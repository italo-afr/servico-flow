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
import { audit } from '../audit/audit.js';
import { invalid, notFound } from '../common/errors.js';
import { ZodPipe } from '../common/http.js';
import { idempotencyKey, idempotent } from '../common/idempotency.js';
import { decodeCursor, pageOf } from '../common/pagination.js';
import { withTransaction, type Db, type Tx } from '../db/pool.js';
import { CurrentMember, RequestId, Requires, type Member } from '../identity/context.js';
import { DB } from '../tokens.js';
import { addOrderEvent } from './events.js';
import { orderDetailExtras } from './detail-extras.js';
import {
  assertVersion,
  lockOrder,
  onOrderCancelled,
  technicianOrderFilter,
  transitionOrder,
  userActor,
} from './service.js';
import { isTerminal, ORDER_STATUSES } from './state.js';

const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;

const createSchema = z.strictObject({
  customerId: z.uuid(),
  addressId: z.uuid(),
  equipmentId: z.uuid(),
  description: z.string().trim().min(3).max(4000),
  priority: z.enum(PRIORITIES).default('NORMAL'),
});
const versionSchema = z.strictObject({ version: z.number().int().positive().optional() });
const updateSchema = z.strictObject({
  version: z.number().int().positive(),
  description: z.string().trim().min(3).max(4000).optional(),
  priority: z.enum(PRIORITIES).optional(),
  triageNotes: z.string().trim().max(4000).optional(),
});
const cancelSchema = z.strictObject({
  version: z.number().int().positive().optional(),
  reason: z.string().trim().min(3, 'Informe o motivo').max(1000),
});
const listSchema = z.object({
  status: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(',') : undefined))
    .pipe(z.array(z.enum(ORDER_STATUSES)).max(8).optional()),
  q: z.string().trim().max(80).optional(),
  technicianId: z.uuid().optional(),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  staleDays: z.coerce.number().int().min(1).max(365).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().max(300).optional(),
});

/** Número sequencial por empresa: UPSERT trava a linha do contador até o commit. */
async function nextOrderNumber(tx: Tx, orgId: string): Promise<number> {
  const r = await tx.query<{ last_number: number }>(
    `INSERT INTO order_counters (organization_id, last_number) VALUES ($1, 1)
     ON CONFLICT (organization_id) DO UPDATE SET last_number = order_counters.last_number + 1
     RETURNING last_number`,
    [orgId],
  );
  return r.rows[0]!.last_number;
}

@Controller('organizations/:orgId/orders')
export class OrdersController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get()
  @Requires('orders.read')
  async list(
    @CurrentMember() m: Member,
    @Query(new ZodPipe(listSchema)) q: z.infer<typeof listSchema>,
  ) {
    const params: unknown[] = [m.organizationId, q.limit + 1];
    const where = ['so.organization_id = $1'];
    const add = (v: unknown) => (params.push(v), `$${params.length}`);
    if (m.role === 'TECHNICIAN') {
      params.push(m.userId);
      where.push(technicianOrderFilter(params.length));
    }
    if (q.status) where.push(`so.status = ANY(${add(q.status)}::text[])`);
    if (q.q) {
      const num = /^#?(\d{1,9})$/.exec(q.q);
      if (num) where.push(`so.number = ${add(Number(num[1]))}`);
      else where.push(`c.name ILIKE ${add(`%${q.q.replace(/[%_\\]/g, '\\$&')}%`)}`);
    }
    if (q.technicianId) where.push(technicianOrderFilter(params.push(q.technicianId)));
    if (q.from) where.push(`so.created_at >= ${add(q.from)}`);
    if (q.to) where.push(`so.created_at < ${add(q.to)}`);
    if (q.staleDays) {
      // Ordens abertas sem evento operacional há N dias (brief 3.5).
      where.push(`so.status NOT IN ('COMPLETED','CANCELLED')`);
      where.push(
        `(SELECT max(e.created_at) FROM order_events e WHERE e.order_id = so.id) < now() - make_interval(days => ${add(q.staleDays)})`,
      );
    }
    const cursor = decodeCursor(q.cursor);
    if (cursor) where.push(`(so.created_at, so.id) < (${add(cursor.t)}, ${add(cursor.id)})`);
    const r = await this.db.query(
      `SELECT so.id, so.number, so.status, so.priority, so.created_at AS "createdAt", so.updated_at AS "updatedAt",
              left(so.description, 140) AS summary, c.name AS "customerName", a.city, a.district,
              e.description AS "equipmentDescription"
         FROM service_orders so
         JOIN customers c ON c.organization_id = so.organization_id AND c.id = so.customer_id
         JOIN service_addresses a ON a.organization_id = so.organization_id AND a.id = so.address_id
         JOIN equipment e ON e.organization_id = so.organization_id AND e.id = so.equipment_id
        WHERE ${where.join(' AND ')}
        ORDER BY so.created_at DESC, so.id DESC LIMIT $2`,
      params,
    );
    return pageOf(r.rows, q.limit);
  }

  @Post()
  @Requires('orders.write')
  async create(
    @Req() req: Request,
    @CurrentMember() m: Member,
    @Body(new ZodPipe(createSchema)) b: z.infer<typeof createSchema>,
    @RequestId() requestId: string,
  ) {
    const key = idempotencyKey(req);
    return withTransaction(this.db, (tx) =>
      idempotent(
        tx,
        {
          organizationId: m.organizationId,
          actorUserId: m.userId,
          operation: 'order.create',
          key,
          body: b,
        },
        async () => {
          // Verificação de aplicação com mensagem clara; a FK composta é a defesa final (T02).
          const ref = await tx.query<{ c: Date | null; a: Date | null; e: Date | null }>(
            `SELECT c.archived_at AS c, a.archived_at AS a, e.archived_at AS e
               FROM customers c
               JOIN service_addresses a ON a.organization_id = c.organization_id AND a.customer_id = c.id AND a.id = $3
               JOIN equipment e ON e.organization_id = c.organization_id AND e.customer_id = c.id AND e.id = $4
              WHERE c.organization_id = $1 AND c.id = $2`,
            [m.organizationId, b.customerId, b.addressId, b.equipmentId],
          );
          const row = ref.rows[0];
          if (!row) {
            throw invalid('Cliente, endereço ou equipamento inválido para esta empresa.', {
              customerId: ['Verifique se endereço e equipamento pertencem a este cliente.'],
            });
          }
          if (row.c || row.a || row.e)
            throw invalid('Cliente, endereço ou equipamento está arquivado.');
          const number = await nextOrderNumber(tx, m.organizationId);
          const r = await tx.query<{ id: string; version: number }>(
            `INSERT INTO service_orders (organization_id, number, customer_id, address_id, equipment_id, description, priority, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, version`,
            [
              m.organizationId,
              number,
              b.customerId,
              b.addressId,
              b.equipmentId,
              b.description,
              b.priority,
              m.userId,
            ],
          );
          const id = r.rows[0]!.id;
          await addOrderEvent(tx, {
            organizationId: m.organizationId,
            orderId: id,
            type: 'order.created',
            actorUserId: m.userId,
            data: { number, priority: b.priority },
          });
          await audit(tx, {
            organizationId: m.organizationId,
            actorType: 'USER',
            actorUserId: m.userId,
            action: 'order.created',
            resourceType: 'service_order',
            resourceId: id,
            requestId,
          });
          return { id, number, status: 'OPEN' as const, version: r.rows[0]!.version };
        },
      ),
    );
  }

  @Get(':id')
  @Requires('orders.read')
  async detail(@CurrentMember() m: Member, @Param('id', ParseUUIDPipe) id: string) {
    const params: unknown[] = [m.organizationId, id];
    let scope = '';
    if (m.role === 'TECHNICIAN') {
      params.push(m.userId);
      scope = ` AND ${technicianOrderFilter(3)}`;
    }
    const r = await this.db.query(
      `SELECT so.id, so.number, so.status, so.priority, so.description, so.triage_notes AS "triageNotes",
              so.cancel_reason AS "cancelReason", so.version, so.created_at AS "createdAt", so.updated_at AS "updatedAt",
              so.completed_at AS "completedAt", so.cancelled_at AS "cancelledAt",
              json_build_object('id', c.id, 'name', c.name, 'phone', c.phone, 'email', c.email) AS customer,
              json_build_object('id', a.id, 'label', a.label, 'street', a.street, 'number', a.number, 'complement', a.complement,
                                'district', a.district, 'city', a.city, 'state', a.state, 'postalCode', a.postal_code,
                                'accessNotes', a.access_notes) AS address,
              json_build_object('id', e.id, 'description', e.description, 'brand', e.brand, 'model', e.model,
                                'capacityBtu', e.capacity_btu, 'serialNumber', e.serial_number) AS equipment,
              u.name AS "assignedName"
         FROM service_orders so
         JOIN customers c ON c.organization_id = so.organization_id AND c.id = so.customer_id
         JOIN service_addresses a ON a.organization_id = so.organization_id AND a.id = so.address_id
         JOIN equipment e ON e.organization_id = so.organization_id AND e.id = so.equipment_id
         LEFT JOIN "user" u ON u.id = so.assigned_user_id
        WHERE so.organization_id = $1 AND so.id = $2${scope}`,
      params,
    );
    const order = r.rows[0];
    if (!order) throw notFound('Ordem');
    if (m.role === 'TECHNICIAN') {
      // Técnico vê o necessário ao trabalho: sem e-mail do cliente nem valores.
      delete order.customer.email;
    }
    // Linha do tempo e seções extras são independentes: consultas em paralelo (OP-02).
    const entries = Object.entries(orderDetailExtras);
    const [events, ...loaded] = await Promise.all([
      this.db.query(
        `SELECT ev.id, ev.type, ev.data, ev.actor_type AS "actorType", u.name AS "actorName", ev.created_at AS "createdAt"
           FROM order_events ev LEFT JOIN "user" u ON u.id = ev.actor_user_id
          WHERE ev.organization_id = $1 AND ev.order_id = $2 ORDER BY ev.id`,
        [m.organizationId, id],
      ),
      ...entries.map(([, load]) => load(this.db, m, id)),
    ]);
    const extras = Object.fromEntries(entries.map(([key], i) => [key, loaded[i]]));
    return { ...order, events: events.rows, ...extras };
  }

  @Post(':id/start-triage')
  @Requires('orders.write')
  async startTriage(
    @CurrentMember() m: Member,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(versionSchema)) b: z.infer<typeof versionSchema>,
    @RequestId() requestId: string,
  ) {
    return withTransaction(this.db, async (tx) => {
      const order = await lockOrder(tx, m.organizationId, id);
      assertVersion(order, b.version);
      const updated = await transitionOrder(tx, order, 'TRIAGE', userActor(m), {
        type: 'order.triage_started',
      });
      await tx.query(
        `UPDATE service_orders SET assigned_user_id = $3 WHERE organization_id = $1 AND id = $2`,
        [m.organizationId, id, m.userId],
      );
      await audit(tx, {
        organizationId: m.organizationId,
        actorType: 'USER',
        actorUserId: m.userId,
        action: 'order.triage_started',
        resourceType: 'service_order',
        resourceId: id,
        requestId,
      });
      return { id, status: updated.status, version: updated.version };
    });
  }

  @Post(':id/update')
  @Requires('orders.write')
  async update(
    @CurrentMember() m: Member,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(updateSchema)) b: z.infer<typeof updateSchema>,
  ) {
    return withTransaction(this.db, async (tx) => {
      const order = await lockOrder(tx, m.organizationId, id);
      assertVersion(order, b.version);
      if (isTerminal(order.status)) throw invalid('Ordem encerrada não pode ser alterada.');
      if (b.description && !['OPEN', 'TRIAGE'].includes(order.status)) {
        throw invalid('A descrição só pode mudar antes do envio do orçamento.');
      }
      const r = await tx.query<{ version: number }>(
        `UPDATE service_orders SET description = coalesce($3, description), priority = coalesce($4, priority),
                triage_notes = coalesce($5, triage_notes), version = version + 1, updated_at = now()
          WHERE organization_id = $1 AND id = $2 RETURNING version`,
        [m.organizationId, id, b.description ?? null, b.priority ?? null, b.triageNotes ?? null],
      );
      await addOrderEvent(tx, {
        organizationId: m.organizationId,
        orderId: id,
        type: 'order.updated',
        actorUserId: m.userId,
        data: { fields: Object.keys(b).filter((k) => k !== 'version') },
      });
      return { id, version: r.rows[0]!.version };
    });
  }

  @Post(':id/cancel')
  @Requires('orders.write')
  async cancel(
    @CurrentMember() m: Member,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(cancelSchema)) b: z.infer<typeof cancelSchema>,
    @RequestId() requestId: string,
  ) {
    return withTransaction(this.db, async (tx) => {
      const order = await lockOrder(tx, m.organizationId, id);
      assertVersion(order, b.version);
      const updated = await transitionOrder(
        tx,
        order,
        'CANCELLED',
        userActor(m),
        { type: 'order.cancelled', data: { reason: b.reason } },
        { cancelReason: b.reason },
      );
      for (const effect of onOrderCancelled) await effect(tx, order, userActor(m));
      await audit(tx, {
        organizationId: m.organizationId,
        actorType: 'USER',
        actorUserId: m.userId,
        action: 'order.cancelled',
        resourceType: 'service_order',
        resourceId: id,
        requestId,
      });
      return { id, status: updated.status, version: updated.version };
    });
  }
}
