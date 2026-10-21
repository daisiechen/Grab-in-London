import { acceptLinkProof, clearPendingLink, getPendingLink, setPendingLink, submitPendingLink } from './link.ts';
import { createTestApp, signIn } from '../../test/render.tsx';
import { NOW, sessionInfo } from '../../test/fixtures.ts';
import { networkDown, ok, fail } from '../../test/mock-fetch.ts';
const ticket={linkTicket:'t'.repeat(40),appVerifier:'v'.repeat(43),expiresAt:new Date(NOW+600_000).toISOString()};
beforeEach(clearPendingLink);
it('keeps bounded RAM ticket and refuses absent or expired proof',async()=>{
 setPendingLink(ticket,NOW,'intent');
 expect(getPendingLink(NOW+600_000)).toBeNull();
 setPendingLink({...ticket,expiresAt:'invalid'},NOW,'intent');
 expect(getPendingLink(NOW)).toBeNull();
 const app=createTestApp();setPendingLink(ticket,NOW,'intent');
 expect(await submitPendingLink(app.services)).toMatchObject({ok:false});
 expect(app.mock.calls).toHaveLength(0);
});
it('submits both real proofs only explicitly and preserves exactly the same intent on network retry',async()=>{
 const app=createTestApp(); await signIn(app);
 setPendingLink(ticket,NOW,'intent');
 expect(acceptLinkProof(sessionInfo(),'proof',app.services.session.generation,NOW)).toBe(true);
 expect(app.mock.callsTo('POST','/v1/auth/links')).toHaveLength(0);
 app.mock.on('POST','/v1/auth/links',networkDown,1);
 app.mock.on('POST','/v1/auth/links',ok({identities:[]}));
 expect(await submitPendingLink(app.services)).toMatchObject({ok:false});
 expect(getPendingLink(NOW)).not.toBeNull();
 expect(await submitPendingLink(app.services)).toMatchObject({ok:true});
 const calls=app.mock.callsTo('POST','/v1/auth/links');expect(calls).toHaveLength(2);
 expect(calls[0]?.body).toEqual(calls[1]?.body);
 expect(calls[0]?.body).toEqual({linkTicket:ticket.linkTicket,appVerifier:ticket.appVerifier,originalChallengeProof:'proof'});
 expect(calls[0]?.headers['idempotency-key']).toBe(calls[1]?.headers['idempotency-key']);
 expect(getPendingLink(NOW)).toBeNull();
 const stored=JSON.stringify(app.store.writes);for(const secret of [ticket.linkTicket,ticket.appVerifier,'proof'])expect(stored).not.toContain(secret);
});
it('wrong account proof refusal and session end clear the pending secret',async()=>{
 const app=createTestApp();await signIn(app);setPendingLink(ticket,NOW,'intent');
 acceptLinkProof(sessionInfo(),'proof',app.services.session.generation,NOW);
 app.mock.on('POST','/v1/auth/links',fail(403,'FORBIDDEN'));
 expect(await submitPendingLink(app.services)).toMatchObject({ok:false});expect(getPendingLink(NOW)).toBeNull();
 setPendingLink(ticket,NOW,'intent');await app.services.session.logout();expect(getPendingLink(NOW)).toBeNull();
});
it('five minute proof needs a real new login; generation mismatch cannot submit',async()=>{
 const app=createTestApp();await signIn(app);setPendingLink(ticket,NOW,'intent');
 acceptLinkProof(sessionInfo(),'proof',app.services.session.generation,NOW-300_001);
 expect(await submitPendingLink(app.services)).toMatchObject({ok:false});expect(app.mock.callsTo('POST','/v1/auth/links')).toHaveLength(0);
 acceptLinkProof(sessionInfo(),'proof',app.services.session.generation+1,NOW);
 expect(await submitPendingLink(app.services)).toMatchObject({ok:false});expect(getPendingLink(NOW)).toBeNull();
});
it.each(['conflict','network','success'])('late %s cannot clear a replacement ticket or report success',async(kind)=>{
 const app=createTestApp();await signIn(app);setPendingLink(ticket,NOW,'old');acceptLinkProof(sessionInfo(),'proof',app.services.session.generation,NOW);
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
 app.mock.on('POST','/v1/auth/links',async()=>{await gate;if(kind==='network')return networkDown();return kind==='conflict'?fail(409,'STATE_CONFLICT'):ok({identities:[]});});
 const result=submitPendingLink(app.services);
 await Promise.resolve();clearPendingLink();setPendingLink({...ticket,linkTicket:'n'.repeat(40)},NOW,'new');release();
 expect(await result).toMatchObject({ok:false,stale:true});expect(getPendingLink(NOW)?.linkTicket).toBe('n'.repeat(40));
});
