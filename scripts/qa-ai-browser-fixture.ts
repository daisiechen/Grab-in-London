/** Isolated browser QA rig: deterministic text provider, real core routes and disposable PG. */
import {createInterface} from 'node:readline';
import {randomBytes,randomUUID} from 'node:crypto';
import {loadConfig} from '../packages/config/src/index.ts';
import {migrate} from '../packages/db/src/index.ts';
import {startPostgres17} from '../packages/testkit/src/postgres/server.ts';
import {createMigratedDatabase} from '../packages/testkit/src/db/index.ts';
import {mockProvider} from '../packages/assistant/src/index.ts';
import {BudgetLedger} from '../apps/api/src/assistant/budget.ts';
import {buildServer} from '../apps/api/src/http/server.ts';
import {TestIdentityProvider} from '../apps/api/src/identity/test-provider.ts';
import {Browser,type Harness} from '../apps/api/src/test/harness.ts';
import {londonTime} from '../apps/api/src/meals/time.ts';
if(process.env.FANCY_QA_LOCAL_FIXTURE!=='1'||process.env.FANCY_TEST_DATABASE_URL)throw new Error('Explicit disposable QA only');
const pg=await startPostgres17(),db=await createMigratedDatabase(pg.url,migrate),origin='http://localhost:5176',idp=new TestIdentityProvider('development');
const verify=idp.verifyEmailOtp.bind(idp);idp.verifyEmailOtp=input=>verify({...input,code:input.code==='000000'?idp.inbox.get(input.email)?.at(-1)??input.code:input.code});
const provider=mockProvider('development',async req=>{
 const input=JSON.parse(req.input) as {input?:string;kind?:string};let parsed:unknown;
 if(input.kind==='CREATE')parsed={title:'An easy evening with new neighbours',description:'A relaxed dinner to meet new neighbours and enjoy friendly conversation.'};
 else if(input.kind==='APPLICATION')parsed={text:'I would enjoy joining this friendly table and meeting new neighbours.'};
 else if(input.kind==='GROUP')parsed={text:'Hello everyone, I am looking forward to meeting you at the table.'};
 else parsed={intent:/group/i.test(input.input??'')?'DRAFT_GROUP':/creat|meal draft/i.test(input.input??'')?'DRAFT_CREATE':'DRAFT_APPLICATION',patches:[],mealIds:[]};
 return {parsed,usage:{inputTokens:10,outputTokens:10},providerRequestId:`synthetic-${randomUUID()}`};
});
const config=loadConfig({ENVIRONMENT:'development',DATABASE_URL:db.url,AUTH_ADAPTER:'test',PLACES_ADAPTER:'fixture',MAIL_ADAPTER:'outbox_test',AI_PROVIDER:'mock',WEB_ORIGIN:origin,SESSION_SECRET:randomBytes(32).toString('hex'),IOS_REDIRECT_URI:'fancy://auth/callback'});
const app=await buildServer({config,pool:db.pool,identity:idp,publicOrigin:origin,assistant:{allowedAreas:[],provider,price:{version:'synthetic-only-no-real-charge',verified:true,inputMicroCnyPerMillion:1_000_000n,outputMicroCnyPerMillion:1_000_000n,validUntil:Date.now()+86400000},countInputTokens:()=>1024}});
const h:Harness={app,db,idp,close:async()=>{await app.close();await db.drop();}};
try{
 const {rows:[period]}=await db.pool.query("SELECT 'D:'||to_char(clock_timestamp() AT TIME ZONE 'Europe/London','YYYY-MM-DD') d,'M:'||to_char(clock_timestamp() AT TIME ZONE 'Europe/London','YYYY-MM') m");const ledger=new BudgetLedger(db.pool);await ledger.configure(period.d,10_000_000n,100,true);await ledger.configure(period.m,10_000_000n,100,true);
 const people=[];for(const [email,name]of [['qa-ai-host@example.invalid','QA AI Host'],['qa-ai-guest@example.invalid','QA AI Guest']]){const b=new Browser(h,origin),auth=await b.signInWithEmail(email),id=auth.body.data.session.user.id as string;const r=await b.request('PATCH','/v1/me',{body:{displayName:name,bio:'A synthetic public introduction for independent browser QA.',languages:['en'],lifeStatus:'NEW_TO_LONDON',interests:['FOOD'],ageConfirmedVersion:'2026-10-21',communityAcceptedVersion:'2026-10-21'},headers:{'if-match':'"1"','idempotency-key':randomUUID()}});if(r.statusCode!==200)throw Error('Fixture profile failed');people.push({b,id});}
 const host=people[0],v=await host.b.request('POST','/v1/venues/confirm',{body:{placeId:'fixture_fancy_north'},headers:{'idempotency-key':randomUUID()}});if(v.statusCode!==200)throw Error('Fixture venue failed');
 const start=new Date(Math.floor((Date.now()+3*86400000)/1800000)*1800000),close=new Date(start.getTime()-3600000);const t=(d:Date)=>{const x=londonTime(d);return {localDate:x.localDate,localTime:x.localTime,timeZone:x.timeZone,utcOffsetMinutes:x.utcOffsetMinutes};};
 const created=await host.b.request('POST','/v1/meals',{body:{venueRef:v.json().data.venueRef,title:'QA AI browser future meal',description:'A friendly synthetic table for independent draft authorization checks.',start:t(start),close:t(close),minimum:2,capacity:4,budgetMinPence:1500,budgetMaxPence:3000,languages:['en'],mood:'EASY_CONVERSATION',bookingMode:'EXTERNAL_PAY_AT_VENUE',attemptId:randomUUID(),bookingDeclarationConfirmed:true,reviewConfirmed:true,termsVersion:'2026-10-21'},headers:{'idempotency-key':randomUUID()}});if(created.statusCode!==201)throw Error('Fixture meal failed');
 await db.pool.query(`CREATE TABLE qa_business_probe(id bigserial PRIMARY KEY,table_name text NOT NULL,operation text NOT NULL); CREATE FUNCTION qa_observe_business_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN INSERT INTO qa_business_probe(table_name,operation) VALUES(TG_TABLE_NAME,TG_OP); RETURN NULL; END $$`);
 for(const table of ['meals','applications','seat_events','messages','notifications','outbox'])await db.pool.query(`CREATE TRIGGER qa_observe_write AFTER INSERT OR UPDATE OR DELETE ON ${table} FOR EACH ROW EXECUTE FUNCTION qa_observe_business_write()`);
 await app.listen({host:'127.0.0.1',port:3102});console.warn(`QA AI ONLY API3102/Weblocalhost5176; email000000; guest qa-ai-guest@example.invalid; meal ${created.json().data.id}; no real model/service calls.`);
 const reader=createInterface({input:process.stdin,terminal:false});await new Promise<void>(resolve=>{reader.on('line',line=>{if(line.trim()==='inspect')void db.pool.query(`SELECT table_name,operation,count(*)::int n FROM qa_business_probe GROUP BY table_name,operation ORDER BY table_name,operation`).then(r=>console.warn('QA_BUSINESS_WRITES '+JSON.stringify(r.rows)));});process.once('SIGINT',resolve);process.once('SIGTERM',resolve);}).finally(()=>reader.close());
}finally{await h.close();await pg.stop();}
