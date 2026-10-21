import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { Browser, createHarness, json, randomIp, type Harness } from '../test/harness.ts';
import { pkceChallenge, randomToken } from './tokens.ts';

let h: Harness;
beforeAll(async () => { h = await createHarness(inject('pgServerUrl')); });
afterAll(async () => { await h.close(); });

const q = async (sql: string, params: unknown[] = []) => (await h.db.pool.query(sql, params)).rows;
const email = () => `qa-${randomUUID().slice(0, 8)}@example.invalid`;
const start = (b: Browser, address: string, extra: Record<string, unknown> = {}) =>
  b.request('POST', '/v1/auth/email/start', { body: { clientRequestId: randomUUID(), email: address, client: 'WEB', ...extra } });
const lastCode = (address: string) => h.idp.inbox.get(address)!.at(-1)!;

describe('S03 email OTP sign-in', () => {
  it('signs in with a server-verified code, sets a hardened cookie and exposes no credentials', async () => {
    const b = new Browser(h);
    const address = email();
    const started = await start(b, address, { returnTarget: '/meals/6a1f6c32-6c4e-4c4d-9a51-6c1d0e5f9b11' });
    expect(started.statusCode).toBe(201);
    expect(started.headers['cache-control']).toBe('private, no-store');
    const { challengeId } = json(started).data;
    const verify = await b.request('POST', '/v1/auth/email/verify', { body: { clientRequestId: randomUUID(), challengeId, code: lastCode(address) } });
    expect(verify.statusCode).toBe(200);
    const body = json(verify).data;
    expect(body).toMatchObject({ outcome: 'AUTHENTICATED', returnTarget: '/meals/6a1f6c32-6c4e-4c4d-9a51-6c1d0e5f9b11', authProof: challengeId });
    expect(body.session.user.email).toBe(address);
    expect(body.session.user.profileGate.profileComplete).toBe(false);
    const setCookie = String(verify.headers['set-cookie']);
    expect(setCookie).toMatch(/__Host-fancy_session=[A-Za-z0-9_-]{43}; Max-Age=\d+; Path=\/; HttpOnly; Secure; SameSite=Lax/);
    expect(JSON.stringify(body)).not.toMatch(/__Host|accessToken|refreshToken|handoffCode/);
    b.csrf = body.session.csrfToken;
    expect((await b.request('GET', '/v1/auth/session')).statusCode).toBe(200);
    // Nothing credential-like is kept in the generic idempotency table or the transaction row.
    expect(await q(`SELECT count(*)::int AS n FROM idempotency`)).toEqual([{ n: 0 }]);
    const [row] = await q(`SELECT row_to_json(t)::text AS r FROM auth_transactions t WHERE id = $1`, [challengeId]);
    expect(row.r).not.toContain(lastCode(address));
    expect((await q(`SELECT token_hash FROM sessions`)).every((r) => /^[0-9a-f]{64}$/.test(r.token_hash))).toBe(true);
  });

  it('answers the same for new and existing emails (no account enumeration)', async () => {
    const existing = email();
    await new Browser(h).signInWithEmail(existing);
    await q(`UPDATE auth_transactions SET created_at = created_at - interval '1 minute' WHERE kind = 'EMAIL_OTP'`);
    const a = json(await start(new Browser(h), existing)).data;
    const b = json(await start(new Browser(h), email())).data;
    expect(Object.keys(a).sort()).toEqual(Object.keys(b).sort());
  });

  it('enforces the 5-attempt limit server-side and single use of a successful challenge', async () => {
    const b = new Browser(h);
    const address = email();
    const { challengeId } = json(await start(b, address)).data;
    const verify = (code: string) => b.request('POST', '/v1/auth/email/verify', { body: { clientRequestId: randomUUID(), challengeId, code } });
    const wrong = lastCode(address) === '000000' ? '111111' : '000000';
    for (let i = 4; i >= 1; i--) {
      const r = await verify(wrong);
      expect(r.statusCode).toBe(422);
      expect(json(r).error.fieldErrors['body.code']).toBe(`Incorrect code (${i} attempts left)`);
    }
    expect(json(await verify(wrong)).error.fieldErrors['body.code']).toBe('No attempts left');
    const late = await verify(lastCode(address));
    expect(late.statusCode).toBe(409);
    expect(json(late).error.code).toBe('STATE_CONFLICT');
    expect(late.headers['set-cookie']).toBeUndefined();

    const c = new Browser(h);
    const other = email();
    const { challengeId: id2 } = json(await start(c, other)).data;
    const code = lastCode(other);
    expect((await c.request('POST', '/v1/auth/email/verify', { body: { clientRequestId: randomUUID(), challengeId: id2, code } })).statusCode).toBe(200);
    const replay = await c.request('POST', '/v1/auth/email/verify', { body: { clientRequestId: randomUUID(), challengeId: id2, code } });
    expect(replay.statusCode).toBe(409);
    expect(replay.headers['set-cookie']).toBeUndefined();
  });

  it('rejects expired codes, rate-limits resends and dedupes clientRequestId', async () => {
    const b = new Browser(h);
    const address = email();
    const clientRequestId = randomUUID();
    const first = await b.request('POST', '/v1/auth/email/start', { body: { clientRequestId, email: address, client: 'WEB' } });
    const again = await b.request('POST', '/v1/auth/email/start', { body: { clientRequestId, email: address, client: 'WEB' } });
    expect(json(again).data.challengeId).toBe(json(first).data.challengeId);
    expect(h.idp.inbox.get(address)).toHaveLength(1);
    expect((await b.request('POST', '/v1/auth/email/start', { body: { clientRequestId, email: email(), client: 'WEB' } })).statusCode).toBe(409);

    const resend = await start(b, address);
    expect(resend.statusCode).toBe(429);
    expect(Number(resend.headers['retry-after'])).toBeGreaterThan(0);
    expect(json(resend).error).toMatchObject({ code: 'RATE_LIMITED', retryAfterSeconds: expect.any(Number) });

    await q(`UPDATE auth_transactions SET created_at = created_at - interval '6 minutes', expires_at = clock_timestamp() - interval '1 minute' WHERE id = $1`, [json(first).data.challengeId]);
    const expired = await b.request('POST', '/v1/auth/email/verify', { body: { clientRequestId: randomUUID(), challengeId: json(first).data.challengeId, code: lastCode(address) } });
    expect(json(expired).error.code).toBe('STATE_CONFLICT');
    // 5 codes per 15 minutes per email.
    await q(`UPDATE auth_transactions SET created_at = LEAST(created_at, clock_timestamp() - interval '1 minute') WHERE kind = 'EMAIL_OTP'`);
    for (let i = 0; i < 4; i++) {
      const r = await start(b, address);
      expect(r.statusCode, `start ${i}`).toBe(201);
      await q(`UPDATE auth_transactions SET created_at = clock_timestamp() - interval '1 minute' WHERE id = $1`, [json(r).data.challengeId]);
    }
    const limited = await start(b, address);
    expect(json(limited).error.code).toBe('RATE_LIMITED');
  });

  it('refuses Web sign-in requests from a foreign origin', async () => {
    const r = await new Browser(h, 'https://evil.example').request('POST', '/v1/auth/email/start', { body: { clientRequestId: randomUUID(), email: email(), client: 'WEB' } });
    expect(r.statusCode).toBe(403);
    expect(await q(`SELECT count(*)::int n FROM auth_transactions WHERE created_at > clock_timestamp() - interval '2 seconds' AND ip_hash IS NOT NULL AND email_hash IS NULL`)).toEqual([{ n: 0 }]);
  });

  it('reports provider outages as 503 and retires the undelivered challenge', async () => {
    h.idp.unavailable = true;
    try {
      const r = await start(new Browser(h), email());
      expect(r.statusCode).toBe(503);
      expect(json(r).error.code).toBe('PROVIDER_UNAVAILABLE');
    } finally {
      h.idp.unavailable = false;
    }
  });
});

describe('S04 session protection', () => {
  it('requires Origin and CSRF for cookie writes; logout revokes only this device', async () => {
    const address = email();
    const phone = new Browser(h);
    await phone.signInWithEmail(address);
    await q(`UPDATE auth_transactions SET created_at = created_at - interval '1 minute' WHERE kind = 'EMAIL_OTP'`);
    const laptop = new Browser(h);
    await laptop.signInWithEmail(address);

    const csrf = phone.csrf;
    phone.csrf = null;
    expect((await phone.request('POST', '/v1/auth/logout', { body: { clientRequestId: randomUUID() } })).statusCode).toBe(403);
    phone.csrf = csrf;
    const foreign = new Browser(h, 'https://evil.example');
    for (const [k, v] of phone.cookies) foreign.cookies.set(k, v);
    foreign.csrf = csrf;
    expect((await foreign.request('POST', '/v1/auth/logout', { body: { clientRequestId: randomUUID() } })).statusCode).toBe(403);

    const stolen = new Map(phone.cookies);
    const out = await phone.request('POST', '/v1/auth/logout', { body: { clientRequestId: randomUUID() } });
    expect(out.statusCode).toBe(204);
    expect(phone.cookies.has('__Host-fancy_session')).toBe(false);
    expect((await phone.request('GET', '/v1/auth/session')).statusCode).toBe(401);
    const replay = new Browser(h);
    for (const [k, v] of stolen) replay.cookies.set(k, v);
    expect((await replay.request('GET', '/v1/auth/session')).statusCode).toBe(401);
    expect((await laptop.request('GET', '/v1/auth/session')).statusCode).toBe(200);
  });

  it('rejects unknown fields, malformed tokens and missing sessions with the contract envelope', async () => {
    const b = new Browser(h);
    const r = await b.request('POST', '/v1/auth/email/start', { body: { clientRequestId: randomUUID(), email: email(), client: 'WEB', actorId: randomUUID() } });
    expect(r.statusCode).toBe(422);
    expect(json(r).error).toMatchObject({ code: 'VALIDATION_FAILED', fieldErrors: { 'body.actorId': 'Unknown field' } });
    expect(json(r).meta.requestId).toBe(r.headers['x-request-id']);
    const bearer = await h.app.inject({ method: 'GET', url: '/v1/auth/session', headers: { authorization: 'Bearer not-a-real-token-but-long-enough' } });
    expect(bearer.statusCode).toBe(401);
    expect(json(bearer).error.code).toBe('AUTH_REQUIRED');
    const broken = await h.app.inject({ method: 'POST', url: '/v1/auth/email/start', headers: { 'content-type': 'application/json', origin: 'http://localhost:5174' }, payload: '{"oops"' });
    expect(broken.statusCode).toBe(400);
    expect(json(broken).error.code).toBe('INVALID_REQUEST');
    expect((await h.app.inject({ method: 'GET', url: '/v1/nope' })).statusCode).toBe(404);
  });

  it('expires idle web sessions and sessions of deleted users', async () => {
    const b = new Browser(h);
    const { body } = await b.signInWithEmail(email());
    await q(`UPDATE sessions SET last_used_at = clock_timestamp() - interval '8 days'`);
    expect((await b.request('GET', '/v1/auth/session')).statusCode).toBe(401);
    const c = new Browser(h);
    const signed = await c.signInWithEmail(email());
    await q(`UPDATE users SET status = 'DELETING' WHERE id = $1`, [signed.body.data.session.user.id]);
    expect((await c.request('GET', '/v1/auth/session')).statusCode).toBe(401);
    expect(body.data.outcome).toBe('AUTHENTICATED');
  });
});

describe('S03 OAuth (Google/Apple) for Web', () => {
  async function startGoogle(b: Browser, returnTarget?: string) {
    const r = await b.request('POST', '/v1/auth/oauth/start', { body: { clientRequestId: randomUUID(), provider: 'GOOGLE', client: 'WEB', ...(returnTarget ? { returnTarget } : {}) } });
    return { r, url: json(r).data?.authorizationUrl as string };
  }

  it('binds state, nonce and PKCE to the starting browser and consumes the callback once', async () => {
    const b = new Browser(h);
    const { r, url } = await startGoogle(b, '/discover');
    expect(r.statusCode).toBe(201);
    const params = new URL(url).searchParams;
    expect(params.get('code_challenge_method')).toBe('S256');
    expect(params.get('redirect_uri')).toBe('http://localhost:5174/auth/callback');
    expect(b.cookies.has('__Host-fancy_oauth')).toBe(true);
    const { code, state } = h.idp.consent(url, { subject: randomUUID(), email: email() });

    const other = new Browser(h);
    const hijack = await other.request('GET', `/v1/auth/oauth/callback?code=${code}&state=${state}`);
    expect(json(hijack).error.code).toBe('STATE_CONFLICT');
    const swapped = await b.request('GET', `/v1/auth/oauth/callback?code=${code}&state=${randomToken()}`);
    expect(json(swapped).error.code).toBe('STATE_CONFLICT');

    const ok = await b.request('GET', `/v1/auth/oauth/callback?code=${code}&state=${state}`);
    expect(ok.statusCode).toBe(200);
    expect(json(ok).data).toMatchObject({ outcome: 'AUTHENTICATED', returnTarget: '/discover' });
    expect(b.cookies.has('__Host-fancy_session')).toBe(true);
    const replay = await b.request('GET', `/v1/auth/oauth/callback?code=${code}&state=${state}`);
    expect(json(replay).error.code).toBe('STATE_CONFLICT');
  });

  it('fails closed when the PKCE verifier does not match and refuses open redirects', async () => {
    const b = new Browser(h);
    const { url } = await startGoogle(b);
    const { code, state } = h.idp.consent(url, { subject: randomUUID(), email: email() });
    await q(`UPDATE auth_transactions SET provider_state = provider_state || '{"verifier":"${randomToken(48)}"}' WHERE kind = 'OAUTH' AND consumed_at IS NULL`);
    const r = await b.request('GET', `/v1/auth/oauth/callback?code=${code}&state=${state}`);
    expect(json(r).error.code).toBe('STATE_CONFLICT');
    expect(b.cookies.has('__Host-fancy_session')).toBe(false);
    for (const target of ['//evil.example', '/\\evil.example', '/admin']) {
      const bad = await startGoogle(new Browser(h), target);
      expect(bad.r.statusCode, target).toBe(422);
    }
  });

  it('treats a cancelled consent as no sign-in', async () => {
    const b = new Browser(h);
    const { url } = await startGoogle(b);
    const state = new URL(url).searchParams.get('state')!;
    const r = await b.request('GET', `/v1/auth/oauth/callback?state=${state}&error=access_denied`);
    expect(json(r).error.code).toBe('STATE_CONFLICT');
    expect(b.cookies.has('__Host-fancy_session')).toBe(false);
  });
});

describe('S04 iOS handoff and refresh rotation', () => {
  async function iosSignIn() {
    const verifier = randomToken(48);
    const appChallenge = pkceChallenge(verifier);
    const address = email();
    const s = await h.app.inject({ method: 'POST', url: '/v1/auth/email/start', remoteAddress: randomIp(), payload: { clientRequestId: randomUUID(), email: address, client: 'IOS' } });
    const challengeId = s.json().data.challengeId;
    const v = await h.app.inject({ method: 'POST', url: '/v1/auth/email/verify', payload: { clientRequestId: randomUUID(), challengeId, code: lastCode(address), appChallenge } });
    return { verifier, response: v };
  }
  const exchange = (code: string, appVerifier: string) => h.app.inject({ method: 'POST', url: '/v1/auth/handoff', payload: { clientRequestId: randomUUID(), code, appVerifier } });

  it('atomically revokes the native guest credential when a verified handoff becomes a user session',async()=>{
    const minted=await h.app.inject({method:'POST',url:'/v1/guest-sessions',payload:{clientRequestId:randomUUID(),client:'IOS'}});
    expect(minted.statusCode).toBe(201);const guest=minted.json().data.guestToken;
    const login=await iosSignIn();
    const result=await h.app.inject({method:'POST',url:'/v1/auth/handoff',headers:{authorization:`Bearer ${guest}`},payload:{clientRequestId:randomUUID(),code:login.response.json().data.handoffCode,appVerifier:login.verifier}});
    expect(result.statusCode,result.body).toBe(200);
    const reuse=await h.app.inject({method:'POST',url:'/v1/ai/sessions',headers:{authorization:`Bearer ${guest}`,'idempotency-key':randomUUID()},payload:{deviceChallenge:randomToken(32)}});
    expect(reuse.statusCode,reuse.body).toBe(410);
  });

  it('returns a one-time handoff code bound to the app challenge, never a session cookie', async () => {
    const { verifier, response } = await iosSignIn();
    expect(response.headers['set-cookie']).toBeUndefined();
    const { handoffCode } = response.json().data;
    expect(handoffCode).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const wrong = await exchange(handoffCode, randomToken(48));
    expect(wrong.json().error.code).toBe('STATE_CONFLICT');
    // The wrong verifier burned the code for everyone.
    expect((await exchange(handoffCode, verifier)).statusCode).toBe(409);

    const second = await iosSignIn();
    const ok = await exchange(second.response.json().data.handoffCode, second.verifier);
    expect(ok.statusCode).toBe(200);
    const creds = ok.json().data;
    expect(creds).toMatchObject({ client: 'IOS', accessToken: expect.any(String), refreshToken: expect.any(String) });
    expect(new Date(creds.accessExpiresAt).getTime() - Date.now()).toBeLessThanOrEqual(15 * 60_000);
    expect((await exchange(second.response.json().data.handoffCode, second.verifier)).statusCode).toBe(409);
    const session = await h.app.inject({ method: 'GET', url: '/v1/auth/session', headers: { authorization: `Bearer ${creds.accessToken}` } });
    expect(session.statusCode).toBe(200);
    expect(session.json().data.csrfToken).toBeUndefined();
  });

  it('refuses native sign-in without an app challenge and expired handoffs', async () => {
    const address = email();
    const s = await h.app.inject({ method: 'POST', url: '/v1/auth/email/start', remoteAddress: randomIp(), payload: { clientRequestId: randomUUID(), email: address, client: 'IOS' } });
    const v = await h.app.inject({ method: 'POST', url: '/v1/auth/email/verify', payload: { clientRequestId: randomUUID(), challengeId: s.json().data.challengeId, code: lastCode(address) } });
    expect(v.statusCode).toBe(422);
    const { verifier, response } = await iosSignIn();
    await q(`UPDATE auth_transactions SET created_at = created_at - interval '2 minutes', expires_at = clock_timestamp() - interval '1 second' WHERE kind = 'HANDOFF' AND consumed_at IS NULL`);
    expect((await exchange(response.json().data.handoffCode, verifier)).json().error.code).toBe('STATE_CONFLICT');
  });

  it('rotates refresh tokens and revokes the family when an old refresh token is reused', async () => {
    const { verifier, response } = await iosSignIn();
    const creds = (await exchange(response.json().data.handoffCode, verifier)).json().data;
    const refresh = (token: string) => h.app.inject({ method: 'POST', url: '/v1/auth/refresh', payload: { clientRequestId: randomUUID(), refreshToken: token } });
    const rotated = await refresh(creds.refreshToken);
    expect(rotated.statusCode).toBe(200);
    const next = rotated.json().data;
    expect(next.refreshToken).not.toBe(creds.refreshToken);
    const session = (token: string) => h.app.inject({ method: 'GET', url: '/v1/auth/session', headers: { authorization: `Bearer ${token}` } });
    expect((await session(creds.accessToken)).statusCode).toBe(401);
    expect((await session(next.accessToken)).statusCode).toBe(200);
    const reuse = await refresh(creds.refreshToken);
    expect(reuse.statusCode).toBe(401);
    expect((await session(next.accessToken)).statusCode).toBe(401);
    expect((await refresh(next.refreshToken)).statusCode).toBe(401);
    expect(await q(`SELECT revoke_reason FROM session_families f JOIN refresh_tokens r ON r.family_id = f.id WHERE r.token_hash IS NOT NULL GROUP BY revoke_reason`)).toContainEqual({ revoke_reason: 'REFRESH_REUSE' });
  });
});

describe('S03 identity linking without silent merge', () => {
  async function linkRequired(b: Browser, address: string) {
    const r = await b.request('POST', '/v1/auth/oauth/start', { body: { clientRequestId: randomUUID(), provider: 'GOOGLE', client: 'WEB' } });
    const subject = randomUUID();
    const { code, state } = h.idp.consent(json(r).data.authorizationUrl, { subject, email: address });
    return { cb: await b.request('GET', `/v1/auth/oauth/callback?code=${code}&state=${state}`), subject };
  }
  const link = (b: Browser, body: Record<string, unknown>, key = randomUUID()) =>
    b.request('POST', '/v1/auth/links', { body, headers: { 'idempotency-key': key } });
  const userCount = async () => Number((await q(`SELECT count(*) n FROM users`))[0].n);

  it('returns LINK_REQUIRED without creating a user or session, then links after dual proof', async () => {
    const address = email();
    const owner = new Browser(h);
    const signup = await owner.signInWithEmail(address);
    const userId = signup.body.data.session.user.id;
    const before = await userCount();

    const b = new Browser(h);
    const { cb } = await linkRequired(b, address);
    expect(json(cb).data).toMatchObject({ outcome: 'LINK_REQUIRED', linkTicket: expect.any(String) });
    expect(json(cb).data.session).toBeUndefined();
    expect(b.cookies.has('__Host-fancy_session')).toBe(false);
    expect(await userCount()).toBe(before);

    await q(`UPDATE auth_transactions SET created_at = created_at - interval '1 minute' WHERE kind = 'EMAIL_OTP'`);
    const proof = await b.signInWithEmail(address);
    expect(proof.body.data.session.user.id).toBe(userId);
    const key = randomUUID();
    const linked = await link(b, { linkTicket: json(cb).data.linkTicket, originalChallengeProof: proof.body.data.authProof }, key);
    expect(linked.statusCode).toBe(200);
    expect(json(linked).data.identities.map((i: { provider: string }) => i.provider)).toEqual(['EMAIL', 'GOOGLE']);
    expect(await userCount()).toBe(before);

    const replay = await link(b, { linkTicket: json(cb).data.linkTicket, originalChallengeProof: proof.body.data.authProof }, key);
    expect(replay.headers['idempotent-replay']).toBe('true');
    expect(json(replay).data).toEqual(json(linked).data);
    const reused = await link(b, { linkTicket: json(cb).data.linkTicket, originalChallengeProof: proof.body.data.authProof });
    expect(json(reused).error.code).toBe('LINK_TICKET_INVALID');
    expect(await q(`SELECT action FROM audit_events WHERE aggregate_id = $1`, [userId])).toEqual([{ action: 'identity.linked' }]);
  });

  for(const ageMs of [1000,299000,300000,301000,-1000])it(`QA-F03 proof age ${ageMs}ms uses the five-minute boundary independently of fresh session auth`,async()=>{
    const address=email();await new Browser(h).signInWithEmail(address);
    const b=new Browser(h),{cb}=await linkRequired(b,address);
    await q(`UPDATE auth_transactions SET created_at=created_at-interval '1 minute' WHERE kind='EMAIL_OTP'`);
    const proof=(await b.signInWithEmail(address)).body.data.authProof;
    await q(`UPDATE auth_transactions SET consumed_at=clock_timestamp()-make_interval(secs=>$2::double precision/1000) WHERE id=$1`,[proof,ageMs]);
    const result=await link(b,{linkTicket:json(cb).data.linkTicket,originalChallengeProof:proof});
    expect(result.statusCode,result.body).toBe(ageMs>=0&&ageMs<300000?200:403);
    if(ageMs<0||ageMs>=300000){expect(json(result).error.code).toBe('REAUTH_REQUIRED');expect(await q(`SELECT 1 FROM identities WHERE user_id=(SELECT user_id FROM auth_transactions WHERE id=$1) AND provider='GOOGLE'`,[proof])).toHaveLength(0);}
  });

  it('rejects tickets from another browser, expired tickets and stale re-authentication', async () => {
    const address = email();
    await new Browser(h).signInWithEmail(address);
    const b = new Browser(h);
    const { cb } = await linkRequired(b, address);
    const ticket = json(cb).data.linkTicket;
    await q(`UPDATE auth_transactions SET created_at = created_at - interval '1 minute' WHERE kind = 'EMAIL_OTP'`);
    const proof = (await b.signInWithEmail(address)).body.data.authProof;

    const elsewhere = new Browser(h);
    for (const [k, v] of b.cookies) if (k !== '__Host-fancy_link') elsewhere.cookies.set(k, v);
    elsewhere.csrf = b.csrf;
    expect(json(await link(elsewhere, { linkTicket: ticket, originalChallengeProof: proof })).error.code).toBe('LINK_TICKET_INVALID');

    await q(`UPDATE session_families SET auth_time = clock_timestamp() - interval '301 seconds' WHERE id = (SELECT result_family_id FROM auth_transactions WHERE id = $1)`, [proof]);
    expect(json(await link(b, { linkTicket: ticket, originalChallengeProof: proof })).error.code).toBe('REAUTH_REQUIRED');

    await q(`UPDATE auth_transactions SET created_at = created_at - interval '11 minutes', expires_at = clock_timestamp() - interval '1 second' WHERE kind = 'LINK' AND consumed_at IS NULL`);
    await q(`UPDATE session_families SET auth_time = clock_timestamp() WHERE id = (SELECT result_family_id FROM auth_transactions WHERE id = $1)`, [proof]);
    expect(json(await link(b, { linkTicket: ticket, originalChallengeProof: proof })).error.code).toBe('LINK_TICKET_INVALID');
  });

  async function legacySecondAccount(subject: string, withFacts: boolean) {
    const [{ id }] = await q(`INSERT INTO users DEFAULT VALUES RETURNING id`);
    await q(`INSERT INTO identities (user_id, issuer, subject, provider, email_verified) VALUES ($1, 'https://test-idp.invalid/', $2, 'GOOGLE', true)`, [id, `google|${subject}`]);
    await q(`INSERT INTO session_families (user_id, kind, auth_time, amr, absolute_expires_at) VALUES ($1, 'WEB', now(), '{google}', now() + interval '1 day')`, [id]);
    if (withFacts) await q(`INSERT INTO roles (user_id, role, granted_by) VALUES ($1, 'analyst', 'test')`, [id]);
    return id as string;
  }

  async function dualProofAgainstLegacy(withFacts: boolean) {
    const address = email();
    const owner = await new Browser(h).signInWithEmail(address);
    const subject = randomUUID();
    const legacy = await legacySecondAccount(subject, withFacts);
    // A LINK ticket for that identity (as if issued before the legacy mapping existed).
    const b = new Browser(h);
    await q(`UPDATE auth_transactions SET created_at = created_at - interval '1 minute' WHERE kind = 'EMAIL_OTP'`);
    const proof = (await b.signInWithEmail(address)).body.data.authProof;
    const ticket = randomToken();
    const binder = randomToken();
    const { sha256Hex } = await import('./tokens.ts');
    await q(`INSERT INTO auth_transactions (kind, client, user_id, secret_hash, binder_hash, provider, provider_state, expires_at)
             VALUES ('LINK', 'WEB', $1, $2, $3, 'GOOGLE', $4, clock_timestamp() + interval '10 minutes')`,
      [owner.body.data.session.user.id, sha256Hex(ticket), sha256Hex(binder), JSON.stringify({ issuer: 'https://test-idp.invalid/', subject: `google|${subject}`, emailVerified: 'true' })]);
    b.cookies.set('__Host-fancy_link', binder);
    return { response: await link(b, { linkTicket: ticket, originalChallengeProof: proof }), legacy, ownerId: owner.body.data.session.user.id as string };
  }

  it('migrates the identity from an empty provisional shell, revoking its sessions and tombstoning it', async () => {
    const { response, legacy, ownerId } = await dualProofAgainstLegacy(false);
    expect(response.statusCode).toBe(200);
    expect(await q(`SELECT user_id FROM identities WHERE subject LIKE 'google|%' AND user_id IN ($1, $2)`, [legacy, ownerId])).toEqual([{ user_id: ownerId }]);
    expect(await q(`SELECT status FROM users WHERE id = $1`, [legacy])).toEqual([{ status: 'DELETED' }]);
    expect(await q(`SELECT revoke_reason FROM session_families WHERE user_id = $1`, [legacy])).toEqual([{ revoke_reason: 'LINK_SHELL' }]);
  });

  it('refuses to merge two accounts that both have business facts', async () => {
    const { response, legacy, ownerId } = await dualProofAgainstLegacy(true);
    expect(json(response).error.code).toBe('ACCOUNT_LINK_CONFLICT');
    expect(await q(`SELECT user_id FROM identities WHERE subject LIKE 'google|%' AND user_id IN ($1, $2)`, [legacy, ownerId])).toEqual([{ user_id: legacy }]);
    expect(await q(`SELECT status FROM users WHERE id = $1`, [legacy])).toEqual([{ status: 'ACTIVE' }]);
  });
});

describe('re-authentication', () => {
  it('refreshes authTime only through the same device and an identity of the same user', async () => {
    const address = email();
    const b = new Browser(h);
    await b.signInWithEmail(address);
    await q(`UPDATE session_families SET auth_time = clock_timestamp() - interval '1 hour'`);
    await q(`UPDATE auth_transactions SET created_at = created_at - interval '1 minute' WHERE kind = 'EMAIL_OTP'`);
    const startR = await b.request('POST', '/v1/auth/reauth', { body: { clientRequestId: randomUUID(), method: 'EMAIL' } });
    expect(startR.statusCode).toBe(201);
    const challengeId = json(startR).data.challengeId;
    const other = new Browser(h);
    const hijack = await other.request('POST', '/v1/auth/email/verify', { body: { clientRequestId: randomUUID(), challengeId, code: lastCode(address) } });
    expect(json(hijack).error.code).toBe('FORBIDDEN');

    await q(`UPDATE auth_transactions SET created_at = created_at - interval '1 minute' WHERE kind = 'EMAIL_OTP'`);
    const again = await b.request('POST', '/v1/auth/reauth', { body: { clientRequestId: randomUUID(), method: 'EMAIL' } });
    const done = await b.request('POST', '/v1/auth/email/verify', { body: { clientRequestId: randomUUID(), challengeId: json(again).data.challengeId, code: lastCode(address) } });
    expect(done.statusCode).toBe(200);
    expect(Date.now() - new Date(json(done).data.session.authTime).getTime()).toBeLessThan(60_000);
    expect(json(done).data.authProof).toBe(json(again).data.challengeId);
  });
});
