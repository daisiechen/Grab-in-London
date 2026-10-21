ALTER TABLE outbox ADD COLUMN claim_token uuid;
ALTER TABLE outbox ADD COLUMN lease_until timestamptz;
ALTER TABLE outbox ADD COLUMN lookup_attempts integer NOT NULL DEFAULT 0 CHECK(lookup_attempts>=0);
