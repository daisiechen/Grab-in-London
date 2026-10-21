/** QA-F07: model the provider's actual code/state deep link, not a fabricated handoff URL. */
import {createApiClient} from '@fancy/client';
import {SessionManager} from './session.ts';
import {signInWithProvider} from './oauth.ts';
import {createMockFetch,ok} from '../../test/mock-fetch.ts';
import {HANDOFF,NOW,credentials,memoryStore,seqId,sessionInfo} from '../../test/fixtures.ts';
const STATE='S'.repeat(43),ID='1d6f0a3e-2b7c-4f8e-9a1d-3c5e7f9b2d40',REDIRECT='fancy://auth/callback';
function setup(outcome:unknown={outcome:'AUTHENTICATED',handoffCode:HANDOFF,authProof:ID}){const mock=createMockFetch(),holder:{m?:SessionManager}={};const api=createApiClient({baseUrl:'http://api.test',credentials:{kind:'bearer',accessToken:()=>holder.m?.accessToken()??null},fetch:mock.fetch});const manager=new SessionManager({api,withToken:()=>api,store:memoryStore(),installMarker:null,newId:seqId,now:()=>NOW,onClear:[]});holder.m=manager;mock.on('POST','/v1/auth/oauth/start',ok({authorizationUrl:`https://auth.example.test/authorize?state=${STATE}`,stateTransactionId:ID},201));mock.on('GET','/v1/auth/oauth/callback',ok(outcome));mock.on('POST','/v1/auth/handoff',ok(credentials()));mock.on('GET','/v1/auth/session',ok(sessionInfo()));return{mock,api,manager,deps:{api,session:manager,createChallenge:async()=>({verifier:'V'.repeat(43),challenge:'C'.repeat(43)}),newId:seqId,redirectUrl:REDIRECT}};}
it.each(['GOOGLE','APPLE'] as const)('QA-F07 %s real provider code/state callback exchanges core JSON outcome before handoff and signs in',async provider=>{
 const h=setup();const result=await signInWithProvider(provider,{...h.deps,openAuthSession:async()=>({type:'success',url:`${REDIRECT}?code=provider-code-for-qa&state=${STATE}`})});expect(result.kind).toBe('signedIn');expect(h.mock.callsTo('GET','/v1/auth/oauth/callback')).toHaveLength(1);expect(h.mock.callsTo('POST','/v1/auth/handoff')[0]?.body).toMatchObject({code:HANDOFF,appVerifier:'V'.repeat(43)});
});
it('QA-F07 mismatched provider state never exchanges core or handoff',async()=>{
 const h=setup();const r=await signInWithProvider('GOOGLE',{...h.deps,openAuthSession:async()=>({type:'success',url:`${REDIRECT}?code=provider-code-for-qa&state=wrong-state`})});expect(r.kind).toBe('failed');expect(h.mock.callsTo('GET','/v1/auth/oauth/callback')).toHaveLength(0);expect(h.mock.callsTo('POST','/v1/auth/handoff')).toHaveLength(0);
});
it('QA-F07 LINK_REQUIRED comes from core JSON without a link ticket in callback URL or handoff',async()=>{
 const ticket='Q'.repeat(43),h=setup({outcome:'LINK_REQUIRED',linkTicket:ticket,expiresAt:'2026-10-21T12:00:00Z'});const callback=`${REDIRECT}?code=provider-code-for-qa&state=${STATE}`;const r=await signInWithProvider('GOOGLE',{...h.deps,openAuthSession:async()=>({type:'success',url:callback})});expect(r).toMatchObject({kind:'linkRequired',linkTicket:ticket});expect(callback).not.toContain(ticket);expect(h.mock.callsTo('POST','/v1/auth/handoff')).toHaveLength(0);
});
