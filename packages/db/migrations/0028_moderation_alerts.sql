-- Report reasons and moderation alerts (owner decision 2026-10-29; takeover plan §8).
-- reports.reason now takes one of safety / harassment / scam / under_18 / other; the legacy
-- private_concern rows stay as they are. safety, harassment and under_18 are urgent: a new urgent
-- report queues an immediate alert (support email + the owner's assistant, Ethan), coalesced so at
-- most one alert goes out per 10 minutes and each report case is alerted at most once.

-- ETHAN: JSON push to the owner's assistant (counts and an admin link only), retried like email.
ALTER TABLE outbox DROP CONSTRAINT outbox_channel_check;
ALTER TABLE outbox ADD CONSTRAINT outbox_channel_check CHECK (channel IN ('EMAIL', 'ETHAN'));

-- One row per alert. Counts are taken when the alert is queued; no report text, names or user ids.
CREATE TABLE moderation_alerts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 kind text NOT NULL CHECK (kind IN ('morning', 'evening', 'urgent')),
 -- London day for the once-a-day morning and evening pushes; NULL for urgent alerts.
 alert_day date,
 reason text CHECK (reason IN ('safety', 'harassment', 'under_18')),
 report_ids uuid[] NOT NULL DEFAULT '{}',
 report_count integer NOT NULL CHECK (report_count >= 0),
 stats jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK ((kind = 'urgent') = (reason IS NOT NULL)),
 CHECK ((kind = 'urgent') = (alert_day IS NULL))
);
CREATE UNIQUE INDEX moderation_alerts_daily_key ON moderation_alerts (kind, alert_day) WHERE kind <> 'urgent';
CREATE INDEX moderation_alerts_urgent_idx ON moderation_alerts (created_at DESC) WHERE kind = 'urgent';

-- The urgent alert that covered this case (at most one per case).
ALTER TABLE support_cases ADD COLUMN urgent_alert_id uuid REFERENCES moderation_alerts(id);
