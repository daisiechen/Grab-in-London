import {randomBytes,randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,inject,it} from 'vitest';
import {Browser,createHarness,json,type Harness} from '../test/harness.ts';
import {withTransaction} from '../common/transaction.ts';
import {createGroupConversation} from '../membership/intervals.ts';
let h:Harness;
beforeAll(async()=>{h=await createHarness(inject('pgServerUrl'));});afterAll(async()=>{await h.close();});
async function actor(){const b=new Browser(h);const {body}=await b.signInWithEmail(`${randomUUID()}@example.invalid`);return {b,id:body.data.session.user.id as string};}
async function fixture(endAgoMs=3_600_000){
 const host=await actor(),guest=await actor(),outsider=await actor();const end=new Date(Date.now()-endAgoMs),start=new Date(end.getTime()-2*3_600_000),close=new Date(start.getTime()-3_600_000);
 const {rows:[venue]}=await h.db.pool.query(`INSERT INTO venues(place_id,provider) VALUES($1,'fixture') RETURNING id`,[`fixture_${randomUUID().replaceAll('-','')}`]);
 const {rows:[m]}=await h.db.pool.query(`INSERT INTO meals(host_id,venue_ref,title,description,starts_at,closes_at,scheduled_end_at,start_local_date,start_local_time,start_offset,close_local_date,close_local_time,close_offset,minimum,capacity,budget_min_pence,budget_max_pence,languages,mood,booking_mode,terms_version,attempt_id,status) VALUES($1,$2,'A finished fixture','This is a completed meal fixture description',$3,$4,$5,'2026-10-20','12:00',60,'2026-10-20','11:00',60,2,4,1000,2000,ARRAY['en'],'EASY_CONVERSATION','EXTERNAL_PAY_AT_VENUE','2026-10-21',$6,'COMPLETED') RETURNING id`,[host.id,venue.id,start,close,end,randomUUID()]);const mealId=m.id as string;
 for(const [index,user] of [host,guest].entries()){
  await h.db.pool.query(`INSERT INTO seat_events(meal_id,seq,user_id,type,effective_at,command_id) VALUES($1,$2,$3,$4,$5,$6)`,[mealId,index+1,user.id,index===0?'HOST_CONFIRMED':'GUEST_CONFIRMED',new Date(close.getTime()-60_000),randomUUID()]);
  await h.db.pool.query(`INSERT INTO start_roster(meal_id,user_id,source_revision_hash,starts_at) VALUES($1,$2,'fixture',$3)`,[mealId,user.id,start]);
 }
 await h.db.pool.query(`UPDATE meals SET head=2 WHERE id=$1`,[mealId]);return {host,guest,outsider,mealId,end};
}
const write=(b:Browser,method:string,path:string,body:unknown,version='0')=>b.request(method,path,{...(body===undefined?{}:{body}),headers:{'idempotency-key':randomUUID(),'if-match':`"${version}"`}});
const attendance=(b:Browser,mealId:string,subject:string,value='present',version='0')=>write(b,'PUT',`/v1/meals/${mealId}/attendance/${subject}`,{value},version);
const choice=(b:Browser,mealId:string,subject:string,selected=true,version='0')=>write(b,'PUT',`/v1/meals/${mealId}/reconnect/${subject}`,{selected},version);
async function present(f:Awaited<ReturnType<typeof fixture>>){expect((await attendance(f.host.b,f.mealId,f.host.id)).statusCode).toBe(200);expect((await attendance(f.guest.b,f.mealId,f.guest.id)).statusCode).toBe(200);}


async function connected(){
 const f=await fixture();
 await h.db.pool.query(`INSERT INTO profiles(user_id,display_name) VALUES($1,'Host Public Name'),($2,'Guest Public Name')`,[f.host.id,f.guest.id]);
 await present(f);await choice(f.host.b,f.mealId,f.guest.id);await choice(f.guest.b,f.mealId,f.host.id);
 const hostDetail=await f.host.b.request('GET',`/v1/connections/${f.guest.id}/conversation`);expect(hostDetail.statusCode,hostDetail.body).toBe(200);
 return {...f,directId:json(hostDetail).data.id as string};
}
const inboxTitle=async(b:Browser,id:string)=>{
 const result=await b.request('GET','/v1/inbox');expect(result.statusCode,result.body).toBe(200);
 return json(result).data.find((row:{conversation?:{id:string}})=>row.conversation?.id===id)?.conversation;
};
it('DIRECT inbox title names the current actor peer and matches detail in both directions after sending and reloading',async()=>{
 const f=await connected();
 for(const [self,peer,name] of [[f.host,f.guest,'Guest Public Name'],[f.guest,f.host,'Host Public Name']] as const){
  const detail=await self.b.request('GET',`/v1/connections/${peer.id}/conversation`);expect(json(detail).data.title).toBe(name);
  expect(await inboxTitle(self.b,f.directId)).toMatchObject({kind:'DIRECT',title:name,canSend:true});
  const message=await self.b.request('POST',`/v1/conversations/${f.directId}/messages`,{body:{body:'A synthetic direct hello.',clientMessageId:randomUUID()}});expect(message.statusCode,message.body).toBe(201);
  expect((await inboxTitle(self.b,f.directId)).title).toBe(name);
 }
});
it('anonymous and outsider clients cannot discover peers or a DIRECT history',async()=>{
 const f=await connected(),anonymous=new Browser(h);
 expect((await anonymous.request('GET','/v1/inbox')).statusCode).toBe(401);
 for(const b of [anonymous,f.outsider.b]){
  const detail=await b.request('GET',`/v1/connections/${f.guest.id}/conversation`),history=await b.request('GET',`/v1/conversations/${f.directId}/messages?mode=HISTORY`);
  expect(detail.statusCode).toBe(b===anonymous?401:404);expect(history.statusCode).toBe(b===anonymous?401:404);
  for(const result of [detail,history]){expect(result.body).not.toContain('Guest Public Name');expect(result.body).not.toContain('Host Public Name');}
 }
 const inbox=await f.outsider.b.request('GET','/v1/inbox');expect(inbox.body).not.toContain('Guest Public Name');expect(inbox.body).not.toContain('Host Public Name');
});
it('accepted peer deletion masks a still-present profile immediately and preserves the same read-only history fallback after purge status',async()=>{
 const f=await connected();
 const removed=await f.guest.b.request('POST','/v1/me/deletion',{body:{confirm:true,receiptToken:randomBytes(32).toString('base64url')},headers:{'idempotency-key':randomUUID(),'if-match':'"1"'}});expect(removed.statusCode,removed.body).toBe(202);
 expect((await h.db.pool.query(`SELECT display_name FROM profiles WHERE user_id=$1`,[f.guest.id])).rows[0].display_name).toBe('Guest Public Name');
 for(const status of ['DELETING','DELETED']){
  if(status==='DELETED')await h.db.pool.query(`UPDATE users SET status='DELETED' WHERE id=$1`,[f.guest.id]);
  const inbox=await inboxTitle(f.host.b,f.directId),detail=await f.host.b.request('GET',`/v1/connections/${f.guest.id}/conversation`);
  expect(inbox).toMatchObject({title:'Deleted member',canSend:false});expect(json(detail).data).toMatchObject({title:'Deleted member',canSend:false});expect(JSON.stringify(inbox)).not.toContain('Guest Public Name');
 }
});
it('GROUP continues to use its meal title and DIRECT title never contains private contact fields',async()=>{
 const f=await connected();const group=await withTransaction(h.db.pool,tx=>createGroupConversation(tx,{mealId:f.mealId,hostId:f.host.id,effectiveAt:new Date()}));
 expect(await inboxTitle(f.host.b,group.conversationId)).toMatchObject({kind:'GROUP',title:'A finished fixture'});
 const {rows:[contact]}=await h.db.pool.query(`SELECT email FROM private_contact WHERE user_id=$1`,[f.guest.id]);
 const inbox=await f.host.b.request('GET','/v1/inbox');expect(inbox.body).not.toContain(contact.email);
});
