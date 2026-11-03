import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Db } from '../src/db/pool.js';
import { createCustomer, createOrder, fixtures, ORIGIN, type Agent } from './fixtures.js';
import { resetDatabase, startApp } from './helpers.js';

describe('clientes e ordens (fase 3)', () => {
  let db: Db;
  let app: NestExpressApplication;
  let f: ReturnType<typeof fixtures>;
  let orgA: string;
  let orgB: string;
  let attA: Agent;
  let attB: Agent;

  beforeAll(async () => {
    db = await resetDatabase();
    app = await startApp(db, { AUTH_RATE_LIMIT: 'false' });
    f = fixtures(app, db);
    orgA = await f.newOrg('Empresa A');
    orgB = await f.newOrg('Empresa B');
    attA = (await f.member(orgA, 'ATTENDANT')).agent;
    attB = (await f.member(orgB, 'ATTENDANT')).agent;
  });
  afterAll(async () => {
    await app.close();
    await db.end();
  });

  it('abre ordem com número, estado inicial e evento de criação; persiste após recarregar', async () => {
    const c = await createCustomer(attA, orgA);
    const o = await createOrder(attA, orgA, c);
    expect(o.number).toBeGreaterThan(0);
    const detail = await attA.get(`/api/v1/organizations/${orgA}/orders/${o.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body).toMatchObject({
      status: 'OPEN',
      number: o.number,
      customer: { name: 'Padaria Exemplo (fictícia)' },
    });
    expect(detail.body.events.map((e: { type: string }) => e.type)).toEqual(['order.created']);
    const list = await attA.get(`/api/v1/organizations/${orgA}/orders?q=%23${o.number}`);
    expect(list.body.items.map((i: { id: string }) => i.id)).toContain(o.id);
  });

  it('T02: referência a endereço/equipamento de outra empresa é recusada pela API', async () => {
    const cA = await createCustomer(attA, orgA);
    const cB = await createCustomer(attB, orgB);
    const res = await attA.post(`/api/v1/organizations/${orgA}/orders`).set('Origin', ORIGIN).send({
      customerId: cA.id,
      addressId: cB.addressId,
      equipmentId: cA.equipmentId,
      description: 'Teste cruzado',
    });
    expect(res.status).toBe(422);
    // cliente inteiro de outra empresa
    const res2 = await attA
      .post(`/api/v1/organizations/${orgA}/orders`)
      .set('Origin', ORIGIN)
      .send({
        customerId: cB.id,
        addressId: cB.addressId,
        equipmentId: cB.equipmentId,
        description: 'Teste cruzado',
      });
    expect(res2.status).toBe(422);
  });

  it('T02: equipamento de OUTRO cliente da mesma empresa é recusado', async () => {
    const c1 = await createCustomer(attA, orgA, 'Cliente 1');
    const c2 = await createCustomer(attA, orgA, 'Cliente 2');
    const res = await attA.post(`/api/v1/organizations/${orgA}/orders`).set('Origin', ORIGIN).send({
      customerId: c1.id,
      addressId: c1.addressId,
      equipmentId: c2.equipmentId,
      description: 'Equip. de outro',
    });
    expect(res.status).toBe(422);
  });

  it('T02: o banco recusa a associação cruzada mesmo sem a aplicação (FK composta)', async () => {
    const cA = await createCustomer(attA, orgA);
    const cB = await createCustomer(attB, orgB);
    const user = (await db.query(`SELECT id FROM "user" LIMIT 1`)).rows[0].id;
    await expect(
      db.query(
        `INSERT INTO service_orders (organization_id, number, customer_id, address_id, equipment_id, description, created_by)
         VALUES ($1, 9999, $2, $3, $4, 'direto no banco', $5)`,
        [orgA, cA.id, cB.addressId, cA.equipmentId, user],
      ),
    ).rejects.toMatchObject({ code: '23503' });
  });

  it('T01: atendente de B não lê nem altera ordem de A trocando o orgId ou o id', async () => {
    const c = await createCustomer(attA, orgA);
    const o = await createOrder(attA, orgA, c);
    expect((await attB.get(`/api/v1/organizations/${orgA}/orders/${o.id}`)).status).toBe(404);
    expect((await attB.get(`/api/v1/organizations/${orgB}/orders/${o.id}`)).status).toBe(404);
    expect((await attB.get(`/api/v1/organizations/${orgB}/customers/${c.id}`)).status).toBe(404);
    const t = await attB
      .post(`/api/v1/organizations/${orgB}/orders/${o.id}/start-triage`)
      .set('Origin', ORIGIN)
      .send({});
    expect(t.status).toBe(404);
  });

  it('aberturas simultâneas recebem números distintos e sequenciais', async () => {
    const c = await createCustomer(attA, orgA);
    const results = await Promise.all(Array.from({ length: 10 }, () => createOrder(attA, orgA, c)));
    const numbers = results.map((r) => r.number).sort((a, b) => a - b);
    expect(new Set(numbers).size).toBe(10);
    expect(numbers[9]! - numbers[0]!).toBe(9);
  });

  it('Idempotency-Key: repetição devolve a mesma ordem; outro conteúdo com a mesma chave é 409', async () => {
    const c = await createCustomer(attA, orgA);
    const body = {
      customerId: c.id,
      addressId: c.addressId,
      equipmentId: c.equipmentId,
      description: 'Idempotente',
    };
    const send = (b: object) =>
      attA
        .post(`/api/v1/organizations/${orgA}/orders`)
        .set('Origin', ORIGIN)
        .set('Idempotency-Key', 'chave-teste-0001')
        .send(b);
    const [r1, r2] = await Promise.all([send(body), send(body)]);
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    expect(r1.body.id).toBe(r2.body.id);
    const count = await db.query(
      `SELECT count(*)::int AS n FROM service_orders WHERE description = 'Idempotente'`,
    );
    expect(count.rows[0].n).toBe(1);
    const r3 = await send({ ...body, description: 'Outro conteúdo' });
    expect(r3.status).toBe(409);
    expect(r3.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('triagem: transição protegida; repetir ou pular estado é 409', async () => {
    const c = await createCustomer(attA, orgA);
    const o = await createOrder(attA, orgA, c);
    const url = `/api/v1/organizations/${orgA}/orders/${o.id}/start-triage`;
    const [a, b] = await Promise.all([
      attA.post(url).set('Origin', ORIGIN).send({}),
      attA.post(url).set('Origin', ORIGIN).send({}),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const events = await db.query(`SELECT type FROM order_events WHERE order_id = $1 ORDER BY id`, [
      o.id,
    ]);
    expect(events.rows.map((r) => r.type)).toEqual(['order.created', 'order.triage_started']);
  });

  it('controle otimista: versão desatualizada retorna 409 VERSION_CONFLICT', async () => {
    const c = await createCustomer(attA, orgA);
    const o = await createOrder(attA, orgA, c);
    const ok = await attA
      .post(`/api/v1/organizations/${orgA}/orders/${o.id}/update`)
      .set('Origin', ORIGIN)
      .send({ version: o.version, priority: 'HIGH' });
    expect(ok.status).toBe(201);
    const stale = await attA
      .post(`/api/v1/organizations/${orgA}/orders/${o.id}/update`)
      .set('Origin', ORIGIN)
      .send({ version: o.version, priority: 'LOW' });
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('VERSION_CONFLICT');
  });

  it('cancelamento exige motivo, preserva histórico e encerra a ordem', async () => {
    const c = await createCustomer(attA, orgA);
    const o = await createOrder(attA, orgA, c);
    const url = `/api/v1/organizations/${orgA}/orders/${o.id}/cancel`;
    expect((await attA.post(url).set('Origin', ORIGIN).send({})).status).toBe(422);
    const res = await attA.post(url).set('Origin', ORIGIN).send({ reason: 'Cliente desistiu' });
    expect(res.status).toBe(201);
    expect((await attA.post(url).set('Origin', ORIGIN).send({ reason: 'De novo' })).status).toBe(
      409,
    );
    const d = await attA.get(`/api/v1/organizations/${orgA}/orders/${o.id}`);
    expect(d.body).toMatchObject({ status: 'CANCELLED', cancelReason: 'Cliente desistiu' });
  });

  it('cliente arquivado não recebe novas ordens; histórico continua acessível', async () => {
    const c = await createCustomer(attA, orgA);
    const o = await createOrder(attA, orgA, c);
    await attA
      .post(`/api/v1/organizations/${orgA}/customers/${c.id}/archive`)
      .set('Origin', ORIGIN)
      .send({});
    const res = await attA.post(`/api/v1/organizations/${orgA}/orders`).set('Origin', ORIGIN).send({
      customerId: c.id,
      addressId: c.addressId,
      equipmentId: c.equipmentId,
      description: 'Depois de arquivar',
    });
    expect(res.status).toBe(422);
    expect((await attA.get(`/api/v1/organizations/${orgA}/orders/${o.id}`)).status).toBe(200);
  });

  it('paginação por cursor é estável e limitada', async () => {
    const page1 = await attA.get(`/api/v1/organizations/${orgA}/orders?limit=5`);
    expect(page1.body.items).toHaveLength(5);
    const page2 = await attA.get(
      `/api/v1/organizations/${orgA}/orders?limit=5&cursor=${page1.body.nextCursor}`,
    );
    const ids1 = page1.body.items.map((i: { id: string }) => i.id);
    for (const i of page2.body.items) expect(ids1).not.toContain(i.id);
    expect((await attA.get(`/api/v1/organizations/${orgA}/orders?limit=500`)).status).toBe(422);
    expect((await attA.get(`/api/v1/organizations/${orgA}/orders?cursor=lixo`)).status).toBe(422);
  });
});
