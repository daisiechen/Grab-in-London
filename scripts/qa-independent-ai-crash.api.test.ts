/** QA-AI-041: actually SIGKILL an API child with a persisted in-flight call, then start a new API process. */
import {fork,type ChildProcess} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,inject,it} from 'vitest';
import {migrate} from '../packages/db/src/index.ts';
import {createMigratedDatabase,type MigratedDatabase} from '../packages/testkit/src/db/index.ts';
import {withTransaction} from '../apps/api/src/common/transaction.ts';
import {issueNativeCredentials} from '../apps/api/src/identity/sessions.ts';
import {BudgetLedger} from '../apps/api/src/assistant/budget.ts';
let db:MigratedDatabase;const children:ChildProcess[]=[];
beforeAll(async()=>{db=await createMigratedDatabase(inject('pgServerUrl'),migrate);});
afterAll(async()=>{for(const child of children)if(child.exitCode===null&&child.signalCode===null){const done=once(child,'exit');child.kill('SIGKILL');await done;}await db?.drop();});
function start(){
 const messages:Record<string,unknown>[]=[],errors:string[]=[];
 const child=fork(new URL('./qa-ai-crash-child.ts',import.meta.url),[],{execArgv:['--experimental-strip-types','--experimental-transform-types'],env:{...process.env,NODE_NO_WARNINGS:'1'},stdio:['ignore','ignore','pipe','ipc']});children.push(child);
 child.on('message',message=>messages.push(message as Record<string,unknown>));child.stderr?.on('data',chunk=>errors.push(String(chunk)));
 const event=async(name:string)=>{const until=Date.now()+10000;for(;;){const value=messages.find(m=>m.event===name);if(value)return value;if(messages.some(m=>m.event==='error')||child.exitCode!==null||child.signalCode!==null)throw Error('QA child startup failed: '+errors.join('').split('\n')[0]);if(Date.now()>until)throw Error('QA child event timeout: '+name);await new Promise(r=>setTimeout(r,5));}};
 return{child,event};
}
it('QA-AI-041 SIGKILL retains UNKNOWN maximum reservation and restart releases quota without replaying the provider',async()=>{
 const user=randomUUID(),requestId=randomUUID();await db.pool.query('INSERT INTO users(id) VALUES($1)',[user]);
 const issued=await withTransaction(db.pool,tx=>issueNativeCredentials(tx.client,user,'IOS',['otp'],new Date()));
 const period=(await db.pool.query("SELECT 'D:'||to_char(clock_timestamp() AT TIME ZONE 'Europe/London','YYYY-MM-DD') day_period,'M:'||to_char(clock_timestamp() AT TIME ZONE 'Europe/London','YYYY-MM') month_period")).rows[0],budget=new BudgetLedger(db.pool);
 await budget.configure(period.day_period,10000000n,100,true);await budget.configure(period.month_period,10000000n,100,true);
 const first=start();first.child.send({url:db.url,accessToken:issued.credentials.accessToken,requestId,mode:'dispatch'});
 const accepted=await first.event('accepted');expect(accepted.status).toBe(202);const dispatch=await first.event('dispatch');
 const before=(await db.pool.query('SELECT state,max_micro_cny FROM ai_calls WHERE call_id=$1',[dispatch.callId])).rows[0];expect(before).toEqual({state:'IN_FLIGHT',max_micro_cny:'3024'});
 const stopped=once(first.child,'exit');first.child.kill('SIGKILL');const[,signal]=await stopped;expect(signal).toBe('SIGKILL');
 expect((await db.pool.query('SELECT state FROM ai_requests WHERE request_id=$1',[requestId])).rows[0].state).toBe('PENDING');
 const second=start(),ended=once(second.child,'exit');second.child.send({url:db.url,accessToken:issued.credentials.accessToken,requestId,mode:'recover',sessionId:accepted.sessionId,deviceToken:accepted.deviceToken});
 const recovered=await second.event('recovered');expect(recovered.status).toBe(410);expect(recovered.calls).toBe(0);await ended;
 expect((await db.pool.query('SELECT state,error_code FROM ai_requests WHERE request_id=$1',[requestId])).rows[0]).toEqual({state:'FAILED',error_code:'RESTART'});
 expect((await db.pool.query('SELECT state,max_micro_cny,actual_micro_cny FROM ai_calls WHERE call_id=$1',[dispatch.callId])).rows[0]).toEqual({state:'UNKNOWN',max_micro_cny:'3024',actual_micro_cny:null});
 expect((await db.pool.query('SELECT used_micro_cny,reserved_micro_cny FROM ai_budget')).rows).toEqual([{used_micro_cny:'0',reserved_micro_cny:'3024'},{used_micro_cny:'0',reserved_micro_cny:'3024'}]);
 expect((await db.pool.query('SELECT successes,reserved_success_slots FROM ai_quota WHERE subject=$1',[`user:${user}`])).rows[0]).toEqual({successes:0,reserved_success_slots:0});
 expect((await db.pool.query('SELECT active_request_id FROM ai_subjects WHERE subject=$1',[`user:${user}`])).rows[0].active_request_id).toBeNull();
 expect(await budget.dispatch(String(dispatch.callId))).toBe(false);expect((await db.pool.query('SELECT count(*)::int n FROM ai_calls WHERE request_id=$1',[requestId])).rows[0].n).toBe(1);
});
