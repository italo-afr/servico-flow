import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { LocalStorage } from '../src/attachments/storage.js';
import type { Db } from '../src/db/pool.js';
import { runMaintenance } from '../src/worker/maintenance.js';
import { createCustomer, createOrder, fixtures, ORIGIN, type Agent } from './fixtures.js';
import { resetDatabase, testConfig } from './helpers.js';
import { createApp } from '../src/app.js';

describe('fotos privadas (fase 6: T17, T18)', () => {
  let db: Db;
  let app: NestExpressApplication;
  let f: ReturnType<typeof fixtures>;
  let storage: LocalStorage;
  let org: string;
  let orgB: string;
  let att: Agent;
  let attB: Agent;
  let orderId: string;

  beforeAll(async () => {
    db = await resetDatabase();
    const config = testConfig({ AUTH_RATE_LIMIT: 'false' });
    storage = new LocalStorage(
      await mkdtemp(path.join(os.tmpdir(), 'sf-storage-')),
      config.SESSION_SECRET,
      '',
    );
    app = await createApp(config, db, storage);
    await app.init();
    f = fixtures(app, db);
    org = await f.newOrg('Fotos Ltda');
    orgB = await f.newOrg('Outra Ltda');
    att = (await f.member(org, 'ATTENDANT')).agent;
    attB = (await f.member(orgB, 'ATTENDANT')).agent;
    orderId = (await createOrder(att, org, await createCustomer(att, org))).id;
  });
  afterAll(async () => {
    await app.close();
    await db.end();
  });

  const api = (p: string, o = org) => `/api/v1/organizations/${o}${p}`;

  async function upload(agent: Agent, body: Buffer, contentType = 'image/jpeg') {
    const init = await agent
      .post(api('/attachments/initiate'))
      .set('Origin', ORIGIN)
      .send({ orderId, contentType, sizeBytes: body.length });
    if (init.status !== 201) return { init };
    const u = new URL(init.body.uploadUrl, 'http://x');
    const put = await request(f.server)
      .put(u.pathname + u.search)
      .set('Origin', ORIGIN)
      .set('content-type', contentType)
      .send(body);
    expect(put.status).toBe(200);
    const fin = await agent
      .post(api(`/attachments/${init.body.id}/finalize`))
      .set('Origin', ORIGIN)
      .send({});
    return { init, fin };
  }

  const jpegWithExif = () =>
    sharp({ create: { width: 64, height: 48, channels: 3, background: '#3366cc' } })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Copyright: 'GPS-SECRETO', Artist: 'Pessoa' } } })
      .toBuffer();

  it('imagem válida é reprocessada para WebP e perde metadados EXIF', async () => {
    const original = await jpegWithExif();
    expect((await sharp(original).metadata()).exif).toBeDefined();
    const { fin } = await upload(att, original);
    expect(fin!.status).toBe(201);
    expect(fin!.body).toMatchObject({ status: 'READY', width: 64, height: 48 });
    const url = await att.get(api(`/attachments/${fin!.body.id}/url`));
    const u = new URL(url.body.url, 'http://x');
    const file = await request(f.server).get(u.pathname + u.search);
    expect(file.status).toBe(200);
    const meta = await sharp(file.body as Buffer).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.exif).toBeUndefined();
    expect((file.body as Buffer).toString('latin1')).not.toContain('GPS-SECRETO');
  });

  it('T17: arquivo com tipo declarado de imagem mas conteúdo inválido é recusado e o bruto é apagado', async () => {
    const fake = Buffer.from('<html><script>alert(1)</script></html>');
    const { init, fin } = await upload(att, fake, 'image/jpeg');
    expect(fin!.status).toBe(422);
    const row = (
      await db.query(`SELECT status, raw_key FROM attachments WHERE id = $1`, [init.body.id])
    ).rows[0];
    expect(row.status).toBe('REJECTED');
    expect(await storage.get(row.raw_key)).toBeNull();
  });

  it('SVG e tipos não permitidos são recusados já na autorização', async () => {
    const r = await att
      .post(api('/attachments/initiate'))
      .set('Origin', ORIGIN)
      .send({ orderId, contentType: 'image/svg+xml', sizeBytes: 10 });
    expect(r.status).toBe(422);
    const big = await att
      .post(api('/attachments/initiate'))
      .set('Origin', ORIGIN)
      .send({ orderId, contentType: 'image/png', sizeBytes: 6 * 1024 * 1024 });
    expect(big.status).toBe(422);
  });

  it('T18: anexo de outra empresa não é acessível; URL adulterada ou expirada é recusada', async () => {
    const { fin } = await upload(att, await jpegWithExif());
    expect((await attB.get(api(`/attachments/${fin!.body.id}/url`, orgB))).status).toBe(404);
    expect((await attB.get(api(`/attachments/${fin!.body.id}/url`))).status).toBe(404);
    const url = await att.get(api(`/attachments/${fin!.body.id}/url`));
    const u = new URL(url.body.url, 'http://x');
    const tampered = u.pathname + u.search.replace(/sig=[^&]+/, 'sig=abc');
    expect((await request(f.server).get(tampered)).status).toBe(403);
    const key = u.pathname.replace('/api/v1/storage-local/get/', '');
    const exp = Date.now() - 1000;
    expect(
      (
        await request(f.server).get(
          `/api/v1/storage-local/get/${key}?exp=${exp}&sig=${storage.sign('get', key, exp)}`,
        )
      ).status,
    ).toBe(403);
  });

  it('técnico sem visita atribuída não envia nem baixa fotos da ordem', async () => {
    const tech = (await f.member(org, 'TECHNICIAN')).agent;
    const init = await tech
      .post(api('/attachments/initiate'))
      .set('Origin', ORIGIN)
      .send({ orderId, contentType: 'image/png', sizeBytes: 100 });
    expect(init.status).toBe(404);
  });

  it('upload abandonado é limpo pela manutenção', async () => {
    const init = await att
      .post(api('/attachments/initiate'))
      .set('Origin', ORIGIN)
      .send({ orderId, contentType: 'image/png', sizeBytes: 100 });
    await db.query(`UPDATE attachments SET created_at = now() - interval '2 hours' WHERE id = $1`, [
      init.body.id,
    ]);
    await runMaintenance(db, storage);
    const row = (
      await db.query(`SELECT status, reject_reason FROM attachments WHERE id = $1`, [init.body.id])
    ).rows[0];
    expect(row).toEqual({ status: 'REJECTED', reject_reason: 'abandoned' });
  });

  it('limite de 10 fotos por ordem', async () => {
    const o2 = (await createOrder(att, org, await createCustomer(att, org))).id;
    for (let i = 0; i < 10; i++) {
      const r = await att
        .post(api('/attachments/initiate'))
        .set('Origin', ORIGIN)
        .send({ orderId: o2, contentType: 'image/png', sizeBytes: 10 });
      expect(r.status).toBe(201);
    }
    const r = await att
      .post(api('/attachments/initiate'))
      .set('Origin', ORIGIN)
      .send({ orderId: o2, contentType: 'image/png', sizeBytes: 10 });
    expect(r.status).toBe(409);
  });

  it('cota da empresa em bytes é respeitada, inclusive com pedidos simultâneos', async () => {
    const config = testConfig({ AUTH_RATE_LIMIT: 'false', STORAGE_QUOTA_BYTES_PER_ORG: '1000' });
    const quotaApp = await createApp(config, db, storage);
    await quotaApp.init();
    const g = fixtures(quotaApp, db);
    const o = await g.newOrg('Cota Pequena');
    const a = (await g.member(o, 'ATTENDANT')).agent;
    const ord = (await createOrder(a, o, await createCustomer(a, o))).id;
    const init = (size: number) =>
      a
        .post(`/api/v1/organizations/${o}/attachments/initiate`)
        .set('Origin', ORIGIN)
        .send({ orderId: ord, contentType: 'image/png', sizeBytes: size });
    // 4 × 300 bytes simultâneos com cota de 1000: no máximo 3 cabem
    const results = await Promise.all([init(300), init(300), init(300), init(300)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 201, 201, 409]);
    expect(results.find((r) => r.status === 409)!.body.code).toBe('STORAGE_QUOTA_EXCEEDED');
    await quotaApp.close();
  });

  it('limite por ordem vale sob concorrência', async () => {
    const o3 = (await createOrder(att, org, await createCustomer(att, org))).id;
    const reqs = Array.from({ length: 14 }, () =>
      att
        .post(api('/attachments/initiate'))
        .set('Origin', ORIGIN)
        .send({ orderId: o3, contentType: 'image/png', sizeBytes: 10 }),
    );
    const codes = (await Promise.all(reqs)).map((r) => r.status);
    expect(codes.filter((c) => c === 201)).toHaveLength(10);
    expect(codes.filter((c) => c === 409)).toHaveLength(4);
  });
});
