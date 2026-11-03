import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { withTransaction, type Db } from '../src/db/pool.js';
import { MemoryMailer } from '../src/notifications/mailer.js';
import { claim, processOnce } from '../src/notifications/processor.js';
import { createInvitation } from '../src/organizations/invitations.js';
import { resetDatabase, testConfig } from './helpers.js';

describe('outbox e worker (T14, T15, T25)', () => {
  let db: Db;
  let orgId: string;
  const config = testConfig({ EMAIL_ALLOWED_RECIPIENTS: '@example.com' });

  beforeAll(async () => {
    db = await resetDatabase();
    orgId = (await db.query(`INSERT INTO organizations (name) VALUES ('Outbox Ltda') RETURNING id`))
      .rows[0].id;
  });
  beforeEach(async () => {
    await db.query(
      'DELETE FROM notification_deliveries; DELETE FROM outbox_events; DELETE FROM invitations;',
    );
  });
  afterAll(async () => db.end());

  const inviteTo = (email: string) =>
    withTransaction(db, (tx) =>
      createInvitation(tx, config, {
        organizationId: orgId,
        email,
        role: 'TECHNICIAN',
        invitedBy: null,
      }),
    );

  it('T14: evento criado com worker parado fica pendente e é enviado quando o worker volta', async () => {
    const inv = await inviteTo('tec@example.com');
    const pending = await db.query(`SELECT status FROM outbox_events`);
    expect(pending.rows).toEqual([{ status: 'PENDING' }]);
    const mailer = new MemoryMailer();
    expect(await processOnce({ db, config, mailer })).toEqual(['DONE']);
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]!.text).toContain(inv.link);
    const ev = (await db.query(`SELECT status, payload_encrypted FROM outbox_events`)).rows[0];
    expect(ev).toEqual({ status: 'DONE', payload_encrypted: null }); // segredo apagado após envio
    // Rodar de novo não reenvia.
    expect(await processOnce({ db, config, mailer })).toEqual([]);
  });

  it('falha transitória reagenda com backoff; não reenvia antes do prazo', async () => {
    await inviteTo('retry@example.com');
    const mailer = new MemoryMailer();
    mailer.failNext.push(new Error('ECONNRESET'));
    expect(await processOnce({ db, config, mailer })).toEqual(['RETRY']);
    const ev = (
      await db.query(
        `SELECT status, attempts, available_at > now() AS later, last_error FROM outbox_events`,
      )
    ).rows[0];
    expect(ev).toMatchObject({
      status: 'PENDING',
      attempts: 1,
      later: true,
      last_error: 'ECONNRESET',
    });
    expect(await processOnce({ db, config, mailer })).toEqual([]);
    await db.query(`UPDATE outbox_events SET available_at = now()`);
    expect(await processOnce({ db, config, mailer })).toEqual(['DONE']);
  });

  it('T15: worker que morre após adquirir o evento é substituído quando o lease vence', async () => {
    await inviteTo('lease@example.com');
    const claimed = await claim(db, 'worker-morto');
    expect(claimed).toHaveLength(1);
    const mailer = new MemoryMailer();
    expect(await processOnce({ db, config, mailer, workerId: 'worker-novo' })).toEqual([]); // lease ainda válido
    await db.query(`UPDATE outbox_events SET lease_expires_at = now() - interval '1 second'`);
    expect(await processOnce({ db, config, mailer, workerId: 'worker-novo' })).toEqual(['DONE']);
    expect(mailer.sent).toHaveLength(1);
  });

  it('dois workers concorrentes não adquirem o mesmo evento (SKIP LOCKED)', async () => {
    for (let i = 0; i < 6; i++) await inviteTo(`c${i}@example.com`);
    const [a, b] = await Promise.all([claim(db, 'w1', 6), claim(db, 'w2', 6)]);
    const ids = [...a, ...b].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(6);
  });

  it('T25: destinatário fora da lista permitida não recebe e-mail', async () => {
    await inviteTo('alguem@gmail.com');
    const mailer = new MemoryMailer();
    expect(await processOnce({ db, config, mailer })).toEqual(['BLOCKED']);
    expect(mailer.sent).toHaveLength(0);
    const d = (await db.query(`SELECT status FROM notification_deliveries`)).rows[0];
    expect(d.status).toBe('BLOCKED_BY_POLICY');
  });

  it('convite revogado antes do envio é suprimido (evento obsoleto)', async () => {
    await inviteTo('revogado@example.com');
    await db.query(`UPDATE invitations SET revoked_at = now()`);
    const mailer = new MemoryMailer();
    expect(await processOnce({ db, config, mailer })).toEqual(['SUPPRESSED']);
    expect(mailer.sent).toHaveLength(0);
  });
});
