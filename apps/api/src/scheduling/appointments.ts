import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import type { AppConfig } from '../config.js';
import { audit } from '../audit/audit.js';
import { AppError, conflict, invalid, notFound } from '../common/errors.js';
import { ZodPipe } from '../common/http.js';
import { idempotencyKey, idempotent } from '../common/idempotency.js';
import { withTransaction, type Db, type Tx } from '../db/pool.js';
import { CurrentMember, RequestId, Requires, type Member } from '../identity/context.js';
import { enqueue } from '../notifications/outbox.js';
import { orderDetailExtras } from '../orders/detail-extras.js';
import { addOrderEvent } from '../orders/events.js';
import {
  lockOrder,
  onOrderCancelled,
  transitionOrder,
  userActor,
  type Actor,
} from '../orders/service.js';
import { onQuoteRevised } from '../quotes/quotes.service.js';
import { CONFIG, DB } from '../tokens.js';

type Kind = 'DIAGNOSTIC' | 'EXECUTION';
interface ApptRow {
  id: string;
  organization_id: string;
  order_id: string;
  technician_user_id: string;
  kind: Kind;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  starts_at: Date;
  ends_at: Date;
  version: number;
}

// Instantes sempre com fuso explícito (ISO 8601 com offset); persistidos em UTC.
const instant = z.iso.datetime({ offset: true }).transform((s) => new Date(s));
const createSchema = z
  .strictObject({
    technicianMembershipId: z.uuid(),
    kind: z.enum(['DIAGNOSTIC', 'EXECUTION']),
    startsAt: instant,
    endsAt: instant,
    notes: z.string().trim().max(1000).optional(),
  })
  .refine((v) => v.endsAt > v.startsAt, {
    message: 'Fim deve ser depois do início',
    path: ['endsAt'],
  });
const rescheduleSchema = z
  .strictObject({ version: z.number().int().positive(), startsAt: instant, endsAt: instant })
  .refine((v) => v.endsAt > v.startsAt, {
    message: 'Fim deve ser depois do início',
    path: ['endsAt'],
  });
const cancelSchema = z.strictObject({ reason: z.string().trim().min(3).max(1000) });
const startSchema = z.strictObject({
  actingForOtherReason: z.string().trim().min(5).max(500).optional(),
});
const completeSchema = z.strictObject({
  summary: z.string().trim().min(5, 'Descreva o que foi feito').max(4000),
  actingForOtherReason: z.string().trim().min(5).max(500).optional(),
});
const rangeSchema = z.object({
  from: z.iso.datetime({ offset: true }),
  to: z.iso.datetime({ offset: true }),
  technicianUserId: z.uuid().optional(),
});

const PAST_TOLERANCE_MS = 5 * 60_000;

function rethrowConflict(err: unknown): never {
  const e = err as { code?: string; constraint?: string };
  // Mensagem genérica: não revela cliente nem empresa da outra reserva.
  if (e.code === '23P01')
    throw conflict(
      'SCHEDULE_CONFLICT',
      'O técnico já tem uma visita neste horário. Escolha outro horário ou técnico.',
    );
  if (e.code === '23505' && e.constraint === 'appointments_one_active_execution') {
    throw conflict(
      'EXECUTION_ALREADY_SCHEDULED',
      'Esta ordem já tem uma execução agendada. Reagende a existente.',
    );
  }
  throw err;
}

async function lockAppointment(tx: Tx, orgId: string, id: string): Promise<ApptRow> {
  const r = await tx.query<ApptRow>(
    `SELECT id, organization_id, order_id, technician_user_id, kind, status, starts_at, ends_at, version
       FROM appointments WHERE organization_id = $1 AND id = $2 FOR UPDATE`,
    [orgId, id],
  );
  if (!r.rows[0]) throw notFound('Visita');
  return r.rows[0];
}

/** Cancela visitas ativas da ordem (todas, ou só a execução) e devolve a agenda. */
async function cancelActive(
  tx: Tx,
  orgId: string,
  orderId: string,
  actor: Actor,
  reason: string,
  onlyExecution: boolean,
) {
  const r = await tx.query<{ id: string; kind: string }>(
    `UPDATE appointments SET status = 'CANCELLED', cancel_reason = $3, version = version + 1, updated_at = now()
      WHERE organization_id = $1 AND order_id = $2 AND status IN ('SCHEDULED', 'IN_PROGRESS')
        ${onlyExecution ? "AND kind = 'EXECUTION' AND status = 'SCHEDULED'" : ''}
      RETURNING id, kind`,
    [orgId, orderId, reason],
  );
  for (const a of r.rows) {
    await addOrderEvent(tx, {
      organizationId: orgId,
      orderId,
      type: 'appointment.cancelled',
      actorType: actor.type,
      actorUserId: actor.userId,
      data: { appointmentId: a.id, kind: a.kind, reason },
    });
  }
}
onOrderCancelled.push((tx, order, actor) =>
  cancelActive(tx, order.organization_id, order.id, actor, 'Ordem cancelada', false),
);
// Revisão do orçamento antes da execução cancela a reserva de execução vigente (brief 5.1).
onQuoteRevised.push((tx, order, actor) =>
  cancelActive(tx, order.organization_id, order.id, actor, 'Orçamento revisado', true),
);

const LIST_COLS = `ap.id, ap.order_id AS "orderId", ap.kind, ap.status, ap.starts_at AS "startsAt", ap.ends_at AS "endsAt",
  ap.version, ap.notes, ap.technician_user_id AS "technicianUserId", u.name AS "technicianName", so.number AS "orderNumber"`;

orderDetailExtras.appointments = async (db, m, orderId) => {
  const r = await db.query(
    `SELECT ${LIST_COLS}, er.summary AS "reportSummary"
       FROM appointments ap JOIN "user" u ON u.id = ap.technician_user_id
       JOIN service_orders so ON so.organization_id = ap.organization_id AND so.id = ap.order_id
       LEFT JOIN execution_reports er ON er.appointment_id = ap.id
      WHERE ap.organization_id = $1 AND ap.order_id = $2 ORDER BY ap.starts_at`,
    [m.organizationId, orderId],
  );
  return r.rows;
};

@Controller('organizations/:orgId')
export class AppointmentsController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  @Get('technicians')
  @Requires('appointments.write')
  async technicians(@CurrentMember() m: Member) {
    const r = await this.db.query(
      `SELECT m.id AS "membershipId", u.id AS "userId", u.name, m.role FROM memberships m JOIN "user" u ON u.id = m.user_id
        WHERE m.organization_id = $1 AND m.status = 'ACTIVE' AND m.role IN ('TECHNICIAN', 'ADMIN') ORDER BY m.role DESC, u.name`,
      [m.organizationId],
    );
    return { items: r.rows };
  }

  @Get('appointments')
  @Requires('appointments.read')
  async list(
    @CurrentMember() m: Member,
    @Query(new ZodPipe(rangeSchema)) q: z.infer<typeof rangeSchema>,
  ) {
    const from = new Date(q.from);
    const to = new Date(q.to);
    if (to.getTime() - from.getTime() > 45 * 86_400_000 || to <= from)
      throw invalid('Período inválido (máximo 45 dias).');
    const params: unknown[] = [m.organizationId, from, to];
    let extra = '';
    // Técnico só vê a própria agenda.
    const tech = m.role === 'TECHNICIAN' ? m.userId : q.technicianUserId;
    if (tech) {
      params.push(tech);
      extra = ` AND ap.technician_user_id = $4`;
    }
    const r = await this.db.query(
      `SELECT ${LIST_COLS}, c.name AS "customerName", a.street, a.number AS "streetNumber", a.district, a.city
         FROM appointments ap
         JOIN "user" u ON u.id = ap.technician_user_id
         JOIN service_orders so ON so.organization_id = ap.organization_id AND so.id = ap.order_id
         JOIN customers c ON c.organization_id = so.organization_id AND c.id = so.customer_id
         JOIN service_addresses a ON a.organization_id = so.organization_id AND a.id = so.address_id
        WHERE ap.organization_id = $1 AND ap.period && tstzrange($2, $3, '[)') AND ap.status <> 'CANCELLED'${extra}
        ORDER BY ap.starts_at LIMIT 500`,
      params,
    );
    return { items: r.rows };
  }

  @Post('orders/:orderId/appointments')
  @Requires('appointments.write')
  async create(
    @Req() req: Request,
    @CurrentMember() m: Member,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body(new ZodPipe(createSchema)) b: z.infer<typeof createSchema>,
    @RequestId() requestId: string,
  ) {
    if (b.startsAt.getTime() < Date.now() - PAST_TOLERANCE_MS)
      throw invalid('Não é possível agendar no passado.', { startsAt: ['No passado'] });
    const key = idempotencyKey(req);
    try {
      return await withTransaction(this.db, (tx) =>
        idempotent(
          tx,
          {
            organizationId: m.organizationId,
            actorUserId: m.userId,
            operation: 'appointment.create',
            key,
            body: b,
          },
          async () => {
            const order = await lockOrder(tx, m.organizationId, orderId);
            if (b.kind === 'DIAGNOSTIC' && !['OPEN', 'TRIAGE'].includes(order.status)) {
              throw conflict(
                'INVALID_STATE',
                'Diagnóstico é agendado antes do orçamento (ordem aberta ou em triagem).',
              );
            }
            if (b.kind === 'EXECUTION') {
              if (order.status !== 'APPROVED')
                throw conflict(
                  'QUOTE_NOT_APPROVED',
                  'A execução exige orçamento aprovado pelo cliente.',
                );
              const q = await tx.query(
                `SELECT 1 FROM quotes WHERE order_id = $1 AND status = 'ACCEPTED'`,
                [orderId],
              );
              if (!q.rowCount)
                throw conflict(
                  'QUOTE_NOT_APPROVED',
                  'A execução exige orçamento aprovado e vigente.',
                );
            }
            const tech = await tx.query<{ user_id: string; email: string; name: string }>(
              `SELECT m.user_id, u.email, u.name FROM memberships m JOIN "user" u ON u.id = m.user_id
              WHERE m.organization_id = $1 AND m.id = $2 AND m.status = 'ACTIVE' AND m.role IN ('TECHNICIAN', 'ADMIN')`,
              [m.organizationId, b.technicianMembershipId],
            );
            const t = tech.rows[0];
            if (!t)
              throw invalid('Técnico inválido ou inativo nesta empresa.', {
                technicianMembershipId: ['Inválido'],
              });
            const r = await tx.query<{ id: string; version: number }>(
              `INSERT INTO appointments (organization_id, order_id, technician_user_id, technician_membership_id, kind, starts_at, ends_at, notes, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, version`,
              [
                m.organizationId,
                orderId,
                t.user_id,
                b.technicianMembershipId,
                b.kind,
                b.startsAt,
                b.endsAt,
                b.notes ?? null,
                m.userId,
              ],
            );
            const id = r.rows[0]!.id;
            const data = {
              appointmentId: id,
              kind: b.kind,
              startsAt: b.startsAt,
              endsAt: b.endsAt,
              technician: t.name,
            };
            if (b.kind === 'EXECUTION') {
              await transitionOrder(tx, order, 'SCHEDULED', userActor(m), {
                type: 'appointment.scheduled',
                data,
                visibleToCustomer: true,
              });
            } else {
              await addOrderEvent(tx, {
                organizationId: m.organizationId,
                orderId,
                type: 'appointment.scheduled',
                actorUserId: m.userId,
                data,
              });
            }
            await enqueue(tx, this.config.TOKEN_PAYLOAD_ENCRYPTION_KEY, {
              organizationId: m.organizationId,
              type: 'appointment.scheduled',
              payload: {
                appointmentId: id,
                email: t.email,
                kind: b.kind,
                orderNumber: order.number,
                startsAtLocal: b.startsAt.toLocaleString('pt-BR', {
                  timeZone: m.timezone,
                  dateStyle: 'short',
                  timeStyle: 'short',
                }),
              },
            });
            await audit(tx, {
              organizationId: m.organizationId,
              actorType: 'USER',
              actorUserId: m.userId,
              action: 'appointment.created',
              resourceType: 'appointment',
              resourceId: id,
              requestId,
              metadata: { kind: b.kind },
            });
            return { id, version: r.rows[0]!.version, kind: b.kind };
          },
        ),
      );
    } catch (err) {
      rethrowConflict(err);
    }
  }

  @Post('appointments/:id/reschedule')
  @Requires('appointments.write')
  async reschedule(
    @CurrentMember() m: Member,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(rescheduleSchema)) b: z.infer<typeof rescheduleSchema>,
    @RequestId() requestId: string,
  ) {
    if (b.startsAt.getTime() < Date.now() - PAST_TOLERANCE_MS)
      throw invalid('Não é possível agendar no passado.');
    try {
      return await withTransaction(this.db, async (tx) => {
        const a = await lockAppointment(tx, m.organizationId, id);
        if (a.status !== 'SCHEDULED')
          throw conflict('INVALID_STATE', 'Só visitas agendadas podem ser reagendadas.');
        if (a.version !== b.version)
          throw conflict('VERSION_CONFLICT', 'A visita foi alterada por outra pessoa. Recarregue.');
        // Atualização atômica: a constraint de exclusão valida o novo intervalo na mesma instrução.
        const r = await tx.query<{ version: number }>(
          `UPDATE appointments SET starts_at = $2, ends_at = $3, version = version + 1, updated_at = now() WHERE id = $1 RETURNING version`,
          [id, b.startsAt, b.endsAt],
        );
        await addOrderEvent(tx, {
          organizationId: m.organizationId,
          orderId: a.order_id,
          type: 'appointment.rescheduled',
          actorUserId: m.userId,
          data: {
            appointmentId: id,
            from: { startsAt: a.starts_at, endsAt: a.ends_at },
            to: { startsAt: b.startsAt, endsAt: b.endsAt },
          },
        });
        await audit(tx, {
          organizationId: m.organizationId,
          actorType: 'USER',
          actorUserId: m.userId,
          action: 'appointment.rescheduled',
          resourceType: 'appointment',
          resourceId: id,
          requestId,
        });
        return { id, version: r.rows[0]!.version };
      });
    } catch (err) {
      rethrowConflict(err);
    }
  }

  @Post('appointments/:id/cancel')
  @Requires('appointments.write')
  async cancel(
    @CurrentMember() m: Member,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(cancelSchema)) b: z.infer<typeof cancelSchema>,
    @RequestId() requestId: string,
  ) {
    return withTransaction(this.db, async (tx) => {
      const a = await lockAppointment(tx, m.organizationId, id);
      if (a.status !== 'SCHEDULED')
        throw conflict('INVALID_STATE', 'Só visitas agendadas podem ser canceladas.');
      const order = await lockOrder(tx, m.organizationId, a.order_id);
      await tx.query(
        `UPDATE appointments SET status = 'CANCELLED', cancel_reason = $2, version = version + 1, updated_at = now() WHERE id = $1`,
        [id, b.reason],
      );
      const data = { appointmentId: id, kind: a.kind, reason: b.reason };
      if (a.kind === 'EXECUTION' && order.status === 'SCHEDULED') {
        await transitionOrder(tx, order, 'APPROVED', userActor(m), {
          type: 'appointment.cancelled',
          data,
        });
      } else {
        await addOrderEvent(tx, {
          organizationId: m.organizationId,
          orderId: a.order_id,
          type: 'appointment.cancelled',
          actorUserId: m.userId,
          data,
        });
      }
      await audit(tx, {
        organizationId: m.organizationId,
        actorType: 'USER',
        actorUserId: m.userId,
        action: 'appointment.cancelled',
        resourceType: 'appointment',
        resourceId: id,
        requestId,
      });
      return { id, status: 'CANCELLED' };
    });
  }

  /** Técnico opera só as próprias visitas; administrador pode atuar por outro com justificativa. */
  private assertExecutor(m: Member, a: ApptRow, reason: string | undefined) {
    if (a.technician_user_id === m.userId) return;
    if (m.role === 'ADMIN') {
      if (!reason)
        throw invalid('Informe a justificativa para atuar pela visita de outro técnico.', {
          actingForOtherReason: ['Obrigatório'],
        });
      return;
    }
    throw notFound('Visita'); // técnico não atribuído: não revela a visita (T03)
  }

  @Post('appointments/:id/start')
  @Requires('visits.execute')
  async start(
    @CurrentMember() m: Member,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(startSchema)) b: z.infer<typeof startSchema>,
    @RequestId() requestId: string,
  ) {
    return withTransaction(this.db, async (tx) => {
      const a = await lockAppointment(tx, m.organizationId, id);
      this.assertExecutor(m, a, b.actingForOtherReason);
      if (a.status === 'IN_PROGRESS') return { id, status: 'IN_PROGRESS', repeated: true };
      if (a.status !== 'SCHEDULED')
        throw conflict('INVALID_STATE', 'Esta visita não pode ser iniciada.');
      const order = await lockOrder(tx, m.organizationId, a.order_id);
      if (a.kind === 'EXECUTION' && order.status !== 'SCHEDULED')
        throw conflict('INVALID_STATE', 'A ordem não está agendada para execução.');
      await tx.query(
        `UPDATE appointments SET status = 'IN_PROGRESS', started_at = now(), version = version + 1, updated_at = now() WHERE id = $1`,
        [id],
      );
      const data = {
        appointmentId: id,
        kind: a.kind,
        actingForOther: b.actingForOtherReason ?? null,
      };
      if (a.kind === 'EXECUTION')
        await transitionOrder(tx, order, 'IN_PROGRESS', userActor(m), {
          type: 'appointment.started',
          data,
        });
      else
        await addOrderEvent(tx, {
          organizationId: m.organizationId,
          orderId: a.order_id,
          type: 'appointment.started',
          actorUserId: m.userId,
          data,
        });
      await audit(tx, {
        organizationId: m.organizationId,
        actorType: 'USER',
        actorUserId: m.userId,
        action: 'appointment.started',
        resourceType: 'appointment',
        resourceId: id,
        requestId,
        metadata: { actingForOther: !!b.actingForOtherReason },
      });
      return { id, status: 'IN_PROGRESS', repeated: false };
    });
  }

  @Post('appointments/:id/complete')
  @Requires('visits.execute')
  async complete(
    @CurrentMember() m: Member,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(completeSchema)) b: z.infer<typeof completeSchema>,
    @RequestId() requestId: string,
  ) {
    return withTransaction(this.db, async (tx) => {
      const a = await lockAppointment(tx, m.organizationId, id);
      this.assertExecutor(m, a, b.actingForOtherReason);
      if (a.status === 'COMPLETED')
        throw conflict('ALREADY_COMPLETED', 'Esta visita já foi concluída.');
      if (a.status !== 'IN_PROGRESS')
        throw conflict('INVALID_STATE', 'Inicie a visita antes de concluí-la.');
      const order = await lockOrder(tx, m.organizationId, a.order_id);
      await tx.query(
        `UPDATE appointments SET status = 'COMPLETED', completed_at = now(), version = version + 1, updated_at = now() WHERE id = $1`,
        [id],
      );
      await tx.query(
        `INSERT INTO execution_reports (organization_id, appointment_id, author_user_id, summary, acted_for_other_reason) VALUES ($1,$2,$3,$4,$5)`,
        [m.organizationId, id, m.userId, b.summary, b.actingForOtherReason ?? null],
      );
      const data = { appointmentId: id, kind: a.kind };
      if (a.kind === 'EXECUTION') {
        if (order.status !== 'IN_PROGRESS')
          throw new AppError(409, 'INVALID_STATE', 'A ordem não está em execução.');
        await transitionOrder(tx, order, 'COMPLETED', userActor(m), {
          type: 'order.completed',
          data,
          visibleToCustomer: true,
        });
      } else {
        // Diagnóstico registra achados; a ordem continua aberta para orçamento (brief 4.4).
        await addOrderEvent(tx, {
          organizationId: m.organizationId,
          orderId: a.order_id,
          type: 'appointment.completed',
          actorUserId: m.userId,
          data,
        });
      }
      await audit(tx, {
        organizationId: m.organizationId,
        actorType: 'USER',
        actorUserId: m.userId,
        action: 'appointment.completed',
        resourceType: 'appointment',
        resourceId: id,
        requestId,
      });
      return { id, status: 'COMPLETED' };
    });
  }
}
