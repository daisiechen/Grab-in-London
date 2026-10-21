-- T30 conversation kernel: group/direct conversations, one sequence per conversation shared by
-- JOIN/LEAVE/DISSOLVE/MESSAGE boundaries, and membership intervals. Messages and their bodies
-- arrive with T12; FKs to meals (T07) and user_pairs (T15) are added by those slices.

CREATE TABLE conversations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind         text NOT NULL CHECK (kind IN ('GROUP', 'DIRECT')),
  meal_id      uuid UNIQUE,
  pair_id      uuid UNIQUE,
  head         bigint NOT NULL DEFAULT 0 CHECK (head >= 0),
  dissolved_at timestamptz,
  dissolved_seq bigint,
  version      bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at   timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((kind = 'GROUP') = (meal_id IS NOT NULL)),
  CHECK ((kind = 'DIRECT') = (pair_id IS NOT NULL)),
  CHECK ((dissolved_at IS NULL) = (dissolved_seq IS NULL)),
  CHECK (kind = 'GROUP' OR dissolved_at IS NULL),
  CHECK (dissolved_seq IS NULL OR dissolved_seq <= head)
);

-- Seq is allocated under the conversation row lock, so commit order equals seq order and a
-- rolled-back allocation never leaves a published hole.
CREATE TABLE conversation_events (
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE RESTRICT,
  seq             bigint NOT NULL CHECK (seq > 0),
  kind            text NOT NULL CHECK (kind IN ('JOIN', 'LEAVE', 'DISSOLVE', 'MESSAGE')),
  actor_id        uuid REFERENCES users(id) ON DELETE RESTRICT,
  effective_at    timestamptz NOT NULL,
  recorded_at     timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (conversation_id, seq)
);
CREATE TRIGGER conversation_events_append_only BEFORE UPDATE OR DELETE ON conversation_events
  FOR EACH ROW EXECUTE FUNCTION forbid_history_rewrite();

-- A message seq is visible to an interval iff join_seq < seq AND (leave_seq IS NULL OR seq < leave_seq).
CREATE TABLE membership_intervals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE RESTRICT,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  join_seq        bigint NOT NULL CHECK (join_seq > 0),
  leave_seq       bigint,
  CHECK (leave_seq IS NULL OR leave_seq > join_seq),
  FOREIGN KEY (conversation_id, join_seq) REFERENCES conversation_events (conversation_id, seq),
  FOREIGN KEY (conversation_id, leave_seq) REFERENCES conversation_events (conversation_id, seq)
);
CREATE UNIQUE INDEX membership_one_open_interval ON membership_intervals (conversation_id, user_id) WHERE leave_seq IS NULL;
CREATE INDEX membership_user_idx ON membership_intervals (user_id, conversation_id);
