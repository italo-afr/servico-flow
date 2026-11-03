import { log } from '../common/logger.js';
import type { Db } from '../db/pool.js';

const LOCK_KEY = 727_002;

/**
 * Tarefas periódicas protegidas por advisory lock: se houver dois workers,
 * só um executa por vez (brief fase 7, item 9). Cada tarefa é idempotente.
 */
export async function runMaintenance(db: Db): Promise<void> {
  const client = await db.connect();
  try {
    const got = await client.query<{ ok: boolean }>('SELECT pg_try_advisory_lock($1) AS ok', [
      LOCK_KEY,
    ]);
    if (!got.rows[0]?.ok) return;
    try {
      for (const task of MAINTENANCE_TASKS) {
        const n = await task.run(client);
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
  run(client: { query: Db['query'] }): Promise<number>;
}

export const MAINTENANCE_TASKS: MaintenanceTask[] = [
  {
    name: 'purge_expired_idempotency_and_sessions',
    async run(c) {
      const r = await c.query(`DELETE FROM "session" WHERE "expiresAt" < now() - interval '1 day'`);
      return r.rowCount ?? 0;
    },
  },
];
