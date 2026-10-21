import { ApiError, type ApiClient } from '@fancy/client';
import type { SessionInfo, SessionManager } from './session.ts';
import { authErrorMessage } from './messages.ts';

type Proof = { value: string; userId: string; generation: number; receivedAt: number };
type PendingLink = { linkTicket: string; appVerifier: string; expiresAt: number; intentKey: string; proof: Proof | null };
/** Ticket, PKCE verifier and proof never enter navigation, Keychain or persistent storage. */
let pendingLink: PendingLink | null = null;
export function clearPendingLink() { pendingLink = null; }
export function setPendingLink(value: {linkTicket:string;appVerifier:string;expiresAt:string|null}, now=Date.now(), intentKey='') {
 const expiresAt=Math.min(Date.parse(value.expiresAt??''),now+600_000);
 pendingLink=Number.isFinite(expiresAt)&&expiresAt>now?{...value,expiresAt,intentKey,proof:null}:null;
}
export function getPendingLink(now=Date.now()) {
 if(pendingLink&&now>=pendingLink.expiresAt)clearPendingLink();
 return pendingLink;
}
export function acceptLinkProof(session:SessionInfo, authProof:string, generation:number, now=Date.now(),intentKey?:string) {
 const pending=getPendingLink(now);if(!pending||!authProof)return false;
 if(pending.proof&&pending.proof.userId!==session.user.id){clearPendingLink();return false;}
 pendingLink={...pending,proof:{value:authProof,userId:session.user.id,generation,receivedAt:Math.min(now,Date.parse(session.authTime))},intentKey:intentKey??pending.intentKey};
 return true;
}
export async function submitPendingLink(deps:{api:ApiClient;session:SessionManager;now:()=>number}):Promise<{ok:true}|{ok:false;message:string;stale?:boolean}> {
 const pending=getPendingLink(deps.now());
 if(!pending)return {ok:false,message:'This link has expired. Start sign-in again.'};
 const proof=pending.proof;const state=deps.session.getState();
 if(!proof||!Number.isFinite(proof.receivedAt)||deps.now()-proof.receivedAt>=300_000)return {ok:false,message:'Sign in with your original account again to confirm this link.'};
 if(state.status!=='signedIn'||state.session.user.id!==proof.userId||deps.session.generation!==proof.generation){clearPendingLink();return {ok:false,message:'Your account changed. Start sign-in again.'};}
 try {
  await deps.api.call('linkIdentity',{body:{linkTicket:pending.linkTicket,appVerifier:pending.appVerifier,originalChallengeProof:proof.value},idempotencyKey:pending.intentKey});
  deps.session.assertGeneration(proof.generation);
  const current=deps.session.getState();
  if(pendingLink!==pending||current.status!=='signedIn'||current.session.user.id!==proof.userId)return {ok:false,message:'This link is no longer active.',stale:true};
  clearPendingLink();return {ok:true};
 } catch(error) {
  if(pendingLink!==pending||deps.session.generation!==proof.generation)return {ok:false,message:'This link is no longer active.',stale:true};
  if(error instanceof ApiError){
   if(error.code==='REAUTH_REQUIRED')return {ok:false,message:'Sign in with your original account again to confirm this link.'};
   if(error.kind!=='network'&&error.kind!=='unavailable'&&error.kind!=='rate_limit'){
    clearPendingLink();
    return {ok:false,message:error.code==='ACCOUNT_LINK_CONFLICT'?'These accounts cannot be linked. No account data has been moved.':'This account or link could not be verified. Start sign-in again with your original account.'};
   }
  }
  return {ok:false,message:authErrorMessage(error)};
 }
}
