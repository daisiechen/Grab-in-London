import {secureDeletionReceiptStore,type DeletionReceiptStore} from './features/settings/deletion-receipt-store.ts';
import {secureAIConversationStore,type AIConversationStore} from './features/assistant/session-store.ts';
import {secureGuestCredentialStore,type GuestCredentialStore} from './features/assistant/guest-store.ts';
import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import { createApiClient, newIntentKey, type ApiClient, type ResponseOf } from '@fancy/client';
import { QueryCache } from './api/cache.ts';
import type { CredentialStore, InstallMarker } from './features/auth/credential-store.ts';
import { SessionManager, sessionClient, type SessionState } from './features/auth/session.ts';
import { clearReturnTo } from './features/auth/intent.ts';
import { clearPendingLink } from './features/auth/link.ts';
import { createAppChallenge, type AppChallengePair } from './features/auth/pkce.ts';
import type { WebBrowserAuthSessionResult } from 'expo-web-browser';
import * as ExpoCrypto from 'expo-crypto';
import {AssistantManager} from './features/assistant/manager.ts';
import { AnalyticsManager } from './analytics/manager.ts';

export interface Services {
  deletionReceipts: DeletionReceiptStore;
  /** Receipt-only lookup never refreshes or depends on a revoked user session. */
  deletionStatus: (receiptToken:string)=>Promise<ResponseOf<'deletionStatus'>>;
  analytics:AnalyticsManager;
  assistant:AssistantManager;
  session: SessionManager;
  /** Authenticated client (refresh + single replay on 401). Use for every feature call. */
  api: ApiClient;
  cache: QueryCache;
  /** In-memory drafts (create meal, application messages); never persisted, cleared on session end. */
  drafts: QueryCache;
  /** Clearers registered by features (drafts, pollers); run on every session end. */
  onSessionEnd: Set<() => void>;
  openAuthSession: (url: string, redirectUrl: string) => Promise<WebBrowserAuthSessionResult>;
  createChallenge: () => Promise<AppChallengePair>;
  newId: () => string;
  now: () => number;
  randomBytes: (n: number) => Uint8Array;
}

export interface ServiceConfig {
  deletionReceiptStore?: DeletionReceiptStore;
  baseUrl: string;
  fetch?: typeof fetch;
  guestStore?:GuestCredentialStore;
  aiConversationStore?:AIConversationStore;
  hashGuestCredential?:(token:string)=>Promise<string>;
  store: CredentialStore;
  installMarker: InstallMarker | null;
  openAuthSession: Services['openAuthSession'];
  createChallenge?: Services['createChallenge'];
  newId?: () => string;
  now?: () => number;
  onClearError?: (error: unknown) => void;
  randomBytes?: (n: number) => Uint8Array;
}

export function createServices(config: ServiceConfig): Services {
  const cache = new QueryCache();
  const drafts = new QueryCache();
  const onSessionEnd = new Set<() => void>();
  const newId = config.newId ?? newIntentKey;
  const now = config.now ?? Date.now;
  const aiHolder:{manager?:AssistantManager}={};
  const analyticsHolder:{manager?:AnalyticsManager}={};
  const base = (accessToken: () => string | null,loginGuest=false) =>
    createApiClient({ baseUrl: config.baseUrl, credentials: { kind: 'bearer', accessToken },headers:op=>({...analyticsHolder.manager?.headersFor(op),...(loginGuest&&(op==='verifyEmail'||op==='exchangeHandoff')&&!accessToken()&&aiHolder.manager?.credential?{authorization:`Bearer ${aiHolder.manager.credential}`}:{})}), ...(config.fetch ? { fetch: config.fetch } : {}) });
  const deletionReceipts=config.deletionReceiptStore??secureDeletionReceiptStore();
  const guestStore=config.guestStore??secureGuestCredentialStore();
  const aiConversationStore=config.aiConversationStore??secureAIConversationStore();
  let installation:Promise<void>|null=null;
  const ensureInstallation=()=>{
    if(installation)return installation;
    const job=(async()=>{if(config.installMarker&&!(await config.installMarker.isPresent())){await config.store.clear();await deletionReceipts.clear();await guestStore.clear();await aiConversationStore.clear();await config.installMarker.set();}})();
    installation=job;void job.catch(()=>{if(installation===job)installation=null;});return job;
  };
  const installedGuestStore:GuestCredentialStore={read:async()=>{await ensureInstallation();return guestStore.read();},write:async value=>{await ensureInstallation();await guestStore.write(value);},clear:()=>guestStore.clear()};
  const installedAIStore:AIConversationStore={read:async()=>{await ensureInstallation();return aiConversationStore.read();},write:async value=>{await ensureInstallation();await aiConversationStore.write(value);},clear:()=>aiConversationStore.clear()};
  const installedDeletionReceipts:DeletionReceiptStore={read:async()=>{await ensureInstallation();return deletionReceipts.read();},write:async value=>{await ensureInstallation();await deletionReceipts.write(value);},clear:async expected=>{await ensureInstallation();await deletionReceipts.clear(expected);}};
  const holder: { session?: SessionManager } = {};
  const transport = base(() => holder.session?.accessToken() ?? null,true);
  const raw:ApiClient={async call(op,request){if((op==='verifyEmail'||op==='exchangeHandoff')&&!holder.session?.accessToken()){await aiHolder.manager?.restoreIdentity();await aiHolder.manager?.prepareLogin();}return transport.call(op,request);}};
  const session = new SessionManager({
    api: raw,
    withToken: (token) => base(() => token),
    store: config.store,
    installMarker:config.installMarker?{isPresent:async()=>{await ensureInstallation();return true;},set:async()=>{await ensureInstallation();}}:null,
    newId,
    now,
    onClear: [() => cache.clear(), () => drafts.clear(), clearReturnTo, clearPendingLink, () => { for (const clear of onSessionEnd) clear(); }],
    ...(config.onClearError ? { onClearError: config.onClearError } : {}),
  });
  holder.session = session;
  const analytics=new AnalyticsManager({baseUrl:config.baseUrl,fetch:config.fetch??fetch,newId,now,identity:()=>{
    const current=session.getState();const signedIn=current.status==='signedIn';
    return {key:`${session.generation}:${current.status}:${signedIn?current.session.user.id:'guest'}`,ready:signedIn||current.status==='signedOut',authenticated:signedIn,accessToken:session.accessToken()};
  }});
  analyticsHolder.manager=analytics;session.subscribe(()=>analytics.syncIdentity());onSessionEnd.add(()=>analytics.clear());
  const aiRaw=createApiClient({baseUrl:config.baseUrl,credentials:{kind:'bearer',accessToken:()=>session.accessToken()??aiHolder.manager?.credential??null},
    headers:()=>aiHolder.manager?.deviceToken?{'ai-device-token':aiHolder.manager.deviceToken}:{},...(config.fetch?{fetch:config.fetch}:{})});
  const assistant=new AssistantManager({guestStore:installedGuestStore,conversationStore:installedAIStore,hashGuestCredential:config.hashGuestCredential??(token=>ExpoCrypto.digestStringAsync(ExpoCrypto.CryptoDigestAlgorithm.SHA256,token)),revokeGuest:async(old,credential)=>{
    const retired=createApiClient({baseUrl:config.baseUrl,credentials:{kind:'bearer',accessToken:()=>credential},headers:()=>({'ai-device-token':old.deviceToken}),...(config.fetch?{fetch:config.fetch}:{})});
    await retired.call('resetAI',{params:{sessionId:old.sessionId},body:{generation:old.generation,reason:'ACCOUNT_CHANGE'},idempotencyKey:newId()});
  },auth:session,api:sessionClient(aiRaw,session),newId,now,randomBytes:config.randomBytes??((n)=>ExpoCrypto.getRandomBytes(n))});
  aiHolder.manager=assistant;
  onSessionEnd.add(()=>assistant.clear());
  return {
    deletionReceipts:installedDeletionReceipts,
    deletionStatus:receiptToken=>base(()=>null).call('deletionStatus',{body:{receiptToken}}),
    analytics,
    assistant,
    session,
    api: sessionClient(raw, session),
    cache,
    drafts,
    onSessionEnd,
    openAuthSession: config.openAuthSession,
    createChallenge: config.createChallenge ?? (() => createAppChallenge()),
    newId,
    now,
    randomBytes: config.randomBytes ?? ((n) => ExpoCrypto.getRandomBytes(n)),
  };
}

const ServicesContext = createContext<Services | null>(null);

export function ServicesProvider({ services, children }: { services: Services; children: ReactNode }) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): Services {
  const value = useContext(ServicesContext);
  if (!value) throw new Error('ServicesProvider missing');
  return value;
}

export function useSessionState(): SessionState {
  const { session } = useServices();
  return useSyncExternalStore((cb) => session.subscribe(cb), () => session.getState());
}
