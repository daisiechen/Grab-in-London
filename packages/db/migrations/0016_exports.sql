-- Only export metadata persists. CSV bytes live in bounded process RAM and expire independently.
CREATE TABLE analytics_exports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor_id uuid NOT NULL REFERENCES users(id),
 snapshot_id uuid NOT NULL REFERENCES analytics_snapshots(id),
 privacy_epoch bigint NOT NULL,
 metric text NOT NULL,
 filter_hash text NOT NULL CHECK(filter_hash ~ '^[0-9a-f]{64}$'),
 filters jsonb NOT NULL,
 byte_count integer NOT NULL CHECK(byte_count BETWEEN 0 AND 5242880),
 row_count integer NOT NULL CHECK(row_count BETWEEN 0 AND 10000),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL,
 revoked_at timestamptz,
 CHECK(expires_at>created_at)
);
CREATE INDEX analytics_exports_snapshot_idx ON analytics_exports(snapshot_id);
CREATE INDEX analytics_exports_expiry_idx ON analytics_exports(expires_at);
