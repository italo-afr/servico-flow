import { z } from 'zod';
import { migrate } from './migrate.js';
import { createPool } from './pool.js';

const env = z.object({ DATABASE_URL: z.string().startsWith('postgres') }).safeParse(process.env);
if (!env.success) {
  console.error('DATABASE_URL ausente ou inválida. Veja .env.example.');
  process.exit(1);
}
const db = createPool(env.data.DATABASE_URL, 1);
try {
  const applied = await migrate(db, undefined, (m) => console.warn(m));
  console.warn(
    applied.length ? `${applied.length} migration(s) aplicada(s).` : 'Banco já atualizado.',
  );
} catch (err) {
  console.error((err as Error).message);
  process.exitCode = 1;
} finally {
  await db.end();
}
