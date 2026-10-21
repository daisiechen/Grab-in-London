CREATE TABLE attendance_revisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),meal_id uuid NOT NULL REFERENCES meals(id) ON DELETE RESTRICT,
 subject_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,source text NOT NULL CHECK(source IN ('SELF','HOST','SUPPORT')),
 value text NOT NULL CHECK(value IN ('present','absent')),version bigint NOT NULL CHECK(version>0),reason text,
 actor_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(meal_id,subject_id,version),CHECK(source<>'SUPPORT' OR (reason IS NOT NULL AND char_length(btrim(reason))>0)), CHECK(source<>'SELF' OR actor_id=subject_id)
);
CREATE INDEX attendance_latest_idx ON attendance_revisions(meal_id,subject_id,source,version DESC);
CREATE TRIGGER attendance_append_only BEFORE UPDATE OR DELETE ON attendance_revisions FOR EACH ROW EXECUTE FUNCTION forbid_history_rewrite();
CREATE TABLE experience_revisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),meal_id uuid NOT NULL REFERENCES meals(id) ON DELETE RESTRICT,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,score integer NOT NULL CHECK(score BETWEEN 1 AND 5),revision bigint NOT NULL CHECK(revision>0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(meal_id,user_id,revision)
);
CREATE TRIGGER experience_append_only BEFORE UPDATE OR DELETE ON experience_revisions FOR EACH ROW EXECUTE FUNCTION forbid_history_rewrite();
CREATE TABLE public_review_revisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),meal_id uuid NOT NULL REFERENCES meals(id) ON DELETE RESTRICT,
 author_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,subject_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 body text NOT NULL CHECK(char_length(btrim(body)) BETWEEN 1 AND 500),revision bigint NOT NULL CHECK(revision>0),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(author_id<>subject_id),UNIQUE(meal_id,author_id,subject_id,revision)
);
CREATE TRIGGER reviews_append_only BEFORE UPDATE OR DELETE ON public_review_revisions FOR EACH ROW EXECUTE FUNCTION forbid_history_rewrite();
CREATE TABLE user_pairs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),low_user uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,high_user uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 consent_epoch bigint NOT NULL DEFAULT 1 CHECK(consent_epoch>0),version bigint NOT NULL DEFAULT 1 CHECK(version>0),CHECK(low_user<high_user),UNIQUE(low_user,high_user)
);
CREATE TABLE pair_consents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),pair_id uuid NOT NULL REFERENCES user_pairs(id) ON DELETE RESTRICT,user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 epoch bigint NOT NULL CHECK(epoch>0),revision bigint NOT NULL CHECK(revision>0),basis_meal_id uuid NOT NULL REFERENCES meals(id) ON DELETE RESTRICT,
 selected_at timestamptz NOT NULL,revoked_at timestamptz,UNIQUE(pair_id,user_id,epoch)
);
CREATE INDEX pair_consent_user_idx ON pair_consents(user_id,pair_id,revision DESC);
CREATE TABLE blocks (
 blocker uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,blocked uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),CHECK(blocker<>blocked),PRIMARY KEY(blocker,blocked)
);
CREATE TABLE block_revisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),blocker uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,blocked uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 active boolean NOT NULL,version bigint NOT NULL CHECK(version>0),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),CHECK(blocker<>blocked),UNIQUE(blocker,blocked,version)
);
CREATE TRIGGER block_revisions_append_only BEFORE UPDATE OR DELETE ON block_revisions FOR EACH ROW EXECUTE FUNCTION forbid_history_rewrite();
ALTER TABLE conversations ADD CONSTRAINT conversations_pair_fk FOREIGN KEY(pair_id) REFERENCES user_pairs(id) ON DELETE RESTRICT;
