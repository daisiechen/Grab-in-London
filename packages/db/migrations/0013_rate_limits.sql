CREATE TABLE api_rate_limits (
 actor_id uuid NOT NULL REFERENCES users(id), bucket text NOT NULL, window_start timestamptz NOT NULL,
 count integer NOT NULL CHECK(count > 0), PRIMARY KEY(actor_id,bucket,window_start)
);
