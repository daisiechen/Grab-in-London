/**
 * Identity provider port. The provider only proves who someone is; the core keeps its own users,
 * sessions and mapping (issuer, subject) → userId, and never merges accounts by email.
 */
export type ProviderKind = 'EMAIL' | 'GOOGLE' | 'APPLE';
/** The connection an OAuth transaction was started with; null = the user chose on the hosted login. */
export type StartedProvider = 'GOOGLE' | 'APPLE' | null;

/** OpenID PAPE policy Auth0 documents for requesting MFA on one /authorize request. */
export const MFA_ACR = 'http://schemas.openid.net/pape/policies/2007/06/multi-factor';

export interface VerifiedIdentity {
  issuer: string;
  subject: string;
  provider: ProviderKind;
  email: string | null;
  emailVerified: boolean;
  amr: Array<'otp' | 'google' | 'apple' | 'mfa'>;
}

export interface IdentityProvider {
  readonly kind: 'auth0' | 'test';
  /** Sends a 6-digit code; returns opaque provider state to keep on the transaction. */
  startEmailOtp(email: string): Promise<Record<string, string>>;
  /** Returns null for a wrong/expired code; throws ProviderUnavailableError on outage. */
  verifyEmailOtp(input: { email: string; code: string; providerState: Record<string, string> }): Promise<VerifiedIdentity | null>;
  authorizationUrl(input: { provider: 'GOOGLE' | 'APPLE'; state: string; nonce: string; codeChallenge: string; redirectUri: string; forceLogin: boolean }): string;
  /**
   * Admin console sign-in: the provider's hosted login with every connection enabled for the app
   * (no connection is preselected) and multi-factor authentication requested for this login.
   */
  staffAuthorizationUrl(input: { state: string; nonce: string; codeChallenge: string; redirectUri: string }): string;
  /**
   * Exchanges the provider's authorization code (PKCE) and validates the ID token (iss/aud/nonce).
   * `provider: null` (staff hosted login) derives the method from the verified subject.
   */
  exchangeAuthorizationCode(input: { provider: StartedProvider; code: string; codeVerifier: string; redirectUri: string; nonce: string }): Promise<VerifiedIdentity>;
}

export class ProviderUnavailableError extends Error {
  override name = 'ProviderUnavailableError';
}

export class ProviderRejectedError extends Error {
  override name = 'ProviderRejectedError';
}
