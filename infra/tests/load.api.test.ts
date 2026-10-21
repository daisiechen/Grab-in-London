import {randomUUID} from 'node:crypto';
import {expect,inject,it} from 'vitest';
import {Browser,createHarness} from '../../apps/api/src/test/harness.ts';
import {withTransaction} from '../../apps/api/src/common/transaction.ts';
import {createGroupConversation} from '../../apps/api/src/membership/intervals.ts';
import {enqueueJob} from '../../packages/db/src/index.ts';
import {createWorkerRuntime} from '../../apps/worker/src/main.ts';
import {loadConfig} from '../../packages/config/src/index.ts';
it('G-HOST preparation: 100 concurrent real API reads with 1000 accounts and 10000 messages',async()=>{
 const h=await createHarness(inject('pgServerUrl'));
 try{
  const browser=new Browser(h);const host=(await browser.signInWithEmail(`${randomUUID()}@example.invalid`)).body.data.session.user.id as string;
  await h.db.pool.query(`INSERT INTO users(id) SELECT gen_random_uuid() FROM generate_series(1,999)`);
  const{rows:[venue]}=await h.db.pool.query(`INSERT INTO venues(place_id,provider) VALUES($1,'fixture') RETURNING id`,[randomUUID()]);
  const {rows:[meal]}=await h.db.pool.query(`INSERT INTO meals(host_id,venue_ref,title,description,starts_at,closes_at,scheduled_end_at,start_local_date,start_local_time,start_offset,close_local_date,close_local_time,close_offset,minimum,capacity,budget_min_pence,budget_max_pence,languages,mood,booking_mode,terms_version,attempt_id) VALUES($1,$2,'Load fixture table','Synthetic fixture only for local isolated load checks','2030-01-01 18:00Z','2030-01-01 17:00Z','2030-01-01 20:00Z','2030-01-01','18:00',0,'2030-01-01','17:00',0,2,4,1000,2000,ARRAY['en'],'EASY_CONVERSATION','EXTERNAL_PAY_AT_VENUE','test',$3) RETURNING id`,[host,venue.id,randomUUID()]);
  const {conversationId}=await withTransaction(h.db.pool,tx=>createGroupConversation(tx,{mealId:meal.id,hostId:host,effectiveAt:new Date()}));
  await h.db.pool.query(`INSERT INTO messages(conversation_id,seq,sender_id,client_message_id,body,created_at) SELECT $1,n+1,$2,gen_random_uuid(),'Synthetic load fixture message',clock_timestamp() FROM generate_series(1,10000) n`,[conversationId,host]);
  await h.db.pool.query(`UPDATE conversations SET head=10001 WHERE id=$1`,[conversationId]);
  const due=new Date();await enqueueJob(h.db.pool,{kind:'meal.close',resourceId:meal.id,dueAt:due});
  const results=await Promise.all(Array.from({length:100},async(_,index)=>{const start=performance.now();const response=await browser.request('GET',index%4===0?`/v1/conversations/${conversationId}/messages?mode=HISTORY`:'/v1/me');return{ms:performance.now()-start,status:response.statusCode};}));
  expect(results.every(r=>r.status===200)).toBe(true);
  const config=loadConfig({ENVIRONMENT:'test',DATABASE_URL:h.db.url,AUTH_ADAPTER:'test',PLACES_ADAPTER:'fixture',MAIL_ADAPTER:'outbox_test',AI_PROVIDER:'mock',WEB_ORIGIN:'http://localhost:5174',SESSION_SECRET:'load-test-session-secret-0123456789'});
  const tick=await createWorkerRuntime(h.db.pool,config).tick();expect(tick.done).toBeGreaterThan(0);
  const sorted=results.map(r=>r.ms).sort((a,b)=>a-b),p95=sorted[Math.ceil(sorted.length*.95)-1];
  console.warn(JSON.stringify({drill:'isolated_load_preflight',accounts:1000,messages:10000,concurrency:100,p95Ms:p95,errorRate:0,workerObservedDelayMs:Date.now()-due.getTime(),productionEvidence:false}));
 }finally{await h.close();}
});
