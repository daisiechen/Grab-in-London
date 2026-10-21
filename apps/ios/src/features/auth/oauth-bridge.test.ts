import {deferred,flush} from '../../test/deferred.ts';
import type {MockReply} from '../../test/mock-fetch.ts';
import {createTestApp,signIn} from '../../test/render.tsx';
import {ok,fail} from '../../test/mock-fetch.ts';
import {credentials,sessionInfo,HANDOFF,me} from '../../test/fixtures.ts';
import {signInWithProvider} from './oauth.ts';
const state='synthetic-provider-state';
const authorizationUrl=`https://auth.example.test/authorize?state=${state}`;
const redirect='fancy://auth/callback';
function fixture(callback=`${redirect}?code=synthetic-provider-code&state=${state}`,startUrl=authorizationUrl){
 const app=createTestApp();app.mock.on('POST','/v1/auth/oauth/start',ok({authorizationUrl:startUrl,stateTransactionId:'00000000-0000-4000-8000-000000000001'},201));
 app.openAuthSession.mockResolvedValueOnce({type:'success',url:callback});
 return app;
}
it.each(['GOOGLE','APPLE'] as const)('bridges %s provider code through core callback before handoff redemption',async provider=>{
 const app=fixture();app.mock.on('GET','/v1/auth/oauth/callback',ok({outcome:'AUTHENTICATED',handoffCode:HANDOFF}));app.mock.on('POST','/v1/auth/handoff',ok(credentials()));app.mock.on('GET','/v1/auth/session',ok(sessionInfo()));
 const result=await signInWithProvider(provider,{...app.services,redirectUrl:redirect});expect(result.kind).toBe('signedIn');
 expect(app.mock.calls.map(c=>c.path)).toEqual(['/v1/auth/oauth/start','/v1/auth/oauth/callback','/v1/auth/handoff','/v1/auth/session']);
 const callback=app.mock.callsTo('GET','/v1/auth/oauth/callback')[0]!;expect(callback.query.get('state')).toBe(state);expect(callback.query.get('code')).toBe('synthetic-provider-code');
 expect(app.mock.callsTo('POST','/v1/auth/handoff')[0]?.body).toMatchObject({code:HANDOFF});
});
it.each([
 `${redirect}?code=p&state=wrong`,`${redirect}?code=p&code=q&state=${state}`,`${redirect}?code=p&state=${state}&state=${state}`,
 `${redirect}.evil?code=p&state=${state}`,`${redirect}?code=p&state=${state}#x`,
 `${redirect}?handoffCode=${HANDOFF}`,`${redirect}?code=p&state=${state}&linkTicket=forged`,
 `${redirect}?outcome=LINK_REQUIRED&linkTicket=forged&state=${state}`,
])('rejects unsafe callback before core/session requests: %s',async callback=>{
 const app=fixture(callback);const result=await signInWithProvider('GOOGLE',{...app.services,redirectUrl:redirect});expect(result.kind).toBe('failed');expect(app.mock.calls.map(c=>c.path)).toEqual(['/v1/auth/oauth/start']);
});
it('accepts LINK_REQUIRED only from core JSON and never mints a session',async()=>{
 const app=fixture();app.mock.on('GET','/v1/auth/oauth/callback',ok({outcome:'LINK_REQUIRED',linkTicket:'synthetic-link-ticket',expiresAt:'2026-10-21T10:10:00Z'}));
 expect(await signInWithProvider('GOOGLE',{...app.services,redirectUrl:redirect})).toEqual({kind:'linkRequired',linkTicket:'synthetic-link-ticket',expiresAt:'2026-10-21T10:10:00Z'});expect(app.mock.callsTo('POST','/v1/auth/handoff')).toHaveLength(0);
});
it('does not redeem a handoff if provider verification fails at core',async()=>{
 const app=fixture();app.mock.on('GET','/v1/auth/oauth/callback',fail(409,'STATE_CONFLICT'));
 expect((await signInWithProvider('GOOGLE',{...app.services,redirectUrl:redirect})).kind).toBe('failed');expect(app.mock.callsTo('POST','/v1/auth/handoff')).toHaveLength(0);
});

it.each(['https://auth.example.test/authorize','https://auth.example.test/authorize?state=a&state=b'])('fails before opening a provider URL without one real state: %s',async startUrl=>{
 const app=fixture(undefined,startUrl);expect((await signInWithProvider('GOOGLE',{...app.services,redirectUrl:redirect})).kind).toBe('failed');expect(app.openAuthSession).not.toHaveBeenCalled();
});
it('treats a state-bound provider denial as cancellation, never a handoff',async()=>{
 const app=fixture(`${redirect}?error=access_denied&state=${state}`);expect(await signInWithProvider('GOOGLE',{...app.services,redirectUrl:redirect})).toEqual({kind:'cancelled'});expect(app.mock.calls).toHaveLength(1);
});
it('ignores a late provider redirect after logout and account B login',async()=>{
 const app=fixture();const browser=deferred<Awaited<ReturnType<typeof app.services.openAuthSession>>>();app.openAuthSession.mockReset().mockImplementationOnce(()=>browser.promise);
 const pending=signInWithProvider('GOOGLE',{...app.services,redirectUrl:redirect});await flush();await app.services.session.expire();await signIn(app,me({id:'00000000-0000-4000-8000-000000000002'}));const before=app.mock.calls.length;
 browser.resolve({type:'success',url:`${redirect}?code=old-code&state=${state}`});expect(await pending).toEqual({kind:'cancelled'});expect(app.mock.calls).toHaveLength(before);expect(app.services.session.getState()).toMatchObject({status:'signedIn',session:{user:{id:'00000000-0000-4000-8000-000000000002'}}});
});
it('ignores late core verification after account switch without redeeming the old handoff',async()=>{
 const app=fixture();const callback=deferred<MockReply>();app.mock.on('GET','/v1/auth/oauth/callback',()=>callback.promise);const pending=signInWithProvider('GOOGLE',{...app.services,redirectUrl:redirect});await flush();
 await app.services.session.expire();await signIn(app,me({id:'00000000-0000-4000-8000-000000000002'}));const before=app.mock.calls.length;
 callback.resolve(ok({outcome:'AUTHENTICATED',handoffCode:HANDOFF}));expect(await pending).toEqual({kind:'cancelled'});expect(app.mock.calls).toHaveLength(before);
});
