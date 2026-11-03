import type { Db } from '../db/pool.js';
import type { Member } from '../identity/context.js';

/**
 * Seções extras do detalhe da ordem, registradas pelos módulos (orçamentos, visitas, anexos).
 * Cada loader aplica sua própria regra de visibilidade por papel.
 */
export const orderDetailExtras: Record<
  string,
  (db: Db, m: Member, orderId: string) => Promise<unknown>
> = {};
