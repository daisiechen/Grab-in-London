import { describe, expect, it } from 'vitest';
import { exportJWK, generateKeyPair, SignJWT, createLocalJWKSet } from 'jose';
import { assertFreshAuth } from './reauth.ts';
import { TestIdentityProvider } from './test-provider.ts';
import { loadConfig } from '@fancy/config';
import { identityProviderFor } from '../main.ts';
import { Auth0IdentityProvider } from './auth0-provider.ts';
import { pkceChallenge, verifyPkce } from './tokens.ts';

describe('QA-API-008 re-authentication freshness boundary', () => {
  const authTime = new Date('2026-10-21T10:00:00.000Z');
  it.each([[0, true], [299_999, true], [300_000, false], [300_001, false], [-1, false]])('age %ims → allowed %s', (age, ok) => {
    const call = () => assertFreshAuth(authTime, new Date(authTime.getTime() + age));
    if (ok) expect(call).not.toThrow();
    else expect(call).toThrow(expect.objectContaining({ code: 'REAUTH_REQUIRED' }));
  });
});

describe('PKCE helpers', () => {
  it('matches RFC 7636 appendix B', () => {
    expect(pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
    expect(verifyPkce('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk', 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')).toBe(true);
    expect(verifyPkce('x'.repeat(43), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')).toBe(false);
  });
});

describe('test identity provider', () => {
  it('cannot be constructed for staging or production', () => {
    expect(() => new TestIdentityProvider('production')).toThrow(/test-only/);
    expect(() => new TestIdentityProvider('staging')).toThrow(/test-only/);
  });

  it('issues a different random code per challenge (no fixed OTP)', async () => {
    const idp = new TestIdentityProvider('test');
    const codes = new Set<string>();
    for (let i = 0; i < 20; i++) { await idp.startEmailOtp('a@example.invalid'); }
    for (const c of idp.inbox.get('a@example.invalid')!) codes.add(c);
    expect(codes.size).toBeGreaterThan(1);
  });

  it('uses DEV_FIXED_OTP for every challenge when a local development run opts in', async () => {
    const config = loadConfig({ ENVIRONMENT: 'development', DATABASE_URL: 'postgres://fancy@127.0.0.1:5432/fancy_dev', AUTH_ADAPTER: 'test', PLACES_ADAPTER: 'fixture', MAIL_ADAPTER: 'outbox_test', AI_PROVIDER: 'mock', DEV_FIXED_OTP: '000000', WEB_ORIGIN: 'http://localhost:8081', SESSION_SECRET: 'x'.repeat(32) });
    const idp = identityProviderFor(config) as TestIdentityProvider;
    const first = await idp.startEmailOtp('a@example.invalid');
    await idp.startEmailOtp('a@example.invalid');
    expect(idp.inbox.get('a@example.invalid')).toEqual(['000000', '000000']);
    await expect(idp.verifyEmailOtp({ email: 'a@example.invalid', code: '000000', providerState: first })).resolves.toMatchObject({ email: 'a@example.invalid' });
  });
});

describe('Auth0 adapter (contract-level; real tenant is G-AUTH)', () => {
  async function setup() {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' };
    const jwks = createLocalJWKSet({ keys: [jwk] });
    const sign = (claims: Record<string, unknown>, o: { aud?: string; iss?: string } = {}) =>
      new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid: 'k1' }).setIssuer(o.iss ?? 'https://tenant.example/').setAudience(o.aud ?? 'cid')
        .setIssuedAt().setExpirationTime('5m').setSubject('google-oauth2|123').sign(privateKey);
    const calls: Array<{ url: string; body: Record<string, string> }> = [];
    let next: { status: number; json: unknown } = { status: 200, json: {} };
    const fetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) });
      return new Response(JSON.stringify(next.json), { status: next.status, headers: { 'content-type': 'application/json' } });
    }) as unknown as typeof globalThis.fetch;
    const p = new Auth0IdentityProvider({ domain: 'tenant.example', clientId: 'cid', clientSecret: 'shh', fetch, jwks });
    return { p, sign, calls, setNext: (n: typeof next) => { next = n; } };
  }

  it('builds a PKCE authorization URL for the connection and forces login for re-auth', async () => {
    const { p } = await setup();
    const url = new URL(p.authorizationUrl({ provider: 'APPLE', state: 's', nonce: 'n', codeChallenge: 'c', redirectUri: 'https://app/auth/callback', forceLogin: true }));
    expect(url.origin + url.pathname).toBe('https://tenant.example/authorize');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ connection: 'apple', code_challenge_method: 'S256', prompt: 'login', max_age: '0', response_type: 'code' });
  });

  it('accepts only ID tokens with the right issuer, audience and nonce', async () => {
    const { p, sign, calls, setNext } = await setup();
    setNext({ status: 200, json: { id_token: await sign({ nonce: 'n1', email: 'A@Example.Test', email_verified: true }) } });
    const id = await p.exchangeAuthorizationCode({ provider: 'GOOGLE', code: 'c', codeVerifier: 'v', redirectUri: 'r', nonce: 'n1' });
    expect(id).toMatchObject({ issuer: 'https://tenant.example/', subject: 'google-oauth2|123', email: 'a@example.test', emailVerified: true, amr: ['google'] });
    expect(calls[0]).toMatchObject({ url: 'https://tenant.example/oauth/token', body: { grant_type: 'authorization_code', code_verifier: 'v' } });
    setNext({ status: 200, json: { id_token: await sign({ nonce: 'other' }) } });
    await expect(p.exchangeAuthorizationCode({ provider: 'GOOGLE', code: 'c', codeVerifier: 'v', redirectUri: 'r', nonce: 'n1' })).rejects.toThrow(/nonce/);
    setNext({ status: 200, json: { id_token: await sign({ nonce: 'n1' }, { aud: 'someone-else' }) } });
    await expect(p.exchangeAuthorizationCode({ provider: 'GOOGLE', code: 'c', codeVerifier: 'v', redirectUri: 'r', nonce: 'n1' })).rejects.toThrow(/validation/);
    setNext({ status: 200, json: { id_token: await sign({ nonce: 'n1' }, { iss: 'https://evil.example/' }) } });
    await expect(p.exchangeAuthorizationCode({ provider: 'GOOGLE', code: 'c', codeVerifier: 'v', redirectUri: 'r', nonce: 'n1' })).rejects.toThrow(/validation/);
  });

  it('maps OTP rejection to a wrong code and outages to ProviderUnavailableError', async () => {
    const { p, setNext } = await setup();
    setNext({ status: 403, json: { error: 'invalid_grant' } });
    expect(await p.verifyEmailOtp({ email: 'a@example.test', code: '123456' })).toBeNull();
    setNext({ status: 503, json: {} });
    await expect(p.startEmailOtp('a@example.test')).rejects.toMatchObject({ name: 'ProviderUnavailableError' });
  });
});
