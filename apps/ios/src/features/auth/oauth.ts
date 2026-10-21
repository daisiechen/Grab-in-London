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

/** Raw provider state is distinct from the server's stateTransactionId. Kept in RAM per attempt. */
const hasControlOrSpace=(value:string)=>Array.from(value).some(c=>c.charCodeAt(0)<=32||c.charCodeAt(0)===127);
export function providerState(authorizationUrl:string):string{
  const url=new URL(authorizationUrl);
  const values=url.searchParams.getAll('state');
  if(url.protocol!=='https:'||url.username||url.password||url.hash||values.length!==1||!values[0]||values[0].length>512||hasControlOrSpace(values[0]))throw new Error('Invalid provider authorization URL');
  return values[0];
}

/** App callback carries untrusted provider code/state, never a handoff or link ticket. */
export function parseAuthRedirect(url: string, expectedPrefix: string, expectedState:string):
  | { kind: 'provider'; code: string;state:string }
  | { kind: 'error'; error: string } {
  const base = url.split(/[?#]/, 1)[0];
  if (base !== expectedPrefix || url.includes('#')) return { kind: 'error', error: 'unexpected_redirect' };
  const query = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
  const params = new URLSearchParams(query);
  for(const key of params.keys())if(params.getAll(key).length!==1)return {kind:'error',error:'unexpected_redirect'};
  if(['handoffCode','linkTicket','outcome','expiresAt'].some(key=>params.has(key)))return {kind:'error',error:'unexpected_redirect'};
  const state=params.get('state');
  if(!expectedState||state!==expectedState||state.length>512)return {kind:'error',error:'unexpected_state'};
  const error=params.get('error');const code=params.get('code');
  if(error){if(code||error.length>200)return {kind:'error',error:'unexpected_redirect'};return {kind:'error',error};}
  if(!code||code.length>4000||hasControlOrSpace(code))return {kind:'error',error:'missing_code'};
  return {kind:'provider',code,state};
}

/** Google/Apple via the system browser; the app verifier never leaves memory and is used once. */
export async function signInWithProvider(provider: Provider, deps: OAuthDeps): Promise<SignInResult> {
  const generation=deps.session.generation;
  try {
    const pair = await deps.createChallenge();
    deps.session.assertGeneration(generation);
    const start = await deps.api.call('startOAuth', { body: { clientRequestId: deps.newId(), provider, client: 'IOS', appChallenge: pair.challenge } });
    deps.session.assertGeneration(generation);
    const expectedState=providerState(start.data.authorizationUrl);
    const result = await deps.openAuthSession(start.data.authorizationUrl, deps.redirectUrl);
    deps.session.assertGeneration(generation);
    if (result.type !== 'success') return { kind: 'cancelled' };
    const parsed = parseAuthRedirect(result.url, deps.redirectUrl,expectedState);
    if (parsed.kind === 'error') {
      return parsed.error === 'access_denied' ? { kind: 'cancelled' } : { kind: 'failed', message: 'Sign-in didn’t finish. Please try again.' };
    }
    const callback=await deps.api.call('oauthCallback',{query:{code:parsed.code,state:parsed.state}});
    deps.session.assertGeneration(generation);
    const outcome=callback.data;
    if(outcome.outcome==='LINK_REQUIRED')return {kind:'linkRequired',linkTicket:outcome.linkTicket,expiresAt:outcome.expiresAt};
    if(!outcome.handoffCode)return {kind:'failed',message:'Sign-in didn’t finish. Please try again.'};
    const session = await deps.session.completeHandoff(outcome.handoffCode, pair.verifier);
    return { kind: 'signedIn', session };
  } catch (error) {
    if (error instanceof StaleSessionError) return { kind: 'cancelled' };
    return { kind: 'failed', message: authErrorMessage(error) };
  }
}
