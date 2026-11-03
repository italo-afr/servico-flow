import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { decrypt } from '../src/common/crypto.js';
import type { Db } from '../src/db/pool.js';
import { createCustomer, createOrder, fixtures, ORIGIN, type Agent } from './fixtures.js';
import { resetDatabase, startApp, testConfig } from './helpers.js';

const H = 3_600_000;
/** Horários no futuro, alinhados à hora, para não depender do relógio do teste. */
const base = Math.ceil(Date.now() / H) * H + 48 * H;
let slotSeq = 0;
const slot = (startH: number, endH: number, day = 0) => ({
  startsAt: new Date(base + (day * 24 + startH) * H).toISOString(),
  endsAt: new Date(base + (day * 24 + endH) * H).toISOString(),
});

describe('agenda, diagnóstico e execução (fases 5 e 6)', () => {
  let db: Db;
  let app: NestExpressApplication;
  let f: ReturnType<typeof fixtures>;
  let org: string;
  let orgB: string;
  let att: Agent;
  let attB: Agent;
  let tech: Awaited<ReturnType<ReturnType<typeof fixtures>['member']>>;
  let tech2: Awaited<ReturnType<ReturnType<typeof fixtures>['member']>>;
  let admin: Agent;
  const key = testConfig().TOKEN_PAYLOAD_ENCRYPTION_KEY;

  beforeAll(async () => {
    db = await resetDatabase();
    app = await startApp(db, { AUTH_RATE_LIMIT: 'false' });
    f = fixtures(app, db);
    org = await f.newOrg('Clima Agenda');
    orgB = await f.newOrg('Outra Empresa');
    att = (await f.member(org, 'ATTENDANT')).agent;
    attB = (await f.member(orgB, 'ATTENDANT')).agent;
    admin = (await f.member(org, 'ADMIN')).agent;
    tech = await f.member(org, 'TECHNICIAN');
    tech2 = await f.member(org, 'TECHNICIAN');
  });
  afterAll(async () => {
    await app.close();
    await db.end();
  });

  const api = (p: string, o = org) => `/api/v1/organizations/${o}${p}`;
  const post = (agent: Agent, p: string, body: object = {}, o = org) =>
    agent.post(api(p, o)).set('Origin', ORIGIN).send(body);

  async function triageOrder(agent = att, o = org) {
    const c = await createCustomer(agent, o);
    const ord = await createOrder(agent, o, c);
    await post(agent, `/orders/${ord.id}/start-triage`, {}, o);
    return { ...ord, customerId: c.id };
  }
  async function approvedOrder() {
    const o = await triageOrder();
    await db.query(`UPDATE customers SET email = 'cliente@example.com' WHERE id = $1`, [
      o.customerId,
    ]);
    const d = await post(att, `/orders/${o.id}/quotes`, {
      items: [{ description: 'Serviço', quantity: 1, unitPriceCents: 10000 }],
    });
    await post(att, `/quotes/${d.body.id}/send`);
    const ev = await db.query(
      `SELECT payload_encrypted FROM outbox_events WHERE type = 'quote.sent' AND payload->>'quoteId' = $1`,
      [d.body.id],
    );
    const token = new URL(JSON.parse(decrypt(ev.rows[0].payload_encrypted, key)).link).hash.replace(
      '#token=',
      '',
    );
    const c = request.agent(f.server);
    await c.post('/api/v1/public/quote-access/exchange').set('Origin', ORIGIN).send({ token });
    const r = await c
      .post('/api/v1/public/quote-access/decision')
      .set('Origin', ORIGIN)
      .send({ decision: 'ACCEPT', confirm: true });
    expect(r.status).toBe(201);
    return { ...o, quoteId: d.body.id as string };
  }
  const book = (
    orderId: string,
    kind: 'DIAGNOSTIC' | 'EXECUTION',
    s: { startsAt: string; endsAt: string },
    membershipId = tech.membershipId,
  ) =>
    post(att, `/orders/${orderId}/appointments`, {
      technicianMembershipId: membershipId,
      kind,
      ...s,
    });
  const orderStatus = async (id: string) =>
    (await db.query(`SELECT status FROM service_orders WHERE id = $1`, [id])).rows[0].status;

  it('diagnóstico pode ser agendado na triagem e não muda a ordem para SCHEDULED; execução exige aprovação', async () => {
    const o = await triageOrder();
    const d = await book(o.id, 'DIAGNOSTIC', slot(8, 9, slotSeq++));
    expect(d.status).toBe(201);
    expect(await orderStatus(o.id)).toBe('TRIAGE');
    const e = await book(o.id, 'EXECUTION', slot(10, 11, slotSeq++));
    expect(e.status).toBe(409);
    expect(e.body.code).toBe('QUOTE_NOT_APPROVED');
  });

  it('T10: reservas sobrepostas concorrentes para o mesmo técnico: exatamente uma vence', async () => {
    const day = slotSeq++;
    const orders = await Promise.all(Array.from({ length: 6 }, () => triageOrder()));
    const results = await Promise.all(
      orders.map((o, i) => book(o.id, 'DIAGNOSTIC', slot(9 + (i % 2) * 0.5, 10.5, day))),
    );
    const codes = results.map((r) => r.status).sort();
    expect(codes.filter((c) => c === 201)).toHaveLength(1);
    expect(codes.filter((c) => c === 409)).toHaveLength(5);
    expect(results.find((r) => r.status === 409)!.body.code).toBe('SCHEDULE_CONFLICT');
  });

  it('T11: intervalos adjacentes são aceitos; visita cancelada libera o horário', async () => {
    const day = slotSeq++;
    const [o1, o2, o3] = await Promise.all([triageOrder(), triageOrder(), triageOrder()]);
    const a = await book(o1.id, 'DIAGNOSTIC', slot(8, 9, day));
    expect(a.status).toBe(201);
    expect((await book(o2.id, 'DIAGNOSTIC', slot(9, 10, day))).status).toBe(201); // começa quando a outra termina
    expect((await book(o3.id, 'DIAGNOSTIC', slot(8.5, 9.5, day))).status).toBe(409);
    expect(
      (await post(att, `/appointments/${a.body.id}/cancel`, { reason: 'Cliente pediu' })).status,
    ).toBe(201);
    expect((await book(o3.id, 'DIAGNOSTIC', slot(8, 9, day))).status).toBe(201);
  });

  it('T12: reagendamentos concorrentes para o mesmo horário: a constraint mantém o invariante', async () => {
    const day = slotSeq++;
    const [o1, o2] = await Promise.all([triageOrder(), triageOrder()]);
    const a = await book(o1.id, 'DIAGNOSTIC', slot(8, 9, day));
    const b = await book(o2.id, 'DIAGNOSTIC', slot(10, 11, day));
    const target = slot(13, 14, day);
    const [r1, r2] = await Promise.all([
      post(att, `/appointments/${a.body.id}/reschedule`, { version: a.body.version, ...target }),
      post(att, `/appointments/${b.body.id}/reschedule`, { version: b.body.version, ...target }),
    ]);
    expect([r1.status, r2.status].sort()).toEqual([201, 409]);
    const overlaps = await db.query(
      `SELECT count(*)::int AS n FROM appointments x JOIN appointments y ON x.id < y.id
        AND x.technician_user_id = y.technician_user_id AND x.period && y.period
        AND x.status IN ('SCHEDULED','IN_PROGRESS') AND y.status IN ('SCHEDULED','IN_PROGRESS')`,
    );
    expect(overlaps.rows[0].n).toBe(0);
  });

  it('técnico em duas empresas: conflito entre empresas é bloqueado sem revelar a outra empresa', async () => {
    const day = slotSeq++;
    const shared = await db.query<{ id: string }>(
      `INSERT INTO memberships (organization_id, user_id, role) VALUES ($1, $2, 'TECHNICIAN') RETURNING id`,
      [orgB, tech.userId],
    );
    const oA = await triageOrder();
    const oB = await triageOrder(attB, orgB);
    expect((await book(oA.id, 'DIAGNOSTIC', slot(8, 10, day))).status).toBe(201);
    const r = await post(
      attB,
      `/orders/${oB.id}/appointments`,
      { technicianMembershipId: shared.rows[0]!.id, kind: 'DIAGNOSTIC', ...slot(9, 11, day) },
      orgB,
    );
    expect(r.status).toBe(409);
    expect(JSON.stringify(r.body)).not.toMatch(/Clima Agenda|Padaria/);
  });

  it('agendamento no passado e técnico de outra empresa são recusados', async () => {
    const o = await triageOrder();
    const past = await book(o.id, 'DIAGNOSTIC', {
      startsAt: new Date(Date.now() - 2 * H).toISOString(),
      endsAt: new Date(Date.now() - H).toISOString(),
    });
    expect(past.status).toBe(422);
    const techB = await f.member(orgB, 'TECHNICIAN');
    expect((await book(o.id, 'DIAGNOSTIC', slot(8, 9, slotSeq++), techB.membershipId)).status).toBe(
      422,
    );
  });

  it('jornada completa: execução agendada → técnico inicia e conclui → ordem concluída', async () => {
    const o = await approvedOrder();
    const e = await book(o.id, 'EXECUTION', slot(14, 16, slotSeq++));
    expect(e.status).toBe(201);
    expect(await orderStatus(o.id)).toBe('SCHEDULED');
    // técnico vê a ordem atribuída, sem valores
    const view = await tech.agent.get(api(`/orders/${o.id}`));
    expect(view.status).toBe(200);
    expect(view.body.quotes).toBeUndefined();
    expect(view.body.customer.email).toBeUndefined();
    const mine = await tech.agent.get(
      api(
        `/appointments?from=${new Date(base - H).toISOString()}&to=${new Date(base + 40 * 24 * H).toISOString()}`,
      ),
    );
    expect(
      mine.body.items.every(
        (i: { technicianUserId: string }) => i.technicianUserId === tech.userId,
      ),
    ).toBe(true);
    expect((await post(tech.agent, `/appointments/${e.body.id}/start`)).status).toBe(201);
    expect(await orderStatus(o.id)).toBe('IN_PROGRESS');
    const done = await post(tech.agent, `/appointments/${e.body.id}/complete`, {
      summary: 'Dreno desobstruído e gás recarregado.',
    });
    expect(done.status).toBe(201);
    expect(await orderStatus(o.id)).toBe('COMPLETED');
  });

  it('T03: técnico não atribuído não vê nem opera a visita, mesmo manipulando a URL', async () => {
    const o = await triageOrder();
    const d = await book(o.id, 'DIAGNOSTIC', slot(8, 9, slotSeq++));
    expect((await tech2.agent.get(api(`/orders/${o.id}`))).status).toBe(404);
    expect((await post(tech2.agent, `/appointments/${d.body.id}/start`)).status).toBe(404);
    const list = await tech2.agent.get(api('/orders'));
    expect(list.body.items.map((i: { id: string }) => i.id)).not.toContain(o.id);
    expect(
      (
        await post(tech2.agent, `/orders/${o.id}/appointments`, {
          technicianMembershipId: tech2.membershipId,
          kind: 'DIAGNOSTIC',
          ...slot(8, 9, slotSeq++),
        })
      ).status,
    ).toBe(403);
  });

  it('administrador só atua pela visita de outro técnico com justificativa', async () => {
    const o = await triageOrder();
    const d = await book(o.id, 'DIAGNOSTIC', slot(8, 9, slotSeq++));
    expect((await post(admin, `/appointments/${d.body.id}/start`)).status).toBe(422);
    expect(
      (
        await post(admin, `/appointments/${d.body.id}/start`, {
          actingForOtherReason: 'Técnico doente; fui no lugar.',
        })
      ).status,
    ).toBe(201);
  });

  it('T13: conclusão duplicada concorrente: uma conclusão, efeitos únicos; diagnóstico mantém ordem em triagem', async () => {
    const o = await triageOrder();
    const d = await book(o.id, 'DIAGNOSTIC', slot(8, 9, slotSeq++));
    await post(tech.agent, `/appointments/${d.body.id}/start`);
    const body = { summary: 'Dreno obstruído e baixa carga de gás.' };
    const [r1, r2] = await Promise.all([
      post(tech.agent, `/appointments/${d.body.id}/complete`, body),
      post(tech.agent, `/appointments/${d.body.id}/complete`, body),
    ]);
    expect([r1.status, r2.status].sort()).toEqual([201, 409]);
    const reports = await db.query(
      `SELECT count(*)::int AS n FROM execution_reports WHERE appointment_id = $1`,
      [d.body.id],
    );
    expect(reports.rows[0].n).toBe(1);
    expect(await orderStatus(o.id)).toBe('TRIAGE');
  });

  it('revisar orçamento aprovado cancela a execução agendada e volta à triagem', async () => {
    const o = await approvedOrder();
    const e = await book(o.id, 'EXECUTION', slot(8, 10, slotSeq++));
    expect(e.status).toBe(201);
    const rev = await post(att, `/quotes/${o.quoteId}/revise`);
    expect(rev.status).toBe(201);
    expect(await orderStatus(o.id)).toBe('TRIAGE');
    const st = await db.query(`SELECT status FROM appointments WHERE id = $1`, [e.body.id]);
    expect(st.rows[0].status).toBe('CANCELLED');
  });

  it('cancelar a ordem cancela visitas ativas e libera a agenda', async () => {
    const day = slotSeq++;
    const o = await triageOrder();
    const d = await book(o.id, 'DIAGNOSTIC', slot(8, 9, day));
    await post(att, `/orders/${o.id}/cancel`, { reason: 'Cliente desistiu' });
    expect(
      (await db.query(`SELECT status FROM appointments WHERE id = $1`, [d.body.id])).rows[0].status,
    ).toBe('CANCELLED');
    const o2 = await triageOrder();
    expect((await book(o2.id, 'DIAGNOSTIC', slot(8, 9, day))).status).toBe(201);
  });

  it('cancelar a execução agendada devolve a ordem para APPROVED', async () => {
    const o = await approvedOrder();
    const e = await book(o.id, 'EXECUTION', slot(8, 10, slotSeq++));
    expect(
      (await post(att, `/appointments/${e.body.id}/cancel`, { reason: 'Remarcar' })).status,
    ).toBe(201);
    expect(await orderStatus(o.id)).toBe('APPROVED');
    expect((await book(o.id, 'EXECUTION', slot(11, 12, slotSeq++))).status).toBe(201);
  });
});
