import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { decrypt } from '../src/common/crypto.js';
import type { Db } from '../src/db/pool.js';
import { createCustomer, createOrder, fixtures, ORIGIN, type Agent } from './fixtures.js';
import { resetDatabase, startApp, testConfig } from './helpers.js';

const ITEMS = [
  { description: 'Limpeza de dreno', quantity: 1, unitPriceCents: 18000 },
  { description: 'Recarga de gás', quantity: 1, unitPriceCents: 35000 },
];

describe('orçamentos e decisão do cliente (fase 4)', () => {
  let db: Db;
  let app: NestExpressApplication;
  let f: ReturnType<typeof fixtures>;
  let org: string;
  let att: Agent;
  const key = testConfig().TOKEN_PAYLOAD_ENCRYPTION_KEY;

  beforeAll(async () => {
    db = await resetDatabase();
    app = await startApp(db, { AUTH_RATE_LIMIT: 'false' });
    f = fixtures(app, db);
    org = await f.newOrg('Clima Teste');
    att = (await f.member(org, 'ATTENDANT')).agent;
  });
  afterAll(async () => {
    await app.close();
    await db.end();
  });

  const api = (p: string) => `/api/v1/organizations/${org}${p}`;
  const post = (p: string, body: object = {}) => att.post(api(p)).set('Origin', ORIGIN).send(body);

  /** Ordem em triagem com orçamento enviado; devolve o token do link (lido da outbox, como o worker faria). */
  async function sentQuote(discountCents = 3000) {
    const c = await createCustomer(att, org);
    await db.query(`UPDATE customers SET email = 'cliente@example.com' WHERE id = $1`, [c.id]);
    const o = await createOrder(att, org, c);
    await post(`/orders/${o.id}/start-triage`);
    const d = await post(`/orders/${o.id}/quotes`, { items: ITEMS, discountCents });
    expect(d.status).toBe(201);
    const s = await post(`/quotes/${d.body.id}/send`);
    expect(s.status).toBe(201);
    return {
      orderId: o.id,
      customerId: c.id,
      quoteId: d.body.id as string,
      token: await tokenFor(d.body.id),
    };
  }
  async function tokenFor(quoteId: string) {
    const ev = await db.query(
      `SELECT payload_encrypted FROM outbox_events WHERE type = 'quote.sent' AND payload->>'quoteId' = $1 ORDER BY id DESC LIMIT 1`,
      [quoteId],
    );
    return new URL(JSON.parse(decrypt(ev.rows[0].payload_encrypted, key)).link).hash.replace(
      '#token=',
      '',
    );
  }
  /** Cliente: cada chamada é um navegador independente. */
  async function customer(token: string) {
    const agent = request.agent(f.server);
    const r = await agent
      .post('/api/v1/public/quote-access/exchange')
      .set('Origin', ORIGIN)
      .send({ token });
    return { agent, status: r.status };
  }
  const decide = (agent: Agent, decision: 'ACCEPT' | 'REJECT') =>
    agent
      .post('/api/v1/public/quote-access/decision')
      .set('Origin', ORIGIN)
      .send({ decision, confirm: true });
  const orderStatus = async (id: string) =>
    (await db.query(`SELECT status FROM service_orders WHERE id = $1`, [id])).rows[0].status;

  it('T05: total é calculado no servidor; total enviado pelo cliente é rejeitado; desconto > subtotal é 422', async () => {
    const c = await createCustomer(att, org);
    const o = await createOrder(att, org, c);
    await post(`/orders/${o.id}/start-triage`);
    const forged = await post(`/orders/${o.id}/quotes`, { items: ITEMS, totalCents: 1 });
    expect(forged.status).toBe(422);
    const bad = await post(`/orders/${o.id}/quotes`, { items: ITEMS, discountCents: 53001 });
    expect(bad.status).toBe(422);
    const ok = await post(`/orders/${o.id}/quotes`, { items: ITEMS, discountCents: 3000 });
    expect(ok.body).toMatchObject({ subtotalCents: 53000, totalCents: 50000 });
  });

  it('cliente vê a proposta; GET não altera estado; observações internas não aparecem', async () => {
    const q = await sentQuote();
    const { agent, status } = await customer(q.token);
    expect(status).toBe(201);
    for (let i = 0; i < 3; i++) {
      const r = await agent.get('/api/v1/public/quote-access/current');
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({
        status: 'SENT',
        canDecide: true,
        proposal: { totalCents: 50000 },
      });
      expect(JSON.stringify(r.body)).not.toMatch(/triage|email/i);
    }
    expect(await orderStatus(q.orderId)).toBe('AWAITING_APPROVAL');
  });

  it('T06: duas aprovações simultâneas geram uma decisão e um evento comercial', async () => {
    const q = await sentQuote();
    const [a, b] = [await customer(q.token), await customer(q.token)];
    const [r1, r2] = await Promise.all([decide(a.agent, 'ACCEPT'), decide(b.agent, 'ACCEPT')]);
    expect([r1.status, r2.status]).toEqual([201, 201]);
    expect([r1.body.repeated, r2.body.repeated].sort()).toEqual([false, true]);
    const ev = await db.query(
      `SELECT count(*)::int AS n FROM order_events WHERE order_id = $1 AND type = 'quote.accepted'`,
      [q.orderId],
    );
    expect(ev.rows[0].n).toBe(1);
    const ob = await db.query(
      `SELECT count(*)::int AS n FROM outbox_events WHERE type = 'quote.decided' AND payload->>'quoteId' = $1`,
      [q.quoteId],
    );
    expect(ob.rows[0].n).toBe(1);
    expect(await orderStatus(q.orderId)).toBe('APPROVED');
  });

  it('T07: aceite e recusa simultâneos: um vence, o outro recebe 409; aceite seguido de recusa não muda a decisão', async () => {
    const q = await sentQuote();
    const [a, b] = [await customer(q.token), await customer(q.token)];
    const [r1, r2] = await Promise.all([decide(a.agent, 'ACCEPT'), decide(b.agent, 'REJECT')]);
    expect([r1.status, r2.status].sort()).toEqual([201, 409]);
    const final = (await db.query(`SELECT status FROM quotes WHERE id = $1`, [q.quoteId])).rows[0]
      .status;
    const later = await decide(a.agent, final === 'ACCEPTED' ? 'REJECT' : 'ACCEPT');
    expect(later.status).toBe(409);
    expect(
      (await db.query(`SELECT status FROM quotes WHERE id = $1`, [q.quoteId])).rows[0].status,
    ).toBe(final);
  });

  it('T08: revisão concorrente com aceite: nunca aprova a versão revogada', async () => {
    for (let i = 0; i < 5; i++) {
      const q = await sentQuote();
      const c = await customer(q.token);
      const [rev, acc] = await Promise.all([
        post(`/quotes/${q.quoteId}/revise`),
        decide(c.agent, 'ACCEPT'),
      ]);
      const quote = (await db.query(`SELECT status FROM quotes WHERE id = $1`, [q.quoteId])).rows[0]
        .status;
      const status = await orderStatus(q.orderId);
      if (acc.status === 201) {
        // aceite venceu; revisão posterior é permitida (antes da execução) e devolve a ordem à triagem
        expect(quote).toBe('SUPERSEDED');
        expect(rev.status).toBe(201);
        expect(status).toBe('TRIAGE');
      } else {
        expect(acc.status).toBe(409);
        expect(quote).toBe('SUPERSEDED');
        expect(status).toBe('TRIAGE');
      }
      // Em nenhum caso a ordem fica aprovada com a versão substituída.
      expect(status).not.toBe('APPROVED');
    }
  });

  it('T09: link antigo não aprova a nova versão; link revogado não troca contexto', async () => {
    const q = await sentQuote();
    const old = await customer(q.token);
    const rev = await post(`/quotes/${q.quoteId}/revise`);
    expect(rev.status).toBe(201);
    expect((await decide(old.agent, 'ACCEPT')).status).toBe(401); // sessão do link revogado foi apagada
    expect((await customer(q.token)).status).toBe(410);
    const send = await post(`/quotes/${rev.body.draftId}/send`);
    expect(send.status).toBe(201);
    const fresh = await customer(await tokenFor(rev.body.draftId));
    expect((await decide(fresh.agent, 'ACCEPT')).status).toBe(201);
    expect(await orderStatus(q.orderId)).toBe('APPROVED');
  });

  it('T09: orçamento vencido não pode ser aceito mesmo se o job de expiração não rodou', async () => {
    const q = await sentQuote();
    const c = await customer(q.token);
    await db.query(`ALTER TABLE quotes DISABLE TRIGGER quotes_immutable`);
    await db.query(`UPDATE quotes SET expires_at = now() - interval '1 minute' WHERE id = $1`, [
      q.quoteId,
    ]);
    await db.query(`ALTER TABLE quotes ENABLE TRIGGER quotes_immutable`);
    const r = await decide(c.agent, 'ACCEPT');
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('QUOTE_EXPIRED');
    expect(
      (await db.query(`SELECT status FROM quotes WHERE id = $1`, [q.quoteId])).rows[0].status,
    ).toBe('EXPIRED');
    expect(await orderStatus(q.orderId)).toBe('TRIAGE');
  });

  it('snapshot: alterar o cadastro depois do envio não muda a proposta enviada', async () => {
    const q = await sentQuote();
    const cust = await att.get(api(`/customers/${q.customerId}`));
    await post(`/customers/${q.customerId}/update`, {
      version: cust.body.version,
      name: 'Nome Alterado Depois',
    });
    const c = await customer(q.token);
    const r = await c.agent.get('/api/v1/public/quote-access/current');
    expect(r.body.proposal.customer.name).toBe('Padaria Exemplo (fictícia)');
  });

  it('versão enviada é imutável na API e no banco', async () => {
    const q = await sentQuote();
    const upd = await post(`/quotes/${q.quoteId}/update`, {
      rowVersion: 2,
      items: ITEMS,
      discountCents: 0,
    });
    expect(upd.status).toBe(409);
    await expect(
      db.query(`UPDATE quote_items SET unit_price_cents = 1 WHERE quote_id = $1`, [q.quoteId]),
    ).rejects.toMatchObject({
      code: '23514',
    });
    await expect(
      db.query(
        `UPDATE quotes SET total_cents = 1, subtotal_cents = 1, discount_cents = 0 WHERE id = $1`,
        [q.quoteId],
      ),
    ).rejects.toMatchObject({
      code: '23514',
    });
  });

  it('recusa devolve a ordem à triagem (não cancela)', async () => {
    const q = await sentQuote();
    const c = await customer(q.token);
    expect((await decide(c.agent, 'REJECT')).status).toBe(201);
    expect(await orderStatus(q.orderId)).toBe('TRIAGE');
  });

  it('cancelar a ordem revoga o link do orçamento', async () => {
    const q = await sentQuote();
    const c = await customer(q.token);
    expect((await post(`/orders/${q.orderId}/cancel`, { reason: 'Cliente desistiu' })).status).toBe(
      201,
    );
    expect((await decide(c.agent, 'ACCEPT')).status).toBe(401);
    expect((await customer(q.token)).status).toBe(410);
  });

  it('decisão exige confirmação explícita e Origin correto', async () => {
    const q = await sentQuote();
    const c = await customer(q.token);
    const noConfirm = await c.agent
      .post('/api/v1/public/quote-access/decision')
      .set('Origin', ORIGIN)
      .send({ decision: 'ACCEPT' });
    expect(noConfirm.status).toBe(422);
    const csrf = await c.agent
      .post('/api/v1/public/quote-access/decision')
      .set('Origin', 'https://evil.example')
      .send({ decision: 'ACCEPT', confirm: true });
    expect(csrf.status).toBe(403);
  });

  it('técnico não vê valores do orçamento', async () => {
    const tech = (await f.member(org, 'TECHNICIAN')).agent;
    const q = await sentQuote();
    expect((await tech.get(api(`/quotes/${q.quoteId}`))).status).toBe(403);
  });
});
