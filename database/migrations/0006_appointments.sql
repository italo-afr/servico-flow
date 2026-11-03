-- 0006: visitas (diagnóstico e execução) e relatórios de execução.

CREATE TABLE appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  order_id uuid NOT NULL,
  technician_user_id uuid NOT NULL REFERENCES "user" (id),
  technician_membership_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('DIAGNOSTIC', 'EXECUTION')),
  status text NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  -- Intervalo semiaberto [início, fim): uma visita pode começar quando outra termina.
  period tstzrange GENERATED ALWAYS AS (tstzrange(starts_at, ends_at, '[)')) STORED,
  notes text CHECK (length(notes) <= 1000),
  cancel_reason text CHECK (length(cancel_reason) <= 1000),
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid NOT NULL REFERENCES "user" (id),
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, order_id) REFERENCES service_orders (organization_id, id),
  -- o técnico precisa ser membro DESTA empresa
  FOREIGN KEY (organization_id, technician_membership_id) REFERENCES memberships (organization_id, id),
  CHECK (ends_at > starts_at),
  CHECK (ends_at - starts_at <= interval '12 hours'),
  -- Capacidade exclusiva do técnico em TODAS as empresas (brief 5.3): sem organization_id aqui.
  -- O banco recusa duas reservas ativas sobrepostas mesmo com requisições concorrentes (T10).
  CONSTRAINT appointments_no_overlap EXCLUDE USING gist (technician_user_id WITH =, period WITH &&)
    WHERE (status IN ('SCHEDULED', 'IN_PROGRESS'))
);
-- No máximo uma execução ativa por ordem.
CREATE UNIQUE INDEX appointments_one_active_execution ON appointments (order_id)
  WHERE kind = 'EXECUTION' AND status IN ('SCHEDULED', 'IN_PROGRESS');
CREATE INDEX appointments_org_period_idx ON appointments USING gist (organization_id, period);
CREATE INDEX appointments_order_idx ON appointments (organization_id, order_id);
CREATE INDEX appointments_tech_idx ON appointments (technician_user_id, starts_at);

CREATE TABLE execution_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  appointment_id uuid NOT NULL,
  author_user_id uuid NOT NULL REFERENCES "user" (id),
  summary text NOT NULL CHECK (length(summary) BETWEEN 5 AND 4000),
  acted_for_other_reason text CHECK (length(acted_for_other_reason) <= 500),
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (appointment_id), -- uma conclusão por visita (T13)
  FOREIGN KEY (organization_id, appointment_id) REFERENCES appointments (organization_id, id)
);
