-- Member-uploaded profile photos (owner decision 2026-10-28, replacing the r07 sample portraits).
-- Bytes are always a server re-encoded, metadata-free JPEG. Storage sits behind the API's avatar
-- store so it can later move to object storage without changing public URLs (/v1/avatars/<id>).
-- At most one stored image per member: replacing or removing deletes the old row, and account
-- deletion removes it immediately (API) and again in the purge job (worker).
CREATE TABLE avatar_images (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL UNIQUE REFERENCES users(id),
 content_type text NOT NULL CHECK (content_type = 'image/jpeg'),
 bytes bytea NOT NULL CHECK (octet_length(bytes) BETWEEN 1 AND 2097152),
 width integer NOT NULL CHECK (width BETWEEN 1 AND 4096),
 height integer NOT NULL CHECK (height BETWEEN 1 AND 4096),
 sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE (id, user_id)
);
-- The sample-portrait reference is retired; members without an upload show initials.
ALTER TABLE profiles DROP COLUMN avatar_ref;
ALTER TABLE profiles ADD COLUMN avatar_image_id uuid UNIQUE;
-- The current photo must belong to the same member; deleting the image clears the pointer only.
ALTER TABLE profiles ADD CONSTRAINT profiles_avatar_owner_fk FOREIGN KEY (avatar_image_id, user_id)
 REFERENCES avatar_images(id, user_id) ON DELETE SET NULL (avatar_image_id);
