import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Db } from './pool.js';

export const MIGRATIONS_DIR =
  process.env.MIGRATIONS_DIR ??
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../database/migrations');

const LOCK_KEY = 727_001; // advisory lock: impede duas execuções simultâneas

/**
 * Aplica arquivos `NNNN_nome.sql` em ordem, cada um em sua transação.
 * Registra checksum; um arquivo já aplicado que mudou interrompe a execução.
 * Somente avança (forward-only); reversão é feita por nova migration (brief 11.6).
 */
export async function migrate(
  db: Db,
  dir = MIGRATIONS_DIR,
  log: (m: string) => void = () => undefined,
): Promise<string[]> {
  const client = await db.connect();
  const applied: string[] = [];
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const done = new Map(
      (
        await client.query<{ name: string; checksum: string }>(
          'SELECT name, checksum FROM schema_migrations',
        )
      ).rows.map((r) => [r.name, r.checksum]),
    );
    const files = (await readdir(dir)).filter((f) => /^\d{4}_[\w-]+\.sql$/.test(f)).sort();
    for (const file of files) {
      const sql = await readFile(path.join(dir, file), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const previous = done.get(file);
      if (previous) {
        if (previous !== checksum) {
          throw new Error(`Migration já aplicada foi alterada: ${file}. Crie uma nova migration.`);
        }
        continue;
      }
      log(`aplicando ${file}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [
          file,
          checksum,
        ]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Falha em ${file}: ${(err as Error).message}`, { cause: err });
      }
      applied.push(file);
    }
    return applied;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => undefined);
    client.release();
  }
}
