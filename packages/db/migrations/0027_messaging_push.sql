-- Additive only: no history backfill or provider calls. Old mail workers never see push events.
ALTER TABLE conversations ADD COLUMN authorization_epoch bigint NOT NULL DEFAULT 1 CHECK(authorization_epoch>0);
ALTER TABLE messages ADD COLUMN mention_payload_hash text CHECK(mention_payload_hash ~ '^[a-f0-9]{64}$');
CREATE TABLE message_mentions (
 message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
 ordinal integer NOT NULL CHECK(ordinal BETWEEN 0 AND 99),
 kind text NOT NULL CHECK(kind IN('user','everyone')),
 user_id uuid REFERENCES users(id), start_offset integer NOT NULL CHECK(start_offset>=0),
 end_offset integer NOT NULL CHECK(end_offset>start_offset AND end_offset<=2000),
 CHECK((kind='user')=(user_id IS NOT NULL)), PRIMARY KEY(message_id,ordinal)
);
CREATE TABLE conversation_notification_settings (
 conversation_id uuid NOT NULL REFERENCES conversations(id), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 muted boolean NOT NULL DEFAULT false, version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 PRIMARY KEY(conversation_id,user_id)
);
CREATE TABLE message_notification_recipients (
 event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
 conversation_id uuid NOT NULL REFERENCES conversations(id), recipient_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 membership_epoch uuid NOT NULL REFERENCES membership_intervals(id), group_epoch bigint NOT NULL CHECK(group_epoch>0),
 template text NOT NULL CHECK(template IN('group_message','group_mention')),
 notification_id uuid REFERENCES notifications(id) ON DELETE SET NULL,
 state text NOT NULL DEFAULT 'PENDING' CHECK(state IN('PENDING','REVOKED','EXPIRED')),
 created_at timestamptz NOT NULL, expires_at timestamptz NOT NULL CHECK(expires_at>created_at),
 UNIQUE(message_id,recipient_id,template)
);
CREATE INDEX message_push_due_idx ON message_notification_recipients(state,expires_at);
CREATE TABLE push_subscriptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 family_id uuid NOT NULL REFERENCES session_families(id) ON DELETE CASCADE,
 installation_id uuid NOT NULL, platform text NOT NULL CHECK(platform IN('apns','webpush')),
 environment text NOT NULL CHECK(environment IN('development','production')),
 destination_hash text NOT NULL CHECK(destination_hash ~ '^[a-f0-9]{64}$'),
 encrypted_destination text NOT NULL, key_version text NOT NULL, app_build text NOT NULL,
 version bigint NOT NULL DEFAULT 1 CHECK(version>0), created_at timestamptz NOT NULL DEFAULT clock_timestamp(), revoked_at timestamptz
);
CREATE UNIQUE INDEX push_active_destination ON push_subscriptions(platform,environment,destination_hash) WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX push_active_installation ON push_subscriptions(installation_id,platform,environment) WHERE revoked_at IS NULL;
CREATE TABLE push_deliveries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid NOT NULL REFERENCES message_notification_recipients(event_id) ON DELETE CASCADE,
 subscription_id uuid NOT NULL REFERENCES push_subscriptions(id) ON DELETE CASCADE,
 state text NOT NULL DEFAULT 'PENDING' CHECK(state IN('PENDING','SENDING','SENT','UNKNOWN','FAILED','REVOKED','EXPIRED','SUPPRESSED','INVALID')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0), next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 claim_token uuid, lease_until timestamptz, provider_id text, last_error_code text,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(event_id,subscription_id)
);
CREATE INDEX push_delivery_due_idx ON push_deliveries(state,next_attempt_at);
-- All membership changes already hold the conversation UPDATE lock. The immutable interval id
-- is the membership authorization epoch: a later JOIN cannot restore these terminal events.
CREATE FUNCTION revoke_closed_membership_push() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.leave_seq IS NULL AND NEW.leave_seq IS NOT NULL THEN
  UPDATE message_notification_recipients SET state='REVOKED' WHERE membership_epoch=NEW.id AND state<>'REVOKED';
  UPDATE push_deliveries d SET state='REVOKED',claim_token=NULL,lease_until=NULL,last_error_code='MEMBERSHIP_REVOKED',updated_at=clock_timestamp()
   FROM message_notification_recipients e WHERE d.event_id=e.event_id AND e.membership_epoch=NEW.id AND d.state IN('PENDING','FAILED','SENDING');
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER revoke_closed_membership_push AFTER UPDATE OF leave_seq ON membership_intervals FOR EACH ROW EXECUTE FUNCTION revoke_closed_membership_push();
CREATE FUNCTION bump_dissolved_push_epoch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF OLD.dissolved_at IS NULL AND NEW.dissolved_at IS NOT NULL THEN NEW.authorization_epoch=OLD.authorization_epoch+1; END IF; RETURN NEW; END $$;
CREATE TRIGGER bump_dissolved_push_epoch BEFORE UPDATE OF dissolved_at ON conversations FOR EACH ROW EXECUTE FUNCTION bump_dissolved_push_epoch();
CREATE FUNCTION revoke_family_push() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL THEN
  UPDATE push_subscriptions SET revoked_at=clock_timestamp(),version=version+1 WHERE family_id=NEW.id AND revoked_at IS NULL;
  UPDATE push_deliveries d SET state='REVOKED',claim_token=NULL,lease_until=NULL,last_error_code='FAMILY_REVOKED',updated_at=clock_timestamp()
   FROM push_subscriptions s WHERE d.subscription_id=s.id AND s.family_id=NEW.id AND d.state IN('PENDING','FAILED','SENDING');
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER revoke_family_push AFTER UPDATE OF revoked_at ON session_families FOR EACH ROW EXECUTE FUNCTION revoke_family_push();
CREATE FUNCTION revoke_user_push() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status='ACTIVE' AND NEW.status<>'ACTIVE' THEN
  UPDATE message_notification_recipients SET state='REVOKED' WHERE recipient_id=NEW.id;
  UPDATE push_subscriptions SET revoked_at=clock_timestamp(),version=version+1 WHERE user_id=NEW.id AND revoked_at IS NULL;
  UPDATE push_deliveries d SET state='REVOKED',claim_token=NULL,lease_until=NULL,last_error_code='USER_REVOKED',updated_at=clock_timestamp()
   FROM push_subscriptions s WHERE d.subscription_id=s.id AND s.user_id=NEW.id AND d.state IN('PENDING','FAILED','SENDING');
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER revoke_user_push AFTER UPDATE OF status ON users FOR EACH ROW EXECUTE FUNCTION revoke_user_push();
