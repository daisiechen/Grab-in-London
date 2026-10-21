import {randomBytes} from 'node:crypto';
import {afterAll,beforeAll,describe,expect,inject,it} from 'vitest';
import {migrate} from '@fancy/db';
import {createMigratedDatabase,type MigratedDatabase} from '@fancy/testkit/db';
import {createRunner} from '../runner/runner.ts';
import {deletionHandler,UnavailableDeletionProvider} from './deletion.ts';
let db:MigratedDatabase;
beforeAll(async()=>{db=await createMigratedDatabase(inject('pgServerUrl'),migrate);});afterAll(async()=>{await db.drop();});
async function fixture(){
 const user=(await db.pool.query(`INSERT INTO users(status) VALUES('DELETING') RETURNING id`)).rows[0].id as string;
 await db.pool.query(`INSERT INTO profiles(user_id,display_name,bio) VALUES($1,'Private identity','Private biography should be physically erased')`,[user]);
 await db.pool.query(`INSERT INTO private_contact(user_id,email,email_verified_at) VALUES($1,'private@example.invalid',clock_timestamp())`,[user]);
 await db.pool.query(`INSERT INTO identities(user_id,issuer,subject,provider) VALUES($1::uuid,'test','subject-'||$1::text,'EMAIL')`,[user]);
 const receipt=(await db.pool.query(`INSERT INTO deletion_requests(user_id,receipt_token_hash,status,requested_at,policy_version) VALUES($1,$2,'PENDING',clock_timestamp(),'unconfigured') RETURNING id`,[user,randomBytes(32).toString('hex')])).rows[0].id as string;
 await db.pool.query(`INSERT INTO jobs(kind,resource_id,due_at,run_after) VALUES('account.purge',$1,clock_timestamp(),clock_timestamp())`,[receipt]);
 return {user,receipt};
}
describe('resumable account purge',()=>{
 it('physically erases local private data while honestly stopping at missing provider/policy gates',async()=>{
  const {user,receipt}=await fixture();
  const handler=deletionHandler(db.pool,new UnavailableDeletionProvider());
  expect(await createRunner({pool:db.pool,owner:'purge-test',handlers:{'account.purge':handler}}).tick()).toMatchObject({done:1});
  expect((await db.pool.query(`SELECT 1 FROM profiles WHERE user_id=$1`,[user])).rows).toHaveLength(0);
  expect((await db.pool.query(`SELECT 1 FROM private_contact WHERE user_id=$1`,[user])).rows).toHaveLength(0);
  const row=(await db.pool.query(`SELECT status,completed_at,provider_steps FROM deletion_requests WHERE id=$1`,[receipt])).rows[0];
  expect(row).toMatchObject({status:'NEEDS_SUPPORT',completed_at:null,provider_steps:{local:'COMPLETED',identity:'NEEDS_SUPPORT',retention:'NEEDS_APPROVAL'}});
  expect((await db.pool.query(`SELECT status FROM users WHERE id=$1`,[user])).rows[0].status).toBe('DELETING');
  // Remote identities remain available to a later authorized provider revocation.
  expect((await db.pool.query(`SELECT 1 FROM identities WHERE user_id=$1`,[user])).rows).toHaveLength(1);
 });
 it('resumes safely and marks completed only after both provider revocation and retention approval',async()=>{
  const {user,receipt}=await fixture();let calls=0;
  const runner=createRunner({pool:db.pool,owner:'purge-complete',handlers:{'account.purge':deletionHandler(db.pool,{revoke:async(id,key)=>{expect(id).toBe(user);expect(key).toBe(receipt);calls++;return 'COMPLETED';}},true)}});
  expect(await runner.tick()).toMatchObject({done:1});expect(await runner.tick()).toMatchObject({claimed:0});expect(calls).toBe(1);
  expect((await db.pool.query(`SELECT status,completed_at FROM deletion_requests WHERE id=$1`,[receipt])).rows[0]).toMatchObject({status:'COMPLETED',completed_at:expect.any(Date)});
  expect((await db.pool.query(`SELECT status FROM users WHERE id=$1`,[user])).rows[0].status).toBe('DELETED');
  expect((await db.pool.query(`SELECT 1 FROM identities WHERE user_id=$1`,[user])).rows).toHaveLength(0);
 });
});
