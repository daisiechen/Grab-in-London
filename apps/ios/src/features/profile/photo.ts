/**
 * Profile photo (owner decision 2026-10-28: members upload their own photo; no sample portraits).
 * Pick from the photo library with the system square crop, then crop/resize on the device to a
 * 512px JPEG (quality 0.8). Re-encoding drops EXIF/GPS; the server re-encodes again regardless.
 */
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { AVATAR_MAX_BASE64_LENGTH } from '@fancy/contracts';
import { ApiError, type ApiClient } from '@fancy/client';
import type { Me, SessionManager } from '../auth/session.ts';
import { StaleSessionError } from '../auth/session.ts';

export const PHOTO_SIDE = 512;
export const PHOTO_QUALITY = 0.8;

export class PhotoError extends Error {}

/** `fieldErrors['body.imageBase64']` reasons the API pairs with a member-facing message. */
const PHOTO_REASONS = new Set(['Empty image', 'Image too large', 'Unsupported image type', 'Unreadable image', 'Image too small', 'Image dimensions too large']);

/** null when the member cancels the picker. */
export async function pickProfilePhoto(): Promise<{ base64: string } | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1, exif: false, base64: false });
  const asset = result.canceled ? null : result.assets?.[0];
  if (!asset) return null;
  try {
    const context = ImageManipulator.manipulate(asset.uri);
    const { width, height } = asset;
    if (width > 0 && height > 0) {
      const side = Math.min(width, height);
      if (width !== height) context.crop({ originX: Math.floor((width - side) / 2), originY: Math.floor((height - side) / 2), width: side, height: side });
      const target = Math.min(side, PHOTO_SIDE);
      context.resize({ width: target, height: target });
    } else {
      context.resize({ width: PHOTO_SIDE });
    }
    const image = await context.renderAsync();
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: PHOTO_QUALITY, base64: true });
    if (!saved.base64) throw new Error('no data');
    return { base64: saved.base64.replace(/^data:image\/\w+;base64,/, '') };
  } catch {
    throw new PhotoError('We couldn’t read this photo. Please choose another one.');
  }
}

export type PhotoResult = { kind: 'saved'; me: Me } | { kind: 'failed'; message: string };

/** Upload/remove with the Me version as If-Match; a version race refreshes Me and retries once. */
export class ProfilePhotoService {
  private readonly api: ApiClient;
  private readonly session: SessionManager;
  private readonly newId: () => string;
  constructor(api: ApiClient, session: SessionManager, newId: () => string) {
    this.api = api;
    this.session = session;
    this.newId = newId;
  }

  upload(base64: string, version: string): Promise<PhotoResult> {
    if (base64.length > AVATAR_MAX_BASE64_LENGTH) return Promise.resolve({ kind: 'failed', message: 'This photo is too large. Please choose one under 2 MB.' });
    return this.run(version, (ifMatch) => this.api.call('uploadAvatar', { body: { imageBase64: base64 }, idempotencyKey: this.newId(), ifMatch }));
  }

  remove(version: string): Promise<PhotoResult> {
    return this.run(version, (ifMatch) => this.api.call('removeAvatar', { idempotencyKey: this.newId(), ifMatch }));
  }

  private async run(version: string, call: (ifMatch: string) => Promise<{ data: Me }>, retried = false): Promise<PhotoResult> {
    try {
      const res = await call(version);
      this.session.updateUser(res.data);
      return { kind: 'saved', me: res.data };
    } catch (error) {
      if (error instanceof StaleSessionError) return { kind: 'failed', message: 'You’ve been signed out.' };
      if (!(error instanceof ApiError)) return { kind: 'failed', message: 'Something went wrong. Please try again.' };
      if (error.code === 'VERSION_CONFLICT' && !retried) {
        try {
          const me = (await this.api.call('getMe', {})).data;
          this.session.updateUser(me);
          return await this.run(me.version, call, true);
        } catch {
          return { kind: 'failed', message: 'We couldn’t update your photo. Please try again.' };
        }
      }
      // The server explains photo rejections it recognised (type, size, dimensions); schema-level
      // failures (e.g. over the size cap) get a generic hint.
      if (error.kind === 'validation') return { kind: 'failed', message: PHOTO_REASONS.has(error.fieldErrors?.['body.imageBase64'] ?? '') ? error.message : 'Please choose a JPEG or PNG photo under 2 MB.' };
      if (error.kind === 'network') return { kind: 'failed', message: 'You appear to be offline. Try again when you’re connected.' };
      if (error.kind === 'rate_limit') return { kind: 'failed', message: 'You’ve changed your photo a lot recently. Please try again later.' };
      if (error.kind === 'auth') return { kind: 'failed', message: 'Please sign in again to change your photo.' };
      return { kind: 'failed', message: 'We couldn’t update your photo. Please try again.' };
    }
  }
}
