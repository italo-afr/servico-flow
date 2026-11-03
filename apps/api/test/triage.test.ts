import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Db } from '../src/db/pool.js';
import { fixtures, ORIGIN } from './fixtures.js';
import { resetDatabase, startApp } from './helpers.js';

describe('sugestão de triagem (feature flag)', () => {
  let db: Db;
  const apps: NestExpressApplication[] = [];
  beforeAll(async () => {
    db = await resetDatabase();
  });
  afterAll(async () => {
    for (const a of apps) await a.close();
    await db.end();
  });

  async function setup(flag: 'true' | 'false') {
    const app = await startApp(db, { AUTH_RATE_LIMIT: 'false', TRIAGE_SUGGESTIONS: flag });
    apps.push(app);
    const f = fixtures(app, db);
    const org = await f.newOrg(`Triagem ${flag}`);
    return {
      org,
      att: (await f.member(org, 'ATTENDANT')).agent,
      tech: (await f.member(org, 'TECHNICIAN')).agent,
    };
  }

  it('desligada por padrão: 404 e /me informa o estado', async () => {
    const { org, att } = await setup('false');
    const r = await att
      .post(`/api/v1/organizations/${org}/triage/suggest`)
      .set('Origin', ORIGIN)
      .send({ description: 'não gela' });
    expect(r.status).toBe(404);
    expect((await att.get('/api/v1/me')).body.features).toEqual({ triageSuggestions: false });
  });

  it('ligada: sugere sem gravar nada; técnico não usa', async () => {
    const { org, att, tech } = await setup('true');
    const before = (await db.query(`SELECT count(*)::int AS n FROM service_orders`)).rows[0].n;
    const r = await att
      .post(`/api/v1/organizations/${org}/triage/suggest`)
      .set('Origin', ORIGIN)
      .send({ description: 'Pingando água na parede' });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ category: 'WATER_LEAK', engine: 'rules-v1' });
    expect((await db.query(`SELECT count(*)::int AS n FROM service_orders`)).rows[0].n).toBe(
      before,
    );
    expect(
      (
        await tech
          .post(`/api/v1/organizations/${org}/triage/suggest`)
          .set('Origin', ORIGIN)
          .send({ description: 'x x x' })
      ).status,
    ).toBe(403);
  });
});
