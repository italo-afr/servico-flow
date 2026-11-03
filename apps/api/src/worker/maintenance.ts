import { log } from '../common/logger.js';
import { withTransaction, type Db } from '../db/pool.js';
import { expireQuote } from '../quotes/quotes.service.js';
import type { ObjectStorage } from '../attachments/storage.js';

const LOCK_KEY = 727_002;

/**
 * Tarefas periódicas protegidas por advisory lock: se houver dois workers,
 * só um executa por vez (brief fase 7, item 9). Cada tarefa é idempotente.
 */
export async function runMaintenance(db: Db, storage?: ObjectStorage): Promise<void> {
  const client = await db.connect();
  try {
    const got = await client.query<{ ok: boolean }>('SELECT pg_try_advisory_lock($1) AS ok', [
      LOCK_KEY,
    ]);
    if (!got.rows[0]?.ok) return;
    try {
      for (const task of MAINTENANCE_TASKS) {
        const n = await task.run(client, db, storage);
        if (n) log('info', 'maintenance', { task: task.name, affected: n });
      }
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]);
    }
  } finally {
    client.release();
  }
}

export interface MaintenanceTask {
  name: string;
  run(client: { query: Db['query'] }, db: Db, storage?: ObjectStorage): Promise<number>;
}

export const MAINTENANCE_TASKS: MaintenanceTask[] = [
  {
    // Uploads iniciados e nunca finalizados: remove o objeto bruto e marca como recusado.
    name: 'cleanup_abandoned_uploads',
    async run(c, _db, storage) {
      if (!storage) return 0;
      const r = await c.query<{ id: string; raw_key: string }>(
        `SELECT id, raw_key FROM attachments WHERE status = 'PENDING' AND created_at < now() - interval '1 hour' LIMIT 200`,
      );
      for (const a of r.rows) {
        await storage.delete(a.raw_key);
        await c.query(
          `UPDATE attachments SET status = 'REJECTED', reject_reason = 'abandoned', finalized_at = now() WHERE id = $1`,
          [a.id],
        );
      }
      return r.rows.length;
    },
  },
  {
    // Normaliza orçamentos vencidos (a decisão já verifica a validade por conta própria).
    name: 'expire_quotes',
    async run(c, db) {
      const r = await c.query<{ id: string; organization_id: string }>(
        `SELECT id, organization_id FROM quotes WHERE status = 'SENT' AND expires_at <= now() LIMIT 100`,
      );
      let n = 0;
      for (const q of r.rows) {
        if (await withTransaction(db, (tx) => expireQuote(tx, q.organization_id, q.id))) n++;
      }
      return n;
    },
  },
  {
    name: 'purge_idempotency_and_access_sessions',
    async run(c) {
      const a = await c.query(`DELETE FROM idempotency_records WHERE expires_at < now()`);
      const b = await c.query(
        `DELETE FROM quote_access_sessions WHERE expires_at < now() - interval '1 day'`,
      );
      return (a.rowCount ?? 0) + (b.rowCount ?? 0);
    },
  },
  {
    name: 'purge_expired_sessions',
    async run(c) {
      const r = await c.query(`DELETE FROM "session" WHERE "expiresAt" < now() - interval '1 day'`);
      return r.rowCount ?? 0;
    },
  },
];
