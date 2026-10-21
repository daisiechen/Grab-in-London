CREATE TABLE analytics_discovery_requests (
 request_id uuid PRIMARY KEY,
 scope_key text NOT NULL,
 anonymous_id text NOT NULL,
 user_id uuid REFERENCES users(id),
 session_id text NOT NULL,
 result_count integer NOT NULL CHECK(result_count>=0),
 result_meal_ids uuid[] NOT NULL,
 eligible_meal_ids uuid[] NOT NULL,
 outcome text NOT NULL CHECK(outcome IN('success','failed')),
 filters jsonb NOT NULL,
 occurred_at timestamptz NOT NULL,
 received_at timestamptz NOT NULL,
 environment text NOT NULL,
 classification text NOT NULL
);
CREATE INDEX analytics_discovery_scope_idx ON analytics_discovery_requests(scope_key,received_at);
CREATE TABLE analytics_deliveries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 event_id uuid,
 user_id uuid REFERENCES users(id),
 outcome text NOT NULL CHECK(outcome IN('accepted','rejected','duplicate')),
 reason text CHECK(reason ~ '^[a-z_]{1,64}$'),
 received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 environment text NOT NULL,
 classification text NOT NULL
);
CREATE INDEX analytics_delivery_time_idx ON analytics_deliveries(received_at);
CREATE TABLE analytics_delivery_coverage (
 id smallint PRIMARY KEY CHECK(id=1),
 started_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO analytics_delivery_coverage(id) VALUES(1);
-- A sealed snapshot can be physically purged for privacy, but never silently recomputed.
CREATE TRIGGER analytics_facts_no_update BEFORE UPDATE ON analytics_snapshot_facts
FOR EACH ROW EXECUTE FUNCTION forbid_history_rewrite();
