-- Purpose-isolated, time-bounded destination. Never reconstructed from restored contact.
CREATE TABLE deletion_mail_envelopes (
 deletion_id uuid PRIMARY KEY REFERENCES deletion_requests(id),
 user_id uuid NOT NULL REFERENCES users(id),
 accepted_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 key_version text,
 nonce text,
 ciphertext text,
 auth_tag text,
 state text NOT NULL CHECK(state IN('ACTIVE','UNAVAILABLE','EXPIRED','SUPPRESSED','CLEARED')),
 received_event_id uuid NOT NULL DEFAULT gen_random_uuid(),
 completed_event_id uuid NOT NULL DEFAULT gen_random_uuid(),
 completed_enqueued boolean NOT NULL DEFAULT false,
 CHECK(expires_at>accepted_at AND expires_at<=accepted_at+interval '168 hours'),
 CHECK((state='ACTIVE' AND key_version IS NOT NULL AND nonce IS NOT NULL AND ciphertext IS NOT NULL AND auth_tag IS NOT NULL) OR (state<>'ACTIVE' AND key_version IS NULL AND nonce IS NULL AND ciphertext IS NULL AND auth_tag IS NULL))
);
CREATE INDEX deletion_mail_expiry_idx ON deletion_mail_envelopes(expires_at) WHERE state='ACTIVE';
ALTER TABLE mail_provider_receipts DROP CONSTRAINT mail_provider_receipts_event_type_check;
ALTER TABLE mail_provider_receipts ADD CHECK(event_type IN('email.sent','email.delivered','email.bounced','email.suppressed'));
