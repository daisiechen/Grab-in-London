import { randomBytes, randomUUID } from 'node:crypto';
import { crc32 } from 'node:zlib';
import * as jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { AVATAR_MAX_BYTES } from '@fancy/contracts';
import { Browser, WEB_ORIGIN, createHarness, json, type Harness } from '../test/harness.ts';
import { jpegSegments, normalizeAvatar, sniff } from './avatar-image.ts';

let h: Harness;
beforeAll(async () => { h = await createHarness(inject('pgServerUrl')); });
afterAll(async () => { await h.close(); });

const complete = { displayName: 'Pia Photo', bio: 'I enjoy shared meals and meeting new people.', languages: ['en'], lifeStatus: 'NEW_TO_LONDON', interests: ['FOOD'], ageConfirmedVersion: '2026-10-21', communityAcceptedVersion: '2026-10-21' };

function pixels(width: number, height: number, alpha = 255) {
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) data.set([(i * 7) % 256, (i * 3) % 256, 120, alpha], i * 4);
  return data;
}
/** A real JPEG with an EXIF APP1 segment (GPS canary) and a COM comment inserted after SOI. */
function jpegWithExif(width = 64, height = 64) {
  const base = jpeg.encode({ data: pixels(width, height), width, height }, 90).data;
  const exifBody = Buffer.concat([Buffer.from('Exif\0\0'), Buffer.from('GPSLatitude=51.5072;GPS-CANARY')]);
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1]), u16(exifBody.length + 2), exifBody]);
  const comment = Buffer.from('COMMENT-CANARY');
  const com = Buffer.concat([Buffer.from([0xff, 0xfe]), u16(comment.length + 2), comment]);
  return Buffer.concat([base.subarray(0, 2), app1, com, base.subarray(2)]);
}
const u16 = (n: number) => { const b = Buffer.alloc(2); b.writeUInt16BE(n); return b; };
/** A PNG (semi-transparent) with a tEXt chunk carrying a location canary. */
function pngWithText(width = 48, height = 40) {
  const png = new PNG({ width, height });
  pixels(width, height, 128).copy(png.data);
  const base = PNG.sync.write(png);
  const type = Buffer.from('tEXt'), data = Buffer.from('Location\0TEXT-CANARY');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([type, data])));
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  return Buffer.concat([base.subarray(0, 33), len, type, data, crc, base.subarray(33)]);
}

async function signedIn() {
  const b = new Browser(h);
  const { body } = await b.signInWithEmail(`${randomUUID()}@example.invalid`);
  const saved = await b.request('PATCH', '/v1/me', { body: complete, headers: { 'if-match': '"1"', 'idempotency-key': randomUUID() } });
  expect(saved.statusCode, saved.body).toBe(200);
  return { b, id: body.data.session.user.id as string };
}
const upload = (b: Browser, bytes: Buffer, version: string, key = randomUUID()) =>
  b.request('PUT', '/v1/me/avatar', { body: { imageBase64: bytes.toString('base64') }, headers: { 'if-match': `"${version}"`, 'idempotency-key': key } });
const remove = (b: Browser, version: string) => b.request('DELETE', '/v1/me/avatar', { headers: { 'if-match': `"${version}"`, 'idempotency-key': randomUUID() } });
const idOf = (url: string) => url.split('/').at(-1)!;
const publicGet = (url: string, headers: Record<string, string> = {}) => h.app.inject({ method: 'GET', url: new URL(url).pathname, headers });

describe('profile photo normalisation', () => {
  it('sniffs JPEG, PNG and HEIC by magic bytes', () => {
    expect(sniff(jpegWithExif())).toBe('jpeg');
    expect(sniff(pngWithText())).toBe('png');
    expect(sniff(Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypheic'), Buffer.alloc(16)]))).toBe('heic');
    expect(sniff(Buffer.from('GIF89a........'))).toBe('other');
  });
  it('re-encodes to a metadata-free JPEG and downscales large photos to 1024px', () => {
    const big = jpeg.encode({ data: pixels(1500, 1200), width: 1500, height: 1200 }, 80).data;
    const out = normalizeAvatar(big);
    expect([out.width, out.height]).toEqual([1024, 819]);
    expect(jpeg.decode(out.jpeg, { useTArray: true })).toMatchObject({ width: 1024, height: 819 });
  });
});

describe('profile photo upload, removal and public read', () => {
  it('uploads a JPEG, strips EXIF/comments, exposes the URL on Me and the public profile, and serves cacheable bytes', async () => {
    const { b, id } = await signedIn();
    const res = await upload(b, jpegWithExif(), '2');
    expect(res.statusCode, res.body).toBe(200);
    const me = json(res).data;
    expect(me.version).toBe('3');
    expect(me.avatarUrl).toMatch(new RegExp(`^${WEB_ORIGIN}/v1/avatars/[0-9a-f-]{36}$`));
    expect(json(await b.request('GET', '/v1/me')).data.avatarUrl).toBe(me.avatarUrl);
    expect(json(await new Browser(h).request('GET', `/v1/profiles/${id}`)).data.profile.avatarUrl).toBe(me.avatarUrl);

    const got = await publicGet(me.avatarUrl);
    expect(got.statusCode).toBe(200);
    expect(got.headers['content-type']).toBe('image/jpeg');
    expect(got.headers['cache-control']).toBe('public, max-age=3600');
    expect(got.headers['x-content-type-options']).toBe('nosniff');
    const etag = got.headers.etag as string;
    expect(etag).toMatch(/^"[0-9a-f]{64}"$/);
    const bytes = got.rawPayload;
    expect(sniff(bytes)).toBe('jpeg');
    expect(jpegSegments(bytes).filter((m) => (m >= 0xe1 && m <= 0xef) || m === 0xfe)).toEqual([]);
    expect(bytes.toString('latin1')).not.toMatch(/CANARY|Exif|GPS/);
    const { rows: [row] } = await h.db.pool.query(`SELECT content_type, width, height, octet_length(bytes) AS size FROM avatar_images WHERE id = $1`, [idOf(me.avatarUrl)]);
    expect(row).toMatchObject({ content_type: 'image/jpeg', width: 64, height: 64, size: bytes.length });

    const cached = await publicGet(me.avatarUrl, { 'if-none-match': etag });
    expect(cached.statusCode).toBe(304);
    expect(cached.rawPayload.length).toBe(0);
  });

  it('accepts a PNG (text chunks dropped, transparency flattened) and replaces the previous photo', async () => {
    const { b } = await signedIn();
    const first = json(await upload(b, jpegWithExif(), '2')).data.avatarUrl as string;
    const second = await upload(b, pngWithText(), '3');
    expect(second.statusCode, second.body).toBe(200);
    const url = json(second).data.avatarUrl as string;
    expect(url).not.toBe(first);
    expect((await publicGet(first)).statusCode).toBe(404);
    const got = await publicGet(url);
    expect(got.statusCode).toBe(200);
    expect(sniff(got.rawPayload)).toBe('jpeg');
    expect(got.rawPayload.toString('latin1')).not.toMatch(/CANARY|tEXt|Location/);
    const { rows } = await h.db.pool.query(`SELECT id FROM avatar_images WHERE user_id = (SELECT user_id FROM profiles WHERE avatar_image_id = $1)`, [idOf(url)]);
    expect(rows.map((r) => r.id)).toEqual([idOf(url)]);
  });

  it('removes the photo (initials), is a no-op when there is none, and fences stale versions', async () => {
    const { b, id } = await signedIn();
    const url = json(await upload(b, jpegWithExif(), '2')).data.avatarUrl as string;
    expect((await remove(b, '2')).statusCode).toBe(409);
    const removed = await remove(b, '3');
    expect(removed.statusCode, removed.body).toBe(200);
    expect(json(removed).data).toMatchObject({ avatarUrl: null, version: '4' });
    expect((await publicGet(url)).statusCode).toBe(404);
    expect(json(await new Browser(h).request('GET', `/v1/profiles/${id}`)).data.profile.avatarUrl).toBeNull();
    expect((await h.db.pool.query(`SELECT 1 FROM avatar_images WHERE id = $1`, [idOf(url)])).rowCount).toBe(0);
    expect(json(await remove(b, '4')).data.version).toBe('4');
  });

  it('replays an upload once per idempotency key', async () => {
    const { b } = await signedIn();
    const key = randomUUID();
    const first = await upload(b, jpegWithExif(), '2', key);
    const again = await upload(b, jpegWithExif(), '2', key);
    expect(again.statusCode).toBe(200);
    expect(again.headers['idempotent-replay']).toBe('true');
    expect(json(again).data.avatarUrl).toBe(json(first).data.avatarUrl);
  });

  it('rejects unsupported, garbage, tiny, oversize and over-dimension images with clear errors', async () => {
    const { b } = await signedIn();
    const heic = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypheic'), randomBytes(200)]);
    const cases: Array<[Buffer, RegExp]> = [
      [heic, /HEIC photos aren’t supported/],
      [Buffer.from('GIF89a' + 'x'.repeat(100)), /JPEG or PNG/],
      [Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), randomBytes(300)]), /couldn’t read/],
      [jpeg.encode({ data: pixels(16, 16), width: 16, height: 16 }, 80).data, /too small/],
      [(() => { const png = new PNG({ width: 5000, height: 40 }); return PNG.sync.write(png); })(), /dimensions are too large/],
    ];
    for (const [bytes, message] of cases) {
      const res = await upload(b, bytes, '2');
      expect(res.statusCode, res.body).toBe(422);
      expect(json(res).error.message).toMatch(message);
      expect(json(res).error.fieldErrors).toHaveProperty(['body.imageBase64']);
    }
    const oversize = await upload(b, Buffer.concat([jpegWithExif(), Buffer.alloc(AVATAR_MAX_BYTES)]), '2');
    expect(oversize.statusCode).toBe(422);
    expect(json(oversize).error.code).toBe('VALIDATION_FAILED');
    const notBase64 = await b.request('PUT', '/v1/me/avatar', { body: { imageBase64: '!!!not base64!!!' }, headers: { 'if-match': '"2"', 'idempotency-key': randomUUID() } });
    expect(notBase64.statusCode).toBe(422);
    expect(json(await b.request('GET', '/v1/me')).data).toMatchObject({ version: '2', avatarUrl: null });
  });

  it('requires a session and a valid photo id', async () => {
    const anon = await new Browser(h).request('PUT', '/v1/me/avatar', { body: { imageBase64: jpegWithExif().toString('base64') }, headers: { 'if-match': '"1"', 'idempotency-key': randomUUID() } });
    expect(anon.statusCode).toBe(401);
    expect((await new Browser(h).request('DELETE', '/v1/me/avatar', { headers: { 'if-match': '"1"', 'idempotency-key': randomUUID() } })).statusCode).toBe(401);
    expect((await h.app.inject({ method: 'GET', url: `/v1/avatars/${randomUUID()}` })).statusCode).toBe(404);
    expect((await h.app.inject({ method: 'GET', url: '/v1/avatars/not-a-uuid' })).statusCode).toBe(422);
  });

  it('deletes the photo when the account is deleted', async () => {
    const { b, id } = await signedIn();
    const url = json(await upload(b, jpegWithExif(), '2')).data.avatarUrl as string;
    const deleted = await b.request('POST', '/v1/me/deletion', { body: { confirm: true, receiptToken: randomBytes(32).toString('base64url') }, headers: { 'idempotency-key': randomUUID(), 'if-match': '"3"' } });
    expect(deleted.statusCode, deleted.body).toBe(202);
    expect((await publicGet(url)).statusCode).toBe(404);
    expect((await h.db.pool.query(`SELECT 1 FROM avatar_images WHERE user_id = $1`, [id])).rowCount).toBe(0);
  });
});
