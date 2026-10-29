import { AVATAR_MAX_BASE64_LENGTH } from '@fancy/contracts';
import { ApiError, type ApiClient } from '@fancy/client';
import type { Me } from '../../api/types.ts';

/**
 * Profile photo (owner decision 2026-10-28: members upload their own photo). In the browser: centre
 * square crop, resize to at most 512px and re-encode as JPEG 0.8 (iOS photo.ts) — re-encoding drops
 * EXIF/GPS; the server re-encodes again regardless.
 */
export const PHOTO_SIDE = 512;
export const PHOTO_QUALITY = 0.8;
export class PhotoError extends Error {}

const PHOTO_REASONS = new Set(['Empty image', 'Image too large', 'Unsupported image type', 'Unreadable image', 'Image too small', 'Image dimensions too large']);

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  await new Promise<void>((ok, fail) => { img.onload = () => ok(); img.onerror = () => fail(new Error('decode')); img.src = url; });
  return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
}

/** Base64 JPEG (no data: prefix) ready for `uploadAvatar`. */
export async function preparePhoto(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)) throw new PhotoError('Please choose a JPEG or PNG photo.');
  try {
    const image = await decode(file);
    const side = Math.min(image.width, image.height);
    const target = Math.min(side, PHOTO_SIDE);
    const canvas = document.createElement('canvas');
    canvas.width = target;
    canvas.height = target;
    const ctx = canvas.getContext('2d');
    if (!ctx || side <= 0) throw new Error('canvas');
    ctx.drawImage(image.source, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, target, target);
    image.close();
    const data = canvas.toDataURL('image/jpeg', PHOTO_QUALITY).replace(/^data:image\/\w+;base64,/, '');
    if (!data) throw new Error('encode');
    return data;
  } catch (error) {
    if (error instanceof PhotoError) throw error;
    throw new PhotoError('We couldn’t read this photo. Please choose another one.');
  }
}

export type PhotoResult = { kind: 'saved'; me: Me } | { kind: 'failed'; message: string };

/** Upload/remove with the Me version as If-Match; a version race refreshes Me and retries once. */
export async function savePhoto(api: ApiClient, action: { upload: string } | 'remove', version: string, newKey: () => string, retried = false): Promise<PhotoResult> {
  if (action !== 'remove' && action.upload.length > AVATAR_MAX_BASE64_LENGTH) return { kind: 'failed', message: 'This photo is too large. Please choose one under 2 MB.' };
  try {
    const res = action === 'remove'
      ? await api.call('removeAvatar', { idempotencyKey: newKey(), ifMatch: version })
      : await api.call('uploadAvatar', { body: { imageBase64: action.upload }, idempotencyKey: newKey(), ifMatch: version });
    return { kind: 'saved', me: res.data };
  } catch (error) {
    if (!(error instanceof ApiError)) return { kind: 'failed', message: 'Something went wrong. Please try again.' };
    if (error.code === 'VERSION_CONFLICT' && !retried) {
      try {
        const me = (await api.call('getMe', {})).data;
        return await savePhoto(api, action, me.version, newKey, true);
      } catch {
        return { kind: 'failed', message: 'We couldn’t update your photo. Please try again.' };
      }
    }
    if (error.kind === 'validation') return { kind: 'failed', message: PHOTO_REASONS.has(error.fieldErrors?.['body.imageBase64'] ?? '') ? error.message : 'Please choose a JPEG or PNG photo under 2 MB.' };
    if (error.kind === 'network') return { kind: 'failed', message: 'You appear to be offline. Try again when you’re connected.' };
    if (error.kind === 'rate_limit') return { kind: 'failed', message: 'You’ve changed your photo a lot recently. Please try again later.' };
    if (error.kind === 'auth') return { kind: 'failed', message: 'Please sign in again to change your photo.' };
    return { kind: 'failed', message: 'We couldn’t update your photo. Please try again.' };
  }
}
