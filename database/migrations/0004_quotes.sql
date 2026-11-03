-- 0004: orçamentos versionados, itens, tokens de decisão e sessões de acesso do cliente.
-- Valores em centavos (bigint) com limites explícitos (brief 5.2).

CREATE TABLE quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  order_id uuid NOT NULL,
  version int NOT NULL CHECK (version > 0),
  status text NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'SUPERSEDED', 'CANCELLED')),
  subtotal_cents bigint NOT NULL DEFAULT 0 CHECK (subtotal_cents BETWEEN 0 AND 100000000000),
  discount_cents bigint NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
  total_cents bigint NOT NULL DEFAULT 0 CHECK (total_cents >= 0),
  valid_days int NOT NULL DEFAULT 7 CHECK (valid_days BETWEEN 1 AND 60),
  notes text CHECK (length(notes) <= 2000),
  recipient_email text CHECK (length(recipient_email) <= 254),
  snapshot jsonb,
  sent_at timestamptz,
  expires_at timestamptz,
  decided_at timestamptz,
  correlation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  row_version int NOT NULL DEFAULT 1,
  created_by uuid NOT NULL REFERENCES "user" (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  UNIQUE (order_id, version),
  FOREIGN KEY (organization_id, order_id) REFERENCES service_orders (organization_id, id),
  CHECK (discount_cents <= subtotal_cents),
  CHECK (total_cents = subtotal_cents - discount_cents),
  -- versão enviada tem snapshot, envio e validade
  CHECK (status = 'DRAFT' OR status = 'CANCELLED' OR (snapshot IS NOT NULL AND sent_at IS NOT NULL AND expires_at IS NOT NULL)),
  CHECK ((status IN ('ACCEPTED', 'REJECTED')) = (decided_at IS NOT NULL))
);
-- No máximo UMA versão aberta (rascunho ou enviada) por ordem: só uma vigente para decisão.
CREATE UNIQUE INDEX quotes_one_open_per_order ON quotes (order_id) WHERE status IN ('DRAFT', 'SENT');
CREATE INDEX quotes_expiring_idx ON quotes (expires_at) WHERE status = 'SENT';

CREATE TABLE quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  quote_id uuid NOT NULL,
  position int NOT NULL CHECK (position BETWEEN 1 AND 50),
  description text NOT NULL CHECK (length(description) BETWEEN 2 AND 300),
  quantity int NOT NULL CHECK (quantity BETWEEN 1 AND 10000),
  unit_price_cents bigint NOT NULL CHECK (unit_price_cents BETWEEN 0 AND 10000000000),
  line_total_cents bigint NOT NULL,
  FOREIGN KEY (organization_id, quote_id) REFERENCES quotes (organization_id, id) ON DELETE CASCADE,
  UNIQUE (quote_id, position),
  CHECK (line_total_cents = quantity * unit_price_cents)
);

-- Versão enviada é imutável: o banco recusa alterar itens de orçamento que não é rascunho.
CREATE FUNCTION quote_items_only_in_draft() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s text;
BEGIN
  SELECT status INTO s FROM quotes WHERE id = coalesce(NEW.quote_id, OLD.quote_id);
  IF s IS DISTINCT FROM 'DRAFT' THEN
    RAISE EXCEPTION 'itens de orçamento % são imutáveis', s USING ERRCODE = '23514';
  END IF;
  RETURN coalesce(NEW, OLD);
END $$;
CREATE TRIGGER quote_items_immutable BEFORE INSERT OR UPDATE OR DELETE ON quote_items
  FOR EACH ROW EXECUTE FUNCTION quote_items_only_in_draft();

CREATE FUNCTION quotes_freeze_sent() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status <> 'DRAFT' AND (
       NEW.snapshot IS DISTINCT FROM OLD.snapshot OR NEW.total_cents <> OLD.total_cents
       OR NEW.subtotal_cents <> OLD.subtotal_cents OR NEW.discount_cents <> OLD.discount_cents
       OR NEW.expires_at IS DISTINCT FROM OLD.expires_at OR NEW.notes IS DISTINCT FROM OLD.notes
       OR NEW.version <> OLD.version OR NEW.order_id <> OLD.order_id) THEN
    RAISE EXCEPTION 'orçamento enviado é imutável' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER quotes_immutable BEFORE UPDATE ON quotes FOR EACH ROW EXECUTE FUNCTION quotes_freeze_sent();

CREATE TABLE decision_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  quote_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, quote_id) REFERENCES quotes (organization_id, id)
);
CREATE INDEX decision_tokens_quote_idx ON decision_tokens (quote_id);

-- Contexto curto após trocar o token (cookie HttpOnly), limitado a UM orçamento.
CREATE TABLE quote_access_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  quote_id uuid NOT NULL,
  token_id uuid NOT NULL REFERENCES decision_tokens (id),
  session_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, quote_id) REFERENCES quotes (organization_id, id)
);
