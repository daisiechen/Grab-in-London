CREATE TABLE recovery_control (
 id smallint PRIMARY KEY CHECK(id=1),
 state text NOT NULL CHECK(state IN('READY','REPLAY_REQUIRED')),
 ledger_digest text,
 replayed_count integer NOT NULL DEFAULT 0 CHECK(replayed_count>=0),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO recovery_control(id,state) VALUES(1,'READY');
