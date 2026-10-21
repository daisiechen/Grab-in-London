-- T04 identity: provider identities mapped to stable business users, private contact, opaque
-- sessions grouped in families, rotating refresh tokens, one-shot auth transactions, staff roles.
-- Only hashes of tokens/codes/state are stored; plaintext credentials never touch the database.

CREATE TABLE private_contact (
  user_id           uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email             text NOT NULL CHECK (email = lower(email) AND position('@' IN email) > 1),
  email_verified_at timestamptz NOT NULL,
  updated_at        timestamptz NOT NULL DEFAULT clock_timestamp()
);
-- Email is not a unique business identity key; this index only finds LINK_REQUIRED candidates.
CREATE INDEX private_contact_email_idx ON private_contact (email);

CREATE TABLE identities (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  issuer         text NOT NULL,
  subject        text NOT NULL,
  provider       text NOT NULL CHECK (provider IN ('EMAIL', 'GOOGLE', 'APPLE')),
  email_verified boolean NOT NULL DEFAULT false,
  linked_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (issuer, subject)
);
CREATE INDEX identities_user_idx ON identities (user_id);

CREATE TABLE session_families (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind                text NOT NULL CHECK (kind IN ('WEB', 'IOS', 'SUPPORT_CLI')),
  auth_time           timestamptz NOT NULL,
  amr                 text[] NOT NULL CHECK (cardinality(amr) > 0),
  absolute_expires_at timestamptz NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT clock_timestamp(),
  revoked_at          timestamptz,
  revoke_reason       text CHECK (revoke_reason IN ('LOGOUT', 'REFRESH_REUSE', 'ACCOUNT_DELETION', 'LINK_SHELL', 'SUPPORT')),
  CHECK ((revoked_at IS NULL) = (revoke_reason IS NULL))
);
CREATE INDEX session_families_user_idx ON session_families (user_id) WHERE revoked_at IS NULL;

-- Web cookie tokens and iOS/CLI access tokens. Web CSRF tokens are HMAC(SESSION_SECRET, session id),
-- so nothing CSRF-related is stored.
CREATE TABLE sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id       uuid NOT NULL REFERENCES session_families(id) ON DELETE CASCADE,
  token_hash      text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at      timestamptz NOT NULL,
  idle_timeout    interval,
  last_used_at    timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_at      timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX sessions_family_idx ON sessions (family_id);

-- Rotation chain: consuming a token twice is reuse and revokes the whole family.
CREATE TABLE refresh_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id   uuid NOT NULL REFERENCES session_families(id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  parent_id   uuid REFERENCES refresh_tokens(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX refresh_tokens_one_child ON refresh_tokens (parent_id) WHERE parent_id IS NOT NULL;

-- One-shot OTP / OAuth / reauth / link / handoff transactions with minimal linkage data.
CREATE TABLE auth_transactions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind              text NOT NULL CHECK (kind IN ('EMAIL_OTP', 'OAUTH', 'LINK', 'HANDOFF')),
  purpose           text NOT NULL DEFAULT 'LOGIN' CHECK (purpose IN ('LOGIN', 'REAUTH')),
  client            text NOT NULL CHECK (client IN ('WEB', 'IOS', 'SUPPORT_CLI')),
  client_request_id uuid,
  user_id           uuid REFERENCES users(id) ON DELETE CASCADE,
  email_hash        text CHECK (email_hash ~ '^[0-9a-f]{64}$'),
  ip_hash           text CHECK (ip_hash ~ '^[0-9a-f]{64}$'),
  secret_hash       text UNIQUE CHECK (secret_hash ~ '^[0-9a-f]{64}$'),
  binder_hash       text CHECK (binder_hash ~ '^[0-9a-f]{64}$'),
  app_challenge     text CHECK (app_challenge ~ '^[A-Za-z0-9_-]{43,128}$'),
  provider          text CHECK (provider IN ('EMAIL', 'GOOGLE', 'APPLE')),
  provider_state    jsonb NOT NULL DEFAULT '{}'::jsonb,
  return_target     text,
  result_family_id  uuid REFERENCES session_families(id) ON DELETE SET NULL,
  attempts          integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts      integer NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
  expires_at        timestamptz NOT NULL,
  consumed_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (expires_at > created_at),
  CHECK (attempts <= max_attempts)
);
CREATE UNIQUE INDEX auth_transactions_client_request ON auth_transactions (kind, client_request_id) WHERE client_request_id IS NOT NULL;
CREATE INDEX auth_transactions_email_rate ON auth_transactions (email_hash, created_at) WHERE kind = 'EMAIL_OTP';
CREATE INDEX auth_transactions_ip_rate ON auth_transactions (ip_hash, created_at) WHERE kind = 'EMAIL_OTP';

CREATE TABLE roles (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('analyst', 'data_admin', 'support')),
  granted_by text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (user_id, role)
);
