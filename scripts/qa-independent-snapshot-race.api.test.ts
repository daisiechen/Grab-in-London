/** QA-PRIVACY-006: pause the real RR source transaction before its privacy lock, commit deletion, then resume old SQL. */
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,inject,it} from 'vitest';
import {Browser,createHarness,json,type Harness} from '../apps/api/src/test/harness.ts';
import {sealSourceSnapshot} from '../apps/api/src/admin/snapshots.ts';
let h:Harness;beforeAll(async()=>{h=await createHarness(inject('pgServerUrl'));});afterAll(async()=>h.close());
const headers=(version?:string,key=randomUUID())=>({'idempotency-key':key,...(version?{'if-match':`"${version}"`}:{})});
async function actor(){const b=new Browser(h);const {body}=await b.signInWithEmail(`${randomUUID()}@example.invalid`);const id=body.data.session.user.id as string;const r=await b.request('PATCH','/v1/me',{body:{displayName:'QA Round Two',bio:'Synthetic isolated QA profile for concurrent safety checks.',languages:['en'],lifeStatus:'NEW_TO_LONDON',interests:['FOOD'],ageConfirmedVersion:'2026-10-21',communityAcceptedVersion:'2026-10-21'},headers:headers('1')});expect(r.statusCode,r.body).toBe(200);return{b,id};}
async function meal(b:Browser,capacity=4){const venue=await b.request('POST','/v1/venues/confirm',{body:{placeId:'fixture_fancy_north'},headers:headers()});expect(venue.statusCode,venue.body).toBe(200);const r=await b.request('POST','/v1/meals',{body:{venueRef:json(venue).data.venueRef,title:'QA concurrency isolated table',description:'Synthetic table with no external restaurant or customer activity.',start:{localDate:'2030-10-23',localTime:'18:00',timeZone:'Europe/London',utcOffsetMinutes:60},close:{localDate:'2030-10-23',localTime:'17:00',timeZone:'Europe/London',utcOffsetMinutes:60},minimum:2,capacity,budgetMinPence:2000,budgetMaxPence:3500,languages:['en'],mood:'EASY_CONVERSATION',bookingMode:'EXTERNAL_PAY_AT_VENUE',attemptId:randomUUID(),bookingDeclarationConfirmed:true,reviewConfirmed:true,termsVersion:'2026-10-21'},headers:headers()});expect(r.statusCode,r.body).toBe(201);return json(r).data;}
const apply=(b:Browser,id:string,key=randomUUID(),message='Independent synthetic application for QA.')=>b.request('POST',`/v1/meals/${id}/applications`,{body:{message},headers:headers(undefined,key)});
const approve=(b:Browser,id:string)=>b.request('POST',`/v1/applications/${id}/decision`,{body:{decision:'APPROVE'},headers:headers('1')});
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

it('QA-PRIVACY-006 old MVCC build cannot seal after a committed deletion; fresh build excludes the deleted subject',async()=>{
 const a=await actor(),other=await actor();await meal(a.b);const joined=await meal(other.b),pending=await meal(other.b);
 const application=await apply(a.b,joined.id);expect(application.statusCode,application.body).toBe(201);expect((await approve(other.b,json(application).data.id)).statusCode).toBe(200);expect((await apply(a.b,pending.id)).statusCode).toBe(201);
 const historical=await history(other.id,a.id,true);
 let paused=false,oldEpoch='',release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
 const wrapped=new Proxy(h.db.pool,{get(target,key){if(key==='connect')return async()=>{
  const client=await target.connect();return new Proxy(client,{get(c,k){if(k==='query')return async(...args:unknown[])=>{if(typeof args[0]==='string'&&args[0].includes('FROM privacy_control')&&args[0].includes('FOR SHARE')){oldEpoch=(await c.query('SELECT epoch::text FROM privacy_control WHERE id=1')).rows[0].epoch;paused=true;await gate;}return Reflect.apply(c.query,c,args);};const v=Reflect.get(c,k);return typeof v==='function'?v.bind(c):v;}});
 };const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});
 const before=Number((await h.db.pool.query('SELECT count(*) n FROM analytics_snapshots')).rows[0].n);
 const old=sealSourceSnapshot(wrapped,new Date('2026-01-01')).then(value=>({value,error:null}),error=>({value:null,error}));
 try{
  const end=Date.now()+5000;while(!paused){if(Date.now()>end)throw Error('RR transaction failed to reach privacy barrier');await new Promise<void>(r=>setImmediate(r));}
  const deletion=await a.b.request('POST','/v1/me/deletion',{headers:headers('2'),body:{confirm:true,receiptToken:randomBytes(32).toString('base64url')}});expect(deletion.statusCode,deletion.body).toBe(202);expect(BigInt((await h.db.pool.query('SELECT epoch::text FROM privacy_control WHERE id=1')).rows[0].epoch)).toBeGreaterThan(BigInt(oldEpoch));
 }finally{release();}
 const outcome=await old;expect(outcome.value).toBeNull();expect(outcome.error).toMatchObject({code:'40001'});
 expect(Number((await h.db.pool.query('SELECT count(*) n FROM analytics_snapshots')).rows[0].n)).toBe(before);
 const fresh=await sealSourceSnapshot(h.db.pool,new Date('2026-01-01'));
 expect((await h.db.pool.query('SELECT user_id FROM analytics_snapshot_subjects WHERE snapshot_id=$1 AND user_id=$2',[fresh,a.id])).rows).toHaveLength(0);
 const facts=(await h.db.pool.query("SELECT kind,facts FROM analytics_snapshot_facts WHERE snapshot_id=$1 AND kind=ANY($2::text[])",[fresh,['users','applications','seats','attendance','experiences','rosters']])).rows;expect(facts).toHaveLength(6);for(const row of facts)expect(JSON.stringify(row.facts)).not.toContain(a.id);
 expect((await new Browser(h).request('GET',`/v1/profiles/${a.id}`)).statusCode).toBe(404);expect((await a.b.request('GET','/v1/auth/session')).statusCode).toBe(401);
 expect((await h.db.pool.query('SELECT user_id FROM start_roster WHERE meal_id=$1 AND user_id=$2',[historical.id,a.id])).rows).toHaveLength(1);
});

it('QA-PRIVACY-005 deleting a subject revokes every S0 data surface and E0 download while retained downloaded bytes remain local',async()=>{
 const a=await actor(),other=await actor(),staff=await actor();await meal(a.b);const joined=await meal(other.b),pending=await meal(other.b);const app=await apply(a.b,joined.id);expect((await approve(other.b,json(app).data.id)).statusCode).toBe(200);expect((await apply(a.b,pending.id)).statusCode).toBe(201);await history(other.id,a.id,true);
 await h.db.pool.query("INSERT INTO roles(user_id,role,granted_by) VALUES($1,'analyst','qa')",[staff.id]);await h.db.pool.query("UPDATE session_families SET amr=ARRAY['mfa'] WHERE user_id=$1",[staff.id]);
 const snapshot=await sealSourceSnapshot(h.db.pool,new Date('2026-01-01'));
 const supply=await staff.b.request('GET',`/v1/admin/supply?snapshotId=${snapshot}`);expect(supply.statusCode,supply.body).toBe(200);const filterHash=json(supply).data.filterHash as string;
 const first=await staff.b.request('GET',`/v1/admin/drilldowns/meals?snapshotId=${snapshot}&filterHash=${filterHash}&limit=1`);expect(first.statusCode,first.body).toBe(200);const cursor=json(first).page.nextCursor;expect(typeof cursor).toBe('string');
 const exported=await staff.b.request('POST','/v1/admin/exports',{headers:headers(),body:{snapshotId:snapshot,metric:'formation',filters:{}}});expect(exported.statusCode,exported.body).toBe(201);const id=json(exported).data.exportId as string;
 expect(Date.parse(json(exported).data.expiresAt)-Date.now()).toBeLessThanOrEqual(900000);
 const csv=await staff.b.request('GET',`/v1/admin/exports/${id}`);expect(csv.statusCode,csv.body).toBe(200);expect(csv.headers['cache-control']).toBe('private, no-store');
 const downloaded=Buffer.from(csv.body),digest=createHash('sha256').update(downloaded).digest('hex');expect(downloaded.toString()).toContain(snapshot);
 expect((await new Browser(h).request('GET',`/v1/admin/exports/${id}`)).statusCode).toBe(401);
 const deletion=await a.b.request('POST','/v1/me/deletion',{headers:headers('2'),body:{confirm:true,receiptToken:randomBytes(32).toString('base64url')}});expect(deletion.statusCode,deletion.body).toBe(202);
 for(const page of['overview','journey','supply','retention','quality']){const r=await staff.b.request('GET',`/v1/admin/${page}?snapshotId=${snapshot}`);expect(r.statusCode,r.body).toBe(410);expect(json(r).error.code).toBe('SNAPSHOT_REVOKED');}
 for(const url of[`/v1/admin/drilldowns/meals?snapshotId=${snapshot}&filterHash=${filterHash}&limit=1`,`/v1/admin/drilldowns/meals?snapshotId=${snapshot}&filterHash=${filterHash}&limit=1&cursor=${encodeURIComponent(cursor)}`,`/v1/admin/exports/${id}`]){const r=await staff.b.request('GET',url);expect(r.statusCode,r.body).toBe(410);}
 const retry=await staff.b.request('POST','/v1/admin/exports',{headers:headers(),body:{snapshotId:snapshot,metric:'formation',filters:{}}});expect(retry.statusCode,retry.body).toBe(410);
 expect(createHash('sha256').update(downloaded).digest('hex')).toBe(digest);expect(downloaded.toString()).toContain(snapshot);
});
