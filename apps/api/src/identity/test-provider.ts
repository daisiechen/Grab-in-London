/**
 * Deterministic identity provider for automated tests only. It refuses to exist outside the
 * development/test environments, codes are random per challenge (no fixed OTP), and OAuth codes
 * are only minted through `consent`, which checks the real PKCE/nonce plumbing end to end.
 */
import { createHash } from 'node:crypto';
import type { Environment } from '@fancy/config';
import { ProviderRejectedError, ProviderUnavailableError, type IdentityProvider, type VerifiedIdentity } from './provider.ts';
import { pkceChallenge, randomOtp, randomToken } from './tokens.ts';

export const TEST_ISSUER = 'https://test-idp.invalid/';

export class TestIdentityProvider implements IdentityProvider {
  readonly kind = 'test' as const;
  /** Codes "delivered" per email, newest last — what a test inbox would show. */
  readonly inbox = new Map<string, string[]>();
  private readonly codes = new Map<string, { code: string; email: string }>();
  private readonly grants = new Map<string, { identity: VerifiedIdentity; challenge: string; nonce: string; redirectUri: string }>();
  unavailable = false;

  constructor(environment: Environment) {
    if (environment !== 'test' && environment !== 'development') throw new Error('TestIdentityProvider is test-only');
  }

  async startEmailOtp(email: string) {
    if (this.unavailable) throw new ProviderUnavailableError('test provider marked unavailable');
    const ref = randomToken(12);
    const code = randomOtp();
    this.codes.set(ref, { code, email });
    this.inbox.set(email, [...(this.inbox.get(email) ?? []), code]);
    return { ref };
  }

  async verifyEmailOtp({ email, code, providerState }: { email: string; code: string; providerState: Record<string, string> }) {
    const entry = providerState.ref ? this.codes.get(providerState.ref) : undefined;
    if (!entry || entry.email !== email || entry.code !== code) return null;
    this.codes.delete(providerState.ref!);
    return { issuer: TEST_ISSUER, subject: 'email|' + createHash('sha256').update(email).digest('hex').slice(0, 24), provider: 'EMAIL', email, emailVerified: true, amr: ['otp'] } satisfies VerifiedIdentity;
  }

  authorizationUrl(i: { provider: 'GOOGLE' | 'APPLE'; state: string; nonce: string; codeChallenge: string; redirectUri: string; forceLogin: boolean }) {
    const url = new URL('https://test-idp.invalid/authorize');
    url.search = new URLSearchParams({ connection: i.provider.toLowerCase(), state: i.state, nonce: i.nonce, code_challenge: i.codeChallenge, code_challenge_method: 'S256', redirect_uri: i.redirectUri, ...(i.forceLogin ? { prompt: 'login' } : {}) }).toString();
    return url.toString();
  }

  /** Simulates the user approving at the provider; returns the code the callback would receive. */
  consent(authorizationUrl: string, who: { subject: string; email?: string | null; emailVerified?: boolean }): { code: string; state: string } {
    const url = new URL(authorizationUrl);
    const provider = url.searchParams.get('connection') === 'apple' ? 'APPLE' : 'GOOGLE';
    const code = randomToken(16);
    this.grants.set(code, {
      identity: { issuer: TEST_ISSUER, subject: `${provider.toLowerCase()}|${who.subject}`, provider, email: who.email ?? null, emailVerified: who.emailVerified ?? !!who.email, amr: [provider === 'APPLE' ? 'apple' : 'google'] },
      challenge: url.searchParams.get('code_challenge')!,
      nonce: url.searchParams.get('nonce')!,
      redirectUri: url.searchParams.get('redirect_uri')!,
    });
    return { code, state: url.searchParams.get('state')! };
  }

  async exchangeAuthorizationCode(i: { provider: 'GOOGLE' | 'APPLE'; code: string; codeVerifier: string; redirectUri: string; nonce: string }) {
    const grant = this.grants.get(i.code);
    this.grants.delete(i.code);
    if (!grant || grant.identity.provider !== i.provider) throw new ProviderRejectedError('unknown code');
    if (pkceChallenge(i.codeVerifier) !== grant.challenge) throw new ProviderRejectedError('PKCE mismatch');
    if (grant.nonce !== i.nonce || grant.redirectUri !== i.redirectUri) throw new ProviderRejectedError('nonce/redirect mismatch');
    return grant.identity;
  }
}
