import type { Auth } from '../identity/auth.js';
import type { Role } from '../identity/policy.js';
import type { Db, Tx } from './pool.js';

export const DEMO_PASSWORD = 'demo-senha-123';

const ORGS: { name: string; people: { name: string; email: string; role: Role }[] }[] = [
  {
    name: 'Clima Norte Manutenção (fictícia)',
    people: [
      { name: 'Ana Administradora', email: 'ana@clima-norte.example.com', role: 'ADMIN' },
      { name: 'Beto Atendente', email: 'beto@clima-norte.example.com', role: 'ATTENDANT' },
      { name: 'Caio Técnico', email: 'caio@clima-norte.example.com', role: 'TECHNICIAN' },
      { name: 'Duda Técnica', email: 'duda@clima-norte.example.com', role: 'TECHNICIAN' },
    ],
  },
  {
    name: 'Gelo Sul Refrigeração (fictícia)',
    people: [
      { name: 'Eva Administradora', email: 'eva@gelo-sul.example.com', role: 'ADMIN' },
      { name: 'Fábio Atendente', email: 'fabio@gelo-sul.example.com', role: 'ATTENDANT' },
      // técnico em duas empresas: capacidade exclusiva entre empresas (brief 5.3)
      { name: 'Caio Técnico', email: 'caio@clima-norte.example.com', role: 'TECHNICIAN' },
    ],
  },
];

/** Idempotente: pode ser rodado várias vezes. */
export async function seedDemo(
  db: Db,
  auth: Auth,
  tx: <T>(fn: (t: Tx) => Promise<T>) => Promise<T>,
): Promise<string> {
  const lines: string[] = [];
  for (const o of ORGS) {
    let orgId = (
      await db.query<{ id: string }>(`SELECT id FROM organizations WHERE name = $1`, [o.name])
    ).rows[0]?.id;
    if (!orgId) {
      orgId = (
        await db.query<{ id: string }>(
          `INSERT INTO organizations (name, is_demo) VALUES ($1, true) RETURNING id`,
          [o.name],
        )
      ).rows[0]!.id;
    }
    for (const p of o.people) {
      let userId = (
        await db.query<{ id: string }>(`SELECT id FROM "user" WHERE email = $1`, [p.email])
      ).rows[0]?.id;
      if (!userId) {
        userId = (
          await auth.api.signUpEmail({
            body: { email: p.email, password: DEMO_PASSWORD, name: p.name },
          })
        ).user.id;
        await db.query(`UPDATE "user" SET "emailVerified" = true WHERE id = $1`, [userId]);
      }
      await tx((t) =>
        t.query(
          `INSERT INTO memberships (organization_id, user_id, role) VALUES ($1, $2, $3)
           ON CONFLICT (organization_id, user_id) DO NOTHING`,
          [orgId, userId, p.role],
        ),
      );
    }
    lines.push(`${o.name}: ${o.people.map((p) => `${p.email} (${p.role})`).join(', ')}`);
  }
  return `Seed fictício aplicado. Senha: ${DEMO_PASSWORD}\n${lines.join('\n')}`;
}
