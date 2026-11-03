import type { Tx } from '../db/pool.js';

export async function addOrderEvent(
  tx: Pick<Tx, 'query'>,
  e: {
    organizationId: string;
    orderId: string;
    type: string;
    actorType?: 'USER' | 'CUSTOMER_LINK' | 'SYSTEM';
    actorUserId?: string | null;
    data?: Record<string, unknown>;
    visibleToCustomer?: boolean;
  },
): Promise<void> {
  await tx.query(
    `INSERT INTO order_events (organization_id, order_id, type, actor_type, actor_user_id, data, visible_to_customer)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      e.organizationId,
      e.orderId,
      e.type,
      e.actorType ?? 'USER',
      e.actorUserId ?? null,
      e.data ?? {},
      e.visibleToCustomer ?? false,
    ],
  );
}
