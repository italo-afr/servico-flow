/**
 * Dados FICTÍCIOS de demonstração/desenvolvimento. Recusa produção (brief 11.6).
 * Senha de todas as contas: demo-senha-123 (apenas local/demo).
 */
import { loadConfig } from '../config.js';
import { createAuth } from '../identity/auth.js';
import { createPool, withTransaction } from './pool.js';
import { seedDemo } from './seed.js';

const config = loadConfig();
if (config.APP_ENV === 'production' || config.APP_ENV === 'staging') {
  console.error(
    `Seed recusado: APP_ENV=${config.APP_ENV}. Dados de demonstração só em local/test/ci/demo.`,
  );
  process.exit(1);
}
const db = createPool(config.DATABASE_URL, 2);
try {
  const auth = createAuth(config, db);
  const summary = await seedDemo(db, auth, (fn) => withTransaction(db, fn));
  console.warn(summary);
} finally {
  await db.end();
}
