import {createHash,randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,inject,it} from 'vitest';
import {migrate} from './migrate.ts';
import {createMigratedDatabase,type MigratedDatabase} from '@fancy/testkit/db';
import {captureDeletionMail,enqueueDeletionMail,expireDeletionMail,resolveDeletionMail,type DeletionMailEncryption} from './deletion-mail.ts';
let db:MigratedDatabase;
beforeAll(async()=>{db=await createMigratedDatabase(inject('pgServerUrl'),migrate);});afterAll(async()=>db.drop());
const encryption:DeletionMailEncryption={currentVersion:'v1',keys:{v1:Buffer.alloc(32,17).toString('base64')}};
async function fixture(config:DeletionMailEncryption|null=encryption){
 const user=(await db.pool.query(`INSERT INTO users DEFAULT VALUES RETURNING id`)).rows[0].id as string;
 const id=randomUUID(),email=`${randomUUID()}@example.invalid`;
 await db.pool.query(`INSERT INTO private_contact(user_id,email,email_verified_at) VALUES($1,$2,clock_timestamp())`,[user,email]);
 await db.pool.query(`INSERT INTO deletion_requests(id,user_id,receipt_token_hash,status,requested_at,policy_version) VALUES($1,$2,$3,'PENDING',clock_timestamp(),'test')`,[id,user,createHash('sha256').update(randomUUID()).digest('hex')]);
 const c=await db.pool.connect();try{await c.query('BEGIN');await captureDeletionMail(c,id,user,config);await c.query('COMMIT');}finally{c.release();}
 return{id,user,email};
}
async function resolve(id:string,config:DeletionMailEncryption|null=encryption){const c=await db.pool.connect();try{await c.query('BEGIN');const row=(await c.query(`SELECT * FROM outbox WHERE payload->>'deletionId'=$1 AND template='deletion_received'`,[id])).rows[0];const value=await resolveDeletionMail(c,row,config);await c.query('COMMIT');return value;}catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}}
const envelope=async(id:string)=>(await db.pool.query(`SELECT * FROM deletion_mail_envelopes WHERE deletion_id=$1`,[id])).rows[0];
it('captures only encrypted verified destination, references only; dedup preserves seven-day deadline',async()=>{
 const f=await fixture(),before=await envelope(f.id);expect(JSON.stringify(before)).not.toContain(f.email);expect(before.state).toBe('ACTIVE');expect(+before.expires_at-+before.accepted_at).toBe(7*86400000);expect((await resolve(f.id))?.email).toBe(f.email);
 const c=await db.pool.connect();try{await captureDeletionMail(c,f.id,f.user,encryption);}finally{c.release();}
 expect((await envelope(f.id)).expires_at).toEqual(before.expires_at);const rows=(await db.pool.query(`SELECT payload FROM outbox WHERE payload->>'deletionId'=$1`,[f.id])).rows;expect(rows).toEqual([{payload:{deletionId:f.id}}]);
});
it('missing key is receipt-only and does not retain ciphertext or enqueue',async()=>{const f=await fixture(null);expect(await envelope(f.id)).toMatchObject({state:'UNAVAILABLE',ciphertext:null,nonce:null,auth_tag:null});expect((await db.pool.query(`SELECT id FROM outbox WHERE payload->>'deletionId'=$1`,[f.id])).rows).toHaveLength(0);});
it('wrong key or AAD tamper clears ciphertext permanently instead of trying restored contact',async()=>{
 const f=await fixture();expect(await resolve(f.id,{currentVersion:'v1',keys:{v1:Buffer.alloc(32,18).toString('base64')}})).toBeNull();expect(await envelope(f.id)).toMatchObject({state:'UNAVAILABLE',ciphertext:null});expect(await resolve(f.id)).toBeNull();
 const t=await fixture();await db.pool.query(`UPDATE deletion_mail_envelopes SET accepted_at=accepted_at-interval '1 second',expires_at=expires_at-interval '1 second' WHERE deletion_id=$1`,[t.id]);expect(await resolve(t.id)).toBeNull();
});
it('DB deadline wins with process time unchanged, stops UNKNOWN and works with no provider',async()=>{
 const f=await fixture();await db.pool.query(`UPDATE deletion_mail_envelopes SET accepted_at=now()-interval '192 hours',expires_at=now()-interval '24 hours' WHERE deletion_id=$1`,[f.id]);await db.pool.query(`UPDATE outbox SET status='UNKNOWN' WHERE payload->>'deletionId'=$1`,[f.id]);
 const c=await db.pool.connect();try{await c.query('BEGIN');await expireDeletionMail(c,encryption);await c.query('COMMIT');}finally{c.release();}
 expect(await envelope(f.id)).toMatchObject({state:'EXPIRED',ciphertext:null});expect((await db.pool.query(`SELECT status FROM outbox WHERE payload->>'deletionId'=$1`,[f.id])).rows[0].status).toBe('DEAD');expect(await resolve(f.id)).toBeNull();
});
it('completed mail requires true COMPLETED; unique event prevents repeated completion notices',async()=>{
 const f=await fixture(),c=await db.pool.connect();try{expect(await enqueueDeletionMail(c,f.id,'deletion_completed')).toBe(false);await c.query(`UPDATE deletion_requests SET status='NEEDS_SUPPORT' WHERE id=$1`,[f.id]);expect(await enqueueDeletionMail(c,f.id,'deletion_completed')).toBe(false);await c.query(`UPDATE deletion_requests SET status='COMPLETED' WHERE id=$1`,[f.id]);expect(await enqueueDeletionMail(c,f.id,'deletion_completed')).toBe(true);expect(await enqueueDeletionMail(c,f.id,'deletion_completed')).toBe(true);}finally{c.release();}
 expect((await db.pool.query(`SELECT template FROM outbox WHERE payload->>'deletionId'=$1`,[f.id])).rows.map(r=>r.template).sort()).toEqual(['deletion_completed','deletion_received']);
});
it('rotation uses the original key version without extending deadline, distinct nonces hide repeated destination',async()=>{
 const f=await fixture(),before=await envelope(f.id),rotated={currentVersion:'v2',keys:{...encryption.keys,v2:Buffer.alloc(32,19).toString('base64')}};expect((await resolve(f.id,rotated))?.email).toBe(f.email);expect((await envelope(f.id)).expires_at).toEqual(before.expires_at);
 const g=await fixture();expect((await envelope(g.id)).nonce).not.toBe(before.nonce);
});
it('unverified future verification timestamp and cross-owner resolution never expose destination',async()=>{
 const f=await fixture(),c=await db.pool.connect();try{const row=(await c.query(`SELECT * FROM outbox WHERE payload->>'deletionId'=$1`,[f.id])).rows[0];expect(await resolveDeletionMail(c,{...row,recipient_id:randomUUID()},encryption)).toBeNull();}finally{c.release();}
 const user=(await db.pool.query(`INSERT INTO users DEFAULT VALUES RETURNING id`)).rows[0].id,id=randomUUID();await db.pool.query(`INSERT INTO private_contact(user_id,email,email_verified_at) VALUES($1,'unverified@example.invalid',clock_timestamp()+interval '1 hour')`,[user]);await db.pool.query(`INSERT INTO deletion_requests(id,user_id,receipt_token_hash,status,requested_at,policy_version) VALUES($1,$2,$3,'PENDING',clock_timestamp(),'test')`,[id,user,createHash('sha256').update(randomUUID()).digest('hex')]);const client=await db.pool.connect();try{await captureDeletionMail(client,id,user,encryption);}finally{client.release();}expect(await envelope(id)).toMatchObject({state:'UNAVAILABLE',ciphertext:null});
});
