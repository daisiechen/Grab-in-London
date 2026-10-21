-- T02 core kernel: generic tables only. Business tables are created by the slice that owns them.
-- All times are timestamptz (UTC); versions/sequences are bigint and travel to clients as strings.

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status        text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DELETING', 'DELETED')),
  version       bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  privacy_epoch bigint NOT NULL DEFAULT 0 CHECK (privacy_epoch >= 0),
  created_at    timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at    timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- Ordinary write intents: actor+operation+key, kept 30 days, then purged. Permanent dedupe
-- (messages.client_message_id, deletion receipts) lives on the resource tables, never here.
CREATE TABLE idempotency (
  actor_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  operation       text NOT NULL CHECK (operation ~ '^[a-z][A-Za-z0-9]{1,63}$'),
  key             uuid NOT NULL,
  request_hash    text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  state           text NOT NULL CHECK (state IN ('IN_PROGRESS', 'COMPLETED')),
  claim_token     uuid NOT NULL,
  lease_until     timestamptz NOT NULL,
  response_status integer CHECK (response_status BETWEEN 200 AND 499),
  response_json   jsonb,
  resource_id     uuid,
  created_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at    timestamptz,
  expires_at      timestamptz NOT NULL,
  PRIMARY KEY (actor_id, operation, key),
  CHECK (expires_at > created_at),
  CHECK ((state = 'COMPLETED') = (response_status IS NOT NULL AND completed_at IS NOT NULL))
);
CREATE INDEX idempotency_expires_idx ON idempotency (expires_at);

-- Server-written authoritative facts, append-only.
CREATE TABLE business_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type text NOT NULL,
  aggregate_id   uuid NOT NULL,
  aggregate_seq  bigint NOT NULL CHECK (aggregate_seq > 0),
  kind           text NOT NULL,
  effective_at   timestamptz NOT NULL,
  recorded_at    timestamptz NOT NULL DEFAULT clock_timestamp(),
  actor_kind     text NOT NULL CHECK (actor_kind IN ('USER', 'SYSTEM', 'SUPPORT')),
  actor_id       uuid,
  revision       bigint,
  payload        jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (aggregate_type, aggregate_id, aggregate_seq),
  CHECK ((actor_kind = 'SYSTEM') = (actor_id IS NULL))
);

-- No OTP, token or chat body ever goes in here (enforced by callers' allowlists + tests).
CREATE TABLE audit_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at    timestamptz NOT NULL DEFAULT clock_timestamp(),
  actor_kind     text NOT NULL CHECK (actor_kind IN ('USER', 'SYSTEM', 'SUPPORT')),
  actor_id       uuid,
  action         text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id   uuid,
  request_id     text,
  reason         text,
  payload        jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX audit_events_aggregate_idx ON audit_events (aggregate_type, aggregate_id, occurred_at);

-- Append-only guard. The only exception is an audited privacy purge, which must set
-- fancy.privacy_purge='on' in its own transaction (T19).
CREATE FUNCTION forbid_history_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('fancy.privacy_purge', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
END $$;
CREATE TRIGGER business_events_append_only BEFORE UPDATE OR DELETE ON business_events
  FOR EACH ROW EXECUTE FUNCTION forbid_history_rewrite();
CREATE TRIGGER audit_events_append_only BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION forbid_history_rewrite();

-- In-app notifications: written in the business transaction, authoritative (P-02).
CREATE TABLE notifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     uuid NOT NULL,
  recipient_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel      text NOT NULL DEFAULT 'IN_APP' CHECK (channel = 'IN_APP'),
  template     text NOT NULL CHECK (template ~ '^[a-z0-9_.]+$'),
  refs         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT clock_timestamp(),
  read_at      timestamptz,
  UNIQUE (event_id, recipient_id, channel)
);
CREATE INDEX notifications_recipient_idx ON notifications (recipient_id, created_at DESC, id DESC);

-- Asynchronous side effects (email etc.), delivered at least once by the worker.
CREATE TABLE outbox (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid NOT NULL,
  recipient_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  channel         text NOT NULL CHECK (channel IN ('EMAIL')),
  template        text NOT NULL CHECK (template ~ '^[a-z0-9_.]+$'),
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  status          text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENDING', 'SENT', 'UNKNOWN', 'FAILED', 'DEAD')),
  attempts        integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  provider_id     text,
  last_error_code text,
  created_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT outbox_event_recipient_channel_key UNIQUE NULLS NOT DISTINCT (event_id, recipient_id, channel)
);
CREATE INDEX outbox_status_next_idx ON outbox (status, next_attempt_at);

-- Durable scheduled work; leases make a claim distinct from completion.
CREATE TABLE jobs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind         text NOT NULL CHECK (kind ~ '^[a-z][a-z0-9_.]{1,63}$'),
  resource_id  uuid NOT NULL,
  due_at       timestamptz NOT NULL,
  state        text NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING', 'RUNNING', 'DONE', 'DEAD')),
  attempts     integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 8 CHECK (max_attempts > 0),
  run_after    timestamptz NOT NULL,
  lease_owner  text,
  lease_until  timestamptz,
  -- Fresh per claim: completion/failure must present it, so a stale attempt (even by the same
  -- owner after its lease expired and the job was reclaimed) cannot finish the job.
  claim_token  uuid,
  -- Allowlisted error code only; raw provider messages may contain tokens or private text.
  last_error   text CHECK (last_error IN ('HANDLER_ERROR', 'LEASE_EXPIRED', 'PROVIDER_TIMEOUT', 'PROVIDER_UNAVAILABLE',
                 'PROVIDER_REJECTED', 'PROVIDER_UNKNOWN_OUTCOME', 'STATE_CONFLICT', 'NOT_FOUND', 'DB_RETRY_EXHAUSTED', 'INVALID_PAYLOAD')),
  created_at   timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz,
  UNIQUE (kind, resource_id, due_at),
  CHECK ((state = 'RUNNING') = (lease_owner IS NOT NULL AND lease_until IS NOT NULL AND claim_token IS NOT NULL)),
  CHECK ((state = 'DONE') = (completed_at IS NOT NULL))
);
CREATE INDEX jobs_claim_idx ON jobs (run_after) WHERE state IN ('PENDING', 'RUNNING');

-- Singleton last-level lock shared by deletion and snapshot publication.
CREATE TABLE privacy_control (
  id         smallint PRIMARY KEY CHECK (id = 1),
  epoch      bigint NOT NULL DEFAULT 0 CHECK (epoch >= 0),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO privacy_control (id) VALUES (1);
CREATE FUNCTION forbid_privacy_control_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'privacy_control singleton cannot be deleted' USING ERRCODE = 'restrict_violation';
END $$;
CREATE TRIGGER privacy_control_keep BEFORE DELETE ON privacy_control FOR EACH ROW EXECUTE FUNCTION forbid_privacy_control_delete();
