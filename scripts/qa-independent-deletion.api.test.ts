/** Independent deletion barriers, fault rollback and shared historical preservation. */
import {randomBytes,randomUUID} from 'node:crypto';
import {afterAll,beforeAll,describe,expect,inject,it} from 'vitest';
import {Browser,createHarness,json,type Harness} from '../apps/api/src/test/harness.ts';
let h:Harness;
beforeAll(async()=>{h=await createHarness(inject('pgServerUrl'));});
afterAll(async()=>h.close());
const headers=(version?:string,key=randomUUID())=>({'idempotency-key':key,...(version?{'if-match':`"${version}"`}:{})});
async function actor(){const b=new Browser(h);const {body}=await b.signInWithEmail(`${randomUUID()}@example.invalid`);const id=body.data.session.user.id as string;const r=await b.request('PATCH','/v1/me',{body:{displayName:'QA Round Two',bio:'Synthetic isolated QA profile for concurrent safety checks.',languages:['en'],lifeStatus:'NEW_TO_LONDON',interests:['FOOD'],ageConfirmedVersion:'2026-10-21',communityAcceptedVersion:'2026-10-21'},headers:headers('1')});expect(r.statusCode,r.body).toBe(200);return{b,id};}
async function meal(b:Browser,capacity=4){const venue=await b.request('POST','/v1/venues/confirm',{body:{placeId:'fixture_fancy_north'},headers:headers()});expect(venue.statusCode,venue.body).toBe(200);const r=await b.request('POST','/v1/meals',{body:{venueRef:json(venue).data.venueRef,title:'QA concurrency isolated table',description:'Synthetic table with no external restaurant or customer activity.',start:{localDate:'2030-10-23',localTime:'18:00',timeZone:'Europe/London',utcOffsetMinutes:60},close:{localDate:'2030-10-23',localTime:'17:00',timeZone:'Europe/London',utcOffsetMinutes:60},minimum:2,capacity,budgetMinPence:2000,budgetMaxPence:3500,languages:['en'],mood:'EASY_CONVERSATION',bookingMode:'EXTERNAL_PAY_AT_VENUE',attemptId:randomUUID(),bookingDeclarationConfirmed:true,reviewConfirmed:true,termsVersion:'2026-10-21'},headers:headers()});expect(r.statusCode,r.body).toBe(201);return json(r).data;}
const apply=(b:Browser,id:string,key=randomUUID(),message='Independent synthetic application for QA.')=>b.request('POST',`/v1/meals/${id}/applications`,{body:{message},headers:headers(undefined,key)});
const approve=(b:Browser,id:string)=>b.request('POST',`/v1/applications/${id}/decision`,{body:{decision:'APPROVE'},headers:headers('1')});
async function count(sql:string,values:unknown[]){return Number((await h.db.pool.query(sql,values)).rows[0].n);}

import {createRunner} from '../apps/worker/src/runner/runner.ts';
import {deletionHandler,UnavailableDeletionProvider} from '../apps/worker/src/handlers/deletion.ts';
const deletion=(b:Browser,token:string,v='2')=>b.request('POST','/v1/me/deletion',{headers:headers(v),body:{confirm:true,receiptToken:token}});
async function history(host:string,guest:string,completed=false){
 const venue=(await h.db.pool.query("INSERT INTO venues(place_id,provider) VALUES($1,'fixture') RETURNING id",[`fixture_${randomUUID()}`])).rows[0].id;
 const now=Date.now()-(completed?3_600_001:0),start=new Date(now-3_600_000),close=new Date(now-7_200_000),end=new Date(now+3_600_000);
 const m=(await h.db.pool.query("INSERT INTO meals(host_id,venue_ref,title,description,starts_at,closes_at,scheduled_end_at,start_local_date,start_local_time,start_offset,close_local_date,close_local_time,close_offset,minimum,capacity,budget_min_pence,budget_max_pence,languages,mood,booking_mode,terms_version,attempt_id,head) VALUES($1,$2,'QA private host title','Synthetic private hosted meal description to remove',$3,$4,$5,'2026-10-21','08:00',60,'2026-10-21','07:00',60,2,4,1000,2000,ARRAY['en'],'EASY_CONVERSATION','EXTERNAL_PAY_AT_VENUE','2026-10-21',$6,2) RETURNING id",[host,venue,start,close,end,randomUUID()])).rows[0].id as string;
 for(const [i,id]of[host,guest].entries()){
  await h.db.pool.query('INSERT INTO seat_events(meal_id,seq,user_id,type,effective_at,command_id) VALUES($1,$2,$3,$4,$5,$6)',[m,i+1,id,i===0?'HOST_CONFIRMED':'GUEST_CONFIRMED',new Date(+close-1000),randomUUID()]);
  await h.db.pool.query("INSERT INTO start_roster(meal_id,user_id,source_revision_hash,starts_at) VALUES($1,$2,'qa-sealed',$3)",[m,id,start]);
  await h.db.pool.query("INSERT INTO attendance_revisions(meal_id,subject_id,source,value,version,actor_id) VALUES($1,$2,'SELF','present',1,$2)",[m,id]);
 }
 const group=(await h.db.pool.query("INSERT INTO conversations(kind,meal_id,head) VALUES('GROUP',$1,4) RETURNING id",[m])).rows[0].id;
 for(const [i,id]of[host,guest].entries()){
  await h.db.pool.query("INSERT INTO conversation_events(conversation_id,seq,kind,actor_id,effective_at) VALUES($1,$2,'JOIN',$3,$4)",[group,i+1,id,close]);await h.db.pool.query('INSERT INTO membership_intervals(conversation_id,user_id,join_seq) VALUES($1,$2,$3)',[group,id,i+1]);
  await h.db.pool.query("INSERT INTO conversation_events(conversation_id,seq,kind,actor_id,effective_at) VALUES($1,$2,'MESSAGE',$3,$4)",[group,i+3,id,start]);await h.db.pool.query('INSERT INTO messages(conversation_id,seq,sender_id,client_message_id,body,created_at) VALUES($1,$2,$3,$4,$5,$6)',[group,i+3,id,randomUUID(),`QA author body ${id}`,start]);
 }
 return {id:m,group};
}
async function shared(id:string){return {seats:(await h.db.pool.query('SELECT * FROM seat_events WHERE meal_id=$1 ORDER BY seq',[id])).rows,roster:(await h.db.pool.query('SELECT * FROM start_roster WHERE meal_id=$1 ORDER BY user_id',[id])).rows,attendance:(await h.db.pool.query('SELECT * FROM attendance_revisions WHERE meal_id=$1 ORDER BY subject_id',[id])).rows};}
describe('independent deletion end-to-end local boundary',()=>{
 for(const role of ['HOST','GUEST'])it(`QA-PRIVACY-004 deleting started ${role} preserves shared facts through actual local purge`,async()=>{
  const host=await actor(),guest=await actor(),target=role==='HOST'?host:guest,survivor=role==='HOST'?guest:host;const m=await history(host.id,guest.id),before=await shared(m.id);const token=randomBytes(32).toString('base64url');
  const accepted=await deletion(target.b,token);expect(accepted.statusCode,accepted.body).toBe(202);expect(await shared(m.id)).toEqual(before);expect((await h.db.pool.query('SELECT status FROM meals WHERE id=$1',[m.id])).rows[0].status).toBe('OPEN');
  const runner=createRunner({pool:h.db.pool,owner:`qa-${randomUUID()}`,handlers:{'account.purge':deletionHandler(h.db.pool,new UnavailableDeletionProvider())}});expect(await runner.tick()).toMatchObject({done:1,retried:0});expect(await shared(m.id)).toEqual(before);
  expect((await h.db.pool.query('SELECT body,redacted FROM messages WHERE conversation_id=$1 AND sender_id=$2',[m.group,target.id])).rows).toEqual([{body:'Message removed',redacted:true}]);expect((await h.db.pool.query('SELECT body,redacted FROM messages WHERE conversation_id=$1 AND sender_id=$2',[m.group,survivor.id])).rows).toEqual([{body:`QA author body ${survivor.id}`,redacted:false}]);
  expect(await count('SELECT count(*) n FROM profiles WHERE user_id=$1',[target.id])).toBe(0);expect(await count('SELECT count(*) n FROM profiles WHERE user_id=$1',[survivor.id])).toBe(1);const status=await new Browser(h).request('POST','/v1/deletion-status',{body:{receiptToken:token}});expect(json(status).data).toMatchObject({status:'NEEDS_SUPPORT',completedAt:null});expect(await runner.tick()).toMatchObject({claimed:0});
 });
 it('QA-PRIVACY-003 transaction failure rolls back barrier and receipt; retry survives discarded response',async()=>{
  const a=await actor(),m=await meal(a.b);const token=randomBytes(32).toString('base64url');const before=(await h.db.pool.query('SELECT status,version,privacy_epoch FROM users WHERE id=$1',[a.id])).rows[0];const epoch=(await h.db.pool.query('SELECT epoch FROM privacy_control WHERE id=1')).rows[0].epoch;
  await h.db.pool.query("CREATE FUNCTION qa_reject_journal() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'QA_INJECTED_ROLLBACK'; END $$");await h.db.pool.query('CREATE TRIGGER qa_reject_journal BEFORE INSERT ON deletion_journal FOR EACH ROW EXECUTE FUNCTION qa_reject_journal()');
  try{const failed=await deletion(a.b,token);expect(failed.statusCode,failed.body).toBe(500);expect(failed.body).not.toContain(token);expect((await h.db.pool.query('SELECT status,version,privacy_epoch FROM users WHERE id=$1',[a.id])).rows[0]).toEqual(before);expect((await h.db.pool.query('SELECT epoch FROM privacy_control WHERE id=1')).rows[0].epoch).toBe(epoch);expect(await count('SELECT count(*) n FROM deletion_requests WHERE user_id=$1',[a.id])).toBe(0);expect((await h.db.pool.query('SELECT status FROM meals WHERE id=$1',[m.id])).rows[0].status).toBe('OPEN');expect((await a.b.request('GET','/v1/me')).statusCode).toBe(200);}
  finally{await h.db.pool.query('DROP TRIGGER qa_reject_journal ON deletion_journal');await h.db.pool.query('DROP FUNCTION qa_reject_journal()');}
  expect((await deletion(a.b,token)).statusCode).toBe(202); // Response discarded: next step relies only on the pre-saved receipt.
  expect((await a.b.request('GET','/v1/me')).statusCode).toBe(401);const reader=new Browser(h);const receipt=await reader.request('POST','/v1/deletion-status',{body:{receiptToken:token}});expect(receipt.statusCode,receipt.body).toBe(200);expect(Object.keys(json(receipt).data).sort()).toEqual(['completedAt','requestedAt','status']);expect(receipt.body).not.toContain(token);expect(receipt.body).not.toContain(a.id);expect((await reader.request('POST','/v1/deletion-status',{body:{receiptToken:randomBytes(32).toString('base64url')}})).statusCode).toBe(404);
 });
 it('QA-PRIVACY-002 deletion commits future host cancel member exit and pending withdrawal before response',async()=>{
  const a=await actor(),host=await actor();const hosted=await meal(a.b),joined=await meal(host.b),pending=await meal(host.b);const app=json(await apply(a.b,joined.id)).data;expect((await approve(host.b,app.id)).statusCode).toBe(200);const p=json(await apply(a.b,pending.id)).data;const token=randomBytes(32).toString('base64url');expect((await deletion(a.b,token)).statusCode).toBe(202);
  expect((await h.db.pool.query('SELECT status,cancel_reason FROM meals WHERE id=$1',[hosted.id])).rows[0]).toEqual({status:'CANCELLED',cancel_reason:'host'});expect((await h.db.pool.query('SELECT id,state FROM applications WHERE id=ANY($1::uuid[]) ORDER BY id',[[app.id,p.id]])).rows).toEqual([{id:app.id,state:'CANCELLED'},{id:p.id,state:'WITHDRAWN'}].sort((x,y)=>x.id.localeCompare(y.id)));expect(await count('SELECT count(*) n FROM session_families WHERE user_id=$1 AND revoked_at IS NULL',[a.id])).toBe(0);expect((await a.b.request('POST',`/v1/meals/${pending.id}/applications`,{headers:headers(),body:{message:'Must never create after deletion barrier.'}})).statusCode).toBe(401);
 });
});
describe('independent deletion user-lock queue',()=>{
 it('QA-PRIVACY-002 queued deletion wins over later message and approval and revokes mutual contacts',async()=>{
  const host=await actor(),a=await actor(),m=await meal(host.b);const pending=json(await apply(a.b,m.id)).data;const prior=await history(host.id,a.id,true);
  for(const [who,other]of[[host,a],[a,host]]){const selected=await who.b.request('PUT',`/v1/meals/${prior.id}/reconnect/${other.id}`,{headers:headers('0'),body:{selected:true}});expect(selected.statusCode,selected.body).toBe(200);}
  const group=(await h.db.pool.query('SELECT id FROM conversations WHERE meal_id=$1',[prior.id])).rows[0].id;
  const holder=await h.db.pool.connect();let flight:ReturnType<typeof deletion>|undefined;let sends:ReturnType<Browser['request']>|undefined;let approvals:ReturnType<typeof approve>|undefined;
  try{await holder.query('BEGIN');await holder.query('SELECT id FROM users WHERE id=$1 FOR NO KEY UPDATE',[a.id]);flight=deletion(a.b,randomBytes(32).toString('base64url'));
   let waiting=false;for(let i=0;i<100;i++){const r=await h.db.pool.query("SELECT count(*)::int n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query ILIKE '%FROM users%' AND query ILIKE '%FOR UPDATE%'");if(r.rows[0].n>0){waiting=true;break;}await new Promise(resolve=>setTimeout(resolve,5));}expect(waiting).toBe(true);
   sends=a.b.request('POST',`/v1/conversations/${group}/messages`,{body:{body:'Must not land after queued deletion.',clientMessageId:randomUUID()}});approvals=approve(host.b,pending.id);await holder.query('COMMIT');expect((await flight).statusCode).toBe(202);expect([401,403,404]).toContain((await sends).statusCode);expect([401,403,404]).toContain((await approvals).statusCode);
   expect(await count("SELECT count(*) n FROM messages WHERE conversation_id=$1 AND body='Must not land after queued deletion.'",[group])).toBe(0);expect(await count("SELECT count(*) n FROM seat_events WHERE meal_id=$1 AND user_id=$2 AND type='GUEST_CONFIRMED'",[m.id,a.id])).toBe(0);expect(await count('SELECT count(*) n FROM pair_consents WHERE revoked_at IS NULL AND pair_id IN(SELECT id FROM user_pairs WHERE low_user=$1 OR high_user=$1)',[a.id])).toBe(0);expect((await new Browser(h).request('GET',`/v1/profiles/${a.id}`)).statusCode).toBe(404);
  }finally{await holder.query('ROLLBACK');holder.release();await Promise.allSettled([flight,sends,approvals].filter(Boolean));}
 });
});
