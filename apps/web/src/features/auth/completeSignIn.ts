import type { SessionState } from '../../api/session.tsx';
import { safeReturnTo } from '../../lib/returnTo.ts';
import { readJson, remove, writeJson } from '../../lib/storage.ts';
import { isProfileReady, profileGatePath } from './gate.ts';
import { markFreshSignIn } from '../../lib/freshSignIn.ts';

const RETURN_KEY = 'auth.returnTo';
const LINK_KEY = 'auth.linkTicket';

export const rememberReturnTo = (target: string) => writeJson(RETURN_KEY, safeReturnTo(target));
export const takeReturnTo = (): string => {
  const value = readJson<string>(RETURN_KEY);
  remove(RETURN_KEY);
  return safeReturnTo(value);
};
export interface PendingLink {ticket:string;expiresAt:string;returnTo:string;phase:'offered'|'original';expectedProofId:string|null}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const clearLinkTicket=()=>remove(LINK_KEY);
export function pendingLink():PendingLink|null{
  const p=readJson<PendingLink>(LINK_KEY);
  if(!p||Object.keys(p).some(k=>!['ticket','expiresAt','returnTo','phase','expectedProofId'].includes(k))||typeof p.ticket!=='string'||!/^[A-Za-z0-9_-]{32,128}$/.test(p.ticket)||typeof p.expiresAt!=='string'||!Number.isFinite(Date.parse(p.expiresAt))||Date.parse(p.expiresAt)<=Date.now()||Date.parse(p.expiresAt)>Date.now()+600_000||typeof p.returnTo!=='string'||safeReturnTo(p.returnTo)!==p.returnTo||!['offered','original'].includes(p.phase)||(p.expectedProofId!==null&&(typeof p.expectedProofId!=='string'||!uuid.test(p.expectedProofId)))){clearLinkTicket();return null;}
  return p;
}
export function rememberLinkTicket(ticket:string,expiresAt:string,returnTo='/discover'){
  writeJson(LINK_KEY,{ticket,expiresAt,returnTo:safeReturnTo(returnTo),phase:'offered',expectedProofId:null});
  if(!pendingLink())throw new Error('This linking request could not be kept in this tab. Please start again.');
}
export function continueLink(){const p=pendingLink();if(!p)throw new Error('This linking request expired. Please start again.');writeJson(LINK_KEY,{...p,phase:'original',expectedProofId:null});}
export function expectLinkProof(id:string){const p=pendingLink();if(p?.phase==='original'&&uuid.test(id))writeJson(LINK_KEY,{...p,expectedProofId:id});}
export function linkForProof(proof:string):PendingLink|null{
 const p=pendingLink();if(p?.phase!=='original'||!uuid.test(proof)||p.expectedProofId!==proof)return null;
 // The pre-authentication transaction id is only a callback correlation hint. Once verified,
 // remove it immediately; the resulting authProof lives only in the confirmation component.
 const consumed={...p,expectedProofId:null};writeJson(LINK_KEY,consumed);return consumed;
}

/** Where to go after a verified sign-in: the profile gate first if incomplete, else the original page. */
export function destinationAfterSignIn(state: SessionState, returnTo: string): string | null {
  if (state.status !== 'signed-in') return null;
  markFreshSignIn();
  return isProfileReady(state.session) ? safeReturnTo(returnTo) : profileGatePath(returnTo);
}
