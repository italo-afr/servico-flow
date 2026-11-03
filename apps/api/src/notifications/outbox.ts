import { encrypt } from '../common/crypto.js';
import type { Tx } from '../db/pool.js';

export type OutboxEventType =
  | 'invitation.created'
  | 'auth.password_reset'
  | 'quote.sent'
  | 'quote.decided'
  | 'appointment.scheduled';

export interface EnqueueInput {
  organizationId: string | null;
  type: OutboxEventType;
  /** Dados mínimos, sem segredos (ids, e-mail do destinatário). */
  payload: Record<string, unknown>;
  /** Segredo transitório (ex.: link com token) — criptografado e apagado após o envio. */
  secret?: Record<string, string>;
}

/**
 * Registra a intenção de notificar NA MESMA transação da mudança de negócio
 * (brief 11.7). O envio acontece depois, no worker.
 */
export async function enqueue(
  tx: Pick<Tx, 'query'>,
  keyHex: string,
  e: EnqueueInput,
): Promise<string> {
  const r = await tx.query<{ id: string }>(
    `INSERT INTO outbox_events (organization_id, type, payload, payload_encrypted)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [
      e.organizationId,
      e.type,
      e.payload,
      e.secret ? encrypt(JSON.stringify(e.secret), keyHex) : null,
    ],
  );
  return r.rows[0]!.id;
}
