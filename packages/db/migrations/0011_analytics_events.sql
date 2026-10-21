CREATE TABLE analytics_events (
 event_id uuid PRIMARY KEY,
 anonymous_id text NOT NULL,
 user_id uuid REFERENCES users(id),
 session_id text NOT NULL,
 app_version text NOT NULL,
 auth_family_id uuid,
 type text NOT NULL,
 occurred_at timestamptz NOT NULL,
 received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 schema_version integer NOT NULL CHECK (schema_version=1),
 environment text NOT NULL CHECK (environment IN ('test','development','staging','production')),
 consent_version text NOT NULL,
 classification text NOT NULL CHECK (classification IN ('regular','test','staff')),
 properties jsonb NOT NULL,
 request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$')
);
CREATE INDEX analytics_events_time_idx ON analytics_events(occurred_at,received_at);
CREATE UNIQUE INDEX analytics_first_impression_idx ON analytics_events
 ((coalesce(auth_family_id::text,anonymous_id)),session_id,(properties->>'mealId')) WHERE type='meal_impression';
CREATE TABLE analytics_consents (
 scope_key text PRIMARY KEY,
 version text NOT NULL,
 granted_at timestamptz,
 updated_at timestamptz NOT NULL
);
CREATE TABLE analytics_snapshot_facts (
 snapshot_id uuid NOT NULL REFERENCES analytics_snapshots(id),
 kind text NOT NULL,
 facts jsonb NOT NULL,
 PRIMARY KEY(snapshot_id,kind)
);
CREATE TABLE analytics_snapshot_subjects (
 snapshot_id uuid NOT NULL REFERENCES analytics_snapshots(id),
 user_id uuid NOT NULL REFERENCES users(id),
 PRIMARY KEY(snapshot_id,user_id)
);
CREATE INDEX analytics_snapshot_subjects_user_idx ON analytics_snapshot_subjects(user_id,snapshot_id);
