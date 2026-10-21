-- Opaque provider receipt metadata only; no raw webhook, recipient or message content.
CREATE TABLE mail_provider_messages (
 outbox_id uuid PRIMARY KEY REFERENCES outbox(id) ON DELETE CASCADE,
 provider text NOT NULL DEFAULT 'resend' CHECK(provider='resend'),
 provider_email_id uuid UNIQUE,
 dispatched_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 dispatch_hash text NOT NULL CHECK(dispatch_hash ~ '^[0-9a-f]{64}$'),
 sent_at timestamptz, delivered_at timestamptz, bounced_at timestamptz,
 received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(outbox_id,provider_email_id)
);
CREATE TABLE mail_provider_receipts (
 svix_id text PRIMARY KEY CHECK(char_length(svix_id) BETWEEN 1 AND 128),
 outbox_id uuid NOT NULL,
 provider_email_id uuid NOT NULL,
 event_type text NOT NULL CHECK(event_type IN ('email.sent','email.delivered','email.bounced')),
 payload_sha256 text NOT NULL CHECK(payload_sha256 ~ '^[0-9a-f]{64}$'),
 provider_occurred_at timestamptz NOT NULL,
 signed_attempt_at timestamptz NOT NULL,
 received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(outbox_id,provider_email_id) REFERENCES mail_provider_messages(outbox_id,provider_email_id) ON DELETE CASCADE
);
CREATE INDEX mail_provider_receipts_outbox_idx ON mail_provider_receipts(outbox_id);
