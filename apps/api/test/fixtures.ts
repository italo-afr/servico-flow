import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent.js';
import { withTransaction, type Db } from '../src/db/pool.js';
import type { Role } from '../src/identity/policy.js';
import { createInvitation } from '../src/organizations/invitations.js';
import { testConfig } from './helpers.js';

export const ORIGIN = 'http://localhost:3000';
export const PASSWORD = 'senha-de-teste-123';
let seq = 0;

export type Agent = InstanceType<typeof TestAgent>;

export function fixtures(app: NestExpressApplication, db: Db) {
  const config = testConfig();
  const server = app.getHttpServer();

  async function newOrg(name = `Empresa ${++seq}`): Promise<string> {
    const r = await db.query<{ id: string }>(
      `INSERT INTO organizations (name) VALUES ($1) RETURNING id`,
      [name],
    );
    return r.rows[0]!.id;
  }

  async function invite(orgId: string, email: string, role: Role): Promise<string> {
    const inv = await withTransaction(db, (tx) =>
      createInvitation(tx, config, { organizationId: orgId, email, role, invitedBy: null }),
    );
    return new URL(inv.link).hash.replace('#token=', '');
  }

  async function login(email: string, password = PASSWORD): Promise<Agent> {
    const agent = request.agent(server);
    const res = await agent
      .post('/api/auth/sign-in/email')
      .set('Origin', ORIGIN)
      .send({ email, password });
    if (res.status !== 200)
      throw new Error(`login falhou (${res.status}): ${JSON.stringify(res.body)}`);
    return agent;
  }

  /** Cria usuário pelo fluxo real de convite e devolve um agente logado. */
  async function member(orgId: string, role: Role, email = `u${++seq}-${Date.now()}@example.com`) {
    const token = await invite(orgId, email, role);
    const res = await request(server)
      .post('/api/v1/invitations/accept')
      .set('Origin', ORIGIN)
      .send({ token, name: `Pessoa ${seq}`, password: PASSWORD });
    if (res.status !== 201)
      throw new Error(`aceite falhou (${res.status}): ${JSON.stringify(res.body)}`);
    const agent = await login(email);
    const m = await db.query<{ id: string; user_id: string }>(
      `SELECT m.id, m.user_id FROM memberships m JOIN "user" u ON u.id = m.user_id WHERE u.email = $1 AND m.organization_id = $2`,
      [email, orgId],
    );
    return { agent, email, membershipId: m.rows[0]!.id, userId: m.rows[0]!.user_id };
  }

  return { server, config, newOrg, invite, login, member };
}

export async function createCustomer(
  agent: Agent,
  orgId: string,
  name = 'Padaria Exemplo (fictícia)',
) {
  const res = await agent
    .post(`/api/v1/organizations/${orgId}/customers`)
    .set('Origin', ORIGIN)
    .send({
      name,
      phone: '(11) 90000-0000',
      address: {
        street: 'Rua Fictícia',
        number: '100',
        city: 'São Paulo',
        state: 'sp',
        postalCode: '01000-000',
      },
      equipment: { description: 'Split 12.000 BTU', brand: 'MarcaX', capacityBtu: 12000 },
    });
  if (res.status !== 201) throw new Error(`cliente: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body as { id: string; addressId: string; equipmentId: string };
}

export async function createOrder(
  agent: Agent,
  orgId: string,
  c: { id: string; addressId: string; equipmentId: string },
) {
  const res = await agent.post(`/api/v1/organizations/${orgId}/orders`).set('Origin', ORIGIN).send({
    customerId: c.id,
    addressId: c.addressId,
    equipmentId: c.equipmentId,
    description: 'Não gela e pinga água',
  });
  if (res.status !== 201) throw new Error(`ordem: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body as { id: string; number: number; version: number };
}
