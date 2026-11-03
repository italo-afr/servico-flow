/**
 * Massa SINTÉTICA para desempenho (brief 10.3): 10 empresas, 10 mil ordens no total.
 * Recusa staging/produção. Todos os nomes são marcados como sintéticos.
 *
 * pnpm --filter @servicoflow/api exec tsx --env-file=../../.env src/db/synthetic-cli.ts
 */
import { loadConfig } from '../config.js';
import { createPool } from './pool.js';

const config = loadConfig();
if (!['local', 'test', 'ci'].includes(config.APP_ENV)) {
  console.error(`Recusado: massa sintética só em local/test/ci (APP_ENV=${config.APP_ENV}).`);
  process.exit(1);
}
const ORGS = 10;
const ORDERS_PER_ORG = 1000;
const db = createPool(config.DATABASE_URL, 2);
const t0 = Date.now();
try {
  const user = (
    await db.query<{ id: string }>(`SELECT id FROM "user" ORDER BY "createdAt" LIMIT 1`)
  ).rows[0];
  if (!user) throw new Error('Rode o seed antes (precisa de ao menos um usuário).');
  for (let o = 1; o <= ORGS; o++) {
    const org = (
      await db.query<{ id: string }>(
        `INSERT INTO organizations (name, is_demo) VALUES ($1, true) RETURNING id`,
        [`Sintética ${o} [carga]`],
      )
    ).rows[0]!.id;
    const tech = await db.query<{ id: string }>(
      `INSERT INTO memberships (organization_id, user_id, role) VALUES ($1, $2, 'ADMIN') RETURNING id`,
      [org, user.id],
    );
    await db.query(
      `WITH c AS (
         INSERT INTO customers (organization_id, name, phone)
         SELECT $1, 'Cliente sintético ' || g, '(00) 0000-' || lpad(g::text, 4, '0') FROM generate_series(1, 200) g RETURNING id
       ), a AS (
         INSERT INTO service_addresses (organization_id, customer_id, street, city, state)
         SELECT $1, id, 'Rua Sintética', 'Cidade Teste', 'SP' FROM c RETURNING id, customer_id
       ), e AS (
         INSERT INTO equipment (organization_id, customer_id, description)
         SELECT $1, customer_id, 'Split sintético' FROM a RETURNING id, customer_id
       )
       SELECT count(*) FROM e`,
      [org],
    );
    // Ordens distribuídas por estado e nos últimos 180 dias.
    await db.query(
      `WITH pairs AS (
         SELECT a.customer_id, a.id AS address_id, e.id AS equipment_id, row_number() OVER () AS rn
           FROM service_addresses a JOIN equipment e ON e.customer_id = a.customer_id WHERE a.organization_id = $1
       ), ins AS (
         INSERT INTO service_orders (organization_id, number, customer_id, address_id, equipment_id, status, description, created_by,
                                     created_at, completed_at, cancelled_at)
         SELECT $1, g, p.customer_id, p.address_id, p.equipment_id, s.status, 'Ordem sintética ' || g, $2,
                now() - (random() * interval '180 days'),
                CASE WHEN s.status = 'COMPLETED' THEN now() - (random() * interval '30 days') END,
                CASE WHEN s.status = 'CANCELLED' THEN now() END
           FROM generate_series(1, $3::int) g
           JOIN pairs p ON p.rn = (g % 200) + 1
           CROSS JOIN LATERAL (SELECT (ARRAY['OPEN','TRIAGE','AWAITING_APPROVAL','APPROVED','COMPLETED','COMPLETED','COMPLETED','CANCELLED'])[1 + (g % 8)] AS status) s
         RETURNING id, created_at
       )
       INSERT INTO order_events (organization_id, order_id, type, actor_type, created_at)
       SELECT $1, id, 'order.created', 'SYSTEM', created_at FROM ins`,
      [org, user.id, ORDERS_PER_ORG],
    );
    await db.query(`INSERT INTO order_counters (organization_id, last_number) VALUES ($1, $2)`, [
      org,
      ORDERS_PER_ORG,
    ]);
    // Visitas de diagnóstico sem sobreposição: uma por hora a partir de amanhã.
    await db.query(
      `INSERT INTO appointments (organization_id, order_id, technician_user_id, technician_membership_id, kind, starts_at, ends_at, created_by)
       SELECT $1, so.id, $2, $3, 'DIAGNOSTIC',
              date_trunc('hour', now()) + interval '1 day' + (row_number() OVER (ORDER BY so.number)) * interval '1 hour' + ($4 * interval '1 year'),
              date_trunc('hour', now()) + interval '1 day' + (row_number() OVER (ORDER BY so.number)) * interval '1 hour' + interval '50 minutes' + ($4 * interval '1 year'),
              $2
         FROM service_orders so WHERE so.organization_id = $1 AND so.status = 'TRIAGE' LIMIT 100`,
      [org, user.id, tech.rows[0]!.id, o],
    );
  }
  await db.query('ANALYZE');
  console.warn(
    `Massa sintética criada: ${ORGS} empresas × ${ORDERS_PER_ORG} ordens em ${((Date.now() - t0) / 1000).toFixed(1)} s.`,
  );
} finally {
  await db.end();
}
