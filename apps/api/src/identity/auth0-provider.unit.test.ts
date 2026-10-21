import { beforeAll, expect, it } from 'vitest';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload } from 'jose';
import { Auth0IdentityProvider } from './auth0-provider.ts';
import { ProviderRejectedError } from './provider.ts';

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
