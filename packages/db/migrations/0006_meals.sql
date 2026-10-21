CREATE FUNCTION fancy_unique_text_array(items text[]) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT cardinality(items) = (SELECT count(DISTINCT item) FROM unnest(items) AS item) $$;
CREATE TABLE meals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), host_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 venue_ref uuid NOT NULL REFERENCES venues(id) ON DELETE RESTRICT,
 title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 5 AND 80), description text NOT NULL CHECK (char_length(btrim(description)) BETWEEN 20 AND 1000),
 starts_at timestamptz NOT NULL, closes_at timestamptz NOT NULL, scheduled_end_at timestamptz NOT NULL,
 start_local_date text NOT NULL, start_local_time text NOT NULL, start_offset integer NOT NULL,
 close_local_date text NOT NULL, close_local_time text NOT NULL, close_offset integer NOT NULL,
 minimum integer NOT NULL, capacity integer NOT NULL, budget_min_pence integer NOT NULL, budget_max_pence integer NOT NULL,
 languages text[] NOT NULL CHECK (cardinality(languages) BETWEEN 1 AND 5 AND languages <@ ARRAY['en','zh','fr','es','hi']::text[] AND fancy_unique_text_array(languages)), mood text NOT NULL CHECK(mood IN ('EASY_CONVERSATION','FOOD_DISCOVERIES','TRAVEL_CULTURE')),
 area_code text NOT NULL DEFAULT 'unknown', cuisine_code text CHECK(cuisine_code IN ('EUROPEAN','JAPANESE','SPANISH','CHINESE')), dietary_codes text[] CHECK(dietary_codes IS NULL OR (cardinality(dietary_codes) BETWEEN 1 AND 2 AND dietary_codes <@ ARRAY['VEGETARIAN_OPTIONS','VEGAN']::text[] AND fancy_unique_text_array(dietary_codes))),
 booking_mode text NOT NULL CHECK (booking_mode = 'EXTERNAL_PAY_AT_VENUE'),
 terms_version text NOT NULL, attempt_id uuid NOT NULL,
 status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CANCELLED','COMPLETED')), cancel_reason text CHECK(cancel_reason IN ('host','booking','other','insufficient')),
 version bigint NOT NULL DEFAULT 1 CHECK(version > 0), head bigint NOT NULL DEFAULT 0 CHECK(head >= 0),
 arrangement_locked_at timestamptz, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK (2 <= minimum AND minimum <= capacity AND capacity <= 6),
 CHECK (0 < budget_min_pence AND budget_min_pence <= budget_max_pence),
 CHECK (scheduled_end_at = starts_at + interval '2 hours'), CHECK (closes_at <= starts_at - interval '30 minutes'),
 CHECK ((status = 'CANCELLED') = (cancel_reason IS NOT NULL)), UNIQUE(host_id,attempt_id)
);
CREATE INDEX meals_discover_idx ON meals(status,starts_at,id);
CREATE TABLE applications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), meal_id uuid NOT NULL REFERENCES meals(id) ON DELETE RESTRICT,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT, round integer NOT NULL CHECK(round > 0),
 state text NOT NULL CHECK (state IN ('PENDING','CONFIRMED','DECLINED','WITHDRAWN','EXPIRED','CANCELLED')),
 message text NOT NULL CHECK(char_length(btrim(message)) BETWEEN 20 AND 300),
 version bigint NOT NULL DEFAULT 1 CHECK(version > 0), created_at timestamptz NOT NULL DEFAULT clock_timestamp(), decided_at timestamptz,
 UNIQUE(meal_id,user_id,round), UNIQUE(id,meal_id,user_id)
);
CREATE UNIQUE INDEX applications_one_active ON applications(meal_id,user_id) WHERE state IN ('PENDING','CONFIRMED');
CREATE INDEX applications_meal_state_idx ON applications(meal_id,state);
CREATE TABLE seat_events (
 meal_id uuid NOT NULL REFERENCES meals(id) ON DELETE RESTRICT, seq bigint NOT NULL CHECK(seq > 0),
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT, application_id uuid REFERENCES applications(id) ON DELETE RESTRICT,
 type text NOT NULL CHECK(type IN ('HOST_CONFIRMED','GUEST_CONFIRMED','LEFT')), effective_at timestamptz NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(), command_id uuid NOT NULL,
 PRIMARY KEY(meal_id,seq), UNIQUE(command_id,type,user_id), FOREIGN KEY(application_id,meal_id,user_id) REFERENCES applications(id,meal_id,user_id) ON DELETE RESTRICT
);
CREATE INDEX seat_events_history_idx ON seat_events(meal_id,effective_at,seq);
CREATE TRIGGER seat_events_append_only BEFORE UPDATE OR DELETE ON seat_events FOR EACH ROW EXECUTE FUNCTION forbid_history_rewrite();
CREATE TABLE booking_declarations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), meal_id uuid NOT NULL REFERENCES meals(id) ON DELETE RESTRICT,
 revision bigint NOT NULL CHECK(revision > 0), reported_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 declared_count integer NOT NULL CHECK(declared_count BETWEEN 1 AND 6), reported_at timestamptz NOT NULL,
 status text NOT NULL CHECK(status IN ('REPORTED_CONFIRMED','NEEDS_UPDATE','FAILED','CANCELLED')), arrangement_hash text NOT NULL,
 UNIQUE(meal_id,revision)
);
CREATE TRIGGER booking_declarations_append_only BEFORE UPDATE OR DELETE ON booking_declarations FOR EACH ROW EXECUTE FUNCTION forbid_history_rewrite();
CREATE TABLE lifecycle_marks (
 meal_id uuid NOT NULL REFERENCES meals(id) ON DELETE RESTRICT, kind text NOT NULL CHECK(kind IN ('CLOSE','START','END')),
 due_at timestamptz NOT NULL, recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(meal_id,kind,due_at)
);
CREATE TABLE start_roster (
 meal_id uuid NOT NULL REFERENCES meals(id) ON DELETE RESTRICT, user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 source_revision_hash text NOT NULL, starts_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(meal_id,user_id)
);
ALTER TABLE conversations ADD CONSTRAINT conversations_meal_fk FOREIGN KEY(meal_id) REFERENCES meals(id) ON DELETE RESTRICT;
