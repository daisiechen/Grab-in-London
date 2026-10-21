import {createHmac,randomUUID} from 'node:crypto';
import {afterAll,beforeAll,beforeEach,expect,inject,it} from 'vitest';
import {loadConfig} from '@fancy/config';
import {createHarness,type Harness} from '../test/harness.ts';
import {admitResendDispatch} from './receipts.ts';
import {registerResendWebhook} from './webhook.ts';
import {buildServer} from '../http/server.ts';
import {ResendMailProvider} from '../../../worker/src/mail/resend-provider.ts';
import {mailDelivery,type MailProvider,type DeliveryOutcome} from '../../../worker/src/mail/delivery.ts';
let h:Harness;const secret='whsec_'+Buffer.alloc(32,9).toString('base64');
const config=()=>loadConfig({ENVIRONMENT:'test',DATABASE_URL:h.db.url,AUTH_ADAPTER:'test',PLACES_ADAPTER:'fixture',MAIL_ADAPTER:'provider',AI_PROVIDER:'disabled',WEB_ORIGIN:'http://localhost:5174',SESSION_SECRET:['synthetic','session','0123456789abcdef0123456789abcdef'].join('-'),RESEND_WEBHOOK_SECRET:secret});
beforeAll(async()=>{h=await createHarness(inject('pgServerUrl'));registerResendWebhook(h.app,{config:config(),pool:h.db.pool,identity:h.idp,publicOrigin:'http://localhost:5174'});});afterAll(async()=>h.close());beforeEach(async()=>{await h.db.pool.query('DELETE FROM outbox');});
async function queued(status='UNKNOWN',attempts=1,admitted=true){const user=randomUUID(),id=randomUUID(),claim=randomUUID();await h.db.pool.query('INSERT INTO users(id) VALUES($1)',[user]);await h.db.pool.query('INSERT INTO private_contact(user_id,email,email_verified_at) VALUES($1,$2,clock_timestamp())',[user,`synthetic-${id}@example.invalid`]);await h.db.pool.query(`INSERT INTO outbox(id,event_id,recipient_id,channel,template,payload,status,attempts,claim_token,lease_until) VALUES($1,$2,$3,'EMAIL','meal_cancelled',$4,$5,$6,$7,clock_timestamp()-interval '1 second')`,[id,randomUUID(),user,{mealId:randomUUID()},status,attempts,claim]);if(attempts>0&&admitted)await h.db.pool.query(`INSERT INTO mail_provider_messages(outbox_id,dispatch_hash) VALUES($1,$2)`,[id,'a'.repeat(64)]);return{id,claim};}
function raw(id:string,provider:string,type='email.sent'){return JSON.stringify({type,created_at:new Date().toISOString(),data:{email_id:provider,tags:{outbox_id:id},to:['PRIVATE_EMAIL_CANARY'],subject:'PRIVATE_SUBJECT_CANARY',bounce:{message:'PRIVATE_BOUNCE_CANARY'}}});}
function signed(payload:string,eventId='msg_'+randomUUID(),seconds=String(Math.floor(Date.now()/1000))){return {'content-type':'application/json','svix-id':eventId,'svix-timestamp':seconds,'svix-signature':'v1,'+createHmac('sha256',Buffer.from(secret.slice(6),'base64')).update(eventId+'.'+seconds+'.'+payload).digest('base64')};}
const post=(payload:string,headers=signed(payload))=>h.app.inject({method:'POST',url:'/v1/webhooks/resend',payload,headers});
const row=async(id:string)=>(await h.db.pool.query('SELECT * FROM outbox WHERE id=$1',[id])).rows[0];
it('persists matching sent proof, fences the claim and survives a new server without another send',async()=>{
 const f=await queued(),provider=randomUUID(),payload=raw(f.id,provider),headers=signed(payload);expect((await post(payload,headers)).statusCode).toBe(200);expect(await row(f.id)).toMatchObject({status:'SENT',provider_id:provider,claim_token:null,lease_until:null});
 const restarted=await buildServer({config:config(),pool:h.db.pool,identity:h.idp,publicOrigin:'http://localhost:5174'});try{expect((await restarted.inject({method:'POST',url:'/v1/webhooks/resend',payload,headers})).statusCode).toBe(200);}finally{await restarted.close();}
 let sends=0;await mailDelivery(h.db.pool,{kind:'test',send:async()=>{sends++;return{status:'UNKNOWN'};},lookup:async()=>({status:'UNKNOWN'})},'test').tick();expect(sends).toBe(0);expect((await h.db.pool.query('SELECT * FROM mail_provider_receipts')).rows).toHaveLength(1);
 const stored=JSON.stringify((await h.db.pool.query('SELECT * FROM mail_provider_receipts')).rows)+JSON.stringify((await h.db.pool.query('SELECT * FROM mail_provider_messages')).rows);expect(stored).not.toContain('PRIVATE_');
});
it('rejects wrong signatures/stale attempts, does not claim undispatched or unknown IDs and keeps ordinary JSON parsing',async()=>{
 const f=await queued('PENDING',0),provider=randomUUID(),payload=raw(f.id,provider);expect((await post(payload)).statusCode).toBe(200);expect((await row(f.id)).status).toBe('PENDING');
 expect((await post(raw(randomUUID(),provider))).statusCode).toBe(200);
 expect((await post(payload,{...signed(payload),'svix-signature':'v1,AAAA'})).statusCode).toBe(400);
 expect((await post(payload,signed(payload,undefined,String(Math.floor(Date.now()/1000)-301)))).statusCode).toBe(400);
 expect((await h.db.pool.query('SELECT * FROM mail_provider_receipts')).rows).toHaveLength(0);
 expect((await h.app.inject({method:'POST',url:'/v1/auth/email/start',headers:{origin:'http://localhost:5174'},payload:{clientRequestId:randomUUID(),email:'synthetic-'+randomUUID()+'@example.invalid',client:'WEB'}})).statusCode).toBe(201);
});
it('dedupes same svix-id and rejects re-signed changed payload plus provider/outbox reassignment',async()=>{
 const f=await queued(),provider=randomUUID(),payload=raw(f.id,provider),headers=signed(payload);expect((await post(payload,headers)).statusCode).toBe(200);expect((await post(payload,headers)).statusCode).toBe(200);const changed=payload+' ';expect((await post(changed,signed(changed,headers['svix-id']))).statusCode).toBe(409);
 expect((await post(raw(f.id,randomUUID()))).statusCode).toBe(409);const other=await queued();expect((await post(raw(other.id,provider))).statusCode).toBe(409);expect((await row(other.id)).status).toBe('UNKNOWN');expect((await h.db.pool.query('SELECT * FROM mail_provider_receipts')).rows).toHaveLength(1);
});
it('stores delivered and bounced separately in any order, only sent promotes transport status',async()=>{
 const f=await queued('SENDING'),provider=randomUUID();for(const type of ['email.bounced','email.delivered']){expect((await post(raw(f.id,provider,type))).statusCode).toBe(200);expect((await row(f.id)).status).toBe('UNKNOWN');expect((await row(f.id)).claim_token).toBeNull();}
 expect((await post(raw(f.id,provider))).statusCode).toBe(200);expect((await row(f.id)).status).toBe('SENT');expect((await post(raw(f.id,provider,'email.bounced'))).statusCode).toBe(200);expect((await row(f.id)).status).toBe('SENT');const {rows:[message]}=await h.db.pool.query('SELECT * FROM mail_provider_messages WHERE outbox_id=$1',[f.id]);expect(message.sent_at).toBeTruthy();expect(message.delivered_at).toBeTruthy();expect(message.bounced_at).toBeTruthy();
});
for(const status of ['UNKNOWN','RETRY','SENT'] as const)it(`webhook before send response prevents stale ${status} from overwriting confirmed evidence`,async()=>{
 const f=await queued('PENDING',0),provider=randomUUID();let entered!:()=>void,release!:()=>void;const entry=new Promise<void>(r=>{entered=r;}),gate=new Promise<void>(r=>{release=r;});
 const outcome:DeliveryOutcome=status==='SENT'?{status,providerId:randomUUID()}:{status};const adapter:MailProvider={kind:'test',send:async(input)=>{await h.db.pool.query(`INSERT INTO mail_provider_messages(outbox_id,dispatch_hash) VALUES($1,$2) ON CONFLICT DO NOTHING`,[input.idempotencyKey,'a'.repeat(64)]);entered();await gate;return outcome;},lookup:async()=>({status:'UNKNOWN'})};const pending=mailDelivery(h.db.pool,adapter,'test').tick();
 try{await entry;expect((await post(raw(f.id,provider))).statusCode).toBe(200);expect((await row(f.id)).claim_token).toBeNull();}finally{release();await pending;}expect(await row(f.id)).toMatchObject({status:'SENT',provider_id:provider,attempts:1});
});
it('webhook fences an actual in-flight UNKNOWN lookup and never lets its NOT_SENT result schedule resend',async()=>{
 const f=await queued(),provider=randomUUID();let entered!:()=>void,release!:()=>void;const entry=new Promise<void>(r=>{entered=r;}),gate=new Promise<void>(r=>{release=r;});let sends=0;
 const adapter:MailProvider={kind:'test',send:async()=>{sends++;return{status:'UNKNOWN'};},lookup:async()=>{entered();await gate;return{status:'NOT_SENT'};}};const service=mailDelivery(h.db.pool,adapter,'test'),pending=service.tick();try{await entry;expect((await post(raw(f.id,provider))).statusCode).toBe(200);}finally{release();await pending;}await service.tick();expect(sends).toBe(0);expect(await row(f.id)).toMatchObject({status:'SENT',provider_id:provider});
});
it('uses a real independent row-lock barrier and the old worker claim updates zero rows after receipt commits',async()=>{
 const f=await queued(),provider=randomUUID(),holder=await h.db.pool.connect();let webhook:ReturnType<typeof post>|undefined,oldWriter:Promise<{rowCount:number|null}>|undefined;
 try{await holder.query('BEGIN');await holder.query('SELECT id FROM outbox WHERE id=$1 FOR UPDATE',[f.id]);webhook=post(raw(f.id,provider));let waiting=false;for(let n=0;n<150;n++){const {rows}=await h.db.pool.query("SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT status,channel,attempts,%'");if(rows.length){waiting=true;break;}await new Promise<void>(r=>setImmediate(r));}expect(waiting).toBe(true);
 oldWriter=h.db.pool.query("UPDATE outbox SET status='UNKNOWN',provider_id=NULL WHERE id=$1 AND claim_token=$2",[f.id,f.claim]);await holder.query('COMMIT');expect((await webhook).statusCode).toBe(200);expect((await oldWriter).rowCount).toBe(0);expect(await row(f.id)).toMatchObject({status:'SENT',provider_id:provider});
 }finally{await holder.query('ROLLBACK');holder.release();if(webhook)await webhook;if(oldWriter)await oldWriter;}
});
it('does not register a webhook for absent secret or fixture mail adapter',async()=>{for(const changes of [{resendWebhookSecret:null},{adapters:{...config().adapters,MAIL_ADAPTER:'outbox_test' as const}}]){const app=await buildServer({config:{...config(),...changes},pool:h.db.pool,identity:h.idp,publicOrigin:'http://localhost:5174'});try{expect((await app.inject({method:'POST',url:'/v1/webhooks/resend',payload:{}})).statusCode).toBe(404);}finally{await app.close();}}});
it('rolls back mapping and receipt with a failed outbox transition then retries once',async()=>{
 const f=await queued(),provider=randomUUID(),payload=raw(f.id,provider),headers=signed(payload);
 await h.db.pool.query(`CREATE FUNCTION mail_receipt_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'SYNTHETIC_RECEIPT_FAULT'; END $$`);
 await h.db.pool.query(`CREATE TRIGGER mail_receipt_fault BEFORE UPDATE ON outbox FOR EACH ROW EXECUTE FUNCTION mail_receipt_fault()`);
 try{expect((await post(payload,headers)).statusCode).toBe(500);expect((await h.db.pool.query('SELECT * FROM mail_provider_receipts')).rows).toHaveLength(0);expect((await h.db.pool.query('SELECT * FROM mail_provider_messages')).rows).toMatchObject([{provider_email_id:null}]);expect(await row(f.id)).toMatchObject({status:'UNKNOWN',provider_id:null,claim_token:f.claim});}
 finally{await h.db.pool.query('DROP TRIGGER mail_receipt_fault ON outbox');await h.db.pool.query('DROP FUNCTION mail_receipt_fault()');}
 expect((await post(payload,headers)).statusCode).toBe(200);expect((await h.db.pool.query('SELECT * FROM mail_provider_receipts')).rows).toHaveLength(1);
});
it('does not claim an attempted UNKNOWN row without a durable dispatch admission marker',async()=>{
 const f=await queued('UNKNOWN',1,false);expect((await post(raw(f.id,randomUUID()))).statusCode).toBe(200);expect(await row(f.id)).toMatchObject({status:'UNKNOWN',provider_id:null,claim_token:f.claim});expect((await h.db.pool.query('SELECT * FROM mail_provider_receipts')).rows).toHaveLength(0);
});
it('actual Resend hook rejects stale or expired claim before any fetch and freezes the admitted payload hash',async()=>{
 const f=await queued('SENDING',1,false),calls:string[]=[];
 const provider=new ResendMailProvider({apiKey:['re','SYNTHETIC','FIXTURE'].join('_'),from:'Fancy <noreply@example.invalid>',webOrigin:'https://fancy.example',onDispatch:input=>admitResendDispatch(h.db.pool,input),fetch:async()=>{calls.push('fetch');return Response.json({id:randomUUID()});}});
 const input={idempotencyKey:f.id,email:'synthetic@example.invalid',template:'meal_cancelled',refs:{mealId:randomUUID()},claimToken:f.claim};
 expect(await provider.send(input)).toEqual({status:'UNKNOWN'});expect(calls).toEqual([]);expect((await h.db.pool.query('SELECT * FROM mail_provider_messages')).rows).toHaveLength(0);
 await h.db.pool.query("UPDATE outbox SET lease_until=clock_timestamp()+interval '1 minute' WHERE id=$1",[f.id]);
 expect(await provider.send({...input,claimToken:randomUUID()})).toEqual({status:'UNKNOWN'});expect(calls).toEqual([]);
 expect((await provider.send(input)).status).toBe('SENT');expect(calls).toHaveLength(1);
 expect(await provider.send({...input,template:'application_declined'})).toEqual({status:'UNKNOWN'});expect(calls).toHaveLength(1);
 const {rows:[mapping]}=await h.db.pool.query('SELECT * FROM mail_provider_messages WHERE outbox_id=$1',[f.id]);expect(mapping.dispatched_at).toBeTruthy();expect(mapping.dispatch_hash).toMatch(/^[a-f0-9]{64}$/);expect(JSON.stringify(mapping)).not.toContain(input.email);
});
for(const reason of ['RETRY_EXHAUSTED','RECIPIENT_UNAVAILABLE'])it(`retains a late signed sent result after ${reason} without another send or erasing dead history`,async()=>{
 const f=await queued('DEAD',8),provider=randomUUID();await h.db.pool.query("UPDATE outbox SET last_error_code=$2,created_at=clock_timestamp()-interval '49 hours' WHERE id=$1",[f.id,reason]);await h.db.pool.query("UPDATE mail_provider_messages SET dispatched_at=clock_timestamp()-interval '49 hours' WHERE outbox_id=$1",[f.id]);
 const payload=(type:string)=>{const event=JSON.parse(raw(f.id,provider,type));event.created_at=new Date(Date.now()-48*3600_000).toISOString();return JSON.stringify(event);};
 for(const type of ['email.delivered','email.bounced']){expect((await post(payload(type))).statusCode).toBe(200);expect(await row(f.id)).toMatchObject({status:'DEAD',last_error_code:reason});}
 expect((await post(payload('email.sent'))).statusCode).toBe(200);expect(await row(f.id)).toMatchObject({status:'SENT',provider_id:provider,last_error_code:reason,attempts:8,claim_token:null});
 expect((await post(payload('email.delivered'))).statusCode).toBe(200);expect((await row(f.id)).last_error_code).toBe(reason);
 let sends=0;await mailDelivery(h.db.pool,{kind:'test',send:async()=>{sends++;return{status:'UNKNOWN'};},lookup:async()=>({status:'UNKNOWN'})},'test').tick();expect(sends).toBe(0);
});
it('admission rechecks the lease after a real row-lock wait and rejects the old sender without a fetch',async()=>{
 const f=await queued('SENDING',1,false),holder=await h.db.pool.connect();let pending:Promise<DeliveryOutcome>|undefined;let fetches=0;
 const provider=new ResendMailProvider({apiKey:['re','SYNTHETIC','FIXTURE'].join('_'),from:'Fancy <noreply@example.invalid>',webOrigin:'https://fancy.example',onDispatch:input=>admitResendDispatch(h.db.pool,input),fetch:async()=>{fetches++;return Response.json({id:randomUUID()});}});
 try{await holder.query('BEGIN');await holder.query("UPDATE outbox SET lease_until=clock_timestamp()+interval '1 minute' WHERE id=$1",[f.id]);pending=provider.send({idempotencyKey:f.id,claimToken:f.claim,email:'synthetic@example.invalid',template:'meal_cancelled',refs:{}});
  let waiting=false;for(let n=0;n<150;n++){const {rows}=await h.db.pool.query("SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query='SELECT id FROM outbox WHERE id=$1 FOR UPDATE'");if(rows.length){waiting=true;break;}await new Promise<void>(r=>setImmediate(r));}expect(waiting).toBe(true);
  await holder.query("UPDATE outbox SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",[f.id]);await holder.query('COMMIT');expect(await pending).toEqual({status:'UNKNOWN'});expect(fetches).toBe(0);expect((await h.db.pool.query('SELECT * FROM mail_provider_messages')).rows).toHaveLength(0);
 }finally{await holder.query('ROLLBACK');holder.release();if(pending)await pending;}
});
it('actual Resend adapter persists claim-bound admission and receives a signed callback before a lost send response',async()=>{
 const f=await queued('PENDING',0),providerId=randomUUID();let entered!:()=>void,release!:()=>void;const entry=new Promise<void>(r=>{entered=r;}),gate=new Promise<void>(r=>{release=r;});let fetches=0;
 const adapter=new ResendMailProvider({apiKey:['re','SYNTHETIC','FIXTURE'].join('_'),from:'Fancy <noreply@example.invalid>',webOrigin:'https://fancy.example',onDispatch:input=>admitResendDispatch(h.db.pool,input),fetch:async(_url,init)=>{fetches++;expect(JSON.parse(String(init?.body)).tags).toEqual([{name:'outbox_id',value:f.id}]);const {rows:[marker]}=await h.db.pool.query('SELECT dispatched_at,dispatch_hash FROM mail_provider_messages WHERE outbox_id=$1',[f.id]);expect(marker.dispatched_at).toBeTruthy();expect(marker.dispatch_hash).toMatch(/^[a-f0-9]{64}$/);entered();await gate;throw Error('SYNTHETIC_LOST_SEND_RESPONSE');}});
 const pending=mailDelivery(h.db.pool,adapter,'test').tick();try{await entry;expect((await post(raw(f.id,providerId))).statusCode).toBe(200);}finally{release();await pending;}
 expect(fetches).toBe(1);expect(await row(f.id)).toMatchObject({status:'SENT',provider_id:providerId,attempts:1,claim_token:null});await mailDelivery(h.db.pool,adapter,'test').tick();expect(fetches).toBe(1);
});
