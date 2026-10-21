-- Google display content is not persisted. Area is app-owned, unknown until polygon mapping.
CREATE TABLE venues (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 place_id text NOT NULL UNIQUE,
 provider text NOT NULL CHECK (provider IN ('google', 'fixture')),
 area_code text NOT NULL DEFAULT 'unknown'
);
