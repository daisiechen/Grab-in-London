/**
 * Deterministic identity provider for automated tests only. It refuses to exist outside the
 * development/test environments, codes are random per challenge unless a local development run
 * opts into `DEV_FIXED_OTP` (config refuses it in staging/production), and OAuth codes are only
 * minted through `consent`, which checks the real PKCE/nonce plumbing end to end.
 */
import { createHash } from 'node:crypto';
import type { Environment } from '@fancy/config';
import { MFA_ACR, ProviderRejectedError, ProviderUnavailableError, type IdentityProvider, type ProviderKind, type StartedProvider, type VerifiedIdentity } from './provider.ts';
import { pkceChallenge, randomOtp, randomToken } from './tokens.ts';

export const TEST_ISSUER = 'https://test-idp.invalid/';
/** Subject the email-code sign-in uses, so a hosted-login email sign-in maps to the same identity. */
export const testEmailSubject = (email: string) => 'email|' + createHash('sha256').update(email).digest('hex').slice(0, 24);

export class TestIdentityProvider implements IdentityProvider {
  readonly kind = 'test' as const;
  /** Codes "delivered" per email, newest last — what a test inbox would show. */
  readonly inbox = new Map<string, string[]>();
  private readonly codes = new Map<string, { code: string; email: string }>();
  private readonly grants = new Map<string, { identity: VerifiedIdentity; challenge: string; nonce: string; redirectUri: string }>();
  unavailable = false;

  private readonly fixedOtp: string | null;

  constructor(environment: Environment, options: { fixedOtp?: string | null } = {}) {
    if (environment !== 'test' && environment !== 'development') throw new Error('TestIdentityProvider is test-only');
    this.fixedOtp = options.fixedOtp ?? null;
  }

  async startEmailOtp(email: string) {
    if (this.unavailable) throw new ProviderUnavailableError('test provider marked unavailable');
    const ref = randomToken(12);
    const code = this.fixedOtp ?? randomOtp();
    this.codes.set(ref, { code, email });
    this.inbox.set(email, [...(this.inbox.get(email) ?? []), code]);
    return { ref };
  }

  async verifyEmailOtp({ email, code, providerState }: { email: string; code: string; providerState: Record<string, string> }) {
    const entry = providerState.ref ? this.codes.get(providerState.ref) : undefined;
    if (!entry || entry.email !== email || entry.code !== code) return null;
    this.codes.delete(providerState.ref!);
    return { issuer: TEST_ISSUER, subject: testEmailSubject(email), provider: 'EMAIL', email, emailVerified: true, amr: ['otp'] } satisfies VerifiedIdentity;
  }

  authorizationUrl(i: { provider: 'GOOGLE' | 'APPLE'; state: string; nonce: string; codeChallenge: string; redirectUri: string; forceLogin: boolean }) {
    const url = new URL('https://test-idp.invalid/authorize');
    url.search = new URLSearchParams({ connection: i.provider.toLowerCase(), state: i.state, nonce: i.nonce, code_challenge: i.codeChallenge, code_challenge_method: 'S256', redirect_uri: i.redirectUri, ...(i.forceLogin ? { prompt: 'login' } : {}) }).toString();
    return url.toString();
  }

  staffAuthorizationUrl(i: { state: string; nonce: string; codeChallenge: string; redirectUri: string }) {
    const url = new URL('https://test-idp.invalid/authorize');
    url.search = new URLSearchParams({ state: i.state, nonce: i.nonce, code_challenge: i.codeChallenge, code_challenge_method: 'S256', redirect_uri: i.redirectUri, acr_values: MFA_ACR }).toString();
    return url.toString();
  }

  /**
   * Simulates the user approving at the provider; returns the code the callback would receive.
   * A hosted login without a preselected connection uses `who.provider` (default EMAIL). `mfa: true`
   * completes MFA, which only adds the `mfa` method when the request asked for it (acr_values).
   */
  consent(authorizationUrl: string, who: { subject?: string; email?: string | null; emailVerified?: boolean; provider?: ProviderKind; mfa?: boolean }): { code: string; state: string } {
    const url = new URL(authorizationUrl);
    const connection = url.searchParams.get('connection');
    const provider: ProviderKind = connection === 'apple' ? 'APPLE' : connection ? 'GOOGLE' : who.provider ?? 'EMAIL';
    const subject = provider === 'EMAIL' && who.email && !who.subject ? testEmailSubject(who.email) : `${provider.toLowerCase()}|${who.subject ?? randomToken(12)}`;
    const method = provider === 'APPLE' ? 'apple' : provider === 'GOOGLE' ? 'google' : 'otp';
    const mfa = who.mfa === true && url.searchParams.get('acr_values') === MFA_ACR;
    const code = randomToken(16);
    this.grants.set(code, {
      identity: { issuer: TEST_ISSUER, subject, provider, email: who.email ?? null, emailVerified: who.emailVerified ?? !!who.email, amr: [method, ...(mfa ? ['mfa' as const] : [])] },
      challenge: url.searchParams.get('code_challenge')!,
      nonce: url.searchParams.get('nonce')!,
      redirectUri: url.searchParams.get('redirect_uri')!,
    });
    return { code, state: url.searchParams.get('state')! };
  }

  async exchangeAuthorizationCode(i: { provider: StartedProvider; code: string; codeVerifier: string; redirectUri: string; nonce: string }) {
    const grant = this.grants.get(i.code);
    this.grants.delete(i.code);
    if (!grant || (i.provider !== null && grant.identity.provider !== i.provider)) throw new ProviderRejectedError('unknown code');
    if (pkceChallenge(i.codeVerifier) !== grant.challenge) throw new ProviderRejectedError('PKCE mismatch');
    if (grant.nonce !== i.nonce || grant.redirectUri !== i.redirectUri) throw new ProviderRejectedError('nonce/redirect mismatch');
    return grant.identity;
  }
}
