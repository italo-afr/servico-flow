import { cp, mkdtemp, readdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrate, MIGRATIONS_DIR } from '../src/db/migrate.js';
import { createPool, type Db } from '../src/db/pool.js';
import { testDatabaseUrl } from './helpers.js';

describe('migrations (T20, T21)', () => {
  let db: Db;
  beforeAll(async () => {
    db = createPool(testDatabaseUrl(), 2);
    await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  });
  afterAll(async () => db.end());

  it('T21: atualizar a partir da versão anterior com dados preserva registros', async () => {
    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
    const previous = await mkdtemp(path.join(os.tmpdir(), 'sf-mig-'));
    for (const f of files.slice(0, -1))
      await cp(path.join(MIGRATIONS_DIR, f), path.join(previous, f));
    await migrate(db, previous);
    await db.query(`INSERT INTO organizations (name) VALUES ('Antes da atualização')`);
    const applied = await migrate(db); // aplica apenas a(s) nova(s)
    expect(applied).toEqual(files.slice(-1));
    const r = await db.query(`SELECT name FROM organizations`);
    expect(r.rows).toEqual([{ name: 'Antes da atualização' }]);
    expect(await migrate(db)).toEqual([]); // idempotente
  });

  it('migration já aplicada que foi alterada interrompe a execução', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'sf-mig-'));
    await cp(MIGRATIONS_DIR, dir, { recursive: true });
    await writeFile(path.join(dir, '0001_init.sql'), '-- alterada\nSELECT 1;');
    await expect(migrate(db, dir)).rejects.toThrow(/foi alterada/);
  });

  it('migration com erro faz rollback e não é registrada', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'sf-mig-'));
    await cp(MIGRATIONS_DIR, dir, { recursive: true });
    await writeFile(
      path.join(dir, '9999_quebrada.sql'),
      'CREATE TABLE ok_parcial (id int); SELECT * FROM tabela_inexistente;',
    );
    await expect(migrate(db, dir)).rejects.toThrow(/9999_quebrada/);
    const t = await db.query(`SELECT to_regclass('public.ok_parcial') AS t`);
    expect(t.rows[0].t).toBeNull();
    const reg = await db.query(
      `SELECT count(*)::int AS n FROM schema_migrations WHERE name = '9999_quebrada.sql'`,
    );
    expect(reg.rows[0].n).toBe(0);
  });
});
