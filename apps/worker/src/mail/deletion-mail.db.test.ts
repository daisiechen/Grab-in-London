import {randomBytes,randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,inject,it} from 'vitest';
import {migrate,captureDeletionMail,enqueueDeletionMail,type DeletionMailEncryption} from '@fancy/db';
import {createMigratedDatabase,type MigratedDatabase} from '@fancy/testkit/db';
import {mailDelivery,UnavailableMailProvider,type MailProvider} from './delivery.ts';
import {deletionHandler} from '../handlers/deletion.ts';
import {createRunner} from '../runner/runner.ts';
import {admitResendDispatch,recordResendReceipt} from '../../../api/src/mail/receipts.ts';
let db:MigratedDatabase;
beforeAll(async()=>{db=await createMigratedDatabase(inject('pgServerUrl'),migrate);});afterAll(async()=>db.drop());
const encryption:DeletionMailEncryption={currentVersion:'v1',keys:{v1:Buffer.alloc(32,29).toString('base64')}};
async function fixture(){const user=(await db.pool.query(`INSERT INTO users(status) VALUES('DELETING') RETURNING id`)).rows[0].id as string,id=randomUUID(),email=`${randomUUID()}@example.invalid`;
 await db.pool.query(`INSERT INTO private_contact(user_id,email,email_verified_at) VALUES($1,$2,clock_timestamp())`,[user,email]);
 await db.pool.query(`INSERT INTO deletion_requests(id,user_id,receipt_token_hash,status,requested_at,policy_version) VALUES($1,$2,$3,'PENDING',clock_timestamp(),'test')`,[id,user,randomBytes(32).toString('hex')]);
 const c=await db.pool.connect();try{await captureDeletionMail(c,id,user,encryption);}finally{c.release();}return{user,id,email};}
const outbox=async(id:string)=>(await db.pool.query(`SELECT * FROM outbox WHERE payload->>'deletionId'=$1 ORDER BY template`,[id])).rows;
it('purge removes contact and ordinary mail; received/completed reuse refs-only outbox and independent encrypted destination',async()=>{
 const f=await fixture();await db.pool.query(`INSERT INTO outbox(event_id,recipient_id,channel,template,payload) VALUES(gen_random_uuid(),$1,'EMAIL','meal_cancelled','{}')`,[f.user]);
 await db.pool.query(`INSERT INTO jobs(kind,resource_id,due_at,run_after) VALUES('account.purge',$1,clock_timestamp(),clock_timestamp())`,[f.id]);
 const runner=createRunner({pool:db.pool,owner:'deletion-mail-test',handlers:{'account.purge':deletionHandler(db.pool,{revoke:async()=> 'COMPLETED'},true)}});expect(await runner.tick()).toMatchObject({done:1});
 expect((await db.pool.query(`SELECT * FROM private_contact WHERE user_id=$1`,[f.user])).rows).toHaveLength(0);expect((await db.pool.query(`SELECT status FROM outbox WHERE recipient_id=$1 AND template='meal_cancelled'`,[f.user])).rows[0].status).toBe('DEAD');
 expect((await outbox(f.id)).map(r=>r.template)).toEqual(['deletion_completed','deletion_received']);let sends=0;
 const provider:MailProvider={kind:'test',send:async input=>{sends++;expect(input.email).toBe(f.email);expect(input.refs).toEqual({deletionId:f.id});return{status:'SENT',providerId:randomUUID()};},lookup:async()=>({status:'UNKNOWN'})};
 const mail=mailDelivery(db.pool,provider,'test',{deletionMailEncryption:encryption});await mail.tick();expect(sends).toBe(2);await mail.tick();expect(sends).toBe(2);expect((await db.pool.query(`SELECT state,ciphertext FROM deletion_mail_envelopes WHERE deletion_id=$1`,[f.id])).rows[0]).toEqual({state:'CLEARED',ciphertext:null});
});
it('missing retention-policy approval never sends a false completed notice',async()=>{const f=await fixture();await db.pool.query(`INSERT INTO jobs(kind,resource_id,due_at,run_after) VALUES('account.purge',$1,clock_timestamp(),clock_timestamp())`,[f.id]);await createRunner({pool:db.pool,owner:'deletion-mail-no-policy',handlers:{'account.purge':deletionHandler(db.pool,{revoke:async()=> 'COMPLETED'},false)}}).tick();expect((await outbox(f.id)).map(r=>r.template)).toEqual(['deletion_received']);expect((await db.pool.query(`SELECT status FROM deletion_requests WHERE id=$1`,[f.id])).rows[0].status).toBe('NEEDS_SUPPORT');});
it('UNKNOWN is never resent, expired/missing key clears destination even with unavailable provider',async()=>{const f=await fixture();let sends=0;const service=mailDelivery(db.pool,{kind:'test',send:async()=>{sends++;return{status:'UNKNOWN'};},lookup:async()=>({status:'UNKNOWN'})},'test',{deletionMailEncryption:encryption});await service.tick();await db.pool.query(`UPDATE outbox SET next_attempt_at=clock_timestamp() WHERE payload->>'deletionId'=$1`,[f.id]);await service.tick();expect(sends).toBeGreaterThanOrEqual(1);const before=sends;await service.tick();expect(sends).toBe(before);await mailDelivery(db.pool,new UnavailableMailProvider(),'test').tick();expect((await db.pool.query(`SELECT state,ciphertext FROM deletion_mail_envelopes WHERE deletion_id=$1`,[f.id])).rows[0]).toEqual({state:'UNAVAILABLE',ciphertext:null});});
it('signed matching suppression erases destination and fences pending completed notice; late sent cannot revive channel',async()=>{
 const f=await fixture();await db.pool.query(`UPDATE deletion_requests SET status='COMPLETED' WHERE id=$1`,[f.id]);const c=await db.pool.connect();try{await enqueueDeletionMail(c,f.id,'deletion_completed');}finally{c.release();}
 const row=(await outbox(f.id)).find(r=>r.template==='deletion_received')!,token=randomUUID(),providerId=randomUUID();await db.pool.query(`UPDATE outbox SET status='SENDING',attempts=1,claim_token=$2,lease_until=clock_timestamp()+interval '1 minute' WHERE id=$1`,[row.id,token]);
 expect(await admitResendDispatch(db.pool,{outboxId:row.id,claimToken:token,payloadSha256:'a'.repeat(64)})).toBe(true);
 const base={svixId:randomUUID(),outboxId:row.id,providerEmailId:providerId,eventType:'email.suppressed' as const,payloadSha256:'b'.repeat(64),occurredAt:new Date().toISOString(),signedAttemptAt:new Date().toISOString()};expect(await recordResendReceipt(db.pool,base)).toBe('accepted');
 expect((await outbox(f.id)).every(r=>r.status==='DEAD')).toBe(true);expect((await db.pool.query(`SELECT state,ciphertext FROM deletion_mail_envelopes WHERE deletion_id=$1`,[f.id])).rows[0]).toEqual({state:'SUPPRESSED',ciphertext:null});
 await recordResendReceipt(db.pool,{...base,svixId:randomUUID(),eventType:'email.sent',payloadSha256:'c'.repeat(64)});expect((await db.pool.query(`SELECT state FROM deletion_mail_envelopes WHERE deletion_id=$1`,[f.id])).rows[0].state).toBe('SUPPRESSED');
 const pending=(await outbox(f.id)).find(r=>r.template==='deletion_completed')!;await db.pool.query(`UPDATE outbox SET status='SENDING',claim_token=$2,lease_until=clock_timestamp()+interval '1 minute' WHERE id=$1`,[pending.id,token]);expect(await admitResendDispatch(db.pool,{outboxId:pending.id,claimToken:token,payloadSha256:'d'.repeat(64)})).toBe(false);
});
it('dispatch waits on envelope before outbox, then rejects expired authorization; concurrent suppression has no reverse lock',async()=>{
 const f=await fixture(),row=(await outbox(f.id))[0]!,token=randomUUID(),providerId=randomUUID();await db.pool.query(`UPDATE outbox SET status='SENDING',attempts=1,claim_token=$2,lease_until=clock_timestamp()+interval '1 minute' WHERE id=$1`,[row.id,token]);expect(await admitResendDispatch(db.pool,{outboxId:row.id,claimToken:token,payloadSha256:'e'.repeat(64)})).toBe(true);
 const holder=await db.pool.connect();let admission:Promise<boolean>|undefined,receipt:Promise<unknown>|undefined;
 try{await holder.query('BEGIN');await holder.query(`SELECT deletion_id FROM deletion_mail_envelopes WHERE deletion_id=$1 FOR UPDATE`,[f.id]);admission=admitResendDispatch(db.pool,{outboxId:row.id,claimToken:token,payloadSha256:'e'.repeat(64)});
 let waiting=false;for(let n=0;n<150;n++){const {rows}=await db.pool.query(`SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query='SELECT deletion_id FROM deletion_mail_envelopes WHERE deletion_id=$1 FOR UPDATE'`);if(rows.length){waiting=true;break;}await new Promise<void>(r=>setImmediate(r));}expect(waiting).toBe(true);
 receipt=recordResendReceipt(db.pool,{svixId:randomUUID(),outboxId:row.id,providerEmailId:providerId,eventType:'email.suppressed',payloadSha256:'f'.repeat(64),occurredAt:new Date().toISOString(),signedAttemptAt:new Date().toISOString()});
 await holder.query(`UPDATE deletion_mail_envelopes SET accepted_at=now()-interval '192 hours',expires_at=now()-interval '24 hours' WHERE deletion_id=$1`,[f.id]);await holder.query('COMMIT');expect(await admission).toBe(false);expect(await receipt).toBe('accepted');expect((await db.pool.query(`SELECT state,ciphertext FROM deletion_mail_envelopes WHERE deletion_id=$1`,[f.id])).rows[0]).toEqual({state:'SUPPRESSED',ciphertext:null});
 }finally{await holder.query('ROLLBACK');holder.release();if(admission)await admission;if(receipt)await receipt;}
});
