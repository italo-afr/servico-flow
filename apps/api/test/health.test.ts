import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Db } from '../src/db/pool.js';
import { resetDatabase, startApp } from './helpers.js';

describe('health (T20 parcial: banco vazio + migrations)', () => {
  let db: Db;
  let app: NestExpressApplication;
  beforeAll(async () => {
    db = await resetDatabase();
    app = await startApp(db);
  });
  afterAll(async () => {
    await app.close();
    await db.end();
  });

  it('live responde sem depender do banco', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('ready confirma banco e migrations', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.checks).toEqual({ database: 'ok', migrations: 'ok' });
  });

  it('rota inexistente retorna erro padronizado com requestId', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/nao-existe');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ code: 'NOT_FOUND' });
    expect(res.body.requestId).toBeTruthy();
  });
});
