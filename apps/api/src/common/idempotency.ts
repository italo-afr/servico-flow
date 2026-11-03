import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { conflict, invalid } from './errors.js';
import type { Tx } from '../db/pool.js';

export function idempotencyKey(req: Request): string | null {
  const k = req.header('idempotency-key');
  if (k === undefined) return null;
  if (!/^[\w-]{8,100}$/.test(k))
    throw invalid('Idempotency-Key inválida (8–100 caracteres: letras, números, - e _).');
  return k;
}

/**
 * Idempotência dentro da MESMA transação do comando (brief 5.7):
 * - INSERT do registro bloqueia requisições concorrentes com a mesma chave até o commit;
 * - repetição com mesma entrada devolve a resposta gravada;
 * - mesma chave com conteúdo diferente → 409.
 */
export async function idempotent<T>(
  tx: Tx,
  scope: {
    organizationId: string;
    actorUserId: string;
    operation: string;
    key: string | null;
    body: unknown;
  },
  fn: () => Promise<T>,
): Promise<T> {
  if (!scope.key) return fn();
  const hash = createHash('sha256')
    .update(JSON.stringify(scope.body ?? null))
    .digest('hex');
  const ins = await tx.query(
    `INSERT INTO idempotency_records (organization_id, actor_user_id, operation, idempotency_key, request_hash)
     VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING RETURNING 1`,
    [scope.organizationId, scope.actorUserId, scope.operation, scope.key, hash],
  );
  if (!ins.rowCount) {
    const r = await tx.query<{ request_hash: string; response: T; expired: boolean }>(
      `SELECT request_hash, response, expires_at < now() AS expired FROM idempotency_records
        WHERE organization_id = $1 AND actor_user_id = $2 AND operation = $3 AND idempotency_key = $4`,
      [scope.organizationId, scope.actorUserId, scope.operation, scope.key],
    );
    const rec = r.rows[0]!;
    if (rec.request_hash !== hash) {
      throw conflict(
        'IDEMPOTENCY_KEY_REUSED',
        'Esta chave de idempotência já foi usada com outro conteúdo.',
      );
    }
    if (!rec.expired) return rec.response;
    throw conflict('IDEMPOTENCY_KEY_EXPIRED', 'Chave de idempotência expirada; gere uma nova.');
  }
  const result = await fn();
  await tx.query(
    `UPDATE idempotency_records SET response = $5, status_code = 201
      WHERE organization_id = $1 AND actor_user_id = $2 AND operation = $3 AND idempotency_key = $4`,
    [scope.organizationId, scope.actorUserId, scope.operation, scope.key, JSON.stringify(result)],
  );
  return result;
}
