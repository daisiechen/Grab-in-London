import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, inject, it } from 'vitest';
import { Browser, createHarness, json, type Harness } from '../test/harness.ts';
import { pkceChallenge, sha256Hex } from './tokens.ts';
let h: Harness;
beforeAll(async () => { h = await createHarness(inject('pgServerUrl')); });
afterAll(async () => { await h.close(); });
const verifier = 'v'.repeat(43);
async function start(extra: Record<string, unknown> = {}) {
  return h.app.inject({ method: 'POST', url: '/v1/auth/oauth/start', payload: {
    clientRequestId: randomUUID(), provider: 'GOOGLE', client: 'SUPPORT_CLI', appChallenge: pkceChallenge(verifier),
    loopbackRedirectUri: 'http://127.0.0.1:54321/auth/callback', ...extra,
  } });
}
async function callback() {
  const begun = await start(); expect(begun.statusCode, begun.body).toBe(201);
  const data = json(begun).data;
  expect(new URL(data.authorizationUrl).searchParams.get('redirect_uri')).toBe('http://localhost:5174/v1/auth/oauth/callback');
  const grant = h.idp.consent(data.authorizationUrl, { subject: randomUUID() });
  const url = `/v1/auth/oauth/callback?${new URLSearchParams(grant)}`;
  const response = await h.app.inject({ method: 'GET', url });
  expect(response.statusCode, response.body).toBe(303);
  const location = new URL(String(response.headers.location));
  expect(location.origin + location.pathname).toBe('http://127.0.0.1:54321/auth/callback');
  expect([...location.searchParams.keys()].sort()).toEqual(['code', 'state']);
  expect(location.searchParams.get('state')).toBe(data.stateTransactionId);
  expect(response.body).not.toContain('handoffCode');expect(response.body).not.toContain('accessToken');
  expect(response.headers['cache-control']).toContain('no-store');
  return { code: location.searchParams.get('code')!, url };
}
const exchange = (code: string, appVerifier = verifier) => h.app.inject({ method: 'POST', url: '/v1/auth/handoff', payload: { clientRequestId: randomUUID(), code, appVerifier } });
it('issues a 60-second PKCE handoff then a 15-minute opaque CLI session without refresh or implicit support rights', async () => {
  const grant = await callback();
  const { rows: [handoff] } = await h.db.pool.query('SELECT extract(epoch FROM expires_at-created_at)::int AS ttl FROM auth_transactions WHERE secret_hash=$1', [sha256Hex(grant.code)]);
  expect(handoff.ttl).toBe(60);
  const result = await exchange(grant.code); expect(result.statusCode, result.body).toBe(200);
  const credentials = json(result).data;
  expect(Object.keys(credentials).sort()).toEqual(['accessExpiresAt', 'accessToken', 'client']);expect(credentials.client).toBe('SUPPORT_CLI');
  expect(Date.parse(credentials.accessExpiresAt) - Date.now()).toBeGreaterThan(14 * 60_000);
  expect(Date.parse(credentials.accessExpiresAt) - Date.now()).toBeLessThanOrEqual(15 * 60_000);
  expect((await exchange(grant.code)).statusCode).toBe(409);
  expect((await h.app.inject({ method: 'GET', url: grant.url })).statusCode).toBe(409);
  const token = credentials.accessToken, caseId = randomUUID();
  const access = () => h.app.inject({ method: 'GET', url: `/v1/support/cases/${caseId}`, headers: { authorization: `Bearer ${token}` } });
  expect((await access()).statusCode).toBe(403);
  const { rows: [session] } = await h.db.pool.query('SELECT f.user_id,s.family_id FROM sessions s JOIN session_families f ON f.id=s.family_id WHERE s.token_hash=$1', [sha256Hex(token)]);
  await h.db.pool.query("INSERT INTO roles(user_id,role,granted_by) VALUES($1,'support','test')", [session.user_id]);
  const missingMfa = await access(); expect(missingMfa.statusCode).toBe(403); expect(json(missingMfa).error.code).toBe('REAUTH_REQUIRED');
  await h.db.pool.query("UPDATE session_families SET amr=ARRAY['mfa'] WHERE id=$1", [session.family_id]);
  expect((await access()).statusCode).toBe(404); // No per-case grant: role + MFA alone do not disclose a case.
  expect((await h.db.pool.query('SELECT 1 FROM refresh_tokens WHERE family_id=$1', [session.family_id])).rowCount).toBe(0);
});
it('burns a wrong-verifier handoff and refuses expired handoffs', async () => {
  const wrong = await callback(); expect((await exchange(wrong.code, 'x'.repeat(43))).statusCode).toBe(409);
  expect((await exchange(wrong.code)).statusCode).toBe(409);
  const expired = await callback();
  await h.db.pool.query("UPDATE auth_transactions SET created_at=clock_timestamp()-interval '61 seconds',expires_at=clock_timestamp()-interval '1 second' WHERE secret_hash=$1", [sha256Hex(expired.code)]);
  expect((await exchange(expired.code)).statusCode).toBe(409);
});
it.each(['http://localhost:54321/auth/callback', 'http://127.0.0.1:80/auth/callback', 'http://127.0.0.1:65536/auth/callback', 'http://127.0.0.1:54321/other', 'http://127.0.0.1:54321/auth/callback?next=evil', 'http://127.0.0.1:54321/auth/callback#evil', 'http://user@127.0.0.1:54321/auth/callback', 'http://2130706433:54321/auth/callback', 'http://127.0.0.1:54321/auth/%63allback'])('refuses nonliteral or unregistered loopback %s', async (uri) => {
  expect((await start({ loopbackRedirectUri: uri })).statusCode).toBe(422);
});
it('requires CLI challenge and loopback while disallowing loopback on other clients', async () => {
  expect((await start({ appChallenge: undefined })).statusCode).toBe(422);
  expect((await start({ loopbackRedirectUri: undefined })).statusCode).toBe(422);
  expect((await start({ client: 'IOS' })).statusCode).toBe(422);
});
it('keeps a link-required identity in the browser error without issuing a CLI session or leaking a ticket', async () => {
  const email = `${randomUUID()}@example.invalid`, browser = new Browser(h);
  const signedIn = await browser.signInWithEmail(email);
  const begun = await start(), data = json(begun).data;
  const grant = h.idp.consent(data.authorizationUrl, { subject: randomUUID(), email });
  const response = await browser.request('GET', `/v1/auth/oauth/callback?${new URLSearchParams(grant)}`);
  expect(response.statusCode, response.body).toBe(403);expect(response.headers.location).toBeUndefined();
  expect(response.body).not.toContain('linkTicket');expect(response.body).not.toContain('accessToken');
  expect((await browser.request('GET', '/v1/auth/session')).statusCode).toBe(200);
  expect((await h.db.pool.query("SELECT 1 FROM session_families WHERE user_id=$1 AND kind='SUPPORT_CLI'", [signedIn.body.data.session.user.id])).rowCount).toBe(0);
});
