-- Ops analytics P0 (review 2026-10-29, docs/delivery/admin-ops-analytics-review-2026-10-29.zh-CN.md).
-- 1. Measurement definition v5: new snapshots are sealed as v5; existing v4 snapshots stay readable.
ALTER TABLE analytics_snapshots DROP CONSTRAINT analytics_snapshots_definition_version_check;
ALTER TABLE analytics_snapshots ADD CONSTRAINT analytics_snapshots_definition_version_check CHECK (definition_version IN ('v4', 'v5'));

-- 2. First profile completion, written once by the server (updateMe) and never moved afterwards.
-- Existing profiles stay NULL (no backfill): their real completion time is unknown, and inventing one
-- would place them in a wrong sign-up -> completion interval. They get a value only if they save their
-- profile again while it is complete.
ALTER TABLE profiles ADD COLUMN completed_at timestamptz;

-- 3. Coarse, campaign-level acquisition source, written once when the account is created.
-- Values: 'ios_app', 'meal_link', or '<utm_source>:<utm_medium>:<utm_campaign>' normalised to
-- lowercase [a-z0-9_-] (medium/campaign may be empty). No device, IP or free text. Cleared on purge.
ALTER TABLE users ADD COLUMN signup_source text
 CHECK (signup_source ~ '^[a-z0-9_-]{1,40}(:[a-z0-9_-]{0,40}){0,2}$');

-- 4. Retention purge scans (worker): snapshots by time, raw rows by receipt time.
CREATE INDEX analytics_snapshots_as_of_idx ON analytics_snapshots (as_of);
CREATE INDEX analytics_events_received_idx ON analytics_events (received_at);
CREATE INDEX analytics_discovery_received_idx ON analytics_discovery_requests (received_at);
