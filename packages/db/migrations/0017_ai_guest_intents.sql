-- Bootstrap dedup identifiers only; opaque credentials and assistant text never enter durable rows.
ALTER TABLE guest_sessions ADD COLUMN client_request_id uuid;
ALTER TABLE guest_sessions ADD COLUMN ip_hash text;
CREATE INDEX guest_sessions_ip_admission ON guest_sessions(ip_hash,created_at);
CREATE UNIQUE INDEX guest_sessions_request_id ON guest_sessions(client_request_id) WHERE client_request_id IS NOT NULL;
ALTER TABLE ai_session_meta ADD COLUMN bootstrap_hash text;
CREATE UNIQUE INDEX ai_session_bootstrap ON ai_session_meta(subject,bootstrap_hash) WHERE bootstrap_hash IS NOT NULL;
