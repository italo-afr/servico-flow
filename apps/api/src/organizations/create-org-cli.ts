/**
 * Criação controlada de empresa (brief 4.3 passo 1): executada por operador com acesso
 * ao ambiente, nunca por rota pública. Cria a empresa e um convite de ADMIN.
 *
 * pnpm --filter @servicoflow/api org:create -- --name "Clima Norte" --admin-email dono@exemplo.com
 */
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { loadConfig } from '../config.js';
import { createPool, withTransaction } from '../db/pool.js';
import { createInvitation } from './invitations.js';

const { values } = parseArgs({
  options: {
    name: { type: 'string' },
    'admin-email': { type: 'string' },
    timezone: { type: 'string', default: 'America/Sao_Paulo' },
  },
});
const args = z
  .object({
    name: z.string().trim().min(2).max(120),
    'admin-email': z.email().transform((e) => e.toLowerCase()),
    timezone: z
      .string()
      .refine((tz) => Intl.supportedValuesOf('timeZone').includes(tz), 'fuso IANA inválido'),
  })
  .safeParse(values);
if (!args.success) {
  console.error(
    'Uso: org:create --name "Empresa" --admin-email pessoa@dominio [--timezone America/Sao_Paulo]',
  );
  console.error(args.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n'));
  process.exit(1);
}
const config = loadConfig();
const db = createPool(config.DATABASE_URL, 2);
try {
  const result = await withTransaction(db, async (tx) => {
    const org = await tx.query<{ id: string }>(
      `INSERT INTO organizations (name, timezone, is_demo) VALUES ($1, $2, $3) RETURNING id`,
      [args.data.name, args.data.timezone, config.DEMO_MODE],
    );
    const id = org.rows[0]!.id;
    const inv = await createInvitation(tx, config, {
      organizationId: id,
      email: args.data['admin-email'],
      role: 'ADMIN',
      invitedBy: null,
    });
    return { id, inv };
  });
  console.warn(`Empresa criada: ${result.id}`);
  console.warn(
    `Convite de administrador enfileirado para ${args.data['admin-email']} (envio pelo worker).`,
  );
  if (config.APP_ENV === 'local')
    console.warn(`[somente local] link do convite: ${result.inv.link}`);
} finally {
  await db.end();
}
