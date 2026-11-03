-- 0002: identidade (tabelas do better-auth, geradas por getMigrations() da versão 1.7.15),
-- associações por empresa, convites, auditoria e outbox.

create table "user" ("id" uuid default pg_catalog.gen_random_uuid() not null primary key, "name" text not null, "email" text not null unique, "emailVerified" boolean not null, "image" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null);
create table "session" ("id" uuid default pg_catalog.gen_random_uuid() not null primary key, "expiresAt" timestamptz not null, "token" text not null unique, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null, "ipAddress" text, "userAgent" text, "userId" uuid not null references "user" ("id") on delete cascade);
create table "account" ("id" uuid default pg_catalog.gen_random_uuid() not null primary key, "accountId" text not null, "providerId" text not null, "userId" uuid not null references "user" ("id") on delete cascade, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" timestamptz, "refreshTokenExpiresAt" timestamptz, "scope" text, "password" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null);
create table "verification" ("id" uuid default pg_catalog.gen_random_uuid() not null primary key, "identifier" text not null, "value" text not null, "expiresAt" timestamptz not null, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null);
create table "rateLimit" ("id" uuid default pg_catalog.gen_random_uuid() not null primary key, "key" text not null unique, "count" integer not null, "lastRequest" bigint not null);
create index "session_userId_idx" on "session" ("userId");
create index "account_userId_idx" on "account" ("userId");
create index "verification_identifier_idx" on "verification" ("identifier");

-- Permite FKs compostas (organization_id, id) a partir das tabelas de negócio.
ALTER TABLE organizations ADD CONSTRAINT organizations_id_key UNIQUE (id);

CREATE TABLE memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  user_id uuid NOT NULL REFERENCES "user" (id),
  role text NOT NULL CHECK (role IN ('ADMIN', 'ATTENDANT', 'TECHNICIAN')),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REMOVED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id),
  UNIQUE (organization_id, id)
);
CREATE INDEX memberships_user_idx ON memberships (user_id) WHERE status = 'ACTIVE';

CREATE TABLE invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  email text NOT NULL CHECK (email = lower(email)),
  role text NOT NULL CHECK (role IN ('ADMIN', 'ATTENDANT', 'TECHNICIAN')),
  token_hash text NOT NULL UNIQUE,
  invited_by uuid REFERENCES "user" (id),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  consumed_by uuid REFERENCES "user" (id),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX invitations_org_idx ON invitations (organization_id, created_at DESC);

-- Auditoria: append-only pela aplicação (sem UPDATE/DELETE no código).
CREATE TABLE audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id uuid REFERENCES organizations (id),
  actor_type text NOT NULL CHECK (actor_type IN ('USER', 'CUSTOMER_LINK', 'SYSTEM')),
  actor_user_id uuid REFERENCES "user" (id),
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  outcome text NOT NULL DEFAULT 'SUCCESS' CHECK (outcome IN ('SUCCESS', 'DENIED', 'FAILED')),
  request_id text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_org_idx ON audit_events (organization_id, created_at DESC);

-- Outbox transacional (brief 11.7). payload mínimo; segredos vão em payload_encrypted.
CREATE TABLE outbox_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id uuid REFERENCES organizations (id),
  type text NOT NULL,
  schema_version int NOT NULL DEFAULT 1,
  payload jsonb NOT NULL DEFAULT '{}',
  payload_encrypted text,
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'PROCESSING', 'DONE', 'FAILED', 'SUPPRESSED')),
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 8,
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_owner text,
  lease_expires_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX outbox_pending_idx ON outbox_events (available_at) WHERE status IN ('PENDING', 'PROCESSING');

CREATE TABLE notification_deliveries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  outbox_event_id bigint NOT NULL REFERENCES outbox_events (id),
  channel text NOT NULL DEFAULT 'EMAIL',
  recipient text NOT NULL,
  status text NOT NULL CHECK (status IN ('ACCEPTED_BY_PROVIDER', 'BLOCKED_BY_POLICY', 'FAILED_PERMANENT')),
  provider_message_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (outbox_event_id, channel, recipient)
);

CREATE TABLE worker_heartbeats (
  worker_id text PRIMARY KEY,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
