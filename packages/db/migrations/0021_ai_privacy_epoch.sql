-- A deleted public meal author may have contributed facts to another subject's RAM
-- conversation. Conservatively invalidate all older AI sessions at the privacy barrier.
ALTER TABLE ai_session_meta ADD COLUMN privacy_epoch bigint NOT NULL DEFAULT 0 CHECK(privacy_epoch>=0);
