import { conflict, notFound } from '../common/errors.js';
import type { Tx } from '../db/pool.js';
import type { Member } from '../identity/context.js';
import { addOrderEvent } from './events.js';
import { assertTransition, type OrderStatus } from './state.js';

export interface OrderRow {
  id: string;
  organization_id: string;
  number: number;
  status: OrderStatus;
  version: number;
  customer_id: string;
  address_id: string;
  equipment_id: string;
}

/** Bloqueia a ordem para a transação corrente (serializa comandos sobre a mesma ordem). */
export async function lockOrder(
  tx: Tx,
  organizationId: string,
  orderId: string,
): Promise<OrderRow> {
  const r = await tx.query<OrderRow>(
    `SELECT id, organization_id, number, status, version, customer_id, address_id, equipment_id
       FROM service_orders WHERE organization_id = $1 AND id = $2 FOR UPDATE`,
    [organizationId, orderId],
  );
  if (!r.rows[0]) throw notFound('Ordem');
  return r.rows[0];
}

export function assertVersion(order: OrderRow, expected: number | undefined) {
  if (expected !== undefined && expected !== order.version) {
    throw conflict(
      'VERSION_CONFLICT',
      'A ordem foi alterada por outra pessoa. Recarregue e tente novamente.',
    );
  }
}

export interface Actor {
  type: 'USER' | 'CUSTOMER_LINK' | 'SYSTEM';
  userId: string | null;
}
export const userActor = (m: Member): Actor => ({ type: 'USER', userId: m.userId });

/** Única forma de mudar o estado da ordem: valida a transição e registra o evento. */
export async function transitionOrder(
  tx: Tx,
  order: OrderRow,
  to: OrderStatus,
  actor: Actor,
  event: { type: string; data?: Record<string, unknown>; visibleToCustomer?: boolean },
  extra: { cancelReason?: string } = {},
): Promise<OrderRow> {
  assertTransition(order.status, to);
  const r = await tx.query<OrderRow>(
    `UPDATE service_orders SET status = $3, version = version + 1, updated_at = now(),
            completed_at = CASE WHEN $3 = 'COMPLETED' THEN now() ELSE completed_at END,
            cancelled_at = CASE WHEN $3 = 'CANCELLED' THEN now() ELSE cancelled_at END,
            cancel_reason = coalesce($4, cancel_reason)
      WHERE organization_id = $1 AND id = $2
      RETURNING id, organization_id, number, status, version, customer_id, address_id, equipment_id`,
    [order.organization_id, order.id, to, extra.cancelReason ?? null],
  );
  await addOrderEvent(tx, {
    organizationId: order.organization_id,
    orderId: order.id,
    type: event.type,
    actorType: actor.type,
    actorUserId: actor.userId,
    data: { from: order.status, to, ...event.data },
    visibleToCustomer: event.visibleToCustomer,
  });
  return r.rows[0]!;
}

/**
 * Efeitos do cancelamento registrados por outros módulos (orçamentos revogam links,
 * agenda cancela visitas futuras), executados na mesma transação.
 */
export const onOrderCancelled: ((tx: Tx, order: OrderRow, actor: Actor) => Promise<void>)[] = [];

/**
 * Filtro de visibilidade para técnico: só ordens com visita atribuída a ele.
 * `userParam` é o índice do parâmetro SQL que contém o user_id.
 */
export function technicianOrderFilter(userParam: number, alias = 'so'): string {
  return (
    `EXISTS (SELECT 1 FROM appointments ap WHERE ap.organization_id = ${alias}.organization_id ` +
    `AND ap.order_id = ${alias}.id AND ap.technician_user_id = $` +
    String(userParam) +
    ')'
  );
}
