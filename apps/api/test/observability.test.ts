import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { createApp } from '../src/app.js';
import type { Db } from '../src/db/pool.js';
import { MemoryMailer } from '../src/notifications/mailer.js';
import {
  ALERT_RULES,
  evaluateAlerts,
  notifyTransitions,
  type AlertRule,
} from '../src/observability/alerts.js';
import { createMetrics, registerStateGauges, type Metrics } from '../src/observability/metrics.js';
import { fixtures, ORIGIN } from './fixtures.js';
import { resetDatabase, testConfig } from './helpers.js';

describe('monitoramento e alertas', () => {
  let db: Db;
  let app: NestExpressApplication;
  let metrics: Metrics;
  let f: ReturnType<typeof fixtures>;
  let org: string;

  beforeAll(async () => {
    db = await resetDatabase();
    metrics = createMetrics('api');
    registerStateGauges(metrics, db);
    app = await createApp(testConfig({ AUTH_RATE_LIMIT: 'false' }), db, undefined, metrics);
    await app.init();
    f = fixtures(app, db);
    org = await f.newOrg('Métricas Ltda');
  });
  afterAll(async () => {
    await app.close();
    await db.end();
  });

  describe('métricas Prometheus', () => {
    it('contam requisições por rota NORMALIZADA, sem IDs nem organização nos rótulos', async () => {
      const admin = (await f.member(org, 'ADMIN')).agent;
      await admin.get(`/api/v1/organizations/${org}/members`);
      await admin.get(`/api/v1/organizations/${org}/orders/00000000-0000-4000-8000-000000000000`);
      const text = await metrics.registry.metrics();
      expect(text).toMatch(
        /servicoflow_http_requests_total\{[^}]*route="\/api\/v1\/organizations\/:orgId\/members"[^}]*status_class="2xx"/,
      );
      expect(text).toMatch(
        /route="\/api\/v1\/organizations\/:orgId\/orders\/:id"[^}]*status_class="4xx"/,
      );
      expect(text).toContain('servicoflow_http_request_duration_seconds_bucket');
      expect(text).not.toContain(org); // nenhum organizationId como rótulo
      expect(text).not.toMatch(/@example\.com/);
    });

    it('expõem estado da fila, heartbeat, pool e conexões', async () => {
      await db.query(`DELETE FROM outbox_events`);
      await db.query(
        `INSERT INTO outbox_events (type, created_at) VALUES ('invitation.created', now() - interval '10 minutes')`,
      );
      const text = await metrics.registry.metrics();
      expect(text).toMatch(/servicoflow_outbox_events\{[^}]*status="PENDING"[^}]*\} 1/);
      const oldest = Number(
        /servicoflow_outbox_oldest_eligible_seconds\{[^}]*\} ([\d.]+)/.exec(text)?.[1],
      );
      expect(oldest).toBeGreaterThan(590);
      expect(text).toMatch(/servicoflow_worker_heartbeat_age_seconds\{[^}]*\} -1/); // nenhum worker até agora
      expect(text).toContain('servicoflow_db_pool_connections');
      expect(text).toContain('servicoflow_db_connections_ratio');
      expect(text).toContain('servicoflow_process_resident_memory_bytes');
      await db.query(`DELETE FROM outbox_events`);
    });
  });

  describe('avaliador de alertas embutido', () => {
    beforeEach(async () => {
      await db.query(`DELETE FROM ops_alerts; DELETE FROM outbox_events;`);
    });

    it('notifica uma vez ao disparar e uma vez ao resolver (sem repetir a cada avaliação)', async () => {
      await db.query(
        `INSERT INTO outbox_events (type, created_at) VALUES ('invitation.created', now() - interval '6 minutes')`,
      );
      const rules = ALERT_RULES.filter((r) => r.name === 'outbox_stalled');
      const first = await evaluateAlerts(db, rules);
      expect(first).toEqual([
        expect.objectContaining({ rule: 'outbox_stalled', to: 'FIRING', severity: 'critical' }),
      ]);
      expect(await evaluateAlerts(db, rules)).toEqual([]); // continua disparado, sem nova notificação
      await db.query(`UPDATE outbox_events SET status = 'DONE'`);
      expect(await evaluateAlerts(db, rules)).toEqual([
        expect.objectContaining({ to: 'RESOLVED' }),
      ]);
      expect(await evaluateAlerts(db, rules)).toEqual([]);
      const row = (
        await db.query(
          `SELECT state, fired_at IS NOT NULL AS fired, resolved_at IS NOT NULL AS resolved FROM ops_alerts`,
        )
      ).rows[0];
      expect(row).toEqual({ state: 'RESOLVED', fired: true, resolved: true });
    });

    it('fila recente (< 5 min) não dispara: evita ruído', async () => {
      await db.query(`INSERT INTO outbox_events (type) VALUES ('invitation.created')`);
      expect(
        await evaluateAlerts(
          db,
          ALERT_RULES.filter((r) => r.name === 'outbox_stalled'),
        ),
      ).toEqual([]);
    });

    it('respeita a janela "for": só dispara depois que a condição dura o tempo mínimo', async () => {
      let value = 1;
      const rule: AlertRule = {
        name: 'teste_for',
        severity: 'warning',
        summary: 'teste',
        forSeconds: 300,
        measure: async () => value,
        firing: (v) => v > 0,
      };
      const t0 = new Date();
      expect(await evaluateAlerts(db, [rule], t0)).toEqual([]); // pendente
      expect(await evaluateAlerts(db, [rule], new Date(t0.getTime() + 120_000))).toEqual([]);
      expect(await evaluateAlerts(db, [rule], new Date(t0.getTime() + 301_000))).toHaveLength(1);
      value = 0;
      expect(await evaluateAlerts(db, [rule], new Date(t0.getTime() + 400_000))).toEqual([
        expect.objectContaining({ to: 'RESOLVED' }),
      ]);
      // condição volta: recomeça a janela
      value = 1;
      expect(await evaluateAlerts(db, [rule], new Date(t0.getTime() + 410_000))).toEqual([]);
    });

    it('envia direto pelo mailer (não depende da outbox) e só para destinatário permitido', async () => {
      const mailer = new MemoryMailer();
      const t = [
        {
          rule: 'outbox_stalled',
          to: 'FIRING' as const,
          severity: 'critical',
          summary: 'fila parada',
          value: 400,
        },
      ];
      await db.query(
        `INSERT INTO ops_alerts (rule, state, severity, summary) VALUES ('outbox_stalled', 'FIRING', 'critical', 'x')`,
      );
      await notifyTransitions(
        db,
        testConfig({
          OPS_ALERT_EMAIL: 'ops@example.com',
          EMAIL_ALLOWED_RECIPIENTS: '@example.com',
        }),
        mailer,
        t,
      );
      expect(mailer.sent).toHaveLength(1);
      expect(mailer.sent[0]!.subject).toContain('ALERTA: outbox_stalled');
      expect((await db.query(`SELECT count(*)::int AS n FROM outbox_events`)).rows[0].n).toBe(0);
      expect(
        (await db.query(`SELECT notified_at IS NOT NULL AS ok FROM ops_alerts`)).rows[0].ok,
      ).toBe(true);
      const blocked = new MemoryMailer();
      await notifyTransitions(
        db,
        testConfig({ OPS_ALERT_EMAIL: 'ops@gmail.com', EMAIL_ALLOWED_RECIPIENTS: '@example.com' }),
        blocked,
        t,
      );
      expect(blocked.sent).toHaveLength(0);
    });

    it('falha definitiva recente e expiração atrasada disparam avisos', async () => {
      await db.query(
        `INSERT INTO outbox_events (type, status) VALUES ('invitation.created', 'FAILED')`,
      );
      const r = await evaluateAlerts(
        db,
        ALERT_RULES.filter((x) => x.name === 'outbox_failed_recent'),
      );
      expect(r).toEqual([
        expect.objectContaining({ rule: 'outbox_failed_recent', to: 'FIRING', value: 1 }),
      ]);
    });

    it('a métrica servicoflow_ops_alert_firing reflete o estado', async () => {
      await db.query(
        `INSERT INTO ops_alerts (rule, state, severity, summary) VALUES ('outbox_stalled', 'FIRING', 'critical', 'x')`,
      );
      const text = await metrics.registry.metrics();
      expect(text).toMatch(/servicoflow_ops_alert_firing\{[^}]*rule="outbox_stalled"[^}]*\} 1/);
    });
  });

  it('a API pública não expõe /metrics (porta interna separada)', async () => {
    const res = await f.login((await f.member(org, 'ADMIN')).email);
    expect((await res.get('/api/v1/metrics')).status).toBe(404);
    expect((await res.post('/api/v1/metrics').set('Origin', ORIGIN)).status).toBe(404);
  });
});
