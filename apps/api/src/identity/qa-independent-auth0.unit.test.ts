import { expect, it } from 'vitest';
import { generateKeyPair, SignJWT } from 'jose';
import { Auth0IdentityProvider } from './auth0-provider.ts';

it.each(['GOOGLE', 'APPLE', 'EMAIL'] as const)('QA-F08 %s preserves signed MFA evidence without granting it to unsigned claims', async (kind) => {
  const trusted = await generateKeyPair('RS256');
  const stranger = await generateKeyPair('RS256');
  const issue = (amr: unknown, key = trusted.privateKey) => new SignJWT({ sub: 'qa-member', nonce: 'qa-nonce', amr })
    .setProtectedHeader({ alg: 'RS256' }).setIssuer('https://qa.example.invalid/').setAudience('qa-client').setExpirationTime('5m').sign(key);
  const verify = async (token: string) => {
    const adapter = new Auth0IdentityProvider({ domain: 'qa.example.invalid', clientId: 'qa-client', clientSecret: 'synthetic',
      jwks: async () => trusted.publicKey, fetch: async () => new Response(JSON.stringify({ id_token: token }), { status: 200 }) });
    return kind === 'EMAIL' ? adapter.verifyEmailOtp({ email: 'qa@example.invalid', code: '123456' }) : adapter.exchangeAuthorizationCode({ provider: kind, code: 'qa-code', codeVerifier: 'qa-verifier', redirectUri: 'https://app.example.invalid/callback', nonce: 'qa-nonce' });
  };
  expect((await verify(await issue(['pwd', 'mfa', 'mfa'])))?.amr).toContain('mfa');
  expect((await verify(await issue(['otp'])))?.amr).not.toContain('mfa');
  expect((await verify(await issue('mfa')))?.amr).not.toContain('mfa');
  await expect(verify(await issue(['mfa'], stranger.privateKey))).rejects.toThrow('id_token failed validation');
});
