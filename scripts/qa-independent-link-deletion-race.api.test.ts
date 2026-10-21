/** QA-F03: consume-age protocol must use milliseconds consistently at the HTTP boundary. */
import {randomBytes,randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,inject,it} from 'vitest';
import {Browser,createHarness,json,type Harness} from '../apps/api/src/test/harness.ts';
let h:Harness;
beforeAll(async()=>{h=await createHarness(inject('pgServerUrl'));});afterAll(async()=>h.close());
async function preparedLink(){
 const address=`qa-proof-${randomUUID()}@example.invalid`,owner=new Browser(h);await owner.signInWithEmail(address);const b=new Browser(h);
 const start=await b.request('POST','/v1/auth/oauth/start',{body:{clientRequestId:randomUUID(),provider:'GOOGLE',client:'WEB'}});expect(start.statusCode,start.body).toBe(201);
 const{code,state}=h.idp.consent(json(start).data.authorizationUrl,{subject:randomUUID(),email:address});const callback=await b.request('GET',`/v1/auth/oauth/callback?code=${code}&state=${state}`);expect(json(callback).data.outcome).toBe('LINK_REQUIRED');
 await h.db.pool.query("UPDATE auth_transactions SET created_at=created_at-interval '1 minute' WHERE kind='EMAIL_OTP'");
 const proof=await b.signInWithEmail(address);return{b,proof:proof.body.data.authProof as string,ticket:json(callback).data.linkTicket as string,userId:proof.body.data.session.user.id as string};
}

async function waiters(n:number){for(let i=0;i<150;i++){const r=await h.db.pool.query("SELECT count(*)::int n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query ILIKE '%users%'");if(r.rows[0].n>=n)return;await new Promise<void>(resolve=>setTimeout(resolve,5));}const q=await h.db.pool.query("SELECT state,wait_event_type,query FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()");throw Error('real user lock waiters not observed '+JSON.stringify(q.rows));}
it('QA-CODE-004 actual accepted deletion wins queued user lock before link and prevents a new identity link',async()=>{
 const f=await preparedLink(),holder=await h.db.pool.connect();let deletion:ReturnType<Browser['request']>|undefined,link:ReturnType<Browser['request']>|undefined;
 try{await holder.query('BEGIN');await holder.query('SELECT id FROM users WHERE id=$1 FOR NO KEY UPDATE',[f.userId]);
 deletion=f.b.request('POST','/v1/me/deletion',{body:{confirm:true,receiptToken:randomBytes(32).toString('base64url')},headers:{'idempotency-key':randomUUID(),'if-match':'"1"'}});await waiters(1);
 link=f.b.request('POST','/v1/auth/links',{body:{linkTicket:f.ticket,originalChallengeProof:f.proof},headers:{'idempotency-key':randomUUID()}});await waiters(2);await holder.query('COMMIT');
 const removed=await deletion;expect(removed.statusCode,removed.body).toBe(202);expect((await h.db.pool.query('SELECT status FROM users WHERE id=$1',[f.userId])).rows[0].status).toBe('DELETING');
 const result=await link;expect([401,403],result.body).toContain(result.statusCode);expect((await h.db.pool.query("SELECT count(*)::int n FROM identities WHERE user_id=$1 AND provider='GOOGLE'",[f.userId])).rows[0].n).toBe(0);
 }finally{await holder.query('ROLLBACK');holder.release();if(deletion)await deletion;if(link)await link;}
});
