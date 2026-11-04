/**
 * Profile photo normalisation (owner decision 2026-10-28). Every upload is decoded and re-encoded
 * here, so the stored bytes are only pixels: EXIF/GPS (JPEG APPn segments), comments, ICC
 * profiles and PNG text/time chunks never survive, even if the client failed to strip them.
 * Pure JavaScript codecs (jpeg-js, pngjs) keep the API free of native dependencies.
 *
 * Limits: ≤ 2 MiB input; JPEG or PNG only (HEIC/WebP/GIF are rejected with a clear message);
 * 32–4096 px per side and ≤ 16.8 MP checked from the header before decoding; output is a
 * baseline JPEG (quality 85), downscaled to fit 1024 px. EXIF orientation is not applied; the
 * iOS app sends an already-oriented JPEG from expo-image-manipulator.
 */
import { createHash } from 'node:crypto';
import * as jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import { AVATAR_MAX_BYTES } from '@fancy/contracts';
import { DomainError } from '../common/errors.ts';

export const AVATAR_MIN_SIDE = 32;
export const AVATAR_MAX_SIDE = 4096;
const MAX_PIXELS = 16_800_000;
export const AVATAR_OUTPUT_MAX_SIDE = 1024;
const QUALITY = 85;

export interface NormalizedAvatar { jpeg: Buffer; width: number; height: number; sha256: string }

const reject = (message: string, field = 'Unsupported image') =>
  new DomainError('VALIDATION_FAILED', message, { fieldErrors: { 'body.imageBase64': field } });

export type ImageKind = 'jpeg' | 'png' | 'heic' | 'other';
export function sniff(bytes: Buffer): ImageKind {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (bytes.length >= 12 && bytes.toString('latin1', 4, 8) === 'ftyp' && /^(heic|heix|hevc|hevx|heim|heis|mif1|msf1|avif)$/.test(bytes.toString('latin1', 8, 12))) return 'heic';
  return 'other';
}

/** Width/height from the JPEG frame header (SOFn), walking marker segments without decoding. */
function jpegSize(bytes: Buffer): { width: number; height: number } | null {
  let i = 2;
  while (i + 4 <= bytes.length) {
    if (bytes[i] !== 0xff) return null;
    const marker = bytes[i + 1]!;
    if (marker === 0xff) { i++; continue; }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { i += 2; continue; }
    if (marker === 0xd9 || marker === 0xda) return null;
    const length = bytes.readUInt16BE(i + 2);
    if (length < 2) return null;
    const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrame) return i + 9 <= bytes.length ? { height: bytes.readUInt16BE(i + 5), width: bytes.readUInt16BE(i + 7) } : null;
    i += 2 + length;
  }
  return null;
}

function pngSize(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 24 || bytes.toString('latin1', 12, 16) !== 'IHDR') return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

/** Area-average downscale of RGBA pixels so the longest side fits `max`. */
function fit(data: Uint8Array, width: number, height: number, max: number) {
  const scale = Math.max(width, height) / max;
  if (scale <= 1) return { data, width, height };
  const w = Math.max(1, Math.round(width / scale)), h = Math.max(1, Math.round(height / scale));
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * height / h), y1 = Math.max(y0 + 1, Math.floor((y + 1) * height / h));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * width / w), x1 = Math.max(x0 + 1, Math.floor((x + 1) * width / w));
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = y0; sy < y1; sy++) {
        let p = (sy * width + x0) * 4;
        for (let sx = x0; sx < x1; sx++, p += 4) { r += data[p]!; g += data[p + 1]!; b += data[p + 2]!; a += data[p + 3]!; }
      }
      const n = (y1 - y0) * (x1 - x0), o = (y * w + x) * 4;
      out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = a / n;
    }
  }
  return { data: out, width: w, height: h };
}

/** Flattens transparency onto white (JPEG has no alpha channel). */
function flatten(data: Uint8Array) {
  for (let p = 0; p < data.length; p += 4) {
    const a = data[p + 3]! / 255;
    if (a === 1) continue;
    data[p] = data[p]! * a + 255 * (1 - a); data[p + 1] = data[p + 1]! * a + 255 * (1 - a); data[p + 2] = data[p + 2]! * a + 255 * (1 - a); data[p + 3] = 255;
  }
}

export function normalizeAvatar(bytes: Buffer): NormalizedAvatar {
  if (bytes.length === 0) throw reject('We couldn’t read this photo. Please choose another one.', 'Empty image');
  if (bytes.length > AVATAR_MAX_BYTES) throw reject('This photo is too large. Please choose one under 2 MB.', 'Image too large');
  const kind = sniff(bytes);
  if (kind === 'heic') throw reject('HEIC photos aren’t supported yet. Please choose a JPEG or PNG photo.', 'Unsupported image type');
  if (kind === 'other') throw reject('Please choose a JPEG or PNG photo.', 'Unsupported image type');
  const size = kind === 'jpeg' ? jpegSize(bytes) : pngSize(bytes);
  if (!size) throw reject('We couldn’t read this photo. Please choose another one.', 'Unreadable image');
  if (size.width < AVATAR_MIN_SIDE || size.height < AVATAR_MIN_SIDE) throw reject('This photo is too small. Please choose one at least 32 pixels wide.', 'Image too small');
  if (size.width > AVATAR_MAX_SIDE || size.height > AVATAR_MAX_SIDE || size.width * size.height > MAX_PIXELS) throw reject('This photo’s dimensions are too large. Please choose a smaller photo.', 'Image dimensions too large');
  let decoded: { data: Uint8Array; width: number; height: number };
  try {
    decoded = kind === 'jpeg'
      ? jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true, maxResolutionInMP: 17, maxMemoryUsageInMB: 256 })
      : (() => { const png = PNG.sync.read(bytes); return { data: new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.length), width: png.width, height: png.height }; })();
  } catch {
    throw reject('We couldn’t read this photo. Please choose another one.', 'Unreadable image');
  }
  if (decoded.width !== size.width || decoded.height !== size.height) throw reject('We couldn’t read this photo. Please choose another one.', 'Unreadable image');
  const resized = fit(decoded.data, decoded.width, decoded.height, AVATAR_OUTPUT_MAX_SIDE);
  flatten(resized.data);
  const out = jpeg.encode({ data: resized.data, width: resized.width, height: resized.height }, QUALITY).data;
  return { jpeg: out, width: resized.width, height: resized.height, sha256: createHash('sha256').update(out).digest('hex') };
}

/** JPEG marker segments before the scan data (tests use this to prove metadata is gone). */
export function jpegSegments(bytes: Buffer): number[] {
  const markers: number[] = [];
  let i = 2;
  while (i + 4 <= bytes.length && bytes[i] === 0xff) {
    const marker = bytes[i + 1]!;
    markers.push(marker);
    if (marker === 0xda) break;
    i += 2 + bytes.readUInt16BE(i + 2);
  }
  return markers;
}
