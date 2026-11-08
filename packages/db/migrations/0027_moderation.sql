-- Moderation back office (owner decision 2026-10-28, App Store guideline 1.2).
-- Every limit is reversible: content is masked by timestamps, never rewritten, and SUSPENDED is an
-- account state that staff can lift. Staff and automatic steps are appended to moderation_actions.

-- SUSPENDED: no sign-in, no API use, public content masked like a deleted member's; reversible.
ALTER TABLE users DROP CONSTRAINT users_status_check;
ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('ACTIVE', 'SUSPENDED', 'DELETING', 'DELETED'));

-- Masks while set; clearing restores the original content.
ALTER TABLE messages ADD COLUMN moderation_hidden_at timestamptz;
ALTER TABLE meals ADD COLUMN moderation_hidden_at timestamptz;
-- Hides bio and photo from other members; the owner can still read and edit their bio, the photo URL stops resolving.
ALTER TABLE profiles ADD COLUMN moderation_hidden_at timestamptz;

-- auto_actioned_at: the server limited the content after repeated reports (awaiting review).
-- auto_closed_at: closed after 30 days without a staff action; the automatic limit stays.
ALTER TABLE support_cases ADD COLUMN auto_actioned_at timestamptz;
ALTER TABLE support_cases ADD COLUMN auto_closed_at timestamptz;
CREATE INDEX support_cases_open_idx ON support_cases (created_at, id) WHERE status <> 'RESOLVED';
CREATE INDEX reports_target_idx ON reports (target_type, target_id, created_at);
CREATE INDEX reports_reporter_target_idx ON reports (reporter_id, target_type, target_id);

CREATE TABLE moderation_actions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 report_id uuid NOT NULL REFERENCES reports(id),
 case_id uuid NOT NULL REFERENCES support_cases(id),
 actor_kind text NOT NULL CHECK (actor_kind IN ('SUPPORT', 'SYSTEM')),
 actor_id uuid REFERENCES users(id),
 action text NOT NULL CHECK (action IN ('UPHOLD', 'RESTORE', 'HIDE_CONTENT', 'CANCEL_MEAL', 'RESET_PROFILE_TEXT', 'REMOVE_PROFILE_PHOTO', 'SUSPEND_USER', 'UNSUSPEND_USER', 'AUTO_HIDE', 'AUTO_CLOSE')),
 target_type text NOT NULL CHECK (target_type IN ('USER', 'MEAL', 'MESSAGE')),
 target_id uuid NOT NULL,
 -- The account the action affected (profile owner, meal host or message sender).
 subject_user_id uuid REFERENCES users(id),
 -- Staff-only internal note; replaced on a privacy purge.
 note text,
 before_state jsonb NOT NULL DEFAULT '{}'::jsonb,
 after_state jsonb NOT NULL DEFAULT '{}'::jsonb,
 public_outcome text,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK ((actor_kind = 'SYSTEM') = (actor_id IS NULL)),
 CHECK (actor_kind = 'SYSTEM' OR (note IS NOT NULL AND char_length(btrim(note)) BETWEEN 1 AND 1000))
);
CREATE INDEX moderation_actions_report_idx ON moderation_actions (report_id, created_at);
CREATE INDEX moderation_actions_case_idx ON moderation_actions (case_id, actor_kind);
CREATE TRIGGER moderation_actions_append_only BEFORE UPDATE OR DELETE ON moderation_actions
  FOR EACH ROW EXECUTE FUNCTION forbid_history_rewrite();

-- One digest per London day; the outbox row references it so the mail carries no free text.
CREATE TABLE moderation_digests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 digest_day date NOT NULL UNIQUE,
 report_ids uuid[] NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
