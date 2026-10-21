/** QA round four: post-meal exact windows and independent message/consent permissions. */
import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,describe,expect,inject,it} from 'vitest';
import {Browser,createHarness,json,type Harness} from '../apps/api/src/test/harness.ts';
import {withTransaction,type Tx} from '../apps/api/src/common/transaction.ts';
import {lockPostMeal} from '../apps/api/src/post-meal/lock.ts';
import {assertWindow,assertRoster,recordAttendanceRevision} from '../apps/api/src/post-meal/attendance.ts';
import {rateExperience} from '../apps/api/src/post-meal/experience.ts';
import {reviewPerson} from '../apps/api/src/post-meal/reviews.ts';
import {lockConnection,selectPair} from '../apps/api/src/connections/service.ts';
import {createGroupConversation,joinConversation} from '../apps/api/src/membership/intervals.ts';
let h:Harness;
beforeAll(async()=>{h=await createHarness(inject('pgServerUrl'));});afterAll(async()=>h.close());
const headers=(version='0',key=randomUUID())=>({'idempotency-key':key,'if-match':`"${version}"`});
async function actor(){const b=new Browser(h);const {body}=await b.signInWithEmail(`${randomUUID()}@example.invalid`);return{b,id:body.data.session.user.id as string};}
async function fixture(present=true){
 const host=await actor(),guest=await actor(),outsider=await actor();const end=new Date('2026-10-20T20:00:00Z'),start=new Date(+end-7200_000),close=new Date(+start-3600_000);
 const venue=(await h.db.pool.query("INSERT INTO venues(place_id,provider) VALUES($1,'fixture') RETURNING id",['fixture_'+randomUUID()])).rows[0].id;
 const m=(await h.db.pool.query("INSERT INTO meals(host_id,venue_ref,title,description,starts_at,closes_at,scheduled_end_at,start_local_date,start_local_time,start_offset,close_local_date,close_local_time,close_offset,minimum,capacity,budget_min_pence,budget_max_pence,languages,mood,booking_mode,terms_version,attempt_id,status,head) VALUES($1,$2,'QA finished table','Synthetic independent post-meal fixture description',$3,$4,$5,'2026-10-20','19:00',60,'2026-10-20','18:00',60,2,4,1000,2000,ARRAY['en'],'EASY_CONVERSATION','EXTERNAL_PAY_AT_VENUE','2026-10-21',$6,'COMPLETED',2) RETURNING id",[host.id,venue,start,close,end,randomUUID()])).rows[0].id as string;
 for(const[index,user]of[host,guest].entries()){await h.db.pool.query('INSERT INTO seat_events(meal_id,seq,user_id,type,effective_at,command_id) VALUES($1,$2,$3,$4,$5,$6)',[m,index+1,user.id,index?'GUEST_CONFIRMED':'HOST_CONFIRMED',new Date(+close-60_000),randomUUID()]);await h.db.pool.query("INSERT INTO start_roster(meal_id,user_id,source_revision_hash,starts_at) VALUES($1,$2,'qa-independent',$3)",[m,user.id,start]);if(present)await h.db.pool.query("INSERT INTO attendance_revisions(meal_id,subject_id,source,value,version,actor_id,created_at) VALUES($1,$2,'SELF','present',1,$2,$3)",[m,user.id,end]);}
 const group=await withTransaction(h.db.pool,async tx=>{const g=await createGroupConversation(tx,{mealId:m,hostId:host.id,effectiveAt:close});await joinConversation(tx,g.conversationId,guest.id,close);return g.conversationId;});
 return{host,guest,outsider,m,end,group};
}
async function at<T>(now:Date,fn:(tx:Tx)=>Promise<T>){return withTransaction(h.db.pool,tx=>fn({...tx,effectiveNow:async()=>{tx.locks.closeLockPhase();return now;}}),{commitOnDomainError:true});}
async function snapshot(m:string){const result:Record<string,number>={};for(const table of['attendance_revisions','experience_revisions','public_review_revisions'])result[table]=Number((await h.db.pool.query(`SELECT count(*) n FROM ${table} WHERE meal_id=$1`,[m])).rows[0].n);result.consents=Number((await h.db.pool.query('SELECT count(*) n FROM pair_consents WHERE basis_meal_id=$1',[m])).rows[0].n);result.facts=Number((await h.db.pool.query('SELECT count(*) n FROM business_events WHERE aggregate_id=$1',[m])).rows[0].n);return result;}
const operations=['SELF','HOST','EXPERIENCE','REVIEW','RECONNECT']as const;
describe('QA independent exact post-meal transactional boundaries',()=>{
 for(const[cid,delta,allowed]of[['QA-POST-001',-1,false],['QA-POST-002',0,true],['QA-POST-003',7*86400_000-1,true],['QA-POST-004',7*86400_000,false]]as const){
  for(const operation of operations){it(`${cid} ${operation} exact ${delta}ms`,async()=>{
   const f=await fixture(),before=await snapshot(f.m),now=new Date(+f.end+delta);
   const run=()=>at(now,async tx=>{
    if(operation==='RECONNECT'){const{pair,now}=await lockConnection(tx,f.guest.id,f.host.id,[f.m]);const meal=(await tx.client.query('SELECT * FROM meals WHERE id=$1',[f.m])).rows[0];assertWindow(meal,now);await assertRoster(tx.client,f.m,[f.guest.id,f.host.id]);return selectPair(tx,pair,f.guest.id,f.host.id,f.m,true,'0',now);}
    const{meal,now}=await lockPostMeal(tx,f.m,operation==='HOST'?f.host.id:f.guest.id,operation==='REVIEW'?f.host.id:f.guest.id);
    if(operation==='SELF'||operation==='HOST')return recordAttendanceRevision(tx,meal,f.guest.id,operation,'present',operation==='HOST'?f.host.id:f.guest.id,'1',now);
    if(operation==='EXPERIENCE')return rateExperience(tx,meal,f.guest.id,4,'0',now);
    return reviewPerson(tx,meal,f.guest.id,f.host.id,'Independent synthetic public reference.','0',now);
   });
   if(!allowed){await expect(run()).rejects.toMatchObject({code:'STATE_CONFLICT'});expect(await snapshot(f.m)).toEqual(before);}
   else{const result=await run();expect(result.version).toBe(operation==='SELF'||operation==='HOST'?'2':'1');const after=await snapshot(f.m);const target=operation==='SELF'||operation==='HOST'?'attendance_revisions':operation==='EXPERIENCE'?'experience_revisions':operation==='REVIEW'?'public_review_revisions':'consents';expect(after[target]).toBe(before[target]!+1);}
  });}
 }
});
const send=(b:Browser,id:string,body:string,key=randomUUID())=>b.request('POST',`/v1/conversations/${id}/messages`,{body:{body,clientMessageId:key}});
const read=(b:Browser,id:string,mode='HISTORY')=>b.request('GET',`/v1/conversations/${id}/messages?mode=${mode}`);
async function groupVersion(id:string){return String((await h.db.pool.query('SELECT version FROM conversations WHERE id=$1',[id])).rows[0].version);}
async function select(b:Browser,m:string,subject:string,version='0'){return b.request('PUT',`/v1/meals/${m}/reconnect/${subject}`,{body:{selected:true},headers:headers(version)});}
describe('QA independent actual HTTP post-meal and group authorisation',()=>{
 it('QA-POST-005 host present then SELF absent keeps both sources and unknown remains unknown',async()=>{
  const f=await fixture(false);const route=`/v1/meals/${f.m}/attendance/${f.guest.id}`;expect((await f.host.b.request('PUT',route,{body:{value:'present'},headers:headers()})).statusCode).toBe(200);const own=await f.guest.b.request('PUT',route,{body:{value:'absent'},headers:headers('1')});expect(own.statusCode,own.body).toBe(200);expect(json(own).data).toMatchObject({value:'absent',source:'SELF',hostValue:'present',selfValue:'absent',version:'2'});const state=json(await f.guest.b.request('GET',`/v1/meals/${f.m}/post-meal`)).data;expect(state.attendance.find((r:{subjectId:string})=>r.subjectId===f.host.id)).toMatchObject({value:'unknown',source:null});
 });
 it('QA-POST-006 rating bounds and idempotent revisions retain one current rating',async()=>{
  const f=await fixture();const path=`/v1/meals/${f.m}/experience`;for(const score of[0,6,1.5])expect((await f.guest.b.request('PUT',path,{body:{score},headers:headers()})).statusCode).toBe(422);const key=randomUUID(),write=()=>f.guest.b.request('PUT',path,{body:{score:1},headers:headers('0',key)});expect((await write()).statusCode).toBe(200);expect((await write()).headers['idempotent-replay']).toBe('true');expect((await f.guest.b.request('PUT',path,{body:{score:5},headers:headers('1')})).statusCode).toBe(200);const state=json(await f.guest.b.request('GET',`/v1/meals/${f.m}/post-meal`)).data;expect(state.experience).toEqual({score:5,version:'2'});expect((await h.db.pool.query('SELECT score,revision FROM experience_revisions WHERE meal_id=$1 ORDER BY revision',[f.m])).rows).toEqual([{score:1,revision:'1'},{score:5,revision:'2'}]);
 });
 it('QA-CHAT-004 cancelled or completed meal still permits its current group members to send',async()=>{
  for(const cancelled of[false,true]){const f=await fixture();if(cancelled)await h.db.pool.query("UPDATE meals SET status='CANCELLED',cancel_reason='host' WHERE id=$1",[f.m]);const r=await send(f.guest.b,f.group,cancelled?'Cancelled coordination remains open.':'Completed coordination remains open.');expect(r.statusCode,r.body).toBe(201);}
 });
 it('QA-CHAT-005 sender-scoped client key never replays another conversation or changed body',async()=>{
  const f=await fixture(),key=randomUUID(),first=await send(f.host.b,f.group,'Original message',key);expect(first.statusCode,first.body).toBe(201);expect(json(await send(f.host.b,f.group,'Original message',key)).data.id).toBe(json(first).data.id);expect((await send(f.host.b,f.group,'Different message',key)).statusCode).toBe(409);
  const other=await fixture();await withTransaction(h.db.pool,tx=>joinConversation(tx,other.group,f.host.id,new Date()));
  const separate=await send(f.host.b,other.group,'Original message',key);expect(separate.statusCode,separate.body).toBe(409);expect(json(separate).error.code).toBe('IDEMPOTENCY_CONFLICT');expect(separate.body).not.toContain(json(first).data.id);expect(separate.body).not.toContain('Original message');expect((await h.db.pool.query('SELECT count(*)::int n FROM messages WHERE conversation_id=$1 AND client_message_id=$2',[other.group,key])).rows[0].n).toBe(0);expect((await send(f.host.b,other.group,'Other conversation payload',randomUUID())).statusCode).toBe(201);expect((await read(f.outsider.b,f.group)).statusCode).toBe(404);
 });
 it('QA-CHAT-007 block/unblock does not restore consent or disturb shared group permissions',async()=>{
  const f=await fixture();expect((await select(f.host.b,f.m,f.guest.id)).statusCode).toBe(200);expect((await select(f.guest.b,f.m,f.host.id)).statusCode).toBe(200);const get=()=>f.host.b.request('GET',`/v1/connections/${f.guest.id}/conversation`);const direct=json(await get()).data.id;expect((await send(f.host.b,direct,'Mutual history retained.')).statusCode).toBe(201);
  expect((await f.host.b.request('PUT',`/v1/blocks/${f.guest.id}`,{headers:headers()})).statusCode).toBe(200);expect((await f.host.b.request('DELETE',`/v1/blocks/${f.guest.id}`,{headers:headers('1')})).statusCode).toBe(200);expect(json(await get()).data.canSend).toBe(false);expect((await send(f.host.b,direct,'Not allowed after unblock.')).statusCode).toBe(403);expect((await send(f.guest.b,f.group,'Group unaffected by personal block.')).statusCode).toBe(201);
  const state=json(await f.host.b.request('GET',`/v1/meals/${f.m}/post-meal`)).data.reconnect.find((r:{subjectId:string})=>r.subjectId===f.guest.id);expect(json(await select(f.host.b,f.m,f.guest.id,state.version)).data.connection).toBe('WAITING');expect(json(await get()).data.canSend).toBe(false);const otherState=json(await f.guest.b.request('GET',`/v1/meals/${f.m}/post-meal`)).data.reconnect.find((r:{subjectId:string})=>r.subjectId===f.host.id);expect(json(await select(f.guest.b,f.m,f.host.id,otherState.version)).data.connection).toBe('OPEN');expect((await send(f.host.b,direct,'Fresh mutual consent works.')).statusCode).toBe(201);
 });
});

describe('QA independent seat/group separation',()=>{
 it('QA-CHAT-003 leave group preserves confirmed seat and dissolution is terminal',async()=>{
  const f=await fixture();expect((await send(f.host.b,f.group,'Before leaving group.')).statusCode).toBe(201);
  const left=await f.guest.b.request('POST',`/v1/conversations/${f.group}/leave`,{body:{confirm:true},headers:headers(await groupVersion(f.group))});expect(left.statusCode,left.body).toBe(200);
  expect((await h.db.pool.query("SELECT count(*)::int n FROM seat_events WHERE meal_id=$1 AND type='LEFT'",[f.m])).rows[0].n).toBe(0);expect((await h.db.pool.query('SELECT count(*)::int n FROM start_roster WHERE meal_id=$1',[f.m])).rows[0].n).toBe(2);
  const history=await read(f.guest.b,f.group);expect(history.statusCode,history.body).toBe(200);expect(json(history).data.map((m:{body:string})=>m.body)).toContain('Before leaving group.');expect((await read(f.guest.b,f.group,'LIVE')).statusCode).toBe(403);expect((await send(f.guest.b,f.group,'Cannot write after group leave.')).statusCode).toBe(403);
  const dissolved=await f.host.b.request('POST',`/v1/conversations/${f.group}/dissolve`,{body:{confirm:true},headers:headers(await groupVersion(f.group))});expect(dissolved.statusCode,dissolved.body).toBe(200);await expect(withTransaction(h.db.pool,tx=>joinConversation(tx,f.group,f.guest.id,new Date()))).rejects.toThrow();expect((await send(f.host.b,f.group,'Cannot reopen a dissolved group.')).statusCode).toBe(403);
 });
});

describe('QA independent hidden intervals and revocation ordering',()=>{
 it('QA-CHAT-002 small HISTORY and LIVE pages exclude hidden body author and counts without looping',async()=>{
  const f=await fixture();expect((await send(f.host.b,f.group,'M1 visible before leave')).statusCode).toBe(201);
  expect((await f.guest.b.request('POST',`/v1/conversations/${f.group}/leave`,{body:{confirm:true},headers:headers(await groupVersion(f.group))})).statusCode).toBe(200);
  await withTransaction(h.db.pool,tx=>joinConversation(tx,f.group,f.outsider.id,new Date()));expect((await send(f.outsider.b,f.group,'M2 hidden private gap')).statusCode).toBe(201);await withTransaction(h.db.pool,tx=>joinConversation(tx,f.group,f.guest.id,new Date()));expect((await send(f.host.b,f.group,'M3 visible after rejoin')).statusCode).toBe(201);
  for(const mode of['HISTORY','LIVE']){const bodies:string[]=[],cursors=new Set<string>();let cursor:string|undefined,completed=false,lastScan=0n;for(let i=0;i<10;i++){const r=await f.guest.b.request('GET',`/v1/conversations/${f.group}/messages?mode=${mode}&limit=1${cursor?'&cursor='+encodeURIComponent(cursor):''}`);expect(r.statusCode,r.body).toBe(200);expect(r.body).not.toContain('M2 hidden private gap');expect(r.body).not.toContain(f.outsider.id);const p=json(r);expect(p.page).not.toHaveProperty('totalCount');expect(p.page).not.toHaveProperty('hiddenCount');bodies.push(...p.data.map((m:{body:string})=>m.body));if(mode==='LIVE'){expect(BigInt(p.page.scannedThroughSeq)).toBeGreaterThan(lastScan);lastScan=BigInt(p.page.scannedThroughSeq);}if(!p.page.hasMore){completed=true;break;}expect(p.page.nextCursor).toBeTruthy();expect(cursors.has(p.page.nextCursor)).toBe(false);cursors.add(p.page.nextCursor);cursor=p.page.nextCursor;}
   expect(completed).toBe(true);expect(bodies.sort()).toEqual(['M1 visible before leave','M3 visible after rejoin']);}
  const inbox=await f.guest.b.request('GET','/v1/inbox');expect(inbox.body).not.toContain('M2 hidden private gap');expect(inbox.body).not.toContain(f.outsider.id);const row=json(inbox).data.find((i:{conversation?:{id:string}})=>i.conversation?.id===f.group);expect(row.unreadCount).toBe(2);expect(row.lastMessage.preview).toBe('M3 visible after rejoin');
 });
 it('QA-CHAT-006 real row-lock barrier serialises revoke versus send in both orders',async()=>{
  for(const first of['REVOKE','SEND']){const f=await fixture();await select(f.host.b,f.m,f.guest.id);await select(f.guest.b,f.m,f.host.id);const direct=json(await f.host.b.request('GET',`/v1/connections/${f.guest.id}/conversation`)).data.id;const holder=await h.db.pool.connect();
   try{await holder.query('BEGIN');await holder.query('SELECT id FROM user_pairs WHERE (low_user=$1 AND high_user=$2) OR (low_user=$2 AND high_user=$1) FOR UPDATE',[f.host.id,f.guest.id]);
    const revoke=()=>f.host.b.request('POST',`/v1/connections/${f.guest.id}/revoke`,{headers:headers('1')});const message=()=>send(f.guest.b,direct,'Race message '+first);const firstFlight=first==='REVOKE'?revoke():message();let waiting=false;
    for(let i=0;i<100;i++){if((await h.db.pool.query("SELECT count(*)::int n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query ILIKE '%user_pairs%'")).rows[0].n>0){waiting=true;break;}await new Promise(resolve=>setTimeout(resolve,5));}expect(waiting).toBe(true);const secondFlight=first==='REVOKE'?message():revoke();let both=false;
    for(let i=0;i<100;i++){if((await h.db.pool.query("SELECT count(*)::int n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'")).rows[0].n>=2){both=true;break;}await new Promise(resolve=>setTimeout(resolve,5));}expect(both).toBe(true);await holder.query('COMMIT');const a=await firstFlight,b=await secondFlight;expect(a.statusCode,a.body).toBe(first==='REVOKE'?200:201);expect(b.statusCode,b.body).toBe(first==='REVOKE'?403:200);expect((await send(f.guest.b,direct,'No send after committed revocation.')).statusCode).toBe(403);
    expect((await h.db.pool.query('SELECT count(*)::int n FROM messages WHERE conversation_id=$1',[direct])).rows[0].n).toBe(first==='REVOKE'?0:1);
    for(const[person,other]of[[f.host,f.guest],[f.guest,f.host]]){const state=json(await person.b.request('GET',`/v1/meals/${f.m}/post-meal`)).data.reconnect.find((r:{subjectId:string})=>r.subjectId===other.id);expect(state).toMatchObject({selected:false,connection:'CLOSED'});}
   }finally{await holder.query('ROLLBACK');holder.release();}
  }
 });
 it('QA-POST-007 outsider cancelled unknown and self review cannot manufacture qualification',async()=>{
  for(const condition of['outsider','unknown','cancelled']){const f=await fixture(condition!=='unknown');if(condition==='cancelled')await h.db.pool.query("UPDATE meals SET status='CANCELLED',cancel_reason='host' WHERE id=$1",[f.m]);const person=condition==='outsider'?f.outsider:f.guest,before=await snapshot(f.m);for(const[path,body]of[[`/v1/meals/${f.m}/experience`,{score:5}],[`/v1/meals/${f.m}/reviews/${f.host.id}`,{body:'Not a qualified public review.'}],[`/v1/meals/${f.m}/reconnect/${f.host.id}`,{selected:true}]]as const){const r=await person.b.request('PUT',path,{body,headers:headers()});expect([403,409],r.body).toContain(r.statusCode);}expect(await snapshot(f.m)).toEqual(before);}
  const f=await fixture();const r=await f.host.b.request('PUT',`/v1/meals/${f.m}/reviews/${f.host.id}`,{body:{body:'Self reference must not be accepted.'},headers:headers()});expect(r.statusCode,r.body).toBe(403);expect((await h.db.pool.query('SELECT count(*)::int n FROM public_review_revisions WHERE meal_id=$1',[f.m])).rows[0].n).toBe(0);
 });
});
