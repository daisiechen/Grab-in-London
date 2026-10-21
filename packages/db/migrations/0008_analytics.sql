-- Classification is versioned statistical metadata; it never grants application privileges.
CREATE SEQUENCE classification_revision_seq;
CREATE TABLE account_classifications (
 user_id uuid NOT NULL REFERENCES users(id),
 revision bigint NOT NULL DEFAULT nextval('classification_revision_seq') CHECK (revision > 0),
 classification text NOT NULL CHECK (classification IN ('regular','test','staff')),
 actor_id uuid NOT NULL REFERENCES users(id),
 reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 5 AND 500),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY (user_id, revision)
);
CREATE FUNCTION reject_classification_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'classification history is immutable'; END $$;
CREATE TRIGGER immutable_account_classifications BEFORE UPDATE OR DELETE ON account_classifications
FOR EACH ROW EXECUTE FUNCTION reject_classification_mutation();

-- Only actual snapshot workers may seal a row; the HTTP service never manufactures values.
CREATE TABLE analytics_snapshots (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 as_of timestamptz NOT NULL,
 definition_version text NOT NULL CHECK (definition_version = 'v4'),
 history_coverage_start timestamptz NOT NULL,
 privacy_epoch bigint NOT NULL,
 classification_revision bigint NOT NULL CHECK (classification_revision >= 0),
 source_status jsonb NOT NULL,
 quality jsonb NOT NULL,
 dimensions jsonb NOT NULL,
 revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK (history_coverage_start <= as_of)
);
