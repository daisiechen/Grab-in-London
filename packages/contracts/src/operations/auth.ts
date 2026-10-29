import { Enum, Instant, Obj, T, Uuid } from '../schema.ts';
import { ClientRequestId } from '../common.ts';
import { AUTH_PROVIDERS, CLIENT_KINDS } from '../dictionaries.ts';
import { LinkedIdentity, SessionInfo } from '../dto.ts';
import { op } from '../operation.ts';
import { RETURN_TARGET_PATTERN } from '../return-target.ts';

const Client = Enum(CLIENT_KINDS);
/**
 * Same-origin path only: must start with a single `/` (no `//host` or `/\\host` network paths).
 * The server additionally enforces the route allowlist (isAllowedReturnTarget).
 */
export const ReturnTarget = T.String({ pattern: RETURN_TARGET_PATTERN, maxLength: 300 });
const AppChallenge = T.String({ pattern: '^[A-Za-z0-9_-]{43,128}$' });
/** Per-start CLI registration only; runtime also verifies the parsed port and client kind. */
export const LoopbackRedirectUri = T.String({ maxLength: 100, pattern: '^http://127\\.0\\.0\\.1:[1-9][0-9]{3,4}/auth/callback$' });
const AccessToken = T.String({ minLength: 32, maxLength: 512 });
/** Raw campaign value from a landing URL; the server lower-cases it, keeps [a-z0-9_-] and truncates to 40. */
const UtmValue = T.String({ minLength: 1, maxLength: 100 });
/**
 * Optional, campaign-level acquisition hint for a new account (ops analytics review P0-3). Read only when
 * this sign-in creates the account, stored once as users.signup_source and never shown to members.
 * Web: utm_source/utm_medium/utm_campaign of the landing URL (kept in memory or the return URL, never in
 * cookies or local storage), or entry `meal_link` when the visit started on a shared meal link.
 * iOS: entry `ios_app`. No device identifiers, IP or free text. utm values take precedence over entry.
 */
export const SignupSource = Obj({
  utmSource: T.Optional(UtmValue),
  utmMedium: T.Optional(UtmValue),
  utmCampaign: T.Optional(UtmValue),
  entry: T.Optional(Enum(['meal_link', 'ios_app'] as const)),
});
/** iOS: 15-minute access token (memory) + rotating 30-day refresh token (Keychain). */
export const IosCredentials = Obj({
  client: T.Literal('IOS'),
  accessToken: AccessToken,
  accessExpiresAt: Instant,
  refreshToken: AccessToken,
  refreshExpiresAt: Instant,
});
/** Support CLI: 15-minute access-only session; never a refresh token (API §7). */
export const CliCredentials = Obj({
  client: T.Literal('SUPPORT_CLI'),
  accessToken: AccessToken,
  accessExpiresAt: Instant,
});
/** AUTHENTICATED (Web: cookie set; iOS: handoffCode) or LINK_REQUIRED (no session issued), API §7. */
const AuthOutcome = T.Union([
  Obj({
    outcome: T.Literal('AUTHENTICATED'),
    session: T.Optional(SessionInfo),
    handoffCode: T.Optional(T.String({ minLength: 32, maxLength: 128 })),
    /** Allow-listed path bound server-side to the started transaction (Web). */
    returnTarget: T.Optional(ReturnTarget),
    /** Id of the completed authentication; proves a fresh login of this identity to /auth/links. */
    authProof: Uuid,
  }),
  Obj({ outcome: T.Literal('LINK_REQUIRED'), linkTicket: T.String({ minLength: 32, maxLength: 128 }), expiresAt: Instant }),
]);

export const authOperations = [
  op({
    operationId: 'startEmail', method: 'POST', path: '/auth/email/start', summary: 'Send an email OTP challenge',
    auth: 'public', write: 'clientRequestId', ifMatch: false,
    body: Obj({ clientRequestId: ClientRequestId, email: T.String({ format: 'email', maxLength: 320 }), client: Client, returnTarget: T.Optional(ReturnTarget), signupSource: T.Optional(SignupSource) }),
    success: { status: 201, data: Obj({ challengeId: Uuid, expiresAt: Instant, resendAfter: Instant }) },
    errors: ['PROVIDER_UNAVAILABLE'],
  }),
  op({
    operationId: 'verifyEmail', method: 'POST', path: '/auth/email/verify', summary: 'Verify an email OTP',
    auth: 'public', write: 'clientRequestId', ifMatch: false,
    body: Obj({ clientRequestId: ClientRequestId, challengeId: Uuid, code: T.String({ pattern: '^[0-9]{6}$' }), appChallenge: T.Optional(AppChallenge), signupSource: T.Optional(SignupSource) }),
    success: { status: 200, data: AuthOutcome },
    errors: ['NOT_FOUND', 'STATE_CONFLICT', 'PROVIDER_UNAVAILABLE', 'ACCOUNT_SUSPENDED'],
  }),
  op({
    operationId: 'startOAuth', method: 'POST', path: '/auth/oauth/start', summary: 'Begin Google/Apple sign-in',
    auth: 'public', write: 'clientRequestId', ifMatch: false,
    body: Obj({ clientRequestId: ClientRequestId, provider: Enum(AUTH_PROVIDERS), client: Client, returnTarget: T.Optional(ReturnTarget), appChallenge: T.Optional(AppChallenge), loopbackRedirectUri: T.Optional(LoopbackRedirectUri), signupSource: T.Optional(SignupSource) }),
    success: { status: 201, data: Obj({ authorizationUrl: T.String({ format: 'uri', maxLength: 4000 }), stateTransactionId: Uuid }) },
    errors: ['FORBIDDEN', 'PROVIDER_UNAVAILABLE'],
  }),
  /**
   * Admin console (WEB only): Universal Login with the tenant's enabled connections and acr_values
   * requesting multi-factor. The provider returns to /v1/auth/oauth/callback, which sets the session
   * cookie and redirects (303) to /admin/. Never creates or links accounts.
   */
  op({
    operationId: 'startStaffSignIn', method: 'POST', path: '/auth/staff/start', summary: 'Begin admin console sign-in (Universal Login, MFA requested)',
    auth: 'public', write: 'clientRequestId', ifMatch: false,
    body: Obj({ clientRequestId: ClientRequestId }),
    success: { status: 201, data: Obj({ authorizationUrl: T.String({ format: 'uri', maxLength: 4000 }), stateTransactionId: Uuid }) },
    errors: ['FORBIDDEN', 'PROVIDER_UNAVAILABLE'],
  }),
  op({
    operationId: 'oauthCallback', method: 'GET', path: '/auth/oauth/callback', summary: 'Provider redirect target',
    auth: 'public', write: 'read', ifMatch: false,
    query: Obj({ code: T.Optional(T.String({ maxLength: 4000 })), state: T.String({ minLength: 1, maxLength: 512 }), error: T.Optional(T.String({ maxLength: 200 })) }),
    success: { status: 200, data: AuthOutcome },
    errors: ['FORBIDDEN', 'STATE_CONFLICT', 'PROVIDER_UNAVAILABLE', 'ACCOUNT_SUSPENDED'],
  }),
  op({
    operationId: 'exchangeHandoff', method: 'POST', path: '/auth/handoff', summary: 'iOS/CLI: redeem a one-time handoff code',
    auth: 'public', write: 'clientRequestId', ifMatch: false,
    body: Obj({ clientRequestId: ClientRequestId, code: T.String({ minLength: 32, maxLength: 128 }), appVerifier: T.String({ pattern: '^[A-Za-z0-9._~-]{43,128}$' }) }),
    success: { status: 200, data: T.Union([IosCredentials, CliCredentials]) },
    errors: ['STATE_CONFLICT'],
  }),
  op({
    operationId: 'refreshSession', method: 'POST', path: '/auth/refresh', summary: 'Rotate an iOS refresh token',
    auth: 'public', write: 'clientRequestId', ifMatch: false,
    body: Obj({ clientRequestId: ClientRequestId, refreshToken: AccessToken }),
    success: { status: 200, data: IosCredentials },
    errors: ['AUTH_REQUIRED', 'ACCOUNT_SUSPENDED'],
  }),
  op({
    operationId: 'getSession', method: 'GET', path: '/auth/session', summary: 'Current session, CSRF token and profile gate',
    auth: 'session', write: 'read', ifMatch: false,
    success: { status: 200, data: SessionInfo }, errors: [],
  }),
  op({
    operationId: 'logout', method: 'POST', path: '/auth/logout', summary: 'Revoke this device session family',
    auth: 'session', write: 'clientRequestId', ifMatch: false,
    body: Obj({ clientRequestId: ClientRequestId }),
    success: { status: 204 }, errors: [],
  }),
  op({
    operationId: 'startReauth', method: 'POST', path: '/auth/reauth', summary: 'Re-authenticate with an existing identity',
    auth: 'session', write: 'clientRequestId', ifMatch: false,
    body: Obj({ clientRequestId: ClientRequestId, method: Enum(['EMAIL', ...AUTH_PROVIDERS] as const), returnTarget: T.Optional(ReturnTarget), appChallenge: T.Optional(AppChallenge) }),
    success: { status: 201, data: Obj({ challengeId: T.Optional(Uuid), authorizationUrl: T.Optional(T.String({ format: 'uri', maxLength: 4000 })), expiresAt: Instant }) },
    errors: ['PROVIDER_UNAVAILABLE'],
  }),
  op({
    operationId: 'linkIdentity', method: 'POST', path: '/auth/links', summary: 'Link a second proven identity (dual proof)',
    auth: 'session', write: 'idempotencyKey', ifMatch: false,
    body: Obj({
      linkTicket: T.String({ minLength: 32, maxLength: 128 }),
      /** authProof of the original identity's fresh sign-in (≤5 minutes) in this same session. */
      originalChallengeProof: Uuid,
      /** iOS only: PKCE-style verifier of the app challenge the ticket was bound to. */
      appVerifier: T.Optional(T.String({ pattern: '^[A-Za-z0-9._~-]{43,128}$' })),
    }),
    success: { status: 200, data: Obj({ identities: T.Array(LinkedIdentity, { maxItems: 10 }) }) },
    errors: ['REAUTH_REQUIRED', 'LINK_TICKET_INVALID', 'ACCOUNT_LINK_CONFLICT'],
  }),
] as const;
