import type { ApiClient } from '@fancy/client';
import type { WebBrowserAuthSessionResult } from 'expo-web-browser';
import type { AppChallengePair } from './pkce.ts';
import { StaleSessionError, type SessionInfo, type SessionManager } from './session.ts';
import { authErrorMessage } from './messages.ts';

export type Provider = 'GOOGLE' | 'APPLE';

export type SignInResult =
  | { kind: 'signedIn'; session: SessionInfo }
  | { kind: 'linkRequired'; linkTicket: string; expiresAt: string | null }
  | { kind: 'cancelled' }
  | { kind: 'failed'; message: string };

export interface OAuthDeps {
  api: ApiClient;
  session: SessionManager;
  /** expo-web-browser openAuthSessionAsync (ASWebAuthenticationSession, system browser). */
  openAuthSession: (url: string, redirectUrl: string) => Promise<WebBrowserAuthSessionResult>;
  redirectUrl: string;
  createChallenge: () => Promise<AppChallengePair>;
  newId: () => string;
}

/**
 * Parses the app deep link the core OAuth callback redirects to.
 * CONTRACT GAP: oauthCallback documents a JSON AuthOutcome; for iOS the server must instead redirect
 * to an allow-listed app URL. Assumed query keys: `handoffCode`, or `outcome=LINK_REQUIRED&linkTicket&expiresAt`, or `error`.
 */
export function parseAuthRedirect(url: string, expectedPrefix: string):
  | { kind: 'handoff'; code: string }
  | { kind: 'linkRequired'; linkTicket: string; expiresAt: string | null }
  | { kind: 'error'; error: string } {
  // Compare the complete redirect base, not a prefix (callback.evil / callback/extra).
  // Avoid relying on React Native's partial URL implementation for custom schemes.
  const base = url.split(/[?#]/, 1)[0];
  if (base !== expectedPrefix || url.includes('#')) return { kind: 'error', error: 'unexpected_redirect' };
  const query = url.includes('?') ? url.slice(url.indexOf('?') + 1).split('#')[0] ?? '' : '';
  const params = new URLSearchParams(query);
  for (const key of ['error', 'handoffCode', 'outcome', 'linkTicket', 'expiresAt']) {
    if (params.getAll(key).length > 1) return { kind: 'error', error: 'unexpected_redirect' };
  }
  const error = params.get('error');
  if (error) return { kind: 'error', error };
  const code = params.get('handoffCode');
  if (code && code.length >= 32 && code.length <= 128) return { kind: 'handoff', code };
  const ticket = params.get('linkTicket');
  if (params.get('outcome') === 'LINK_REQUIRED' && ticket) return { kind: 'linkRequired', linkTicket: ticket, expiresAt: params.get('expiresAt') };
  return { kind: 'error', error: 'missing_code' };
}

/** Google/Apple via the system browser; the app verifier never leaves memory and is used once. */
export async function signInWithProvider(provider: Provider, deps: OAuthDeps): Promise<SignInResult> {
  try {
    const pair = await deps.createChallenge();
    const start = await deps.api.call('startOAuth', { body: { clientRequestId: deps.newId(), provider, client: 'IOS', appChallenge: pair.challenge } });
    const result = await deps.openAuthSession(start.data.authorizationUrl, deps.redirectUrl);
    if (result.type !== 'success') return { kind: 'cancelled' };
    const parsed = parseAuthRedirect(result.url, deps.redirectUrl);
    if (parsed.kind === 'error') {
      return parsed.error === 'access_denied' ? { kind: 'cancelled' } : { kind: 'failed', message: 'Sign-in didn’t finish. Please try again.' };
    }
    if (parsed.kind === 'linkRequired') return parsed;
    const session = await deps.session.completeHandoff(parsed.code, pair.verifier);
    return { kind: 'signedIn', session };
  } catch (error) {
    if (error instanceof StaleSessionError) return { kind: 'cancelled' };
    return { kind: 'failed', message: authErrorMessage(error) };
  }
}
