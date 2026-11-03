import pg from 'pg';

export type Db = pg.Pool;
export type Tx = pg.PoolClient;

// BIGINT (int8) como string evita perda de precisão; COUNT etc. convertidos explicitamente.
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => v);

export function createPool(databaseUrl: string, max: number): Db {
  return new pg.Pool({
    connectionString: databaseUrl,
    max,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 15_000,
    application_name: 'servicoflow',
  });
}

/**
 * Executa `fn` em uma transação. Faz ROLLBACK em qualquer erro.
 * Transações devem ser curtas e nunca incluir chamadas externas (e-mail, storage).
 */
export async function withTransaction<T>(
  db: Db,
  fn: (tx: Tx) => Promise<T>,
  isolation: 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE' = 'READ COMMITTED',
): Promise<T> {
  const client = await db.connect();
  try {
    await client.query(`BEGIN ISOLATION LEVEL ${isolation}`);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
