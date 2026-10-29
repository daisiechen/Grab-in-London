-- Safety records kept after an account deletion (owner decision 2026-10-29: 12 months, then delete).
-- When a member deletes their account, the support cases linked to them (reports about them and
-- reports they made) are held instead of being redacted at once: the report text, the case, staff
-- notes with before/after state and audit reasons stay readable to support staff with a case grant.
-- For a case about the member, `evidence` keeps a copy of the reported content as it was when the
-- account was purged (profile text, meal title and description, or the member's own messages around
-- a reported message), because the purge replaces the live copies. Photos are never copied.
-- `held_at` is the deletion's acceptance time. The worker redacts the case and deletes its holds once
-- the case is closed and RETENTION_POLICY_JSON.safetyRecordDays (default 365) days have passed since
-- the later of the deletion and the case's last closing activity.
CREATE TABLE safety_record_holds (
 case_id uuid NOT NULL REFERENCES support_cases(id),
 user_id uuid NOT NULL REFERENCES users(id),
 role text NOT NULL CHECK (role IN ('SUBJECT', 'REPORTER')),
 evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
 held_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY (case_id, user_id),
 CHECK (role = 'SUBJECT' OR evidence = '{}'::jsonb)
);
CREATE INDEX safety_record_holds_user_idx ON safety_record_holds (user_id);
