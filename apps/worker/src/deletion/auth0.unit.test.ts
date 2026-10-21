import {expect,it,vi} from 'vitest';
import type {Pool} from 'pg';
import {Auth0DeletionStep} from './auth0.ts';
const config={domain:'tenant.example',clientId:'independent-management',clientSecret:'private-placeholder'};
const input={userId:'11111111-1111-4111-8111-111111111111',deletionId:'22222222-2222-4222-8222-222222222222',idempotencyKey:'stable-key'};
function setup(handler:(url:string,init:RequestInit)=>Promise<Response>,rows:unknown[]=[{issuer:'https://tenant.example/',subject:'google-oauth2|exact-subject'}],now=()=>0){
 const pool={query:vi.fn(async()=>({rows}))} as unknown as Pick<Pool,'query'>;const fetch=vi.fn<typeof globalThis.fetch>(async(url,init)=>handler(String(url),init!));
 return {step:new Auth0DeletionStep(pool,config,{fetch,now}),fetch};
}
const token=()=>Response.json({access_token:'opaque-token',token_type:'Bearer',expires_in:120,scope:'delete:grants delete:users'});
it('uses exact encoded subjects, independent M2M audience and only the two deletion scopes',async()=>{
 const {step,fetch}=setup(async url=>url.endsWith('/oauth/token')?token():new Response(null,{status:204}));expect(await step.revoke(input)).toBe('COMPLETED');
 expect(fetch.mock.calls.map(([url])=>url)).toEqual(['https://tenant.example/oauth/token','https://tenant.example/api/v2/grants?user_id=google-oauth2%7Cexact-subject','https://tenant.example/api/v2/users/google-oauth2%7Cexact-subject']);
 expect(JSON.parse(fetch.mock.calls[0]![1]!.body as string)).toMatchObject({grant_type:'client_credentials',client_id:config.clientId,audience:'https://tenant.example/api/v2/',scope:'delete:grants delete:users'});
 expect(fetch.mock.calls.every(([,init])=>init?.redirect==='error')).toBe(true);
});
it('singleflights RAM token acquisition across overlapping attempts and renews before expiry',async()=>{
 let now=0;const {step,fetch}=setup(async url=>url.endsWith('/oauth/token')?token():new Response(null,{status:204}),undefined,()=>now);
 expect(await Promise.all([step.revoke(input),step.revoke(input)])).toEqual(['COMPLETED','COMPLETED']);expect(fetch.mock.calls.filter(([u])=>String(u).endsWith('/oauth/token'))).toHaveLength(1);
 now=121000;await step.revoke(input);expect(fetch.mock.calls.filter(([u])=>String(u).endsWith('/oauth/token'))).toHaveLength(2);
});
it.each([401,403,429,500])('does not complete HTTP %s and refreshes an invalidated 401 token only on the next attempt',async status=>{
 let bad=true;const {step,fetch}=setup(async url=>url.endsWith('/oauth/token')?token():new Response(null,{status:bad?status:204}));
 expect(await step.revoke(input)).toBe('NEEDS_SUPPORT');bad=false;expect(await step.revoke(input)).toBe('COMPLETED');
 expect(fetch.mock.calls.filter(([u])=>String(u).endsWith('/oauth/token'))).toHaveLength(status===401?2:1);
});
it('keeps timeout/redirect/invalid scope outcomes unresolved and never sends deletion after them',async()=>{
 for(const response of [()=>{throw new Error('PRIVATE provider URL/token');},()=>Response.json({access_token:'t',token_type:'Bearer',expires_in:120,scope:'delete:users'}),()=>Response.json({access_token:'t',token_type:'Bearer',expires_in:-1,scope:'delete:users delete:grants'})]){
  const {step,fetch}=setup(async()=>response());expect(await step.revoke(input)).toBe('NEEDS_SUPPORT');expect(fetch).toHaveBeenCalledTimes(1);
 }
});
it('deduplicates subjects and accepts already-absent exact users without treating foreign or missing mappings as success',async()=>{
 const mapping={issuer:'https://tenant.example/',subject:'auth0|same'};
 const {step,fetch}=setup(async url=>url.endsWith('/oauth/token')?token():new Response(null,{status:404}),[mapping,mapping]);expect(await step.revoke(input)).toBe('COMPLETED');expect(fetch).toHaveBeenCalledTimes(3);
 for(const rows of [[],[{issuer:'https://foreign.example/',subject:'auth0|same'}],[{issuer:null,subject:null}]]){const test=setup(async()=>token(),rows);expect(await test.step.revoke(input)).toBe('NEEDS_SUPPORT');expect(test.fetch).not.toHaveBeenCalled();}
});
it('deletes each distinct locally-owned subject once in deterministic order',async()=>{
 const rows=['google-oauth2|b','auth0|a','auth0|a'].map(subject=>({issuer:'https://tenant.example/',subject}));
 const {step,fetch}=setup(async url=>url.endsWith('/oauth/token')?token():new Response(null,{status:204}),rows);
 expect(await step.revoke(input)).toBe('COMPLETED');expect(fetch.mock.calls.slice(1).map(([u])=>String(u))).toEqual(['https://tenant.example/api/v2/grants?user_id=auth0%7Ca','https://tenant.example/api/v2/users/auth0%7Ca','https://tenant.example/api/v2/grants?user_id=google-oauth2%7Cb','https://tenant.example/api/v2/users/google-oauth2%7Cb']);
});
it('rejects non-host tenant configuration and unexpected broader token scopes',async()=>{
 for(const domain of ['https://tenant.example','tenant.example/path','user@tenant.example','tenant.example:443'])expect(()=>new Auth0DeletionStep({} as Pick<Pool,'query'>,{...config,domain})).toThrow('INVALID_AUTH0_MANAGEMENT_CONFIG');
 const {step,fetch}=setup(async()=>Response.json({access_token:'opaque',token_type:'Bearer',expires_in:120,scope:'delete:grants delete:users create:client_grants'}));
 expect(await step.revoke(input)).toBe('NEEDS_SUPPORT');expect(fetch).toHaveBeenCalledTimes(1);
});
