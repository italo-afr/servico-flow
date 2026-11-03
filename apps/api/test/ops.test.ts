import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Db } from '../src/db/pool.js';
import { MemoryMailer, PermanentMailError } from '../src/notifications/mailer.js';
import { processOnce } from '../src/notifications/processor.js';
import { createCustomer, createOrder, fixtures, ORIGIN, type Agent } from './fixtures.js';
import { resetDatabase, startApp, testConfig } from './helpers.js';

describe('painel e operação (fases 7 e 8: T24)', () => {
  let db: Db;
  let app: NestExpressApplication;
  let f: ReturnType<typeof fixtures>;
  let org: string;
  let admin: Agent;
  let att: Agent;

  beforeAll(async () => {
    db = await resetDatabase();
    app = await startApp(db, { AUTH_RATE_LIMIT: 'false' });
    f = fixtures(app, db);
    org = await f.newOrg('Painel Ltda');
    admin = (await f.member(org, 'ADMIN')).agent;
    att = (await f.member(org, 'ATTENDANT')).agent;
  });
  afterAll(async () => {
    await app.close();
    await db.end();
  });
  const api = (p: string) => `/api/v1/organizations/${org}${p}`;

  it('T24: indicadores batem com uma massa conhecida', async () => {
    const c = await createCustomer(att, org);
    const ids = [];
    for (let i = 0; i < 4; i++) ids.push((await createOrder(att, org, c)).id);
    await att
      .post(api(`/orders/${ids[0]}/cancel`))
      .set('Origin', ORIGIN)
      .send({ reason: 'Teste' });
    // uma ordem "parada": último evento há 5 dias
    await db.query(
      `UPDATE order_events SET created_at = now() - interval '5 days' WHERE order_id = $1`,
      [ids[1]],
    );
    const r = await att.get(api('/dashboard'));
    expect(r.status).toBe(200);
    expect(r.body.metrics).toEqual({
      open: 3,
      awaitingApproval: 0,
      visitsToday: 0,
      completed30d: 0,
      stale3d: 1,
    });
    expect(r.body.definitions.stale3d).toMatch(/3 dias/);
    // a lista de detalhe usa a mesma definição
    const list = await att.get(api('/orders?staleDays=3'));
    expect(list.body.items.map((i: { id: string }) => i.id)).toEqual([ids[1]]);
  });

  it('falha definitiva aparece no painel e pode ser reprocessada com auditoria', async () => {
    await admin
      .post(api('/invitations'))
      .set('Origin', ORIGIN)
      .send({ email: 'falha@example.com', role: 'TECHNICIAN' });
    const mailer = new MemoryMailer();
    mailer.failNext.push(new PermanentMailError('SMTP 550'));
    await processOnce({
      db,
      config: testConfig({ EMAIL_ALLOWED_RECIPIENTS: '@example.com' }),
      mailer,
    });
    const panel = await admin.get(api('/ops/outbox'));
    expect(panel.body.counts.FAILED).toBe(1);
    const failedId = panel.body.failed[0].id;
    expect((await att.get(api('/ops/outbox'))).status).toBe(403);
    const retry = await admin
      .post(api(`/ops/outbox/${failedId}/retry`))
      .set('Origin', ORIGIN)
      .send({});
    expect(retry.status).toBe(201);
    const a = await db.query(
      `SELECT count(*)::int AS n FROM audit_events WHERE action = 'outbox.retried'`,
    );
    expect(a.rows[0].n).toBe(1);
    expect(
      await processOnce({
        db,
        config: testConfig({ EMAIL_ALLOWED_RECIPIENTS: '@example.com' }),
        mailer,
      }),
    ).toEqual(['DONE']);
    expect(
      (
        await admin
          .post(api(`/ops/outbox/${failedId}/retry`))
          .set('Origin', ORIGIN)
          .send({})
      ).status,
    ).toBe(409);
  });
});
