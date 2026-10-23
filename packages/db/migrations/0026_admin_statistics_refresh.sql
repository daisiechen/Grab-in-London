-- PATCH-006 P09. Classification revisions come from one global sequence, so a snapshot's
-- global maximum never proves that a particular user's revision was sealed (a lower value can
-- commit after a higher one). Each snapshot therefore seals the exact per-user revision it read.
CREATE TABLE analytics_snapshot_classification_inputs (
 snapshot_id uuid NOT NULL REFERENCES analytics_snapshots(id) ON DELETE RESTRICT,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 revision bigint NOT NULL CHECK (revision > 0),
 classification text NOT NULL CHECK (classification IN ('regular','test','staff')),
 PRIMARY KEY (snapshot_id, user_id),
 FOREIGN KEY (user_id, revision) REFERENCES account_classifications(user_id, revision)
);
CREATE INDEX analytics_snapshot_classification_inputs_user_idx ON analytics_snapshot_classification_inputs(user_id, revision);
CREATE TRIGGER analytics_snapshot_classification_inputs_append_only BEFORE UPDATE OR DELETE ON analytics_snapshot_classification_inputs
FOR EACH ROW EXECUTE FUNCTION forbid_history_rewrite();

-- One statistics refresh per accepted classification intent (actor + Idempotency-Key). Ready is
-- bound to a snapshot whose sealed input for the same target user is this or a later revision of
-- that user. Refresh state never rolls back or rewrites the accepted classification.
CREATE TABLE admin_statistics_refreshes (
 id uuid PRIMARY KEY,
 actor_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 intent_key uuid NOT NULL,
 request_id text NOT NULL CHECK (length(request_id) BETWEEN 1 AND 128),
 target_user_id uuid NOT NULL,
 accepted_revision bigint NOT NULL,
 state text NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING','READY','FAILED')),
 snapshot_id uuid REFERENCES analytics_snapshots(id) ON DELETE RESTRICT,
 attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
 failure_code text CHECK (failure_code ~ '^[A-Z_]{1,64}$'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE (actor_id, intent_key),
 FOREIGN KEY (target_user_id, accepted_revision) REFERENCES account_classifications(user_id, revision),
 CHECK ((state = 'READY') = (snapshot_id IS NOT NULL)),
 CHECK ((state = 'FAILED') = (failure_code IS NOT NULL))
);
CREATE INDEX admin_statistics_refreshes_open_idx ON admin_statistics_refreshes(created_at) WHERE state <> 'READY';
