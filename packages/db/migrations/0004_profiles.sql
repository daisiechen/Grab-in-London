-- Private profile facts; public projections are explicit application allowlists.
CREATE TABLE profiles (
 user_id uuid PRIMARY KEY REFERENCES users(id),
 display_name text CHECK (char_length(display_name) BETWEEN 2 AND 40),
 avatar_ref text,
 bio text CHECK (char_length(bio) BETWEEN 20 AND 1000),
 languages text[] NOT NULL DEFAULT '{}',
 life_status text,
 interests text[] NOT NULL DEFAULT '{}',
 background jsonb NOT NULL DEFAULT '{}',
 age_confirmed_version text,
 community_accepted_version text,
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
