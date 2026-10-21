/**
 * Auth0 adapter (T-04). Email OTP via passwordless start + passwordless OTP grant; Google/Apple
 * via Universal Login authorization code + PKCE. ID tokens are validated with the tenant JWKS
 * (issuer, audience, nonce, expiry). Real-tenant behaviour is unverified until G-AUTH (T03).
 */
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { ProviderRejectedError, ProviderUnavailableError, type IdentityProvider, type ProviderKind, type VerifiedIdentity } from './provider.ts';

export interface Auth0Options {
  domain: string;
  clientId: string;
  clientSecret: string;
  fetch?: typeof fetch;
  jwks?: JWTVerifyGetKey;
  timeoutMs?: number;
}

const CONNECTIONS: Record<'GOOGLE' | 'APPLE', string> = { GOOGLE: 'google-oauth2', APPLE: 'apple' };

export class Auth0IdentityProvider implements IdentityProvider {
  readonly kind = 'auth0' as const;
  private readonly issuer: string;
  private readonly jwks: JWTVerifyGetKey;
  private readonly doFetch: typeof fetch;
  private readonly o: Auth0Options;

  constructor(o: Auth0Options) {
    this.o = o;
    if (!/^[a-z0-9.-]+$/i.test(o.domain)) throw new Error('invalid Auth0 domain');
    this.issuer = `https://${o.domain}/`;
    this.jwks = o.jwks ?? createRemoteJWKSet(new URL(`${this.issuer}.well-known/jwks.json`));
    this.doFetch = o.fetch ?? fetch;
  }

  private async post(path: string, body: Record<string, string>): Promise<{ status: number; json: Record<string, unknown> }> {
    let response: Response;
    try {
      response = await this.doFetch(`${this.issuer}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.o.timeoutMs ?? 10_000),
      });
    } catch {
      throw new ProviderUnavailableError('identity provider unreachable');
    }
    if (response.status >= 500 || response.status === 429) throw new ProviderUnavailableError(`identity provider status ${response.status}`);
    const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    return { status: response.status, json };
  }

  private async verifyIdToken(idToken: unknown, nonce: string | null, provider: ProviderKind): Promise<VerifiedIdentity> {
    if (typeof idToken !== 'string') throw new ProviderRejectedError('missing id_token');
    const { payload } = await jwtVerify(idToken, this.jwks, { issuer: this.issuer, audience: this.o.clientId, clockTolerance: 30 }).catch(() => {
      throw new ProviderRejectedError('id_token failed validation');
    });
    if (nonce !== null && payload.nonce !== nonce) throw new ProviderRejectedError('nonce mismatch');
    if (typeof payload.sub !== 'string') throw new ProviderRejectedError('missing sub');
    const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : null;
    // Auth0 documents amr:[...,"mfa"] as session MFA evidence. Only the verified token's
    // well-formed claim counts: https://auth0.com/blog/preventing-destructive-actions-with-step-up-authentication/
    const mfa = Array.isArray(payload.amr) && payload.amr.every((method) => typeof method === 'string') && payload.amr.includes('mfa');
    return {
      issuer: this.issuer,
      subject: payload.sub,
      provider,
      email,
      emailVerified: payload.email_verified === true,
      amr: [provider === 'EMAIL' ? 'otp' : provider === 'APPLE' ? 'apple' : 'google', ...(mfa ? ['mfa' as const] : [])],
    };
  }

  async startEmailOtp(email: string) {
    const { status } = await this.post('passwordless/start', { client_id: this.o.clientId, client_secret: this.o.clientSecret, connection: 'email', email, send: 'code' });
    if (status !== 200) throw new ProviderRejectedError(`passwordless start rejected (${status})`);
    return {};
  }

  async verifyEmailOtp({ email, code }: { email: string; code: string }) {
    const { status, json } = await this.post('oauth/token', {
      grant_type: 'http://auth0.com/oauth/grant-type/passwordless/otp',
      client_id: this.o.clientId, client_secret: this.o.clientSecret, username: email, otp: code, realm: 'email', scope: 'openid email',
    });
    if (status === 403 || status === 400) return null;
    if (status !== 200) throw new ProviderRejectedError(`otp grant rejected (${status})`);
    return this.verifyIdToken(json.id_token, null, 'EMAIL');
  }

  authorizationUrl(i: { provider: 'GOOGLE' | 'APPLE'; state: string; nonce: string; codeChallenge: string; redirectUri: string; forceLogin: boolean }) {
    const url = new URL(`${this.issuer}authorize`);
    url.search = new URLSearchParams({
      response_type: 'code', client_id: this.o.clientId, redirect_uri: i.redirectUri, scope: 'openid email',
      connection: CONNECTIONS[i.provider], state: i.state, nonce: i.nonce, code_challenge: i.codeChallenge, code_challenge_method: 'S256',
      ...(i.forceLogin ? { prompt: 'login', max_age: '0' } : {}),
    }).toString();
    return url.toString();
  }

  async exchangeAuthorizationCode(i: { provider: 'GOOGLE' | 'APPLE'; code: string; codeVerifier: string; redirectUri: string; nonce: string }) {
    const { status, json } = await this.post('oauth/token', {
      grant_type: 'authorization_code', client_id: this.o.clientId, client_secret: this.o.clientSecret,
      code: i.code, code_verifier: i.codeVerifier, redirect_uri: i.redirectUri,
    });
    if (status !== 200) throw new ProviderRejectedError(`code exchange rejected (${status})`);
    return this.verifyIdToken(json.id_token, i.nonce, i.provider);
  }
}
