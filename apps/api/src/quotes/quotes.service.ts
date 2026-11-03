import { randomUUID } from 'node:crypto';
import type { AppConfig } from '../config.js';
import { audit } from '../audit/audit.js';
import { randomToken, sha256 } from '../common/crypto.js';
import { conflict, invalid, notFound } from '../common/errors.js';
import type { Tx } from '../db/pool.js';
import type { Member } from '../identity/context.js';
import { enqueue } from '../notifications/outbox.js';
import { addOrderEvent } from '../orders/events.js';
import {
  lockOrder,
  onOrderCancelled,
  transitionOrder,
  userActor,
  type Actor,
  type OrderRow,
} from '../orders/service.js';
import { computeTotals, type QuoteItemInput } from './money.js';

export type QuoteStatus =
  'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'SUPERSEDED' | 'CANCELLED';

export interface QuoteRow {
  id: string;
  organization_id: string;
  order_id: string;
  version: number;
  status: QuoteStatus;
  total_cents: string;
  expires_at: Date | null;
  row_version: number;
  valid_days: number;
}

const QUOTE_COLS =
  'id, organization_id, order_id, version, status, total_cents, expires_at, row_version, valid_days';

export async function lockQuote(tx: Tx, orgId: string, quoteId: string): Promise<QuoteRow> {
  const r = await tx.query<QuoteRow>(
    `SELECT ${QUOTE_COLS} FROM quotes WHERE organization_id = $1 AND id = $2 FOR UPDATE`,
    [orgId, quoteId],
  );
  if (!r.rows[0]) throw notFound('Orçamento');
  return r.rows[0];
}

/** Efeitos de revisão registrados por outros módulos (agenda cancela a reserva de execução). */
export const onQuoteRevised: ((tx: Tx, order: OrderRow, actor: Actor) => Promise<void>)[] = [];

async function writeItems(
  tx: Tx,
  orgId: string,
  quoteId: string,
  items: QuoteItemInput[],
  discountCents: number,
) {
  const t = computeTotals(items, discountCents);
  await tx.query(`DELETE FROM quote_items WHERE quote_id = $1`, [quoteId]);
  for (const it of t.items) {
    await tx.query(
      `INSERT INTO quote_items (organization_id, quote_id, position, description, quantity, unit_price_cents, line_total_cents)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        orgId,
        quoteId,
        it.position,
        it.description,
        it.quantity,
        it.unitPriceCents,
        it.lineTotalCents,
      ],
    );
  }
  return t;
}

export async function createDraft(
  tx: Tx,
  m: Member,
  orderId: string,
  input: {
    items: QuoteItemInput[];
    discountCents: number;
    validDays: number;
    notes: string | null;
  },
) {
  const order = await lockOrder(tx, m.organizationId, orderId);
  if (order.status !== 'TRIAGE') {
    throw conflict(
      'INVALID_STATE',
      'Orçamentos são elaborados durante a triagem. Para alterar um orçamento enviado, use “Revisar”.',
    );
  }
  const open = await tx.query(
    `SELECT id FROM quotes WHERE order_id = $1 AND status IN ('DRAFT','SENT')`,
    [orderId],
  );
  if (open.rows[0]) throw conflict('DRAFT_EXISTS', 'Já existe um rascunho para esta ordem.');
  const v = await tx.query<{ n: number }>(
    `SELECT coalesce(max(version), 0) + 1 AS n FROM quotes WHERE order_id = $1`,
    [orderId],
  );
  const t = computeTotals(input.items, input.discountCents);
  const q = await tx.query<{ id: string }>(
    `INSERT INTO quotes (organization_id, order_id, version, subtotal_cents, discount_cents, total_cents, valid_days, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [
      m.organizationId,
      orderId,
      v.rows[0]!.n,
      t.subtotalCents,
      t.discountCents,
      t.totalCents,
      input.validDays,
      input.notes,
      m.userId,
    ],
  );
  const id = q.rows[0]!.id;
  await writeItems(tx, m.organizationId, id, input.items, input.discountCents);
  return { id, version: v.rows[0]!.n, ...t };
}

export async function updateDraft(
  tx: Tx,
  m: Member,
  quoteId: string,
  input: {
    rowVersion: number;
    items: QuoteItemInput[];
    discountCents: number;
    validDays: number;
    notes: string | null;
  },
) {
  const q = await lockQuote(tx, m.organizationId, quoteId);
  if (q.status !== 'DRAFT')
    throw conflict('QUOTE_IMMUTABLE', 'Orçamento enviado não pode ser alterado; use “Revisar”.');
  if (q.row_version !== input.rowVersion)
    throw conflict('VERSION_CONFLICT', 'O rascunho foi alterado por outra pessoa. Recarregue.');
  const t = await writeItems(tx, m.organizationId, quoteId, input.items, input.discountCents);
  const r = await tx.query<{ row_version: number }>(
    `UPDATE quotes SET subtotal_cents = $2, discount_cents = $3, total_cents = $4, valid_days = $5, notes = $6,
            row_version = row_version + 1, updated_at = now() WHERE id = $1 RETURNING row_version`,
    [quoteId, t.subtotalCents, t.discountCents, t.totalCents, input.validDays, input.notes],
  );
  return { id: quoteId, rowVersion: r.rows[0]!.row_version, ...t };
}

/** Congela a versão (snapshot), cria o token do link e registra o envio na outbox. */
export async function sendQuote(
  tx: Tx,
  config: AppConfig,
  m: Member,
  quoteId: string,
  input: { rowVersion?: number; recipientEmail?: string },
  requestId: string,
) {
  const q = await lockQuote(tx, m.organizationId, quoteId);
  const order = await lockOrder(tx, m.organizationId, q.order_id);
  if (q.status !== 'DRAFT') throw conflict('QUOTE_ALREADY_SENT', 'Este orçamento já foi enviado.');
  if (input.rowVersion !== undefined && input.rowVersion !== q.row_version) {
    throw conflict(
      'VERSION_CONFLICT',
      'O rascunho foi alterado por outra pessoa. Revise antes de enviar.',
    );
  }
  const ctx = await tx.query(
    `SELECT o.name AS org_name, o.timezone, o.contact_phone, so.number, so.description,
            c.name AS customer_name, c.email AS customer_email,
            a.street, a.number AS street_number, a.complement, a.district, a.city, a.state,
            e.description AS equipment, e.brand, e.model
       FROM service_orders so
       JOIN organizations o ON o.id = so.organization_id
       JOIN customers c ON c.organization_id = so.organization_id AND c.id = so.customer_id
       JOIN service_addresses a ON a.organization_id = so.organization_id AND a.id = so.address_id
       JOIN equipment e ON e.organization_id = so.organization_id AND e.id = so.equipment_id
      WHERE so.organization_id = $1 AND so.id = $2`,
    [m.organizationId, q.order_id],
  );
  const c = ctx.rows[0];
  const recipient = (input.recipientEmail ?? c.customer_email ?? '').toLowerCase();
  if (!recipient) {
    throw invalid('Informe o e-mail do cliente para enviar o orçamento.', {
      recipientEmail: ['Obrigatório'],
    });
  }
  const items = await tx.query(
    `SELECT description, quantity, unit_price_cents::bigint AS "unitPriceCents", line_total_cents AS "lineTotalCents"
       FROM quote_items WHERE quote_id = $1 ORDER BY position`,
    [quoteId],
  );
  if (!items.rowCount) throw invalid('Inclua pelo menos um item antes de enviar.');
  const totals = await tx.query(
    `SELECT subtotal_cents, discount_cents, total_cents, notes FROM quotes WHERE id = $1`,
    [quoteId],
  );
  const tq = totals.rows[0];
  const expires = await tx.query<{ expires_at: Date }>(
    `SELECT now() + make_interval(days => $1) AS expires_at`,
    [q.valid_days],
  );
  const expiresAt = expires.rows[0]!.expires_at;
  // Snapshot: o acordo enviado não muda se o cadastro mudar depois (brief 5.2).
  const snapshot = {
    organization: { name: c.org_name, phone: c.contact_phone },
    order: { number: c.number, description: c.description },
    customer: { name: c.customer_name },
    address: {
      street: c.street,
      number: c.street_number,
      complement: c.complement,
      district: c.district,
      city: c.city,
      state: c.state,
    },
    equipment: { description: c.equipment, brand: c.brand, model: c.model },
    items: items.rows.map((i) => ({
      ...i,
      unitPriceCents: Number(i.unitPriceCents),
      lineTotalCents: Number(i.lineTotalCents),
    })),
    subtotalCents: Number(tq.subtotal_cents),
    discountCents: Number(tq.discount_cents),
    totalCents: Number(tq.total_cents),
    notes: tq.notes,
    version: q.version,
    currency: 'BRL',
    timezone: c.timezone,
  };
  await tx.query(
    `UPDATE quotes SET status = 'SENT', snapshot = $2, sent_at = now(), expires_at = $3, recipient_email = $4,
            correlation_id = $5, row_version = row_version + 1, updated_at = now() WHERE id = $1`,
    [quoteId, snapshot, expiresAt, recipient, randomUUID()],
  );
  const token = randomToken();
  await tx.query(
    `INSERT INTO decision_tokens (organization_id, quote_id, token_hash, expires_at) VALUES ($1,$2,$3,$4)`,
    [m.organizationId, quoteId, sha256(token), expiresAt],
  );
  const updated = await transitionOrder(tx, order, 'AWAITING_APPROVAL', userActor(m), {
    type: 'quote.sent',
    data: { quoteId, version: q.version, totalCents: snapshot.totalCents },
    visibleToCustomer: true,
  });
  await enqueue(tx, config.TOKEN_PAYLOAD_ENCRYPTION_KEY, {
    organizationId: m.organizationId,
    type: 'quote.sent',
    payload: { quoteId, email: recipient },
    secret: { link: `${config.PUBLIC_APP_URL}/orcamento#token=${token}` },
  });
  await audit(tx, {
    organizationId: m.organizationId,
    actorType: 'USER',
    actorUserId: m.userId,
    action: 'quote.sent',
    resourceType: 'quote',
    resourceId: quoteId,
    requestId,
    metadata: { version: q.version, totalCents: snapshot.totalCents },
  });
  // O token NÃO é devolvido: segue apenas pelo e-mail (brief fase 4, item 8).
  return { id: quoteId, status: 'SENT' as const, expiresAt, orderStatus: updated.status };
}

async function revokeTokens(tx: Tx, quoteId: string) {
  await tx.query(
    `UPDATE decision_tokens SET revoked_at = now() WHERE quote_id = $1 AND revoked_at IS NULL`,
    [quoteId],
  );
  await tx.query(`DELETE FROM quote_access_sessions WHERE quote_id = $1`, [quoteId]);
}

/**
 * Revisão: invalida a versão vigente, revoga links, cancela a reserva de execução
 * (via hooks) e abre um rascunho N+1 — tudo na mesma transação (brief 5.1).
 */
export async function reviseQuote(tx: Tx, m: Member, quoteId: string, requestId: string) {
  const q = await lockQuote(tx, m.organizationId, quoteId);
  const order = await lockOrder(tx, m.organizationId, q.order_id);
  if (!['SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'].includes(q.status)) {
    throw conflict(
      'INVALID_STATE',
      'Somente orçamentos enviados ou decididos podem ser revisados.',
    );
  }
  if (
    order.status === 'IN_PROGRESS' ||
    order.status === 'COMPLETED' ||
    order.status === 'CANCELLED'
  ) {
    throw conflict(
      'INVALID_STATE',
      'Não é possível revisar depois do início da execução. Abra uma nova ordem para serviço adicional.',
    );
  }
  const open = await tx.query(`SELECT id FROM quotes WHERE order_id = $1 AND status = 'DRAFT'`, [
    q.order_id,
  ]);
  if (open.rows[0]) throw conflict('DRAFT_EXISTS', 'Já existe um rascunho para esta ordem.');
  if (q.status === 'SENT' || q.status === 'ACCEPTED') {
    await tx.query(`UPDATE quotes SET status = 'SUPERSEDED', updated_at = now() WHERE id = $1`, [
      quoteId,
    ]);
  }
  await revokeTokens(tx, quoteId);
  let current = order;
  if (order.status !== 'TRIAGE') {
    for (const hook of onQuoteRevised) await hook(tx, order, userActor(m));
    current = await lockOrder(tx, m.organizationId, q.order_id);
    current = await transitionOrder(tx, current, 'TRIAGE', userActor(m), {
      type: 'quote.revised',
      data: { quoteId, version: q.version },
    });
  } else {
    await addOrderEvent(tx, {
      organizationId: m.organizationId,
      orderId: q.order_id,
      type: 'quote.revised',
      actorUserId: m.userId,
      data: { quoteId, version: q.version },
    });
  }
  // Novo rascunho copiando os itens da versão anterior.
  const items = await tx.query(
    `SELECT description, quantity, unit_price_cents FROM quote_items WHERE quote_id = $1 ORDER BY position`,
    [quoteId],
  );
  const prev = await tx.query(
    `SELECT discount_cents, valid_days, notes FROM quotes WHERE id = $1`,
    [quoteId],
  );
  const draft = await createDraft(tx, m, q.order_id, {
    items: items.rows.map((i) => ({
      description: i.description,
      quantity: i.quantity,
      unitPriceCents: Number(i.unit_price_cents),
    })),
    discountCents: Number(prev.rows[0].discount_cents),
    validDays: prev.rows[0].valid_days,
    notes: prev.rows[0].notes,
  });
  await audit(tx, {
    organizationId: m.organizationId,
    actorType: 'USER',
    actorUserId: m.userId,
    action: 'quote.revised',
    resourceType: 'quote',
    resourceId: quoteId,
    requestId,
    metadata: { newQuoteId: draft.id },
  });
  return {
    previousId: quoteId,
    draftId: draft.id,
    version: draft.version,
    orderStatus: current.status,
  };
}

// Cancelar a ordem invalida orçamentos abertos e links (brief 5.1).
onOrderCancelled.push(async (tx, order) => {
  const r = await tx.query<{ id: string }>(
    `UPDATE quotes SET status = 'CANCELLED', updated_at = now()
      WHERE order_id = $1 AND status IN ('DRAFT', 'SENT') RETURNING id`,
    [order.id],
  );
  for (const q of r.rows) await revokeTokens(tx, q.id);
});

/**
 * Expira orçamentos vencidos e devolve a ordem à triagem. Idempotente; também é
 * verificado no momento da decisão, então atraso deste job não permite aceitar vencido.
 */
export async function expireQuote(tx: Tx, orgId: string, quoteId: string): Promise<boolean> {
  const q = await lockQuote(tx, orgId, quoteId);
  if (q.status !== 'SENT' || !q.expires_at || q.expires_at > new Date()) return false;
  await tx.query(`UPDATE quotes SET status = 'EXPIRED', updated_at = now() WHERE id = $1`, [
    quoteId,
  ]);
  await revokeTokens(tx, quoteId);
  const order = await lockOrder(tx, orgId, q.order_id);
  if (order.status === 'AWAITING_APPROVAL') {
    await transitionOrder(
      tx,
      order,
      'TRIAGE',
      { type: 'SYSTEM', userId: null },
      {
        type: 'quote.expired',
        data: { quoteId, version: q.version },
        visibleToCustomer: true,
      },
    );
  }
  return true;
}
