import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { Browser, createHarness, json, type Harness } from '../test/harness.ts';
let h: Harness;
beforeAll(async () => { h = await createHarness(inject('pgServerUrl')); });
afterAll(async () => { await h.close(); });
const complete = { displayName: 'Alex Test', bio: 'I enjoy shared meals and meeting new people.', languages: ['en'], lifeStatus: 'NEW_TO_LONDON', interests: ['FOOD'], ageConfirmedVersion: '2026-10-21', communityAcceptedVersion: '2026-10-21' };
async function signedIn() { const b = new Browser(h); const { body } = await b.signInWithEmail(`${randomUUID()}@example.invalid`); return { b, id: body.data.session.user.id as string }; }
const patch = (b: Browser, body: unknown, version = '1', key = randomUUID()) => b.request('PATCH', '/v1/me', { body, headers: { 'if-match': `"${version}"`, 'idempotency-key': key } });
describe('S05 profile privacy, gates and optimistic writes', () => {
  it('starts incomplete, completes with explicit consents, updates session and returns a private-field-free public projection', async () => {
    const { b, id } = await signedIn();
    expect(json(await b.request('GET', '/v1/me')).data.profileGate.profileComplete).toBe(false);
    const saved = await patch(b, complete);
    expect(saved.statusCode, saved.body).toBe(200);
    expect(json(saved).data).toMatchObject({ version: '2', profileGate: { profileComplete: true, missing: [] } });
    expect(json(await b.request('GET', '/v1/auth/session')).data.user.displayName).toBe(complete.displayName);
    const pub = await new Browser(h).request('GET', `/v1/profiles/${id}`);
    expect(pub.statusCode).toBe(200);
    expect(Object.keys(json(pub).data.profile).sort()).toEqual(['background', 'avatarUrl', 'bio', 'displayName', 'id', 'interests', 'languages'].sort());
    expect(pub.body).not.toMatch(/email|lifeStatus|ConfirmedVersion|AcceptedVersion|roles|privacyEpoch/);
  });
  it('rejects private fields and forged consent versions without changing status or version', async () => {
    const { b } = await signedIn();
    for (const body of [{ email: 'injected@example.invalid' }, { status: 'DELETED' }, { roles: ['analyst'] }, { ageConfirmedVersion: 'invented' }, { bio: ' '.repeat(20) }]) {
      expect((await patch(b, body)).statusCode).toBe(422);
    }
    const me = json(await b.request('GET', '/v1/me')).data;
    expect(me.version).toBe('1'); expect(me.profileGate.profileComplete).toBe(false);
  });
  it('replays once, fences stale edits and preserves other fields in partial patches', async () => {
    const { b } = await signedIn(); const key = randomUUID();
    expect((await patch(b, complete, '1', key)).statusCode).toBe(200);
    const replay = await patch(b, complete, '1', key);
    expect(replay.headers['idempotent-replay']).toBe('true');
    expect(json(replay).data.version).toBe('2');
    const stale = await patch(b, { displayName: 'Stale name' });
    expect(stale.statusCode).toBe(409);
    const update = await patch(b, { displayName: 'New name' }, '2');
    expect(json(update).data).toMatchObject({ displayName: 'New name', bio: complete.bio, version: '3' });
  });
  it('requires authentication, CSRF and a version; hides deleted profiles', async () => {
    expect((await new Browser(h).request('GET', '/v1/me')).statusCode).toBe(401);
    const { b, id } = await signedIn();
    expect((await b.request('PATCH', '/v1/me', { body: complete, headers: { 'idempotency-key': randomUUID() } })).statusCode).toBe(428);
    b.csrf = null; expect((await patch(b, complete)).statusCode).toBe(403);
    await h.db.pool.query(`UPDATE users SET status = 'DELETING' WHERE id = $1`, [id]);
    expect((await new Browser(h).request('GET', `/v1/profiles/${id}`)).statusCode).toBe(404);
  });
});
