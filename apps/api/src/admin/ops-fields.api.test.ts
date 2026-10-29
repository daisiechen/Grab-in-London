import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { Browser, createHarness, json, type Harness } from '../test/harness.ts';
import { normalizeSignupSource } from '../identity/signup-source.ts';
import { sealSourceSnapshot } from './snapshots.ts';
import { readAdminPage } from './pages.ts';

let h: Harness;
beforeAll(async () => { h = await createHarness(inject('pgServerUrl')); });
afterAll(async () => { await h.close(); });

const q = async (sql: string, params: unknown[] = []) => (await h.db.pool.query(sql, params)).rows;
const email = () => `ops-${randomUUID().slice(0, 8)}@example.invalid`;
const complete = { displayName: 'Ops Test', bio: 'I enjoy shared meals and meeting new people.', languages: ['en'], lifeStatus: 'NEW_TO_LONDON', interests: ['FOOD'], ageConfirmedVersion: '2026-10-21', communityAcceptedVersion: '2026-10-21' };
const patch = (b: Browser, body: unknown, version: string) => b.request('PATCH', '/v1/me', { body, headers: { 'if-match': `"${version}"`, 'idempotency-key': randomUUID() } });

async function signUp(b: Browser, address: string, startSource?: unknown, verifySource?: unknown) {
  const started = await b.request('POST', '/v1/auth/email/start', { body: { clientRequestId: randomUUID(), email: address, client: 'WEB', ...(startSource ? { signupSource: startSource } : {}) } });
  expect(started.statusCode, started.body).toBe(201);
  const verify = await b.request('POST', '/v1/auth/email/verify', { body: { clientRequestId: randomUUID(), challengeId: json(started).data.challengeId, code: h.idp.inbox.get(address)!.at(-1)!, ...(verifySource ? { signupSource: verifySource } : {}) } });
  expect(verify.statusCode, verify.body).toBe(200);
  const body = json(verify).data;
  b.csrf = body.session.csrfToken;
  return body.session.user.id as string;
}
const sourceOf = async (userId: string) => (await q(`SELECT signup_source FROM users WHERE id=$1`, [userId]))[0].signup_source as string | null;

describe('sign-up source (users.signup_source)', () => {
  it('normalises utm values to a short lowercase source:medium:campaign and records it once on account creation', async () => {
    const b = new Browser(h), address = email();
    const id = await signUp(b, address, { utmSource: 'Instagram', utmMedium: 'Social', utmCampaign: 'Launch Week!' });
    expect(await sourceOf(id)).toBe('instagram:social:launch-week');
    // A later sign-in of the same account never rewrites it.
    await q(`UPDATE auth_transactions SET created_at=created_at-interval '1 minute' WHERE kind='EMAIL_OTP' AND user_id IS NULL AND provider_state->>'email'=$1`, [address]);
    await signUp(new Browser(h), address, { utmSource: 'tiktok' });
    expect(await sourceOf(id)).toBe('instagram:social:launch-week');
  });
  it('takes a source sent with the code over one sent with the request, and accepts the meal link and iOS entries', async () => {
    expect(await sourceOf(await signUp(new Browser(h), email(), { entry: 'meal_link' }, { utmSource: 'tiktok' }))).toBe('tiktok');
    expect(await sourceOf(await signUp(new Browser(h), email(), { entry: 'meal_link' }))).toBe('meal_link');
    expect(await sourceOf(await signUp(new Browser(h), email(), { entry: 'ios_app' }))).toBe('ios_app');
    expect(await sourceOf(await signUp(new Browser(h), email()))).toBeNull();
  });
  it('rejects unknown fields and entries without starting a challenge', async () => {
    const b = new Browser(h);
    for (const signupSource of [{ entry: 'facebook' }, { referrer: 'x' }, { utmSource: 'x'.repeat(101) }]) {
      const r = await b.request('POST', '/v1/auth/email/start', { body: { clientRequestId: randomUUID(), email: email(), client: 'WEB', signupSource } });
      expect(r.statusCode).toBe(422);
    }
  });
  it('keeps only safe characters and drops values that normalise to nothing', () => {
    expect(normalizeSignupSource({ utmSource: '  News Letter  ', utmCampaign: 'Oct/2026' })).toBe('news-letter::oct-2026');
    expect(normalizeSignupSource({ utmSource: '!!!', entry: 'meal_link' })).toBe('meal_link');
    expect(normalizeSignupSource({ utmSource: 'a'.repeat(80) })).toBe('a'.repeat(40));
    expect(normalizeSignupSource({})).toBeNull();
    expect(normalizeSignupSource(undefined)).toBeNull();
  });
});

describe('profile first completion (profiles.completed_at)', () => {
  it('is written once when the profile gate first becomes complete and never moves afterwards', async () => {
    const b = new Browser(h);
    const id = await signUp(b, email());
    expect((await patch(b, { displayName: 'Ops Test' }, '1')).statusCode).toBe(200);
    expect((await q(`SELECT completed_at FROM profiles WHERE user_id=$1`, [id]))[0].completed_at).toBeNull();
    const saved = await patch(b, complete, '2');
    expect(saved.statusCode, saved.body).toBe(200);
    expect(saved.body).not.toContain('completed');
    const [{ completed_at: first }] = await q(`SELECT completed_at FROM profiles WHERE user_id=$1`, [id]);
    expect(first).toBeInstanceOf(Date);
    expect((await patch(b, { bio: 'Still enjoying shared meals with new people.' }, '3')).statusCode).toBe(200);
    expect((await q(`SELECT completed_at FROM profiles WHERE user_id=$1`, [id]))[0].completed_at).toEqual(first);
  });
});

describe('v5 snapshot facts', () => {
  it('seals sign-up platform, source, first completion and consent families, and offers sources as a filter', async () => {
    const b = new Browser(h);
    const id = await signUp(b, email(), { utmSource: 'flyer', utmCampaign: 'soho' });
    expect((await patch(b, complete, '1')).statusCode).toBe(200);
    const snapshotId = await sealSourceSnapshot(h.db.pool, new Date('2026-01-01T00:00:00Z'));
    const [snapshot] = await q(`SELECT definition_version,dimensions FROM analytics_snapshots WHERE id=$1`, [snapshotId]);
    expect(snapshot.definition_version).toBe('v5');
    expect(snapshot.dimensions.sources).toContainEqual({ code: 'flyer', label: 'flyer' });
    const [{ facts: users }] = await q(`SELECT facts FROM analytics_snapshot_facts WHERE snapshot_id=$1 AND kind='users'`, [snapshotId]);
    expect(users.find((u: { id: string }) => u.id === id)).toMatchObject({ signup_source: 'flyer::soho', signup_platform: 'WEB', completed_at: expect.any(String) });
    const [{ facts: families }] = await q(`SELECT facts FROM analytics_snapshot_facts WHERE snapshot_id=$1 AND kind='families'`, [snapshotId]);
    expect(families.filter((f: { user_id: string }) => f.user_id === id)).toEqual([expect.objectContaining({ kind: 'WEB', consented: false })]);
    const overview = await readAdminPage(h.db.pool, 'overview', { snapshotId, sources: 'flyer' });
    expect(overview.metrics.signups).toBeGreaterThanOrEqual(1);
    expect(overview.series['ops.previousWeek']).toBeDefined();
    const quality = await readAdminPage(h.db.pool, 'quality', { snapshotId, sources: 'flyer' });
    expect(quality.metrics.consentCoverage).toEqual({ numerator: 0, denominator: 1 });
  });
});
