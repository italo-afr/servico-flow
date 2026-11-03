-- 0008: estado dos alertas operacionais do avaliador embutido no worker.
-- Uma linha por regra: notifica só na TRANSIÇÃO (disparou / resolveu), não a cada avaliação.
CREATE TABLE ops_alerts (
  rule text PRIMARY KEY,
  state text NOT NULL CHECK (state IN ('FIRING', 'RESOLVED')),
  severity text NOT NULL CHECK (severity IN ('warning', 'critical')),
  summary text NOT NULL,
  value double precision,
  pending_since timestamptz,
  fired_at timestamptz,
  resolved_at timestamptz,
  last_evaluated_at timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz,
  notify_error text
);
