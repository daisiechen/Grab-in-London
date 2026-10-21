import {afterEach,expect,it,vi} from 'vitest';
import {clearLinkTicket,continueLink,expectLinkProof,linkForProof,pendingLink,rememberLinkTicket} from './completeSignIn.ts';
import {clearAll} from '../../lib/storage.ts';
const proof='66666666-6666-4666-8666-666666666666';
afterEach(()=>{vi.restoreAllMocks();clearAll();vi.useRealTimers();});
it('persists only a short-lived tab ticket and expected transaction id, never the completed proof',()=>{
 rememberLinkTicket('t'.repeat(43),new Date(Date.now()+600000).toISOString(),'/profile');
 expect(linkForProof(proof)).toBeNull();continueLink();expectLinkProof(proof);
 expect(linkForProof(proof)?.ticket).toBe('t'.repeat(43));
 expect(Object.keys(JSON.parse(sessionStorage.getItem('fancy.auth.linkTicket')!)).sort()).toEqual(['expectedProofId','expiresAt','phase','returnTo','ticket']);
 expect(linkForProof('77777777-7777-4777-8777-777777777777')).toBeNull();
 clearLinkTicket();expect(linkForProof(proof)).toBeNull();
});
it('fails safely when same-tab storage is blocked instead of pretending an OAuth continuation can survive',()=>{
 vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('blocked');});
 expect(()=>rememberLinkTicket('t'.repeat(43),new Date(Date.now()+600000).toISOString())).toThrow(/could not be kept/);
 expect(pendingLink()).toBeNull();
});
it('rejects expired, malformed, unbounded or expanded stored data and session clearing ends the flow',()=>{
 vi.useFakeTimers();const now=Date.now();
 for(const value of [{ticket:'short'},{ticket:'t'.repeat(43),expiresAt:new Date(now+600001).toISOString(),returnTo:'/discover',phase:'offered',expectedProofId:null},{ticket:'t'.repeat(43),expiresAt:new Date(now+1000).toISOString(),returnTo:'/discover',phase:'offered',expectedProofId:null,authProof:proof}]){
  sessionStorage.setItem('fancy.auth.linkTicket',JSON.stringify(value));expect(pendingLink()).toBeNull();
 }
 rememberLinkTicket('t'.repeat(43),new Date(now+1000).toISOString());vi.advanceTimersByTime(1000);expect(pendingLink()).toBeNull();
 rememberLinkTicket('t'.repeat(43),new Date(Date.now()+1000).toISOString());clearAll();expect(pendingLink()).toBeNull();
});
