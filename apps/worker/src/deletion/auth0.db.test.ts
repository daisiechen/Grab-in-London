import {randomBytes,randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,inject,it,vi} from 'vitest';
import {migrate} from '@fancy/db';
import {createMigratedDatabase,type MigratedDatabase} from '@fancy/testkit/db';
import {Auth0DeletionStep} from './auth0.ts';
import {StepwiseDeletionProvider,UnavailableDeletionStep} from './provider.ts';
let db:MigratedDatabase;
beforeAll(async()=>{db=await createMigratedDatabase(inject('pgServerUrl'),migrate);});afterAll(async()=>db.drop());
const config={domain:'tenant.example',clientId:'independent-management',clientSecret:'synthetic-secret'};
async function fixture(){
 const user=(await db.pool.query(`INSERT INTO users(status) VALUES('DELETING') RETURNING id`)).rows[0].id as string;
 const subject='google-oauth2|'+randomUUID();
 await db.pool.query(`INSERT INTO identities(user_id,issuer,subject,provider) VALUES($1,'https://tenant.example/',$2,'GOOGLE')`,[user,subject]);
 const receipt=(await db.pool.query(`INSERT INTO deletion_requests(user_id,receipt_token_hash,status,requested_at,policy_version,provider_steps) VALUES($1,$2,'PROCESSING',clock_timestamp(),'synthetic-policy','{"local":"COMPLETED"}') RETURNING id`,[user,randomBytes(32).toString('hex')])).rows[0].id as string;
 return {user,subject,receipt};
}
const token=()=>Response.json({access_token:'opaque-token',token_type:'Bearer',expires_in:120,scope:'delete:grants delete:users'});
it('retains identity mappings through a lost user-delete response, then checkpoints Auth0 without assuming Apple is revoked',async()=>{
 const f=await fixture();let lost=true;const deleted=new Set<string>();const calls:string[]=[];
 const fetch=vi.fn<typeof globalThis.fetch>(async(url)=>{
  const path=String(url);calls.push(path);if(path.endsWith('/oauth/token'))return token();
  if(path.includes('/users/')){deleted.add(path);if(lost){lost=false;throw new TypeError('PRIVATE_PROVIDER_TIMEOUT_SENTINEL');}return new Response(null,{status:404});}
  return new Response(null,{status:204});
 });
 const run=()=>new StepwiseDeletionProvider(db.pool,{auth0:new Auth0DeletionStep(db.pool,config,{fetch}),apple:new UnavailableDeletionStep()}).revoke(f.user,f.receipt);
 expect(await run()).toBe('NEEDS_SUPPORT');
 let row=(await db.pool.query('SELECT provider_steps FROM deletion_requests WHERE id=$1',[f.receipt])).rows[0];expect(row.provider_steps.auth0).toBe('NEEDS_SUPPORT');expect(JSON.stringify(row)).not.toContain('PRIVATE_PROVIDER');
 expect((await db.pool.query('SELECT subject FROM identities WHERE user_id=$1',[f.user])).rows).toEqual([{subject:f.subject}]);
 expect(await run()).toBe('NEEDS_SUPPORT');
 row=(await db.pool.query('SELECT provider_steps FROM deletion_requests WHERE id=$1',[f.receipt])).rows[0];expect(row.provider_steps).toMatchObject({auth0:'COMPLETED',apple:'NEEDS_SUPPORT'});
 expect(deleted.size).toBe(1);expect(calls.filter(path=>path.includes('/users/'))).toEqual(Array(2).fill('https://tenant.example/api/v2/users/'+encodeURIComponent(f.subject)));
 expect((await db.pool.query('SELECT subject FROM identities WHERE user_id=$1',[f.user])).rows).toEqual([{subject:f.subject}]);
 const count=calls.length;expect(await run()).toBe('NEEDS_SUPPORT');expect(calls).toHaveLength(count);
});
it('rejects wrong receipt ownership, active accounts, absent mappings and foreign issuers before any management call',async()=>{
 const fetch=vi.fn<typeof globalThis.fetch>(async()=>token()),step=new Auth0DeletionStep(db.pool,config,{fetch});
 const f=await fixture();const input={userId:f.user,deletionId:f.receipt,idempotencyKey:'stable'};
 expect(await step.revoke({...input,userId:randomUUID()})).toBe('NEEDS_SUPPORT');
 await db.pool.query(`UPDATE users SET status='ACTIVE' WHERE id=$1`,[f.user]);expect(await step.revoke(input)).toBe('NEEDS_SUPPORT');
 await db.pool.query(`UPDATE users SET status='DELETING' WHERE id=$1`,[f.user]);await db.pool.query(`UPDATE identities SET issuer='https://foreign.example/' WHERE user_id=$1`,[f.user]);expect(await step.revoke(input)).toBe('NEEDS_SUPPORT');
 await db.pool.query('DELETE FROM identities WHERE user_id=$1',[f.user]);expect(await step.revoke(input)).toBe('NEEDS_SUPPORT');expect(fetch).not.toHaveBeenCalled();
});
