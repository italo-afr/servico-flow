// Recria o banco E2E (somente *_e2e). Executado antes de a API do E2E iniciar.
import pg from 'pg';
const url = process.env.DATABASE_URL;
const name = new URL(url).pathname.slice(1);
if (!name.endsWith('_e2e')) {
  console.error(`Recusado: banco "${name}" não termina em _e2e.`);
  process.exit(1);
}
const c = new pg.Client({ connectionString: url });
await c.connect();
await c.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
await c.end();
