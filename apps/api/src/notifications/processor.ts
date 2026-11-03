import { randomUUID } from 'node:crypto';
import type { AppConfig } from '../config.js';
import { decrypt } from '../common/crypto.js';
import { log } from '../common/logger.js';
import type { Db } from '../db/pool.js';
import { PermanentMailError, recipientAllowed, type Mailer } from './mailer.js';
import { render, type OutboxRow } from './templates.js';

export const OUTBOX_POLICY = {
  leaseSeconds: 120,
  sendTimeoutMs: 15_000, // menor que o lease (brief fase 7)
  maxBackoffSeconds: 3600,
  batchSize: 10,
};

/** Backoff exponencial limitado a 1 h, com jitter "full" para espalhar retentativas. */
export function backoffSeconds(attempt: number, random = Math.random): number {
  const cap = Math.min(OUTBOX_POLICY.maxBackoffSeconds, 30 * 2 ** Math.max(0, attempt - 1));
  return Math.max(5, Math.floor(random() * cap));
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout após ${ms} ms`)), ms);
    p.then(
      (v) => (clearTimeout(t), resolve(v)),
      (e) => (clearTimeout(t), reject(e)),
    );
  });
}

export interface ProcessorDeps {
  db: Db;
  config: AppConfig;
  mailer: Mailer;
  workerId?: string;
}

/**
 * Adquire eventos com FOR UPDATE SKIP LOCKED e marca lease (transação curta),
 * depois envia FORA do bloqueio. Leases vencidos (worker que morreu) são retomados.
 */
export async function claim(
  db: Db,
  workerId: string,
  limit = OUTBOX_POLICY.batchSize,
): Promise<OutboxRow[]> {
  const r = await db.query<OutboxRow>(
    `UPDATE outbox_events SET status = 'PROCESSING', lease_owner = $1,
            lease_expires_at = now() + make_interval(secs => $3), attempts = attempts + 1
      WHERE id IN (
        SELECT id FROM outbox_events
         WHERE (status = 'PENDING' AND available_at <= now())
            OR (status = 'PROCESSING' AND lease_expires_at < now())
         ORDER BY available_at, id
         LIMIT $2
         FOR UPDATE SKIP LOCKED)
      RETURNING id, organization_id, type, payload, payload_encrypted, attempts, max_attempts`,
    [workerId, limit, OUTBOX_POLICY.leaseSeconds],
  );
  return r.rows;
}

/** Atualiza o evento somente se este worker ainda detém o lease. */
async function finish(
  db: Db,
  ev: OutboxRow,
  workerId: string,
  sql: string,
  params: unknown[],
): Promise<boolean> {
  const r = await db.query(
    `UPDATE outbox_events SET ${sql} WHERE id = $1 AND lease_owner = $2 AND status = 'PROCESSING'`,
    [ev.id, workerId, ...params],
  );
  return (r.rowCount ?? 0) > 0;
}

export async function processEvent(
  deps: ProcessorDeps,
  ev: OutboxRow,
  workerId: string,
): Promise<string> {
  const { db, config, mailer } = deps;
  let secret: Record<string, string> | null = null;
  try {
    secret = ev.payload_encrypted
      ? JSON.parse(decrypt(ev.payload_encrypted, config.TOKEN_PAYLOAD_ENCRYPTION_KEY))
      : null;
  } catch {
    await finish(
      db,
      ev,
      workerId,
      `status = 'FAILED', last_error = 'decrypt_failed', lease_owner = NULL`,
      [],
    );
    return 'FAILED';
  }
  const rendered = await render(db, ev, secret);
  if (rendered.kind === 'suppress') {
    await finish(
      db,
      ev,
      workerId,
      `status = 'SUPPRESSED', last_error = $3, payload_encrypted = NULL, processed_at = now(), lease_owner = NULL`,
      [rendered.reason],
    );
    return 'SUPPRESSED';
  }
  // Entrega já registrada (ex.: reprocessamento após crash depois do registro): não reenvia.
  const existing = await db.query(
    `SELECT 1 FROM notification_deliveries WHERE outbox_event_id = $1 AND channel = 'EMAIL' AND recipient = $2`,
    [ev.id, rendered.to],
  );
  if (existing.rowCount) {
    await finish(
      db,
      ev,
      workerId,
      `status = 'DONE', payload_encrypted = NULL, processed_at = now(), lease_owner = NULL`,
      [],
    );
    return 'DONE';
  }
  if (!recipientAllowed(config, rendered.to)) {
    await db.query(
      `INSERT INTO notification_deliveries (outbox_event_id, recipient, status) VALUES ($1, $2, 'BLOCKED_BY_POLICY')
       ON CONFLICT DO NOTHING`,
      [ev.id, rendered.to],
    );
    await finish(
      db,
      ev,
      workerId,
      `status = 'SUPPRESSED', last_error = 'recipient_blocked_by_policy', payload_encrypted = NULL, processed_at = now(), lease_owner = NULL`,
      [],
    );
    return 'BLOCKED';
  }
  try {
    const res = await withTimeout(
      mailer.send({ ...rendered, idempotencyKey: `outbox-${ev.id}-email` }),
      OUTBOX_POLICY.sendTimeoutMs,
    );
    // Janela conhecida (T16): se o processo morrer aqui, após o provedor aceitar e antes
    // deste INSERT, o evento será reenviado quando o lease vencer. Ver docs/adr/0006.
    await db.query(
      `INSERT INTO notification_deliveries (outbox_event_id, recipient, status, provider_message_id)
       VALUES ($1, $2, 'ACCEPTED_BY_PROVIDER', $3) ON CONFLICT DO NOTHING`,
      [ev.id, rendered.to, res.providerMessageId],
    );
    await finish(
      db,
      ev,
      workerId,
      `status = 'DONE', payload_encrypted = NULL, processed_at = now(), lease_owner = NULL, last_error = NULL`,
      [],
    );
    return 'DONE';
  } catch (err) {
    const message = (err as Error).message.slice(0, 300);
    if (err instanceof PermanentMailError || ev.attempts >= ev.max_attempts) {
      if (err instanceof PermanentMailError) {
        await db.query(
          `INSERT INTO notification_deliveries (outbox_event_id, recipient, status) VALUES ($1, $2, 'FAILED_PERMANENT') ON CONFLICT DO NOTHING`,
          [ev.id, rendered.to],
        );
      }
      await finish(db, ev, workerId, `status = 'FAILED', last_error = $3, lease_owner = NULL`, [
        message,
      ]);
      log('warn', 'outbox_failed', { eventId: ev.id, type: ev.type, attempts: ev.attempts });
      return 'FAILED';
    }
    const delay = backoffSeconds(ev.attempts);
    await finish(
      db,
      ev,
      workerId,
      `status = 'PENDING', last_error = $3, lease_owner = NULL, lease_expires_at = NULL, available_at = now() + make_interval(secs => $4)`,
      [message, delay],
    );
    return 'RETRY';
  }
}

/** Uma rodada do worker. Retorna os resultados para testes e métricas. */
export async function processOnce(deps: ProcessorDeps): Promise<string[]> {
  const workerId = deps.workerId ?? `worker-${randomUUID()}`;
  const events = await claim(deps.db, workerId);
  const results: string[] = [];
  for (const ev of events) results.push(await processEvent(deps, ev, workerId));
  return results;
}
