import type { AppConfig } from '../config.js';
import { log } from '../common/logger.js';
import type { Db } from '../db/pool.js';
import { recipientAllowed, type Mailer } from '../notifications/mailer.js';

/**
 * Avaliador de alertas embutido no worker (funciona sem Prometheus).
 * Cobre condições visíveis no banco. Queda TOTAL do worker, da API ou do host
 * só é detectada de fora: ver infra/observability/alerts.yml (Prometheus).
 */
export interface AlertRule {
  name: string;
  severity: 'warning' | 'critical';
  summary: string;
  /** Tempo que a condição precisa durar antes de disparar (evita ruído). */
  forSeconds: number;
  /** Valor atual medido no banco. */
  measure(db: Pick<Db, 'query'>): Promise<number>;
  /** Condição de disparo para o valor medido. */
  firing(value: number): boolean;
}

export const ALERT_RULES: AlertRule[] = [
  {
    name: 'outbox_stalled',
    severity: 'critical',
    summary:
      'Há notificação elegível esperando há mais de 5 minutos (worker parado ou provedor de e-mail fora).',
    forSeconds: 0, // a própria medida já é uma janela de 5 min
    async measure(db) {
      const r = await db.query<{ s: number | null }>(
        `SELECT extract(epoch FROM now() - min(created_at))::float8 AS s FROM outbox_events
          WHERE (status = 'PENDING' AND available_at <= now()) OR (status = 'PROCESSING' AND lease_expires_at < now())`,
      );
      return r.rows[0]?.s ?? 0;
    },
    firing: (s) => s > 300,
  },
  {
    name: 'outbox_failed_recent',
    severity: 'warning',
    summary: 'Notificações com falha definitiva nas últimas 24 h; verifique o painel Operação.',
    forSeconds: 0,
    async measure(db) {
      const r = await db.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM outbox_events WHERE status = 'FAILED' AND created_at > now() - interval '24 hours'`,
      );
      return r.rows[0]?.n ?? 0;
    },
    firing: (n) => n > 0,
  },
  {
    name: 'quote_expiration_lagging',
    severity: 'warning',
    summary:
      'Orçamentos vencidos há mais de 15 min ainda aparecem como enviados (job de expiração atrasado).',
    forSeconds: 0,
    async measure(db) {
      const r = await db.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM quotes WHERE status = 'SENT' AND expires_at < now() - interval '15 minutes'`,
      );
      return r.rows[0]?.n ?? 0;
    },
    firing: (n) => n > 0,
  },
  {
    name: 'db_connections_high',
    severity: 'warning',
    summary: 'Mais de 80% das conexões do PostgreSQL em uso por 5 minutos.',
    forSeconds: 300,
    async measure(db) {
      const r = await db.query<{ ratio: number }>(
        `SELECT (SELECT count(*) FROM pg_stat_activity)::float8 / current_setting('max_connections')::float8 AS ratio`,
      );
      return r.rows[0]?.ratio ?? 0;
    },
    firing: (ratio) => ratio > 0.8,
  },
];

interface AlertState {
  rule: string;
  state: 'FIRING' | 'RESOLVED';
  pending_since: Date | null;
}

export interface Transition {
  rule: string;
  to: 'FIRING' | 'RESOLVED';
  severity: string;
  summary: string;
  value: number;
}

/**
 * Avalia as regras e grava o estado. Retorna só as TRANSIÇÕES
 * (para notificar uma vez ao disparar e uma vez ao resolver).
 */
export async function evaluateAlerts(
  db: Db,
  rules = ALERT_RULES,
  now = new Date(),
): Promise<Transition[]> {
  const transitions: Transition[] = [];
  const current = new Map(
    (await db.query<AlertState>(`SELECT rule, state, pending_since FROM ops_alerts`)).rows.map(
      (r) => [r.rule, r],
    ),
  );
  for (const rule of rules) {
    const value = await rule.measure(db);
    const prev = current.get(rule.name);
    const wasFiring = prev?.state === 'FIRING';
    if (rule.firing(value)) {
      const pendingSince = prev?.pending_since ?? now;
      const due = (now.getTime() - new Date(pendingSince).getTime()) / 1000 >= rule.forSeconds;
      const firing = wasFiring || due;
      await db.query(
        `INSERT INTO ops_alerts (rule, state, severity, summary, value, pending_since, fired_at, last_evaluated_at)
         VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $2 = 'FIRING' THEN $7::timestamptz END, $7)
         ON CONFLICT (rule) DO UPDATE SET state = EXCLUDED.state, severity = EXCLUDED.severity, summary = EXCLUDED.summary,
           value = EXCLUDED.value, pending_since = coalesce(ops_alerts.pending_since, EXCLUDED.pending_since),
           fired_at = CASE WHEN ops_alerts.state = 'FIRING' THEN ops_alerts.fired_at ELSE EXCLUDED.fired_at END,
           resolved_at = CASE WHEN EXCLUDED.state = 'FIRING' THEN NULL ELSE ops_alerts.resolved_at END,
           last_evaluated_at = EXCLUDED.last_evaluated_at`,
        [
          rule.name,
          firing ? 'FIRING' : 'RESOLVED',
          rule.severity,
          rule.summary,
          value,
          pendingSince,
          now,
        ],
      );
      if (firing && !wasFiring)
        transitions.push({
          rule: rule.name,
          to: 'FIRING',
          severity: rule.severity,
          summary: rule.summary,
          value,
        });
    } else {
      await db.query(
        `INSERT INTO ops_alerts (rule, state, severity, summary, value, last_evaluated_at) VALUES ($1, 'RESOLVED', $2, $3, $4, $5)
         ON CONFLICT (rule) DO UPDATE SET state = 'RESOLVED', value = EXCLUDED.value, pending_since = NULL,
           resolved_at = CASE WHEN ops_alerts.state = 'FIRING' THEN EXCLUDED.last_evaluated_at ELSE ops_alerts.resolved_at END,
           last_evaluated_at = EXCLUDED.last_evaluated_at`,
        [rule.name, rule.severity, rule.summary, value, now],
      );
      if (wasFiring)
        transitions.push({
          rule: rule.name,
          to: 'RESOLVED',
          severity: rule.severity,
          summary: rule.summary,
          value,
        });
    }
  }
  return transitions;
}

/**
 * Notifica transições DIRETO pelo mailer, sem passar pela outbox: o alerta mais
 * importante ("outbox parada") não pode depender da própria outbox.
 */
export async function notifyTransitions(
  db: Db,
  config: AppConfig,
  mailer: Mailer,
  transitions: Transition[],
): Promise<void> {
  for (const t of transitions) {
    log(
      t.to === 'FIRING' ? 'warn' : 'info',
      t.to === 'FIRING' ? 'ops_alert_firing' : 'ops_alert_resolved',
      {
        rule: t.rule,
        severity: t.severity,
        value: t.value,
      },
    );
    const to = config.OPS_ALERT_EMAIL;
    if (!to || !recipientAllowed(config, to)) continue;
    try {
      await mailer.send({
        to,
        subject: `[ServiçoFlow ${config.APP_ENV}] ${t.to === 'FIRING' ? 'ALERTA' : 'Resolvido'}: ${t.rule}`,
        text: `${t.summary}\n\nValor medido: ${t.value}\nSeveridade: ${t.severity}\nVersão: ${config.RELEASE_SHA}\nRunbook: docs/runbooks.md`,
        idempotencyKey: `alert-${t.rule}-${t.to}-${Date.now()}`,
      });
      await db.query(
        `UPDATE ops_alerts SET notified_at = now(), notify_error = NULL WHERE rule = $1`,
        [t.rule],
      );
    } catch (err) {
      await db.query(`UPDATE ops_alerts SET notify_error = $2 WHERE rule = $1`, [
        t.rule,
        (err as Error).message.slice(0, 300),
      ]);
    }
  }
}

const LOCK_KEY = 727_003;

/** Uma rodada protegida por advisory lock: com dois workers, só um avalia e notifica. */
export async function runAlertEvaluation(
  db: Db,
  config: AppConfig,
  mailer: Mailer,
): Promise<Transition[]> {
  const client = await db.connect();
  try {
    const got = await client.query<{ ok: boolean }>('SELECT pg_try_advisory_lock($1) AS ok', [
      LOCK_KEY,
    ]);
    if (!got.rows[0]?.ok) return [];
    try {
      const transitions = await evaluateAlerts(db);
      await notifyTransitions(db, config, mailer, transitions);
      return transitions;
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]);
    }
  } finally {
    client.release();
  }
}
