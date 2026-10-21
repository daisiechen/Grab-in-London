import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,inject,it} from 'vitest';
import {Browser,createHarness,json,type Harness} from '../apps/api/src/test/harness.ts';
let h:Harness;beforeAll(async()=>{h=await createHarness(inject('pgServerUrl'));});afterAll(async()=>{await h.close();});
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


it.each(['host','guest'] as const)('QA-F18 direct target public name is actor-relative for %s in conversation and Inbox',async side=>{
 const f=await fixture();for(const [person,name]of [[f.host,'QA Direct Host'],[f.guest,'QA Direct Guest']] as const)await h.db.pool.query('INSERT INTO profiles(user_id,display_name,bio) VALUES($1,$2,$3)',[person.id,name,'Synthetic public introduction for independent direct title QA.']);
 await present(f);expect((await choice(f.host.b,f.mealId,f.guest.id)).statusCode).toBe(200);expect((await choice(f.guest.b,f.mealId,f.host.id)).statusCode).toBe(200);
 const viewer=f[side],peer=side==='host'?f.guest:f.host,expected=side==='host'?'QA Direct Guest':'QA Direct Host';
 const response=await viewer.b.request('GET',`/v1/connections/${peer.id}/conversation`);expect(response.statusCode,response.body).toBe(200);const c=json(response).data;expect(c.kind).toBe('DIRECT');expect(c.title).toBe(expected);
 const inbox=await viewer.b.request('GET','/v1/inbox');expect(inbox.statusCode,inbox.body).toBe(200);expect(json(inbox).data.find((item:{conversation?:{id:string}})=>item.conversation?.id===c.id).conversation.title).toBe(expected);
 const outsider=await f.outsider.b.request('GET',`/v1/connections/${peer.id}/conversation`);expect(outsider.statusCode).toBe(404);
});
