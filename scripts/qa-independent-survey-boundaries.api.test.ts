import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,inject,it} from 'vitest';
import {Browser,createHarness,json,type Harness} from '../apps/api/src/test/harness.ts';
let h:Harness;
beforeAll(async()=>{h=await createHarness(inject('pgServerUrl'));});afterAll(async()=>{await h.close();});
async function actor(){const b=new Browser(h);const a=await b.signInWithEmail(`${randomUUID()}@example.invalid`);return {b,id:a.body.data.session.user.id as string};}
const put=(b:Browser,body:unknown,v='0')=>b.request('PUT','/v1/me/product-survey',{body,headers:{'if-match':`"${v}"`,'idempotency-key':randomUUID()}});
it('QA-SURVEY-001 no attendance: blank rejected and company-only stays unanswered',async()=>{
 const a=await actor();expect((await h.db.pool.query('SELECT count(*)::int n FROM attendance_revisions WHERE subject_id=$1',[a.id])).rows[0].n).toBe(0);
 expect(json(await a.b.request('GET','/v1/me/product-survey')).data).toEqual({version:'0',again:null,reasons:[],submittedAt:null});
 expect((await put(a.b,{again:null,reasons:[]})).statusCode).toBe(422);
 expect((await h.db.pool.query('SELECT count(*)::int n FROM product_surveys WHERE user_id=$1',[a.id])).rows[0].n).toBe(0);
 const saved=await put(a.b,{again:null,reasons:['company']});expect(saved.statusCode).toBe(200);expect(json(saved).data).toMatchObject({version:'1',again:null,reasons:['company']});
 expect(json(await a.b.request('GET','/v1/me/product-survey')).data).toMatchObject({again:null,reasons:['company']});
});
it('QA-SURVEY-002 explicit false differs from cleared null; only seven unique factors accepted',async()=>{
 const a=await actor();expect((await put(a.b,{again:false,reasons:[]})).statusCode).toBe(200);expect(json(await a.b.request('GET','/v1/me/product-survey')).data.again).toBe(false);
 expect((await put(a.b,{again:null,reasons:['cost']},'1')).statusCode).toBe(200);expect(json(await a.b.request('GET','/v1/me/product-survey')).data).toMatchObject({again:null,reasons:['cost'],version:'2'});
 for(const reasons of [['cost','cost'],['allergy_safety'],['Company'],['']])expect((await put(a.b,{again:true,reasons},'2')).statusCode).toBe(422);
 const reasons=['company','conversation','coordination','expectations','venue','cost','other'];const all=await put(a.b,{again:true,reasons},'2');expect(all.statusCode,all.body).toBe(200);expect(json(all).data.reasons).toEqual(reasons);
 const rows=(await h.db.pool.query('SELECT again,reasons FROM product_surveys WHERE user_id=$1 ORDER BY version',[a.id])).rows;expect(rows).toEqual([{again:false,reasons:[]},{again:null,reasons:['cost']},{again:true,reasons}]);
});
it('QA-SURVEY-003 product survey works beyond meal window and never migrates or modifies score',async()=>{
 const a=await actor(),host=await actor(),end=new Date(Date.now()-8*86400_000),start=new Date(end.getTime()-7200_000),close=new Date(start.getTime()-3600_000);
 const {rows:[v]}=await h.db.pool.query(`INSERT INTO venues(place_id,provider) VALUES($1,'fixture') RETURNING id`,[`fixture_${randomUUID().replaceAll('-','')}`]);
 const {rows:[m]}=await h.db.pool.query(`INSERT INTO meals(host_id,venue_ref,title,description,starts_at,closes_at,scheduled_end_at,start_local_date,start_local_time,start_offset,close_local_date,close_local_time,close_offset,minimum,capacity,budget_min_pence,budget_max_pence,languages,mood,booking_mode,terms_version,attempt_id,status) VALUES($1,$2,'Old questionnaire fixture','Synthetic old meal solely for independent questionnaire boundary',$3,$4,$5,'2026-10-12','12:00',60,'2026-10-12','11:00',60,2,4,1000,2000,ARRAY['en'],'EASY_CONVERSATION','EXTERNAL_PAY_AT_VENUE','2026-10-21',$6,'COMPLETED') RETURNING id`,[host.id,v.id,start,close,end,randomUUID()]);
 for(const [index,person]of [host,a].entries())await h.db.pool.query(`INSERT INTO seat_events(meal_id,seq,user_id,type,effective_at,command_id) VALUES($1,$2,$3,$4,$5,$6)`,[m.id,index+1,person.id,index===0?'HOST_CONFIRMED':'GUEST_CONFIRMED',new Date(close.getTime()-60000),randomUUID()]);
 await h.db.pool.query('UPDATE meals SET head=2 WHERE id=$1',[m.id]);
 await h.db.pool.query(`INSERT INTO start_roster(meal_id,user_id,source_revision_hash,starts_at) VALUES($1,$2,'qa-old-fixture',$3)`,[m.id,a.id,start]);
 await h.db.pool.query(`INSERT INTO attendance_revisions(meal_id,subject_id,source,value,version,actor_id,created_at) VALUES($1,$2,'SELF','present',1,$2,$3)`,[m.id,a.id,end]);
 await h.db.pool.query(`INSERT INTO experience_revisions(meal_id,user_id,score,revision,created_at) VALUES($1,$2,5,1,$3)`,[m.id,a.id,end]);
 expect(json(await a.b.request('GET','/v1/me/product-survey')).data).toMatchObject({again:null,version:'0'});
 const score=await a.b.request('PUT',`/v1/meals/${m.id}/experience`,{body:{score:1},headers:{'if-match':'"1"','idempotency-key':randomUUID()}});expect(score.statusCode,score.body).toBe(409);
 const saved=await put(a.b,{again:false,reasons:['cost']});expect(saved.statusCode,saved.body).toBe(200);
 expect((await put(a.b,{again:true,reasons:[],mealId:m.id},'1')).statusCode).toBe(422);
 expect((await h.db.pool.query('SELECT score,revision FROM experience_revisions WHERE meal_id=$1 AND user_id=$2',[m.id,a.id])).rows).toEqual([{score:5,revision:'1'}]);
 expect(json(await a.b.request('GET','/v1/me/product-survey')).data).toMatchObject({again:false,version:'1',reasons:['cost']});
 const post=await a.b.request('GET',`/v1/meals/${m.id}/post-meal`);expect(post.statusCode,post.body).toBe(200);const state=json(post).data;expect(state.windowOpen).toBe(false);expect(state.experience).toEqual({score:5,version:'1'});expect(state).not.toHaveProperty('again');expect(state).not.toHaveProperty('reasons');
});
