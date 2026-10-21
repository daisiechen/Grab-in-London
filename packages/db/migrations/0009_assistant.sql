-- Persistent AI metadata only. No prompts, messages, model replies, drafts or cached bodies.
CREATE TABLE ai_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id),
  fields jsonb NOT NULL DEFAULT '{"areas":[],"budgetMaxPence":null,"tableSizes":[],"dietaryCodes":[],"languages":[],"moods":[]}',
  version bigint NOT NULL DEFAULT 0 CHECK(version >= 0),
  epoch bigint NOT NULL DEFAULT 0 CHECK(epoch >= 0),
  confirmed_at timestamptz,
  CHECK(jsonb_typeof(fields) = 'object' AND fields - ARRAY['areas','budgetMaxPence','tableSizes','dietaryCodes','languages','moods']::text[] = '{}'::jsonb)
);
CREATE TABLE guest_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), expires_at timestamptz NOT NULL,
  revoked_at timestamptz, CHECK(expires_at <= created_at + interval '24 hours')
);
CREATE TABLE ai_session_meta (
  id uuid PRIMARY KEY, subject text NOT NULL, device_hash text NOT NULL, revoke_hash text NOT NULL,
  generation bigint NOT NULL DEFAULT 1 CHECK(generation > 0), preference_epoch bigint NOT NULL CHECK(preference_epoch >= 0),
  last_activity_at timestamptz NOT NULL, expires_at timestamptz NOT NULL,
  status text NOT NULL CHECK(status IN ('ACTIVE','INVALIDATED','EXPIRED')), active_request_id uuid
);
CREATE INDEX ai_session_subject ON ai_session_meta(subject);
CREATE TABLE ai_subjects (subject text PRIMARY KEY, active_request_id uuid);
CREATE TABLE ai_quota (
  subject text NOT NULL, london_date date NOT NULL, successes integer NOT NULL DEFAULT 0 CHECK(successes >= 0),
  reserved_success_slots integer NOT NULL DEFAULT 0 CHECK(reserved_success_slots >= 0),
  minute_start timestamptz NOT NULL, minute_count integer NOT NULL DEFAULT 0 CHECK(minute_count >= 0),
  PRIMARY KEY(subject,london_date)
);
CREATE TABLE ai_requests (
  subject text NOT NULL, request_id uuid NOT NULL, session_id uuid NOT NULL REFERENCES ai_session_meta(id), generation bigint NOT NULL,
  payload_hmac text NOT NULL, state text NOT NULL CHECK(state IN ('PENDING','SUCCEEDED','NEEDS_INPUT','FAILED','SUPERSEDED')),
  deadline timestamptz NOT NULL, quota_date date NOT NULL, error_code text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), finished_at timestamptz,
  PRIMARY KEY(subject,request_id), CHECK(error_code IS NULL OR error_code IN ('TIMEOUT','UNAVAILABLE','SUPERSEDED','RESTART','INVALID_RESULT'))
);
CREATE TABLE ai_budget (
  period text PRIMARY KEY CHECK(period ~ '^[DM]:[0-9]{4}-[0-9]{2}(-[0-9]{2})?$'),
  currency text NOT NULL DEFAULT 'CNY' CHECK(currency = 'CNY'),
  cap_micro_cny bigint NOT NULL CHECK(cap_micro_cny > 0 AND cap_micro_cny <= 50000000),
  used_micro_cny bigint NOT NULL DEFAULT 0 CHECK(used_micro_cny >= 0),
  reserved_micro_cny bigint NOT NULL DEFAULT 0 CHECK(reserved_micro_cny >= 0),
  call_cap integer NOT NULL CHECK(call_cap > 0), calls integer NOT NULL DEFAULT 0 CHECK(calls >= 0),
  enabled boolean NOT NULL DEFAULT false, version bigint NOT NULL DEFAULT 1 CHECK(version > 0)
);
CREATE TABLE ai_calls (
  call_id uuid PRIMARY KEY, subject text NOT NULL, request_id uuid NOT NULL,
  day_period text NOT NULL REFERENCES ai_budget(period), month_period text NOT NULL REFERENCES ai_budget(period),
  price_version text NOT NULL, max_micro_cny bigint NOT NULL CHECK(max_micro_cny > 0), actual_micro_cny bigint CHECK(actual_micro_cny >= 0),
  state text NOT NULL CHECK(state IN ('RESERVED','IN_FLIGHT','UNKNOWN','KNOWN','CANCELLED','RECONCILED')),
  provider_request_id text, input_tokens integer CHECK(input_tokens >= 0), output_tokens integer CHECK(output_tokens >= 0),
  version bigint NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(subject,request_id) REFERENCES ai_requests(subject,request_id)
);
CREATE TABLE ai_budget_reconciliations (
  idempotency_key uuid PRIMARY KEY, call_id uuid NOT NULL REFERENCES ai_calls(call_id),
  actual_micro_cny bigint NOT NULL CHECK(actual_micro_cny >= 0), provider_reference text NOT NULL,
  actor_id uuid NOT NULL REFERENCES users(id), reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
