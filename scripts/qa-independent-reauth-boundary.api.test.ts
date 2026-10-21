/** QA-F03: consume-age protocol must use milliseconds consistently at the HTTP boundary. */
import {randomBytes,randomUUID} from 'node:crypto';
import {afterAll,afterEach,beforeAll,describe,expect,inject,it,vi} from 'vitest';
import {Browser,createHarness,json,type Harness} from '../apps/api/src/test/harness.ts';
import type {Tx} from '../apps/api/src/common/transaction.ts';
const boundaryClock=vi.hoisted(()=>({nowMs:null as number|null}));
vi.mock('../apps/api/src/common/transaction.ts',async original=>{
 const actual=await original<typeof import('../apps/api/src/common/transaction.ts')>();
 return{...actual,withTransaction:async<T>(pool:Parameters<typeof actual.withTransaction>[0],fn:(tx:Tx)=>Promise<T>,options?:Parameters<typeof actual.withTransaction>[2])=>actual.withTransaction(pool,tx=>fn(boundaryClock.nowMs===null?tx:{...tx,effectiveNow:async()=>{tx.locks.closeLockPhase();return new Date(boundaryClock.nowMs!);}}),options)};
});
let h:Harness;
beforeAll(async()=>{h=await createHarness(inject('pgServerUrl'));});afterAll(async()=>h.close());
async function preparedLink(){
 const address=`qa-proof-${randomUUID()}@example.invalid`,owner=new Browser(h);await owner.signInWithEmail(address);const b=new Browser(h);
 const start=await b.request('POST','/v1/auth/oauth/start',{body:{clientRequestId:randomUUID(),provider:'GOOGLE',client:'WEB'}});expect(start.statusCode,start.body).toBe(201);
 const{code,state}=h.idp.consent(json(start).data.authorizationUrl,{subject:randomUUID(),email:address});const callback=await b.request('GET',`/v1/auth/oauth/callback?code=${code}&state=${state}`);expect(json(callback).data.outcome).toBe('LINK_REQUIRED');
 await h.db.pool.query("UPDATE auth_transactions SET created_at=created_at-interval '1 minute' WHERE kind='EMAIL_OTP'");
 const proof=await b.signInWithEmail(address);return{b,proof:proof.body.data.authProof as string,ticket:json(callback).data.linkTicket as string,userId:proof.body.data.session.user.id as string};
}

afterEach(()=>{boundaryClock.nowMs=null;});
describe('QA independent exact command-time HTTP sensitive-operation boundaries',()=>{
 for(const ageMs of[299999,300000,300001,-1]){
  for(const operation of['LINK','DELETE'])it(`QA-API-008 ${operation} exact auth age ${ageMs}ms`,async()=>{
   boundaryClock.nowMs=null;const f=operation==='LINK'?await preparedLink():await(async()=>{const b=new Browser(h),result=await b.signInWithEmail(`qa-boundary-${randomUUID()}@example.invalid`);return{b,userId:result.body.data.session.user.id as string,proof:result.body.data.authProof as string,ticket:''};})();
   const authPoint=new Date();await h.db.pool.query('UPDATE auth_transactions SET consumed_at=$2 WHERE id=$1',[f.proof,authPoint]);await h.db.pool.query('UPDATE session_families SET auth_time=$2 WHERE id=(SELECT result_family_id FROM auth_transactions WHERE id=$1)',[f.proof,authPoint]);boundaryClock.nowMs=+authPoint+ageMs;
   const result=operation==='LINK'?await f.b.request('POST','/v1/auth/links',{body:{linkTicket:f.ticket,originalChallengeProof:f.proof},headers:{'idempotency-key':randomUUID()}}):await f.b.request('POST','/v1/me/deletion',{body:{confirm:true,receiptToken:randomBytes(32).toString('base64url')},headers:{'idempotency-key':randomUUID(),'if-match':'"1"'}});
   const valid=ageMs>=0&&ageMs<300000;expect(result.statusCode,result.body).toBe(valid?(operation==='LINK'?200:202):403);
   if(!valid){expect(json(result).error.code).toBe('REAUTH_REQUIRED');expect((await h.db.pool.query('SELECT status FROM users WHERE id=$1',[f.userId])).rows[0].status).toBe('ACTIVE');expect((await h.db.pool.query('SELECT count(*)::int n FROM deletion_requests WHERE user_id=$1',[f.userId])).rows[0].n).toBe(0);expect((await h.db.pool.query("SELECT count(*)::int n FROM identities WHERE user_id=$1 AND provider='GOOGLE'",[f.userId])).rows[0].n).toBe(0);}
   else if(operation==='DELETE'){expect((await h.db.pool.query('SELECT status FROM users WHERE id=$1',[f.userId])).rows[0].status).toBe('DELETING');expect((await h.db.pool.query('SELECT count(*)::int n FROM deletion_requests WHERE user_id=$1',[f.userId])).rows[0].n).toBe(1);}
   else expect(json(result).data.identities.map((i:{provider:string})=>i.provider)).toContain('GOOGLE');
  });
 }
});
