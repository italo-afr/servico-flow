import { createServer, type Server } from 'node:http';
import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from 'prom-client';
import { log } from '../common/logger.js';
import type { Db } from '../db/pool.js';

/**
 * Métricas Prometheus (brief 11.8). Regras de cardinalidade:
 * - rótulos só com valores de conjunto fechado (rota NORMALIZADA, método, classe de status);
 * - nunca e-mail, token, organizationId ou IDs únicos como rótulo.
 */
export function createMetrics(service: 'api' | 'worker') {
  const registry = new Registry();
  registry.setDefaultLabels({ service, release: process.env.RELEASE_SHA ?? 'dev' });
  collectDefaultMetrics({ register: registry, prefix: 'servicoflow_' });

  const httpRequests = new Counter({
    name: 'servicoflow_http_requests_total',
    help: 'Requisições HTTP por rota normalizada e classe de status.',
    labelNames: ['method', 'route', 'status_class'] as const,
    registers: [registry],
  });
  const httpDuration = new Histogram({
    name: 'servicoflow_http_request_duration_seconds',
    help: 'Latência das requisições HTTP.',
    labelNames: ['method', 'route'] as const,
    buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [registry],
  });
  const outboxProcessed = new Counter({
    name: 'servicoflow_outbox_processed_total',
    help: 'Eventos da outbox processados pelo worker, por resultado.',
    labelNames: ['result'] as const,
    registers: [registry],
  });
  const workerLoopErrors = new Counter({
    name: 'servicoflow_worker_loop_errors_total',
    help: 'Erros inesperados no laço do worker.',
    registers: [registry],
  });
  return { registry, httpRequests, httpDuration, outboxProcessed, workerLoopErrors };
}
export type Metrics = ReturnType<typeof createMetrics>;

/**
 * Indicadores de estado lidos do banco no momento da coleta (sem rótulo de empresa).
 * Registrados só na API, para não duplicar séries entre API e worker.
 */
export function registerStateGauges(m: Metrics, db: Db) {
  const reg = [m.registry];
  // Pool PRIMEIRO: coleta síncrona antes de as outras métricas usarem conexões,
  // senão o próprio scrape aparece como requisição em espera (falso positivo).
  new Gauge({
    name: 'servicoflow_db_pool_connections',
    help: 'Conexões do pool da aplicação por estado.',
    labelNames: ['state'] as const,
    registers: reg,
    collect() {
      this.set({ state: 'total' }, db.totalCount);
      this.set({ state: 'idle' }, db.idleCount);
      this.set({ state: 'waiting' }, db.waitingCount);
    },
  });
  new Gauge({
    name: 'servicoflow_outbox_events',
    help: 'Eventos da outbox por estado.',
    labelNames: ['status'] as const,
    registers: reg,
    async collect() {
      this.reset();
      const r = await db.query<{ status: string; n: number }>(
        `SELECT status, count(*)::int AS n FROM outbox_events GROUP BY status`,
      );
      for (const s of ['PENDING', 'PROCESSING', 'DONE', 'FAILED', 'SUPPRESSED']) {
        this.set({ status: s }, r.rows.find((x) => x.status === s)?.n ?? 0);
      }
    },
  });
  new Gauge({
    name: 'servicoflow_outbox_oldest_eligible_seconds',
    help: 'Idade do evento elegível (pendente e disponível) mais antigo; 0 se nenhum.',
    registers: reg,
    async collect() {
      const r = await db.query<{ s: number | null }>(
        `SELECT extract(epoch FROM now() - min(created_at))::float8 AS s FROM outbox_events
          WHERE (status = 'PENDING' AND available_at <= now()) OR (status = 'PROCESSING' AND lease_expires_at < now())`,
      );
      this.set(r.rows[0]?.s ?? 0);
    },
  });
  new Gauge({
    name: 'servicoflow_worker_heartbeat_age_seconds',
    help: 'Segundos desde o último sinal de qualquer worker (-1 se nunca houve).',
    registers: reg,
    async collect() {
      const r = await db.query<{ s: number | null }>(
        `SELECT extract(epoch FROM now() - max(last_seen_at))::float8 AS s FROM worker_heartbeats`,
      );
      this.set(r.rows[0]?.s ?? -1);
    },
  });
  new Gauge({
    name: 'servicoflow_db_connections_ratio',
    help: 'Fração de max_connections em uso no servidor PostgreSQL.',
    registers: reg,
    async collect() {
      const r = await db.query<{ ratio: number }>(
        `SELECT (SELECT count(*) FROM pg_stat_activity)::float8 / current_setting('max_connections')::float8 AS ratio`,
      );
      this.set(r.rows[0]?.ratio ?? 0);
    },
  });
  registerAlertGauge(m, db);
}

/** Estado do avaliador embutido (1 = disparado), para quem também usa Prometheus. */
export function registerAlertGauge(m: Metrics, db: Db) {
  new Gauge({
    name: 'servicoflow_ops_alert_firing',
    help: 'Alertas do avaliador embutido: 1 se disparado.',
    labelNames: ['rule', 'severity'] as const,
    registers: [m.registry],
    async collect() {
      this.reset();
      const r = await db.query<{ rule: string; severity: string; state: string }>(
        `SELECT rule, severity, state FROM ops_alerts`,
      );
      for (const a of r.rows)
        this.set({ rule: a.rule, severity: a.severity }, a.state === 'FIRING' ? 1 : 0);
    },
  });
}

/**
 * Servidor de métricas em porta INTERNA separada: o proxy público não a expõe.
 * Desligado quando METRICS_PORT=0.
 */
export function startMetricsServer(m: Metrics, port: number): Server | null {
  if (!port) return null;
  const server = createServer((req, res) => {
    if (req.url !== '/metrics') {
      res.writeHead(404).end();
      return;
    }
    m.registry
      .metrics()
      .then((body) => res.writeHead(200, { 'Content-Type': m.registry.contentType }).end(body))
      .catch((err: Error) => {
        log('error', 'metrics_failed', { error: err.message });
        res.writeHead(500).end();
      });
  });
  server.listen(port, '0.0.0.0', () => log('info', 'metrics_listening', { port }));
  return server;
}
