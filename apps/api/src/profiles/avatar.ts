/**
 * Profile photos (owner decision 2026-10-28: members upload their own photo; this replaces the
 * PRD r07 sample portraits). The public URL is `<API public origin>/v1/avatars/<imageId>`: a new
 * id per upload, so a replaced or removed photo's URL simply stops resolving.
 *
 * Storage is PostgreSQL (`avatar_images.bytes`) for now. Everything that touches the bytes goes
 * through the functions below, so moving to object storage later only changes this module.
 */
import type { Pool, PoolClient } from 'pg';
import type { NormalizedAvatar } from './avatar-image.ts';

let origin: string | null = null;
/** Set once at startup from the server's public origin (the one that serves /v1). */
export function configureAvatarOrigin(publicOrigin: string) { origin = publicOrigin.replace(/\/$/, ''); }
export function avatarUrl(imageId: string | null | undefined): string | null {
  return origin && imageId ? `${origin}/v1/avatars/${imageId}` : null;
}

type Db = Pool | PoolClient;

/** Replaces the member's photo inside the caller's transaction; the previous image is deleted. */
export async function replaceAvatar(db: Db, userId: string, image: NormalizedAvatar): Promise<string> {
  await db.query(`DELETE FROM avatar_images WHERE user_id = $1`, [userId]);
  const { rows: [row] } = await db.query<{ id: string }>(
    `INSERT INTO avatar_images (user_id, content_type, bytes, width, height, sha256) VALUES ($1, 'image/jpeg', $2, $3, $4, $5) RETURNING id`,
    [userId, image.jpeg, image.width, image.height, image.sha256],
  );
  await db.query(`UPDATE profiles SET avatar_image_id = $2, updated_at = clock_timestamp() WHERE user_id = $1`, [userId, row!.id]);
  return row!.id;
}

/** Deletes the member's photo (profile pointer is cleared by the foreign key). Returns whether one existed. */
export async function deleteAvatar(db: Db, userId: string): Promise<boolean> {
  const { rowCount } = await db.query(`DELETE FROM avatar_images WHERE user_id = $1`, [userId]);
  return (rowCount ?? 0) > 0;
}

/** Bytes of a CURRENT, unlimited photo of an ACTIVE member only; anything else reads as not found. */
export async function readAvatar(db: Db, imageId: string): Promise<{ bytes: Buffer; sha256: string } | null> {
  const { rows: [row] } = await db.query<{ bytes: Buffer; sha256: string }>(
    `SELECT a.bytes, a.sha256 FROM avatar_images a JOIN profiles p ON p.avatar_image_id = a.id AND p.user_id = a.user_id
       JOIN users u ON u.id = a.user_id AND u.status = 'ACTIVE' WHERE a.id = $1 AND p.moderation_hidden_at IS NULL`, [imageId]);
  return row ?? null;
}
