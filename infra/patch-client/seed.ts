/** Synthetic browser journey fixtures, confined to the running P1.1 rig's proven owned DB. */
import {readFile,writeFile,realpath} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createPool} from '../../packages/db/src/index.ts';
import {createApiClient} from '../../packages/client/src/http.ts';
import {assertPatchEnvironment} from './isolation.ts';
const root=await realpath(resolve(import.meta.dirname,'../..'));
assertPatchEnvironment(process.env,root);
const tmp=await realpath(process.env.TMPDIR!);
const m=JSON.parse(await readFile(resolve(tmp,'manifest.json'),'utf8'));
if(m.root!==root||m.mode!=='synthetic'||m.apiOrigin!=='http://127.0.0.1:64176'||m.webOrigin!=='http://p11-client.localhost:64174'||!/^fancy_test_[a-f0-9]+$/.test(m.database))throw Error('WRONG_CLIENT_RIG');
const owner=JSON.parse(await readFile(resolve(m.pg.root,'fancy-owner.json'),'utf8'));
if(!m.pg.root.startsWith(tmp+'/')||owner.id!==m.pg.id||owner.pid!==m.pg.pid)throw Error('PG_OWNERSHIP_MISMATCH');
const pool=createPool(`postgres://fancy@127.0.0.1:${owner.port}/${m.database}`);
const nativeFetch=globalThis.fetch;
function actor(email:string){
 const cookies=new Map<string,string>();let csrf:string|null=null;
 const client=createApiClient({baseUrl:m.apiOrigin,credentials:{kind:'cookie',csrfToken:()=>csrf},fetch:async(input,init)=>{
  const url=new URL(String(input));if(url.origin!==m.apiOrigin)throw Error('NONLOCAL_FIXTURE_REQUEST');
  const headers=new Headers(init?.headers);headers.set('origin',m.webOrigin);if(cookies.size)headers.set('cookie',[...cookies].map(([k,v])=>`${k}=${v}`).join('; '));
  const r=await nativeFetch(input,{...init,headers});
  for(const raw of r.headers.getSetCookie()){const pair=raw.split(';')[0]!;const i=pair.indexOf('=');cookies.set(pair.slice(0,i),pair.slice(i+1));}
  return r;
 }});
 return {email,client,async signIn(name:string){
  const start=await client.call('startEmail',{body:{clientRequestId:randomUUID(),email,client:'WEB'}});
  const verified=await client.call('verifyEmail',{body:{clientRequestId:randomUUID(),challengeId:start.data.challengeId,code:'000000'}});
  if(verified.data.outcome!=='AUTHENTICATED'||!verified.data.session)throw Error('FIXTURE_NOT_AUTHENTICATED');
  csrf=verified.data.session.csrfToken??null;
  const me=(await client.call('getMe',{})).data;
  await client.call('updateMe',{body:{displayName:name,bio:'Synthetic P1.1 test account for isolated dining journeys.',languages:['en'],lifeStatus:'NEW_TO_LONDON',interests:['FOOD'],ageConfirmedVersion:'2026-10-21',communityAcceptedVersion:'2026-10-21'},ifMatch:me.version,idempotencyKey:randomUUID()});
  return me.id;
 }};
}
const host=actor('p11-host@example.invalid'),guest=actor('p11-guest@example.invalid');
try{
 const check=(await pool.query<{data_directory:string;db:string}>(`SELECT current_setting('data_directory') AS data_directory,current_database() AS db`)).rows[0]!;
 if(await realpath(check.data_directory)!==await realpath(owner.data)||check.db!==m.database)throw Error('DB_TARGET_MISMATCH');
 if((await pool.query(`SELECT 1 FROM users LIMIT 1`)).rowCount)throw Error('FIXTURE_REQUIRES_FRESH_OWN_DB');
 const hostId=await host.signIn('P11 Synthetic Host'),guestId=await guest.signIn('P11 Synthetic Guest');
 const end=new Date(Date.now()-3600_000),start=new Date(end.getTime()-7200_000),close=new Date(start.getTime()-3600_000);
 const c=await pool.connect();let mealId:string;
 try{
  await c.query('BEGIN');
  const venue=(await c.query<{id:string}>(`INSERT INTO venues(place_id,provider) VALUES($1,'fixture') RETURNING id`,['fixture_p11_'+randomUUID().replaceAll('-','')])).rows[0]!;
  const meal=(await c.query<{id:string}>(`INSERT INTO meals(host_id,venue_ref,title,description,starts_at,closes_at,scheduled_end_at,start_local_date,start_local_time,start_offset,close_local_date,close_local_time,close_offset,minimum,capacity,budget_min_pence,budget_max_pence,languages,mood,booking_mode,terms_version,attempt_id,status) VALUES($1,$2,'P1.1 synthetic finished meal','Synthetic post-meal fixture; no real attendees or bookings.',$3,$4,$5,to_char($3::timestamptz AT TIME ZONE 'Europe/London','YYYY-MM-DD'),to_char($3::timestamptz AT TIME ZONE 'Europe/London','HH24:MI'),(EXTRACT(EPOCH FROM (($3::timestamptz AT TIME ZONE 'Europe/London')-($3::timestamptz AT TIME ZONE 'UTC')))/60)::integer,to_char($4::timestamptz AT TIME ZONE 'Europe/London','YYYY-MM-DD'),to_char($4::timestamptz AT TIME ZONE 'Europe/London','HH24:MI'),(EXTRACT(EPOCH FROM (($4::timestamptz AT TIME ZONE 'Europe/London')-($4::timestamptz AT TIME ZONE 'UTC')))/60)::integer,2,4,1000,2000,ARRAY['en'],'EASY_CONVERSATION','EXTERNAL_PAY_AT_VENUE','2026-10-21',$6,'COMPLETED') RETURNING id`,[hostId,venue.id,start,close,end,randomUUID()])).rows[0]!;mealId=meal.id;
  for(const [i,id] of [hostId,guestId].entries()){
   await c.query(`INSERT INTO seat_events(meal_id,seq,user_id,type,effective_at,command_id) VALUES($1,$2,$3,$4,$5,$6)`,[mealId,i+1,id,i===0?'HOST_CONFIRMED':'GUEST_CONFIRMED',new Date(close.getTime()-60000),randomUUID()]);
   await c.query(`INSERT INTO start_roster(meal_id,user_id,source_revision_hash,starts_at) VALUES($1,$2,'p11-synthetic',$3)`,[mealId,id,start]);
  }
  await c.query(`UPDATE meals SET head=2 WHERE id=$1`,[mealId]);await c.query('COMMIT');
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 for(const [a,id] of [[host,hostId],[guest,guestId]] as const){
  await a.client.call('reportAttendance',{params:{mealId,subjectId:id},body:{value:'present'},ifMatch:'0',idempotencyKey:randomUUID()});
  const state=(await a.client.call('postMealState',{params:{mealId}})).data;
  if(!state.windowOpen||state.eligibleMembers.length!==2)throw Error('POSTMEAL_FIXTURE_INVALID');
 }
 const fixture={version:'P1.1',head:m.head,database:m.database,hostEmail:host.email,guestEmail:guest.email,hostId,guestId,mealId,postMealPath:`/post-meal/${mealId}`,synthetic:true};
 await writeFile(resolve(tmp,'client-fixtures.json'),JSON.stringify(fixture,null,2),{mode:0o600});
 process.stdout.write('P1.1 synthetic two-account post-meal fixture verified; private fixture manifest written.\n');
}finally{
 await Promise.allSettled([host.client.call('logout',{body:{clientRequestId:randomUUID()}}),guest.client.call('logout',{body:{clientRequestId:randomUUID()}})]);
 await pool.end();
}
