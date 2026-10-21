CREATE TABLE deletion_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL UNIQUE REFERENCES users(id),
 receipt_token_hash text NOT NULL UNIQUE CHECK(receipt_token_hash ~ '^[a-f0-9]{64}$'),
 status text NOT NULL CHECK(status IN ('PENDING','PROCESSING','COMPLETED','NEEDS_SUPPORT')),
 requested_at timestamptz NOT NULL, completed_at timestamptz, expires_at timestamptz,
 provider_steps jsonb NOT NULL DEFAULT '{}', policy_version text NOT NULL
);
CREATE TABLE deletion_journal (
 deletion_id uuid PRIMARY KEY REFERENCES deletion_requests(id), user_id uuid NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
