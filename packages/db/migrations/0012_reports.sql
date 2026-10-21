CREATE TABLE reports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reporter_id uuid NOT NULL REFERENCES users(id),
 target_type text NOT NULL CHECK(target_type IN ('USER','MEAL','MESSAGE')), target_id uuid NOT NULL,
 reason text NOT NULL, details text NOT NULL, receipt text NOT NULL UNIQUE,
 status text NOT NULL DEFAULT 'RECEIVED' CHECK(status IN ('RECEIVED','IN_REVIEW','RESPONDED')),
 public_outcome text, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE support_cases (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), report_id uuid REFERENCES reports(id),
 target_type text NOT NULL CHECK(target_type IN ('USER','MEAL','MESSAGE')), target_id uuid NOT NULL,
 details text NOT NULL, status text NOT NULL DEFAULT 'OPEN', version bigint NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE support_case_grants (
 case_id uuid NOT NULL REFERENCES support_cases(id), user_id uuid NOT NULL REFERENCES users(id),
 PRIMARY KEY(case_id,user_id)
);
