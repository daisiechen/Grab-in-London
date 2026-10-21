/** Real PostgreSQL advisory-lock barriers around shared OTP quotas. */
import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {afterAll,beforeAll,expect,inject,it,vi} from 'vitest';
import {Browser,createHarness,json,type Harness} from '../test/harness.ts';
import {keyedHash} from '../http/security.ts';
let h:Harness;beforeAll(async()=>{h=await createHarness(inject('pgServerUrl'));});afterAll(async()=>h.close());
const secret='api-test-session-secret-0123456789abcdef';
const ipKey=(b:Browser)=>'otp:ip:'+keyedHash(secret,'ip',b.ip);
const emailKey=(email:string)=>'otp:email:'+keyedHash(secret,'email',email);
const address=()=>`quota-${randomUUID()}@example.invalid`;
const start=(b:Browser,email=address(),key=randomUUID())=>b.request('POST','/v1/auth/email/start',{body:{clientRequestId:key,email,client:'WEB'}});
async function waiters(n:number){const deadline=performance.now()+5000;for(;;){const {rows}=await h.db.pool.query("SELECT count(*)::int n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND wait_event='advisory'");if(rows[0].n>=n)return;if(performance.now()>deadline)throw Error('Expected independent quota lock waiters');await new Promise<void>(r=>setImmediate(r));}}
it('serializes different emails at the same IP quota and sends exactly one fifth challenge',async()=>{
 const b=new Browser(h);for(let i=0;i<4;i++)expect((await start(b)).statusCode).toBe(201);
 const holder=await h.db.pool.connect(),send=vi.spyOn(h.idp,'startEmailOtp');let flights:ReturnType<typeof start>[]=[];
 try{await holder.query('BEGIN');await holder.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[ipKey(b)]);
  flights=[start(b),start(b)];await waiters(2);await holder.query('COMMIT');
  const responses=await Promise.all(flights);expect(responses.map(r=>r.statusCode).sort()).toEqual([201,429]);expect(send).toHaveBeenCalledTimes(1);
  const {rows:[count]}=await h.db.pool.query("SELECT count(*)::int n FROM auth_transactions WHERE kind='EMAIL_OTP' AND ip_hash=$1",[keyedHash(secret,'ip',b.ip)]);expect(count.n).toBe(5);
 }finally{await holder.query('ROLLBACK');holder.release();await Promise.allSettled(flights);send.mockRestore();}
});
it('same email and request ID across IPs dedupe under the email lock without a second provider send',async()=>{
 const a=new Browser(h),b=new Browser(h),email=address(),key=randomUUID(),holder=await h.db.pool.connect(),send=vi.spyOn(h.idp,'startEmailOtp');let flights:ReturnType<typeof start>[]=[];
 try{await holder.query('BEGIN');await holder.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[emailKey(email)]);flights=[start(a,email,key),start(b,email,key)];await waiters(2);await holder.query('COMMIT');const responses=await Promise.all(flights);expect(responses.map(r=>r.statusCode)).toEqual([201,201]);expect(json(responses[0]!).data.challengeId).toBe(json(responses[1]!).data.challengeId);expect(send).toHaveBeenCalledTimes(1);
 }finally{await holder.query('ROLLBACK');holder.release();await Promise.allSettled(flights);send.mockRestore();}
});
it('unrelated IP and email can proceed while a quota is held',async()=>{
 const a=new Browser(h),b=new Browser(h),holder=await h.db.pool.connect();let pending:ReturnType<typeof start>|undefined;
 try{await holder.query('BEGIN');await holder.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[ipKey(a)]);pending=start(a);await waiters(1);expect((await start(b)).statusCode).toBe(201);await holder.query('COMMIT');expect((await pending).statusCode).toBe(201);
 }finally{await holder.query('ROLLBACK');holder.release();if(pending)await pending;}
});
it('provider delivery begins after quota transaction releases both advisory locks',async()=>{
 const b=new Browser(h),email=address(),original=h.idp.startEmailOtp.bind(h.idp);let enter!:()=>void,release!:()=>void;const entered=new Promise<void>(r=>{enter=r;}),gate=new Promise<void>(r=>{release=r;});
 const send=vi.spyOn(h.idp,'startEmailOtp').mockImplementation(async input=>{enter();await gate;return original(input);});const pending=start(b,email);let probe:PoolClient|undefined;
 try{await entered;probe=await h.db.pool.connect();await probe.query('BEGIN');for(const key of [emailKey(email),ipKey(b)]){const {rows:[lock]}=await probe.query<{acquired:boolean}>('SELECT pg_try_advisory_xact_lock(hashtextextended($1,0)) AS acquired',[key]);expect(lock!.acquired).toBe(true);}
 }finally{if(probe){await probe.query('ROLLBACK');probe.release();}release();send.mockRestore();}
 expect((await pending).statusCode).toBe(201);
});
