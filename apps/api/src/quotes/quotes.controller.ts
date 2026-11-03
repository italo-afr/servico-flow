import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { z } from 'zod';
import type { AppConfig } from '../config.js';
import { notFound } from '../common/errors.js';
import { ZodPipe } from '../common/http.js';
import { withTransaction, type Db } from '../db/pool.js';
import { CurrentMember, RequestId, Requires, type Member } from '../identity/context.js';
import { can } from '../identity/policy.js';
import { orderDetailExtras } from '../orders/detail-extras.js';
import { CONFIG, DB } from '../tokens.js';
import { itemSchema, LIMITS } from './money.js';
import { createDraft, reviseQuote, sendQuote, updateDraft } from './quotes.service.js';

const draftSchema = z.strictObject({
  items: z.array(itemSchema).min(1).max(LIMITS.maxItems),
  discountCents: z.number().int().min(0).default(0),
  validDays: z.number().int().min(1).max(60).default(7),
  notes: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => v || null),
});
const updateSchema = draftSchema.extend({ rowVersion: z.number().int().positive() });
const sendSchema = z.strictObject({
  rowVersion: z.number().int().positive().optional(),
  recipientEmail: z.email().max(254).optional(),
});

export async function loadQuotes(db: Pick<Db, 'query'>, orgId: string, orderId: string) {
  const q = await db.query(
    `SELECT id, version, status, subtotal_cents::float8 AS "subtotalCents", discount_cents::float8 AS "discountCents",
            total_cents::float8 AS "totalCents", valid_days AS "validDays", notes, recipient_email AS "recipientEmail",
            sent_at AS "sentAt", expires_at AS "expiresAt", decided_at AS "decidedAt", row_version AS "rowVersion",
            created_at AS "createdAt"
       FROM quotes WHERE organization_id = $1 AND order_id = $2 ORDER BY version DESC`,
    [orgId, orderId],
  );
  const items = await db.query(
    `SELECT quote_id AS "quoteId", position, description, quantity, unit_price_cents::float8 AS "unitPriceCents",
            line_total_cents::float8 AS "lineTotalCents"
       FROM quote_items WHERE organization_id = $1 AND quote_id = ANY($2::uuid[]) ORDER BY position`,
    [orgId, q.rows.map((r) => r.id)],
  );
  return q.rows.map((r) => ({ ...r, items: items.rows.filter((i) => i.quoteId === r.id) }));
}

// Técnico não vê valores por padrão (brief 7.2): a seção só existe para quem pode ler orçamentos.
orderDetailExtras.quotes = async (db, m, orderId) =>
  can(m.role, 'quotes.read') ? loadQuotes(db, m.organizationId, orderId) : undefined;

@Controller('organizations/:orgId')
export class QuotesController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  @Post('orders/:orderId/quotes')
  @Requires('quotes.write')
  create(
    @CurrentMember() m: Member,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body(new ZodPipe(draftSchema)) b: z.infer<typeof draftSchema>,
  ) {
    return withTransaction(this.db, (tx) => createDraft(tx, m, orderId, b));
  }

  @Get('quotes/:id')
  @Requires('quotes.read')
  async get(@CurrentMember() m: Member, @Param('id', ParseUUIDPipe) id: string) {
    const r = await this.db.query(
      `SELECT order_id FROM quotes WHERE organization_id = $1 AND id = $2`,
      [m.organizationId, id],
    );
    if (!r.rows[0]) throw notFound('Orçamento');
    const all = await loadQuotes(this.db, m.organizationId, r.rows[0].order_id);
    return all.find((q) => q.id === id);
  }

  @Post('quotes/:id/update')
  @Requires('quotes.write')
  update(
    @CurrentMember() m: Member,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(updateSchema)) b: z.infer<typeof updateSchema>,
  ) {
    return withTransaction(this.db, (tx) => updateDraft(tx, m, id, b));
  }

  @Post('quotes/:id/send')
  @Requires('quotes.write')
  send(
    @CurrentMember() m: Member,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(sendSchema)) b: z.infer<typeof sendSchema>,
    @RequestId() requestId: string,
  ) {
    return withTransaction(this.db, (tx) => sendQuote(tx, this.config, m, id, b, requestId));
  }

  @Post('quotes/:id/revise')
  @Requires('quotes.write')
  revise(
    @CurrentMember() m: Member,
    @Param('id', ParseUUIDPipe) id: string,
    @RequestId() requestId: string,
  ) {
    return withTransaction(this.db, (tx) => reviseQuote(tx, m, id, requestId));
  }
}
