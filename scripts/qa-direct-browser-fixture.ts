/** Disposable loopback-only fixture for F18 UI verification; never deploy. */
import {randomBytes,randomUUID} from 'node:crypto';
import {loadConfig} from '../packages/config/src/index.ts';
import {migrate} from '../packages/db/src/index.ts';
import {startPostgres17} from '../packages/testkit/src/postgres/server.ts';
import {createMigratedDatabase} from '../packages/testkit/src/db/index.ts';
import {buildServer} from '../apps/api/src/http/server.ts';
import {TestIdentityProvider} from '../apps/api/src/identity/test-provider.ts';
import {Browser,type Harness} from '../apps/api/src/test/harness.ts';
if(process.env.FANCY_QA_LOCAL_FIXTURE!=='1'||process.env.FANCY_TEST_DATABASE_URL)throw new Error('Explicit disposable fixture only');
const origin='http://localhost:5176',pg=await startPostgres17();
const db=await createMigratedDatabase(pg.url,migrate),idp=new TestIdentityProvider('development');
const verify=idp.verifyEmailOtp.bind(idp);
idp.verifyEmailOtp=input=>verify({...input,code:input.code==='000000'?idp.inbox.get(input.email)?.at(-1)??input.code:input.code});
const config=loadConfig({ENVIRONMENT:'development',DATABASE_URL:db.url,AUTH_ADAPTER:'test',PLACES_ADAPTER:'fixture',MAIL_ADAPTER:'outbox_test',AI_PROVIDER:'mock',WEB_ORIGIN:origin,SESSION_SECRET:randomBytes(32).toString('hex'),IOS_REDIRECT_URI:'fancy://auth/callback'});
const app=await buildServer({config,pool:db.pool,identity:idp,publicOrigin:origin});
const h:Harness={app,db,idp,close:async()=>{await app.close();await db.drop();}};
try{
 const people=[];
 for(const [email,name]of [['qa-f18-sender@example.invalid','QA Direct Sender'],['qa-f18-peer@example.invalid','QA Target Peer']]){
  const b=new Browser(h,origin),auth=await b.signInWithEmail(email),id=auth.body.data.session.user.id as string;
  await db.pool.query(`INSERT INTO profiles(user_id,display_name,bio,languages,life_status,interests,age_confirmed_version,community_accepted_version) VALUES($1,$2,'Synthetic fixture public introduction for browser QA.',ARRAY['en'],'NEW_TO_LONDON',ARRAY['FOOD'],'2026-10-21','2026-10-21')`,[id,name]);people.push({b,id});
 }
 const [host,guest]=people,end=new Date(Date.now()-3_600_000),start=new Date(end.getTime()-7_200_000),close=new Date(start.getTime()-3_600_000);
 const {rows:[v]}=await db.pool.query(`INSERT INTO venues(place_id,provider) VALUES($1,'fixture') RETURNING id`,[`fixture_${randomUUID().replaceAll('-','')}`]);
 const {rows:[m]}=await db.pool.query(`INSERT INTO meals(host_id,venue_ref,title,description,starts_at,closes_at,scheduled_end_at,start_local_date,start_local_time,start_offset,close_local_date,close_local_time,close_offset,minimum,capacity,budget_min_pence,budget_max_pence,languages,mood,booking_mode,terms_version,attempt_id,status) VALUES($1,$2,'F18 finished fixture','Synthetic completed meal for target title QA',$3,$4,$5,'2026-10-21','12:00',60,'2026-10-21','11:00',60,2,4,1000,2000,ARRAY['en'],'EASY_CONVERSATION','EXTERNAL_PAY_AT_VENUE','2026-10-21',$6,'COMPLETED') RETURNING id`,[host.id,v.id,start,close,end,randomUUID()]);
 for(const [i,p]of people.entries()){
  await db.pool.query(`INSERT INTO seat_events(meal_id,seq,user_id,type,effective_at,command_id) VALUES($1,$2,$3,$4,$5,$6)`,[m.id,i+1,p.id,i===0?'HOST_CONFIRMED':'GUEST_CONFIRMED',new Date(close.getTime()-60_000),randomUUID()]);
  await db.pool.query(`INSERT INTO start_roster(meal_id,user_id,source_revision_hash,starts_at) VALUES($1,$2,'fixture',$3)`,[m.id,p.id,start]);
 }
 await db.pool.query('UPDATE meals SET head=2 WHERE id=$1',[m.id]);
 for(const phase of ['attendance','reconnect']){for(const p of people){const path=phase==='attendance'?`attendance/${p.id}`:`reconnect/${p===host?guest.id:host.id}`,body=phase==='attendance'?{value:'present'}:{selected:true};const r=await p.b.request('PUT',`/v1/meals/${m.id}/${path}`,{body,headers:{'idempotency-key':randomUUID(),'if-match':'"0"'}});if(r.statusCode!==200)throw new Error(`Fixture action failed ${r.statusCode}`);}}
 const r=await host.b.request('GET',`/v1/connections/${guest.id}/conversation`);if(r.statusCode!==200||r.json().data.title!=='QA Target Peer')throw new Error('Fixed target title seed assertion failed');
 await app.listen({host:'127.0.0.1',port:3101});
 console.warn(`F18 LOCAL ONLY localhost:5176 sender qa-f18-sender@example.invalid code000000; direct ${r.json().data.id}. Past meal seeded: not a full journey claim.`);
 await new Promise<void>(resolve=>{process.once('SIGTERM',resolve);process.once('SIGINT',resolve);});
}finally{await h.close();await pg.stop();}
