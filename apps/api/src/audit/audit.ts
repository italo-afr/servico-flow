import type { Tx } from '../db/pool.js';

export interface AuditEntry {
  organizationId: string | null;
  actorType: 'USER' | 'CUSTOMER_LINK' | 'SYSTEM';
  actorUserId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  outcome?: 'SUCCESS' | 'DENIED' | 'FAILED';
  requestId?: string | null;
  /** Apenas identificadores e campos não sensíveis; nunca tokens ou cadastros completos. */
  metadata?: Record<string, unknown>;
}

export async function audit(tx: Pick<Tx, 'query'>, e: AuditEntry): Promise<void> {
  await tx.query(
    `INSERT INTO audit_events (organization_id, actor_type, actor_user_id, action, resource_type, resource_id, outcome, request_id, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      e.organizationId,
      e.actorType,
      e.actorUserId ?? null,
      e.action,
      e.resourceType,
      e.resourceId ?? null,
      e.outcome ?? 'SUCCESS',
      e.requestId ?? null,
      e.metadata ?? {},
    ],
  );
}
