-- 0001: extensões e empresa (organização).
-- btree_gist: necessário para constraints de exclusão que combinam igualdade (técnico)
-- e sobreposição de intervalos (agenda) — brief 5.3.
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()

CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(name) BETWEEN 2 AND 120),
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  contact_email text,
  contact_phone text,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
