import { loadConfig, type AppConfig } from '../src/config.js';
import { createApp } from '../src/app.js';
import { migrate } from '../src/db/migrate.js';
import { createPool, type Db } from '../src/db/pool.js';

/**
 * Banco de teste real (PostgreSQL). Proteção contra uso acidental:
 * o nome do banco precisa terminar em "_test".
 */
export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL não definida (veja .env.example).');
  const name = new URL(url).pathname.slice(1);
  if (!name.endsWith('_test')) throw new Error(`Recusado: banco "${name}" não termina em _test.`);
  return url;
}

export function testConfig(overrides: Partial<Record<string, string>> = {}): AppConfig {
  return loadConfig({
    NODE_ENV: 'test',
    APP_ENV: 'test',
    DATABASE_URL: testDatabaseUrl(),
    PUBLIC_APP_URL: 'http://localhost:3000',
    SESSION_SECRET: 'test-secret-test-secret-test-secret-123',
    TOKEN_PAYLOAD_ENCRYPTION_KEY: 'a'.repeat(64),
    RELEASE_SHA: 'test',
    ...overrides,
  });
}

/** Recria o schema public do banco de teste e aplica todas as migrations. */
export async function resetDatabase(): Promise<Db> {
  const db = createPool(testDatabaseUrl(), 20);
  await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await migrate(db);
  return db;
}

export async function startApp(db: Db, overrides: Partial<Record<string, string>> = {}) {
  const app = await createApp(testConfig(overrides), db);
  await app.init();
  return app;
}
