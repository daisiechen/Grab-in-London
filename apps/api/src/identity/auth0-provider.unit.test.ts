import { beforeAll, expect, it } from 'vitest';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload } from 'jose';
import { Auth0IdentityProvider, providerFromSubject } from './auth0-provider.ts';
import { MFA_ACR, ProviderRejectedError } from './provider.ts';

let keys: Awaited<ReturnType<typeof generateKeyPair>>;
let jwks: ReturnType<typeof createLocalJWKSet>;
beforeAll(async () => {
  keys = await generateKeyPair('RS256');
  jwks = createLocalJWKSet({ keys: [{ ...await exportJWK(keys.publicKey), kid: 'verified-test-key', alg: 'RS256' }] });
});
async function signed(payload: JWTPayload = {}, signingKey = keys.privateKey) {
  return new SignJWT({ sub: 'google-oauth2|synthetic-user', nonce: 'expected-nonce', ...payload })
    .setProtectedHeader({ alg: 'RS256', kid: 'verified-test-key' }).setIssuer('https://tenant.example/')
    .setAudience('synthetic-client').setExpirationTime('5m').sign(signingKey);
}
function provider(token: string) {
  return new Auth0IdentityProvider({ domain: 'tenant.example', clientId: 'synthetic-client', clientSecret: 'synthetic-placeholder', jwks,
    fetch: (async () => ({ status: 200, json: async () => ({ id_token: token }) })) as unknown as typeof fetch });
}
function exchange(token: string, kind: 'GOOGLE' | 'APPLE' = 'GOOGLE') {
  return provider(token).exchangeAuthorizationCode({ provider: kind, code: 'synthetic-code', codeVerifier: 'synthetic-verifier', redirectUri: 'https://app.example/v1/auth/oauth/callback', nonce: 'expected-nonce' });
}
it('retains MFA only from the cryptographically verified array claim while keeping the provider method', async () => {
  expect((await exchange(await signed({ amr: ['pwd', 'mfa', 'mfa'] }))).amr).toEqual(['google', 'mfa']);
  expect((await exchange(await signed({ amr: ['mfa'] }), 'APPLE')).amr).toEqual(['apple', 'mfa']);
  const email = await provider(await signed({ amr: ['mfa'] })).verifyEmailOtp({ email: 'member@example.invalid', code: '123456' });
  expect(email?.amr).toEqual(['otp', 'mfa']);
});
it.each([undefined, null, 'mfa', ['mfa', 1], { mfa: true }, ['MFA'], ['otp'], []])('does not infer MFA from malformed or absent amr %j', async (amr) => {
  expect((await exchange(await signed({ amr, name: 'mfa', acr: 'mfa', email: 'mfa@example.invalid' }))).amr).toEqual(['google']);
});
it('rejects a signed token with the wrong nonce, issuer, audience or expiry', async () => {
  await expect(exchange(await signed({ nonce: 'wrong' }))).rejects.toBeInstanceOf(ProviderRejectedError);
  for (const field of ['iss', 'aud', 'exp'] as const) {
    const builder = new SignJWT({ sub: 'synthetic-user', nonce: 'expected-nonce', amr: ['mfa'] })
      .setProtectedHeader({ alg: 'RS256', kid: 'verified-test-key' }).setIssuer(field === 'iss' ? 'https://wrong.example/' : 'https://tenant.example/')
      .setAudience(field === 'aud' ? 'wrong-client' : 'synthetic-client').setExpirationTime(field === 'exp' ? Math.floor(Date.now() / 1000) - 60 : '5m');
    await expect(exchange(await builder.sign(keys.privateKey))).rejects.toBeInstanceOf(ProviderRejectedError);
  }
});
it('never accepts an MFA claim signed by an untrusted key', async () => {
  const other = await generateKeyPair('RS256');
  await expect(exchange(await signed({ amr: ['mfa'] }, other.privateKey))).rejects.toBeInstanceOf(ProviderRejectedError);
});
it('requests MFA (acr_values) only on the staff hosted login, which preselects no connection', () => {
  const p = provider('unused');
  const staff = new URL(p.staffAuthorizationUrl({ state: 's', nonce: 'n', codeChallenge: 'c', redirectUri: 'https://app.example/v1/auth/oauth/callback' }));
  expect(staff.origin + staff.pathname).toBe('https://tenant.example/authorize');
  expect(staff.searchParams.get('acr_values')).toBe(MFA_ACR);
  expect(staff.searchParams.has('connection')).toBe(false);
  expect(staff.searchParams.has('prompt')).toBe(false);
  expect(Object.fromEntries(staff.searchParams)).toMatchObject({ response_type: 'code', client_id: 'synthetic-client', redirect_uri: 'https://app.example/v1/auth/oauth/callback', scope: 'openid email', state: 's', nonce: 'n', code_challenge: 'c', code_challenge_method: 'S256' });
  for (const kind of ['GOOGLE', 'APPLE'] as const) {
    const member = new URL(p.authorizationUrl({ provider: kind, state: 's', nonce: 'n', codeChallenge: 'c', redirectUri: 'https://app.example/auth/callback', forceLogin: false }));
    expect(member.searchParams.has('acr_values')).toBe(false);
    expect(member.searchParams.get('connection')).toBe(kind === 'GOOGLE' ? 'google-oauth2' : 'apple');
  }
});
it('derives the hosted-login method from the verified subject and keeps verified MFA', async () => {
  expect(providerFromSubject('email|abc')).toBe('EMAIL');
  expect(providerFromSubject('google-oauth2|123')).toBe('GOOGLE');
  expect(providerFromSubject('apple|001')).toBe('APPLE');
  for (const bad of ['auth0|x', 'samlp|x', 'email', 'toString|x', '__proto__|x', '']) expect(providerFromSubject(bad), bad).toBeNull();
  const staff = (token: string) => provider(token).exchangeAuthorizationCode({ provider: null, code: 'c', codeVerifier: 'v', redirectUri: 'r', nonce: 'expected-nonce' });
  expect(await staff(await signed({ sub: 'email|abc', email: 'Staff@Example.invalid', email_verified: true, amr: ['mfa'] }))).toMatchObject({ provider: 'EMAIL', email: 'staff@example.invalid', amr: ['otp', 'mfa'] });
  expect((await staff(await signed({ sub: 'google-oauth2|1' }))).amr).toEqual(['google']);
  await expect(staff(await signed({ sub: 'auth0|database-user', amr: ['mfa'] }))).rejects.toBeInstanceOf(ProviderRejectedError);
});
