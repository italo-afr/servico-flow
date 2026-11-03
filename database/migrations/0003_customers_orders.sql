-- 0003: clientes, locais, equipamentos, ordens, linha do tempo e idempotência.
-- Integridade multiempresa: toda referência inclui organization_id em FK composta,
-- então o banco recusa associar registro de outra empresa (T02) mesmo se a aplicação falhar.

CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  name text NOT NULL CHECK (length(name) BETWEEN 2 AND 160),
  phone text CHECK (length(phone) <= 40),
  email text CHECK (length(email) <= 254),
  notes text CHECK (length(notes) <= 2000),
  archived_at timestamptz,
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id)
);
CREATE INDEX customers_org_name_idx ON customers (organization_id, lower(name), id) WHERE archived_at IS NULL;

CREATE TABLE service_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  label text CHECK (length(label) <= 60),
  street text NOT NULL CHECK (length(street) BETWEEN 2 AND 200),
  number text CHECK (length(number) <= 20),
  complement text CHECK (length(complement) <= 100),
  district text CHECK (length(district) <= 100),
  city text NOT NULL CHECK (length(city) BETWEEN 2 AND 100),
  state text NOT NULL CHECK (state ~ '^[A-Z]{2}$'),
  postal_code text CHECK (postal_code ~ '^[0-9]{5}-?[0-9]{3}$'),
  access_notes text CHECK (length(access_notes) <= 500),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, customer_id) REFERENCES customers (organization_id, id),
  UNIQUE (organization_id, customer_id, id)
);
CREATE INDEX service_addresses_customer_idx ON service_addresses (organization_id, customer_id);

CREATE TABLE equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  description text NOT NULL CHECK (length(description) BETWEEN 2 AND 160),
  brand text CHECK (length(brand) <= 60),
  model text CHECK (length(model) <= 80),
  capacity_btu int CHECK (capacity_btu BETWEEN 1000 AND 1000000),
  serial_number text CHECK (length(serial_number) <= 80),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, customer_id) REFERENCES customers (organization_id, id),
  UNIQUE (organization_id, customer_id, id)
);
CREATE INDEX equipment_customer_idx ON equipment (organization_id, customer_id);

-- Contador por empresa: o UPSERT trava a linha, serializando a numeração (não usa count+1).
CREATE TABLE order_counters (
  organization_id uuid PRIMARY KEY REFERENCES organizations (id),
  last_number int NOT NULL
);

CREATE TABLE service_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  number int NOT NULL,
  customer_id uuid NOT NULL,
  address_id uuid NOT NULL,
  equipment_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN
    ('OPEN', 'TRIAGE', 'AWAITING_APPROVAL', 'APPROVED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  priority text NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
  description text NOT NULL CHECK (length(description) BETWEEN 3 AND 4000),
  triage_notes text CHECK (length(triage_notes) <= 4000),
  cancel_reason text CHECK (length(cancel_reason) <= 1000),
  assigned_user_id uuid REFERENCES "user" (id),
  created_by uuid NOT NULL REFERENCES "user" (id),
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  UNIQUE (organization_id, number),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, customer_id) REFERENCES customers (organization_id, id),
  -- endereço e equipamento precisam ser DO MESMO cliente e da mesma empresa
  FOREIGN KEY (organization_id, customer_id, address_id) REFERENCES service_addresses (organization_id, customer_id, id),
  FOREIGN KEY (organization_id, customer_id, equipment_id) REFERENCES equipment (organization_id, customer_id, id),
  CHECK ((status = 'CANCELLED') = (cancelled_at IS NOT NULL)),
  CHECK ((status = 'COMPLETED') = (completed_at IS NOT NULL))
);
CREATE INDEX service_orders_list_idx ON service_orders (organization_id, status, created_at DESC, id);
CREATE INDEX service_orders_created_idx ON service_orders (organization_id, created_at DESC, id);
CREATE INDEX service_orders_customer_idx ON service_orders (organization_id, customer_id);

-- Linha do tempo operacional. visible_to_customer permite uma visão filtrada no futuro.
CREATE TABLE order_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id uuid NOT NULL,
  order_id uuid NOT NULL,
  type text NOT NULL,
  actor_type text NOT NULL CHECK (actor_type IN ('USER', 'CUSTOMER_LINK', 'SYSTEM')),
  actor_user_id uuid REFERENCES "user" (id),
  data jsonb NOT NULL DEFAULT '{}',
  visible_to_customer boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, order_id) REFERENCES service_orders (organization_id, id)
);
CREATE INDEX order_events_order_idx ON order_events (order_id, id);
-- "Ordens sem atualização": último evento por ordem (brief 3.5).
CREATE INDEX order_events_org_created_idx ON order_events (organization_id, created_at DESC);

CREATE TABLE idempotency_records (
  organization_id uuid NOT NULL REFERENCES organizations (id),
  actor_user_id uuid NOT NULL,
  operation text NOT NULL,
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 100),
  request_hash text NOT NULL,
  response jsonb,
  status_code int,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  PRIMARY KEY (organization_id, actor_user_id, operation, idempotency_key)
);
CREATE INDEX idempotency_expires_idx ON idempotency_records (expires_at);
