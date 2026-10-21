import * as linking from './link.ts';
import {createTestApp,signIn} from '../../test/render.tsx';
import {NOW,sessionInfo} from '../../test/fixtures.ts';
import {networkDown,ok,fail} from '../../test/mock-fetch.ts';
const ticket={linkTicket:'Q'.repeat(43),appVerifier:'V'.repeat(43),expiresAt:new Date(NOW+600000).toISOString()};
beforeEach(linking.clearPendingLink);
it.each([299999,300000,300001])('QA-F09 proof age %i uses strict less-than five minutes',async age=>{
 const app=createTestApp();await signIn(app);
 linking.setPendingLink(ticket,NOW,'qa-intent');
 linking.acceptLinkProof({...sessionInfo(),authTime:new Date(NOW-age).toISOString()},'qa-proof',app.services.session.generation,NOW-age);
 app.mock.on('POST','/v1/auth/links',ok({identities:[]}));
 const result=await linking.submitPendingLink(app.services);
 expect(result.ok).toBe(age<300000);
 expect(app.mock.callsTo('POST','/v1/auth/links')).toHaveLength(age<300000?1:0);
});
it('QA-F09 ticket expires at exactly ten minutes even with fresh proof',async()=>{
 const app=createTestApp();await signIn(app);linking.setPendingLink(ticket,NOW,'qa-intent');
 expect(linking.getPendingLink(NOW+599999)).not.toBeNull();
 expect(linking.getPendingLink(NOW+600000)).toBeNull();
 expect(await linking.submitPendingLink(app.services)).toMatchObject({ok:false});
 expect(app.mock.callsTo('POST','/v1/auth/links')).toHaveLength(0);
});
it('QA-F09 network retry keeps both proofs and the same intent, without automatic submission',async()=>{
 const app=createTestApp();await signIn(app);linking.setPendingLink(ticket,NOW,'qa-intent');
 linking.acceptLinkProof(sessionInfo(),'qa-original-proof',app.services.session.generation,NOW);
 expect(app.mock.callsTo('POST','/v1/auth/links')).toHaveLength(0);
 app.mock.on('POST','/v1/auth/links',networkDown,1);app.mock.on('POST','/v1/auth/links',ok({identities:[]}));
 expect((await linking.submitPendingLink(app.services)).ok).toBe(false);
 expect((await linking.submitPendingLink(app.services)).ok).toBe(true);
 const calls=app.mock.callsTo('POST','/v1/auth/links');expect(calls).toHaveLength(2);
 expect(calls[0]?.body).toEqual({linkTicket:ticket.linkTicket,appVerifier:ticket.appVerifier,originalChallengeProof:'qa-original-proof'});
 expect(calls[0]?.body).toEqual(calls[1]?.body);expect(calls[0]?.headers['idempotency-key']).toBe(calls[1]?.headers['idempotency-key']);
});
it.each(['success','conflict','network'])('QA-F09 late %s cannot clear replacement pending identity',async kind=>{
 const app=createTestApp();await signIn(app);linking.setPendingLink(ticket,NOW,'old-intent');linking.acceptLinkProof(sessionInfo(),'qa-proof',app.services.session.generation,NOW);
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
 app.mock.on('POST','/v1/auth/links',async()=>{await gate;return kind==='success'?ok({identities:[]}):kind==='conflict'?fail(409,'ACCOUNT_LINK_CONFLICT'):networkDown();});
 const result=linking.submitPendingLink(app.services);await Promise.resolve();
 linking.setPendingLink({...ticket,linkTicket:'N'.repeat(43)},NOW,'new-intent');release();
 expect(await result).toMatchObject({ok:false,stale:true});expect(linking.getPendingLink(NOW)?.linkTicket).toBe('N'.repeat(43));
});
