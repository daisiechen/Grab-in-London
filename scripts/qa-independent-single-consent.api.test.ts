/** QA-CHAT-011: one-sided selection cannot alter the other member public/private projections or staff sources. */
import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,inject,it} from 'vitest';
import {Browser,createHarness,json,type Harness} from '../apps/api/src/test/harness.ts';
import {withTransaction} from '../apps/api/src/common/transaction.ts';
import {lockConnection,selectPair} from '../apps/api/src/connections/service.ts';
import {createGroupConversation,joinConversation} from '../apps/api/src/membership/intervals.ts';
import {sealSourceSnapshot} from '../apps/api/src/admin/snapshots.ts';
let h:Harness;beforeAll(async()=>{h=await createHarness(inject('pgServerUrl'));});afterAll(async()=>h.close());
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

it('QA-CHAT-011 uncommitted rolled-back and committed one-sided consent reveal no recipient signal',async()=>{
 const f=await fixture();
 for(const member of[f.host,f.guest]){const profile=await member.b.request('PATCH','/v1/me',{headers:headers('1'),body:{displayName:'QA consenting member',bio:'Synthetic privacy projection fixture with no real customer data.',languages:['en'],lifeStatus:'NEW_TO_LONDON',interests:['FOOD'],ageConfirmedVersion:'2026-10-21',communityAcceptedVersion:'2026-10-21'}});expect(profile.statusCode,profile.body).toBe(200);}

 const projection=async()=>{
  const post=await f.guest.b.request('GET',`/v1/meals/${f.m}/post-meal`),profile=await f.guest.b.request('GET',`/v1/profiles/${f.host.id}`),inbox=await f.guest.b.request('GET','/v1/inbox');
  expect(post.statusCode,post.body).toBe(200);expect(profile.statusCode,profile.body).toBe(200);expect(inbox.statusCode,inbox.body).toBe(200);
  return{post:json(post).data,profile:json(profile).data,inbox:json(inbox).data};
 };
 const before=await projection(),counts=async()=>({notes:Number((await h.db.pool.query('SELECT count(*) n FROM notifications')).rows[0].n),outbox:Number((await h.db.pool.query('SELECT count(*) n FROM outbox')).rows[0].n)}),beforeCounts=await counts();
 let mutated!:()=>void,release!:()=>void;const reached=new Promise<void>(r=>{mutated=r;}),gate=new Promise<void>(r=>{release=r;});
 const pending=withTransaction(h.db.pool,async tx=>{const{pair,now}=await lockConnection(tx,f.host.id,f.guest.id,[f.m]);const result=await selectPair(tx,pair,f.host.id,f.guest.id,f.m,true,'0',now);expect(result.connection).toBe('WAITING');mutated();await gate;throw new Error('QA controlled rollback');});
 const observed=pending.catch(error=>{expect(error.message).toBe('QA controlled rollback');});
 try{await reached;expect(await projection()).toEqual(before);}finally{release();await observed;}
 expect((await h.db.pool.query('SELECT count(*)::int n FROM pair_consents')).rows[0].n).toBe(0);expect(await projection()).toEqual(before);
 const selected=await f.host.b.request('PUT',`/v1/meals/${f.m}/reconnect/${f.guest.id}`,{body:{selected:true},headers:headers()});expect(selected.statusCode,selected.body).toBe(200);expect(json(selected).data).toMatchObject({selected:true,connection:'WAITING'});
 expect(await projection()).toEqual(before);expect(await counts()).toEqual(beforeCounts);
 expect((await f.guest.b.request('GET',`/v1/connections/${f.host.id}/conversation`)).statusCode).toBe(404);
 const own=json(await f.host.b.request('GET',`/v1/meals/${f.m}/post-meal`)).data.reconnect.find((r:{subjectId:string})=>r.subjectId===f.guest.id);expect(own).toMatchObject({selected:true,connection:'WAITING'});
 const analyst=await actor();await h.db.pool.query("INSERT INTO roles(user_id,role,granted_by) VALUES($1,'analyst','qa')",[analyst.id]);await h.db.pool.query("UPDATE session_families SET amr=ARRAY['mfa'] WHERE user_id=$1",[analyst.id]);
 const snapshot=await sealSourceSnapshot(h.db.pool,new Date('2026-01-01'));
 const pairId=(await h.db.pool.query('SELECT pair_id FROM pair_consents WHERE user_id=$1',[f.host.id])).rows[0].pair_id as string;
 const facts=JSON.stringify((await h.db.pool.query('SELECT kind,facts FROM analytics_snapshot_facts WHERE snapshot_id=$1',[snapshot])).rows);expect(facts).not.toContain(pairId);expect(facts).not.toContain('"selected"');expect(facts).not.toContain('"pair_consents"');
 const supply=await analyst.b.request('GET',`/v1/admin/supply?snapshotId=${snapshot}`);expect(supply.statusCode,supply.body).toBe(200);
 const drill=await analyst.b.request('GET',`/v1/admin/drilldowns/meals?snapshotId=${snapshot}&filterHash=${json(supply).data.filterHash}`);expect(drill.statusCode,drill.body).toBe(200);expect(json(drill).data.length).toBeGreaterThan(0);
 for(const response of[supply,drill]){expect(response.body).not.toContain(pairId);expect(response.body).not.toContain('"selected"');expect(response.body).not.toContain('"reconnect"');}
 expect(await counts()).toEqual(beforeCounts);
});
