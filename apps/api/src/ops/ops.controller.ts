import { Controller, Get, Inject, Param, ParseIntPipe, Post } from '@nestjs/common';
import { audit } from '../audit/audit.js';
import { conflict } from '../common/errors.js';
import { withTransaction, type Db } from '../db/pool.js';
import { CurrentMember, RequestId, Requires, type Member } from '../identity/context.js';
import { DB } from '../tokens.js';

/** Indicadores definidos explicitamente (brief fase 8, item 2). */
export const DASHBOARD_DEFINITIONS = {
  open: 'Ordens que não estão concluídas nem canceladas.',
  awaitingApproval: 'Ordens com orçamento enviado aguardando decisão do cliente.',
  visitsToday: 'Visitas não canceladas que começam hoje, no fuso da empresa.',
  completed30d: 'Ordens concluídas nos últimos 30 dias.',
  stale3d: 'Ordens em andamento sem nenhum evento na linha do tempo há 3 dias ou mais.',
} as const;

@Controller('organizations/:orgId')
export class OpsController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get('dashboard')
  @Requires('customers.read')
  async dashboard(@CurrentMember() m: Member) {
    const r = await this.db.query(
      `WITH bounds AS (
         SELECT (date_trunc('day', now() AT TIME ZONE $2) AT TIME ZONE $2) AS d0
       )
       SELECT
         (SELECT count(*)::int FROM service_orders WHERE organization_id = $1 AND status NOT IN ('COMPLETED','CANCELLED')) AS open,
         (SELECT count(*)::int FROM service_orders WHERE organization_id = $1 AND status = 'AWAITING_APPROVAL') AS "awaitingApproval",
         (SELECT count(*)::int FROM appointments, bounds WHERE organization_id = $1 AND status <> 'CANCELLED'
             AND starts_at >= d0 AND starts_at < d0 + interval '1 day') AS "visitsToday",
         (SELECT count(*)::int FROM service_orders WHERE organization_id = $1 AND status = 'COMPLETED'
             AND completed_at >= now() - interval '30 days') AS "completed30d",
         (SELECT count(*)::int FROM service_orders so WHERE so.organization_id = $1 AND so.status NOT IN ('COMPLETED','CANCELLED')
             AND (SELECT max(e.created_at) FROM order_events e WHERE e.order_id = so.id) < now() - interval '3 days') AS "stale3d"`,
      [m.organizationId, m.timezone],
    );
    return { metrics: r.rows[0], definitions: DASHBOARD_DEFINITIONS, timezone: m.timezone };
  }

  /** Painel restrito da fila de notificações (brief fase 7, item 10). */
  @Get('ops/outbox')
  @Requires('ops.manage')
  async outbox(@CurrentMember() m: Member) {
    const [counts, oldest, failed, hb] = await Promise.all([
      this.db.query(
        `SELECT status, count(*)::int AS n FROM outbox_events WHERE organization_id = $1 GROUP BY status`,
        [m.organizationId],
      ),
      this.db.query(
        `SELECT extract(epoch FROM now() - min(created_at))::int AS seconds FROM outbox_events
          WHERE organization_id = $1 AND status IN ('PENDING','PROCESSING')`,
        [m.organizationId],
      ),
      this.db.query(
        `SELECT id, type, attempts, last_error AS "lastError", created_at AS "createdAt", payload->>'email' AS recipient
           FROM outbox_events WHERE organization_id = $1 AND status = 'FAILED' ORDER BY id DESC LIMIT 50`,
        [m.organizationId],
      ),
      this.db.query(`SELECT max(last_seen_at) AS "lastSeenAt" FROM worker_heartbeats`),
    ]);
    return {
      counts: Object.fromEntries(counts.rows.map((r) => [r.status, r.n])),
      oldestPendingSeconds: oldest.rows[0]?.seconds ?? null,
      failed: failed.rows,
      workerLastSeenAt: hb.rows[0]?.lastSeenAt ?? null,
      // Limite conhecido: sem callbacks do provedor, "aceito pelo provedor" não prova entrega na caixa.
      deliveryTracking: 'ACCEPTED_BY_PROVIDER_ONLY',
    };
  }

  /** Reprocessamento: ação distinta, só para eventos FALHOS, auditada. */
  @Post('ops/outbox/:id/retry')
  @Requires('ops.manage')
  async retry(
    @CurrentMember() m: Member,
    @Param('id', ParseIntPipe) id: number,
    @RequestId() requestId: string,
  ) {
    return withTransaction(this.db, async (tx) => {
      const r = await tx.query(
        `UPDATE outbox_events SET status = 'PENDING', attempts = 0, available_at = now(), last_error = NULL
          WHERE id = $1 AND organization_id = $2 AND status = 'FAILED' RETURNING id`,
        [id, m.organizationId],
      );
      if (!r.rowCount)
        throw conflict(
          'NOT_RETRYABLE',
          'Somente notificações com falha definitiva podem ser reprocessadas.',
        );
      await audit(tx, {
        organizationId: m.organizationId,
        actorType: 'USER',
        actorUserId: m.userId,
        action: 'outbox.retried',
        resourceType: 'outbox_event',
        resourceId: String(id),
        requestId,
      });
      return { id, status: 'PENDING' };
    });
  }
}
