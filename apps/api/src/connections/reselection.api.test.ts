import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,inject,it} from 'vitest';
import {Browser,createHarness,json,type Harness} from '../test/harness.ts';
let h:Harness;beforeAll(async()=>{h=await createHarness(inject('pgServerUrl'));});afterAll(async()=>h.close());
async function actor(){const b=new Browser(h),r=await b.signInWithEmail(`${randomUUID()}@example.invalid`);return{b,id:r.body.data.session.user.id as string};}
async function meal(host:string,guest:string){const venue=(await h.db.pool.query(`INSERT INTO venues(place_id,provider) VALUES($1,'fixture') RETURNING id`,[`fixture_${randomUUID().replaceAll('-','')}`])).rows[0].id;
 const end=new Date(Date.now()-3600000),start=new Date(+end-7200000),close=new Date(+start-3600000);const id=(await h.db.pool.query(`INSERT INTO meals(host_id,venue_ref,title,description,starts_at,closes_at,scheduled_end_at,start_local_date,start_local_time,start_offset,close_local_date,close_local_time,close_offset,minimum,capacity,budget_min_pence,budget_max_pence,languages,mood,booking_mode,terms_version,attempt_id,status,head) VALUES($1,$2,'Finished synthetic meal','A completed synthetic meal for reselection',$3,$4,$5,'2026-10-20','12:00',60,'2026-10-20','11:00',60,2,4,1000,2000,ARRAY['en'],'EASY_CONVERSATION','EXTERNAL_PAY_AT_VENUE','2026-10-21',$6,'COMPLETED',2) RETURNING id`,[host,venue,start,close,end,randomUUID()])).rows[0].id as string;
 for(const [index,user] of [host,guest].entries()){await h.db.pool.query(`INSERT INTO seat_events(meal_id,seq,user_id,type,effective_at,command_id) VALUES($1,$2,$3,$4,$5,$6)`,[id,index+1,user,index===0?'HOST_CONFIRMED':'GUEST_CONFIRMED',new Date(+close-60000),randomUUID()]);await h.db.pool.query(`INSERT INTO start_roster(meal_id,user_id,source_revision_hash,starts_at) VALUES($1,$2,'reselection-fixture',$3)`,[id,user,start]);}return id;}
const write=(b:Browser,method:string,path:string,body:unknown,version='0')=>b.request(method,path,{...(body===undefined?{}:{body}),headers:{'idempotency-key':randomUUID(),'if-match':`"${version}"`}});
async function present(a:Awaited<ReturnType<typeof actor>>,mealId:string){const r=await write(a.b,'PUT',`/v1/meals/${mealId}/attendance/${a.id}`,{value:'present'});expect(r.statusCode,r.body).toBe(200);}
async function state(b:Browser,id:string,other:string){const r=await b.request('GET',`/v1/meals/${id}/post-meal`);expect(r.statusCode,r.body).toBe(200);return json(r).data.reconnect.find((x:{subjectId:string})=>x.subjectId===other);}
it('reselects the same pair on a new shared meal after withdrawal, block and unblock without reviving old consent',async()=>{
 const a=await actor(),b=await actor(),m1=await meal(a.id,b.id);await present(a,m1);await present(b,m1);
 for(const [who,other] of [[a,b],[b,a]] as const){const r=await write(who.b,'PUT',`/v1/meals/${m1}/reconnect/${other.id}`,{selected:true});expect(r.statusCode,r.body).toBe(200);}
 const before=await state(a.b,m1,b.id);expect(before.connection).toBe('OPEN');
 const revoke=await write(a.b,'POST',`/v1/connections/${b.id}/revoke`,undefined,before.version);expect(revoke.statusCode,revoke.body).toBe(200);
 expect((await write(a.b,'PUT',`/v1/blocks/${b.id}`,undefined)).statusCode).toBe(200);expect((await write(a.b,'DELETE',`/v1/blocks/${b.id}`,undefined,'1')).statusCode).toBe(200);
 const pair=(await h.db.pool.query(`SELECT * FROM user_pairs WHERE low_user=$1 AND high_user=$2`,[[a.id,b.id].sort()[0],[a.id,b.id].sort()[1]])).rows[0];expect(pair.consent_epoch).toBe('3');expect((await h.db.pool.query(`SELECT * FROM pair_consents WHERE pair_id=$1 AND revoked_at IS NULL`,[pair.id])).rows).toHaveLength(0);
 const m5=await meal(a.id,b.id);await present(a,m5);await present(b,m5);
 for(const [who,other] of [[a,b],[b,a]] as const){const current=await state(who.b,m5,other.id);const r=await write(who.b,'PUT',`/v1/meals/${m5}/reconnect/${other.id}`,{selected:true},current.version);expect(r.statusCode,r.body).toBe(200);}
 expect((await state(a.b,m5,b.id)).connection).toBe('OPEN');expect((await h.db.pool.query(`SELECT * FROM pair_consents WHERE pair_id=$1 AND epoch=3 AND basis_meal_id=$2 AND revoked_at IS NULL`,[pair.id,m5])).rows).toHaveLength(2);
});
