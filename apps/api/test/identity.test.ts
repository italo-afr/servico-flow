import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Db } from '../src/db/pool.js';
import { fixtures, ORIGIN, PASSWORD } from './fixtures.js';
import { resetDatabase, startApp } from './helpers.js';

describe('identidade, empresas e permissões (fase 2)', () => {
  let db: Db;
  let app: NestExpressApplication;
  let f: ReturnType<typeof fixtures>;
  let orgA: string;
  let orgB: string;

  beforeAll(async () => {
    db = await resetDatabase();
    app = await startApp(db, { AUTH_RATE_LIMIT: 'false' });
    f = fixtures(app, db);
    orgA = await f.newOrg('Empresa A');
    orgB = await f.newOrg('Empresa B');
  });
  afterAll(async () => {
    await app.close();
    await db.end();
  });

  it('sem sessão retorna 401', async () => {
    const res = await request(f.server).get('/api/v1/me');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('cadastro público está bloqueado', async () => {
    const res = await request(f.server)
      .post('/api/auth/sign-up/email')
      .set('Origin', ORIGIN)
      .send({ email: 'intruso@example.com', password: PASSWORD, name: 'X' });
    expect(res.status).toBe(404);
  });

  it('aceite de convite cria conta, associação e permite login', async () => {
    const admin = await f.member(orgA, 'ADMIN');
    const me = await admin.agent.get('/api/v1/me');
    expect(me.status).toBe(200);
    expect(me.body.memberships).toEqual([
      expect.objectContaining({ organizationId: orgA, role: 'ADMIN' }),
    ]);
  });

  it('convite é de uso único; repetido ou revogado é recusado', async () => {
    const token = await f.invite(orgA, 'unico@example.com', 'ATTENDANT');
    const first = await request(f.server)
      .post('/api/v1/invitations/accept')
      .set('Origin', ORIGIN)
      .send({ token, name: 'Única', password: PASSWORD });
    expect(first.status).toBe(201);
    const outra = await f.invite(orgB, 'outra@example.com', 'ATTENDANT');
    await db.query(`UPDATE invitations SET revoked_at = now() WHERE email = 'outra@example.com'`);
    const revoked = await request(f.server)
      .post('/api/v1/invitations/accept')
      .set('Origin', ORIGIN)
      .send({ token: outra, name: 'Outra', password: PASSWORD });
    expect(revoked.status).toBe(410);
    // Mesmo token reutilizado por outra pessoa (sem sessão da conta convidada)
    const again = await request(f.server)
      .post('/api/v1/invitations/accept')
      .set('Origin', ORIGIN)
      .send({ token });
    expect(again.status).toBe(401);
  });

  it('convite expirado é recusado', async () => {
    const token = await f.invite(orgA, 'expirado@example.com', 'TECHNICIAN');
    await db.query(
      `UPDATE invitations SET expires_at = now() - interval '1 minute' WHERE email = 'expirado@example.com'`,
    );
    const res = await request(f.server)
      .post('/api/v1/invitations/accept')
      .set('Origin', ORIGIN)
      .send({ token, name: 'Expirado', password: PASSWORD });
    expect(res.status).toBe(410);
  });

  it('convite não devolve token e gera evento na outbox na mesma transação', async () => {
    const admin = await f.member(orgA, 'ADMIN');
    const res = await admin.agent
      .post(`/api/v1/organizations/${orgA}/invitations`)
      .set('Origin', ORIGIN)
      .send({ email: 'Nova.Pessoa@Example.com', role: 'TECHNICIAN' });
    expect(res.status).toBe(201);
    expect(JSON.stringify(res.body)).not.toMatch(/token/i);
    expect(res.body.email).toBe('nova.pessoa@example.com');
    const ev = await db.query(
      `SELECT payload, payload_encrypted FROM outbox_events WHERE type = 'invitation.created' AND payload->>'invitationId' = $1`,
      [res.body.id],
    );
    expect(ev.rowCount).toBe(1);
    expect(ev.rows[0].payload_encrypted).toMatch(/^v1\./); // link criptografado, não em texto claro
  });

  it('T01: membro de A não acessa recursos de B (404, sem revelar existência)', async () => {
    const admin = await f.member(orgA, 'ADMIN');
    const res = await admin.agent.get(`/api/v1/organizations/${orgB}/members`);
    expect(res.status).toBe(404);
    const inv = await admin.agent
      .post(`/api/v1/organizations/${orgB}/invitations`)
      .set('Origin', ORIGIN)
      .send({ email: 'x@example.com', role: 'ADMIN' });
    expect(inv.status).toBe(404);
  });

  it('técnico não executa ação administrativa; atendente não convida (sem escalada)', async () => {
    const tech = await f.member(orgA, 'TECHNICIAN');
    expect((await tech.agent.get(`/api/v1/organizations/${orgA}/members`)).status).toBe(403);
    const att = await f.member(orgA, 'ATTENDANT');
    const res = await att.agent
      .post(`/api/v1/organizations/${orgA}/invitations`)
      .set('Origin', ORIGIN)
      .send({ email: 'chefe@example.com', role: 'ADMIN' });
    expect(res.status).toBe(403);
  });

  it('T04: associação removida perde acesso na requisição seguinte, com a mesma sessão', async () => {
    const admin = await f.member(orgA, 'ADMIN');
    const att = await f.member(orgA, 'ATTENDANT');
    expect((await att.agent.get(`/api/v1/organizations/${orgA}/members`)).status).toBe(200);
    const rm = await admin.agent
      .post(`/api/v1/organizations/${orgA}/members/${att.membershipId}/remove`)
      .set('Origin', ORIGIN);
    expect(rm.status).toBe(201);
    expect((await att.agent.get(`/api/v1/organizations/${orgA}/members`)).status).toBe(404);
  });

  it('não permite remover o último administrador', async () => {
    const org = await f.newOrg();
    const admin = await f.member(org, 'ADMIN');
    const res = await admin.agent
      .post(`/api/v1/organizations/${org}/members/${admin.membershipId}/remove`)
      .set('Origin', ORIGIN);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('LAST_ADMIN');
  });

  it('T19: escrita sem Origin correto é recusada (CSRF)', async () => {
    const admin = await f.member(orgA, 'ADMIN');
    const res = await admin.agent
      .post(`/api/v1/organizations/${orgA}/invitations`)
      .set('Origin', 'https://site-malicioso.example')
      .send({ email: 'y@example.com', role: 'TECHNICIAN' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CSRF_ORIGIN_MISMATCH');
  });

  it('T19: logout revoga a sessão no servidor', async () => {
    const admin = await f.member(orgA, 'ADMIN');
    const cookie = (await f.login(admin.email)).jar; // segunda sessão independente
    expect(cookie).toBeTruthy();
    const out = await admin.agent.post('/api/auth/sign-out').set('Origin', ORIGIN).send({});
    expect(out.status).toBe(200);
    expect((await admin.agent.get('/api/v1/me')).status).toBe(401);
  });

  it('campos desconhecidos são rejeitados com 422 e lista de campos', async () => {
    const admin = await f.member(orgA, 'ADMIN');
    const res = await admin.agent
      .post(`/api/v1/organizations/${orgA}/invitations`)
      .set('Origin', ORIGIN)
      .send({ email: 'z@example.com', role: 'TECHNICIAN', isAdmin: true });
    expect(res.status).toBe(422);
    expect(res.body.fields).toBeDefined();
  });
});
