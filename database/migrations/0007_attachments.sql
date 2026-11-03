-- 0007: anexos (fotos) privados. O objeto bruto fica em quarentena até validação.
CREATE TABLE attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  order_id uuid NOT NULL,
  appointment_id uuid,
  uploaded_by uuid NOT NULL REFERENCES "user" (id),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'READY', 'REJECTED')),
  raw_key text NOT NULL UNIQUE,
  object_key text UNIQUE,
  declared_type text NOT NULL CHECK (declared_type IN ('image/jpeg', 'image/png', 'image/webp')),
  declared_size int NOT NULL CHECK (declared_size BETWEEN 1 AND 5242880),
  size_bytes int,
  width int,
  height int,
  reject_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finalized_at timestamptz,
  FOREIGN KEY (organization_id, order_id) REFERENCES service_orders (organization_id, id),
  FOREIGN KEY (organization_id, appointment_id) REFERENCES appointments (organization_id, id),
  CHECK ((status = 'READY') = (object_key IS NOT NULL))
);
CREATE INDEX attachments_order_idx ON attachments (organization_id, order_id, created_at);
CREATE INDEX attachments_pending_idx ON attachments (created_at) WHERE status = 'PENDING';
