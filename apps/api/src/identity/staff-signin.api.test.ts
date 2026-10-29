import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { Browser, createHarness, json, type Harness } from '../test/harness.ts';
import { MFA_ACR } from './provider.ts';

/**
 * Admin console sign-in: hosted login with every enabled connection and MFA requested (acr_values),
 * returning through the registered HTTP callback to /admin/. Staff access still depends only on the
 * verified `mfa` method in the session.
 */
let h: Harness;
beforeAll(async () => { h = await createHarness(inject('pgServerUrl')); });
afterAll(async () => { await h.close(); });

const ORIGIN = 'http://localhost:5174';
const address = () => `staff-${randomUUID().slice(0, 8)}@example.invalid`;

async function staffAccount(email = address()) {
  const login = await new Browser(h).signInWithEmail(email);
  const id = login.body.data.session.user.id as string;
  await h.db.pool.query(`INSERT INTO roles(user_id,role,granted_by) VALUES($1,'analyst','test-bootstrap')`, [id]);
  return { email, id };
}

async function startStaff(b: Browser) {
  const started = await b.request('POST', '/v1/auth/staff/start', { body: { clientRequestId: randomUUID() } });
  expect(started.statusCode, started.body).toBe(201);
  return json(started).data as { authorizationUrl: string; stateTransactionId: string };
}

async function callback(b: Browser, grant: { code: string; state: string } | Record<string, string>) {
  return b.request('GET', `/v1/auth/oauth/callback?${new URLSearchParams(grant)}`);
}

describe('admin console sign-in (hosted login, MFA requested)', () => {
  it('requests MFA on a hosted login without a preselected connection and reuses the registered callback', async () => {
    const data = await startStaff(new Browser(h));
    const url = new URL(data.authorizationUrl);
    expect(url.searchParams.get('acr_values')).toBe(MFA_ACR);
    expect(url.searchParams.has('connection')).toBe(false);
    expect(url.searchParams.get('redirect_uri')).toBe(`${ORIGIN}/v1/auth/oauth/callback`);
    const [row] = (await h.db.pool.query(`SELECT client, provider, return_target, binder_hash FROM auth_transactions WHERE id=$1`, [data.stateTransactionId])).rows;
    expect(row).toMatchObject({ client: 'WEB', provider: null, return_target: '/admin/' });
    expect(row.binder_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('never requests MFA for member Web, iOS or CLI provider sign-in', async () => {
    const b = new Browser(h);
    const web = await b.request('POST', '/v1/auth/oauth/start', { body: { clientRequestId: randomUUID(), provider: 'GOOGLE', client: 'WEB', returnTarget: '/discover' } });
    expect(web.statusCode, web.body).toBe(201);
    const url = new URL(json(web).data.authorizationUrl);
    expect(url.searchParams.has('acr_values')).toBe(false);
    expect(url.searchParams.get('redirect_uri')).toBe(`${ORIGIN}/auth/callback`);
  });

  it('refuses a start from another origin', async () => {
    const r = await new Browser(h, 'https://evil.example').request('POST', '/v1/auth/staff/start', { body: { clientRequestId: randomUUID() } });
    expect(r.statusCode).toBe(403);
  });

  it('with MFA: sets the session cookie, redirects to /admin/ and opens staff endpoints', async () => {
    const staff = await staffAccount();
    const b = new Browser(h);
    const data = await startStaff(b);
    const r = await callback(b, h.idp.consent(data.authorizationUrl, { email: staff.email, mfa: true }));
    expect(r.statusCode, r.body).toBe(303);
    expect(r.headers.location).toBe(`${ORIGIN}/admin/`);
    expect(r.headers['cache-control']).toContain('no-store');
    expect(String(r.headers['set-cookie'])).toMatch(/__Host-fancy_session=[A-Za-z0-9_-]{43};.*HttpOnly; Secure; SameSite=Lax/);
    expect(r.body).not.toMatch(/__Host|accessToken|refreshToken|handoffCode/);
    const session = json(await b.request('GET', '/v1/auth/session')).data;
    expect(session.user.id).toBe(staff.id);
    expect((await b.request('GET', '/v1/admin/snapshots')).statusCode).toBe(200);
  });

  it('accepts the RFC 9207 iss and error_description parameters Auth0 adds to the callback', async () => {
    const staff = await staffAccount();
    const b = new Browser(h);
    const data = await startStaff(b);
    const grant = h.idp.consent(data.authorizationUrl, { email: staff.email, mfa: true });
    const r = await callback(b, { ...grant, iss: 'https://tenant.example.invalid/' });
    expect(r.statusCode, r.body).toBe(303);
    expect(r.headers.location).toBe(`${ORIGIN}/admin/`);
    const cancelled = new Browser(h);
    const started = await startStaff(cancelled);
    const state = new URL(started.authorizationUrl).searchParams.get('state')!;
    const c = await callback(cancelled, { state, error: 'access_denied', error_description: 'User cancelled', iss: 'https://tenant.example.invalid/' });
    expect(c.statusCode, c.body).toBe(303);
    expect(c.headers.location).toMatch(/\/admin\/\?signin_error=/);
  });

  it('maps a Google identity already linked to the staff account and records its method', async () => {
    const staff = await staffAccount();
    const subject = randomUUID();
    await h.db.pool.query(`INSERT INTO identities (user_id, issuer, subject, provider, email_verified) VALUES ($1, 'https://test-idp.invalid/', $2, 'GOOGLE', true)`, [staff.id, `google|${subject}`]);
    const b = new Browser(h);
    const data = await startStaff(b);
    const r = await callback(b, h.idp.consent(data.authorizationUrl, { provider: 'GOOGLE', subject, email: staff.email, mfa: true }));
    expect(r.headers.location).toBe(`${ORIGIN}/admin/`);
    const [family] = (await h.db.pool.query(`SELECT amr FROM session_families WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`, [staff.id])).rows;
    expect(family.amr).toEqual(['google', 'mfa']);
  });

  it('without MFA: signs in but staff endpoints answer REAUTH_REQUIRED', async () => {
    const staff = await staffAccount();
    const b = new Browser(h);
    const data = await startStaff(b);
    const r = await callback(b, h.idp.consent(data.authorizationUrl, { email: staff.email, mfa: false }));
    expect(r.headers.location).toBe(`${ORIGIN}/admin/`);
    const denied = await b.request('GET', '/v1/admin/snapshots');
    expect(denied.statusCode).toBe(403);
    expect(json(denied).error.code).toBe('REAUTH_REQUIRED');
  });

  it('never creates an account or starts linking, and reports the refusal to the console', async () => {
    const before = (await h.db.pool.query(`SELECT count(*)::int AS n FROM users`)).rows[0].n;
    const b = new Browser(h);
    const fresh = await callback(b, h.idp.consent((await startStaff(b)).authorizationUrl, { email: address(), mfa: true }));
    expect(fresh.statusCode).toBe(303);
    expect(fresh.headers.location).toBe(`${ORIGIN}/admin/?signin_error=FORBIDDEN`);
    expect(String(fresh.headers['set-cookie'] ?? '')).not.toContain('__Host-fancy_session=');
    expect((await h.db.pool.query(`SELECT count(*)::int AS n FROM users`)).rows[0].n).toBe(before);

    const staff = await staffAccount();
    const link = await callback(b, h.idp.consent((await startStaff(b)).authorizationUrl, { provider: 'GOOGLE', subject: randomUUID(), email: staff.email, mfa: true }));
    expect(link.headers.location).toBe(`${ORIGIN}/admin/?signin_error=FORBIDDEN`);
    expect((await h.db.pool.query(`SELECT count(*)::int AS n FROM auth_transactions WHERE kind='LINK' AND user_id=$1`, [staff.id])).rows[0].n).toBe(0);
  });

  it('redirects cancellations, other browsers and replays back to the console with an error code', async () => {
    const staff = await staffAccount();
    const b = new Browser(h);
    const cancelled = await callback(b, { state: new URL((await startStaff(b)).authorizationUrl).searchParams.get('state')!, error: 'access_denied' });
    expect(cancelled.headers.location).toBe(`${ORIGIN}/admin/?signin_error=STATE_CONFLICT`);

    const grant = h.idp.consent((await startStaff(b)).authorizationUrl, { email: staff.email, mfa: true });
    const elsewhere = await callback(new Browser(h), grant);
    expect(elsewhere.headers.location).toBe(`${ORIGIN}/admin/?signin_error=STATE_CONFLICT`);
    expect((await callback(b, grant)).headers.location).toBe(`${ORIGIN}/admin/`);
    const replay = await callback(b, grant);
    expect(replay.statusCode).toBe(409);
  });
});
