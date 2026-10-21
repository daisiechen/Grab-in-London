/** Sensitive identity mutation must reauthorize after real user lock waits. */
import {randomBytes,randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,inject,it} from 'vitest';
import {Browser,createHarness,json,type Harness} from '../test/harness.ts';
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
it('Accepted deletion wins queued user lock before link and prevents a new identity link',async()=>{
 const f=await preparedLink(),holder=await h.db.pool.connect();let deletion:ReturnType<Browser['request']>|undefined,link:ReturnType<Browser['request']>|undefined;
 try{await holder.query('BEGIN');await holder.query('SELECT id FROM users WHERE id=$1 FOR NO KEY UPDATE',[f.userId]);
 deletion=f.b.request('POST','/v1/me/deletion',{body:{confirm:true,receiptToken:randomBytes(32).toString('base64url')},headers:{'idempotency-key':randomUUID(),'if-match':'"1"'}});await waiters(1);
 link=f.b.request('POST','/v1/auth/links',{body:{linkTicket:f.ticket,originalChallengeProof:f.proof},headers:{'idempotency-key':randomUUID()}});await waiters(2);await holder.query('COMMIT');
 const removed=await deletion;expect(removed.statusCode,removed.body).toBe(202);expect((await h.db.pool.query('SELECT status FROM users WHERE id=$1',[f.userId])).rows[0].status).toBe('DELETING');
 const result=await link;expect([401,403],result.body).toContain(result.statusCode);expect((await h.db.pool.query("SELECT count(*)::int n FROM identities WHERE user_id=$1 AND provider='GOOGLE'",[f.userId])).rows[0].n).toBe(0);
 }finally{await holder.query('ROLLBACK');holder.release();if(deletion)await deletion;if(link)await link;}
});
async function link(f:Awaited<ReturnType<typeof preparedLink>>,key=randomUUID()) {return f.b.request('POST','/v1/auth/links',{body:{linkTicket:f.ticket,originalChallengeProof:f.proof},headers:{'idempotency-key':key}});}
for(const invalidation of ['family','session','ticket'] as const)it(`rechecks ${invalidation} validity after waiting for the user barrier`,async()=>{
 const f=await preparedLink(),holder=await h.db.pool.connect();let pending:ReturnType<typeof link>|undefined;
 try{await holder.query('BEGIN');await holder.query('SELECT id FROM users WHERE id=$1 FOR NO KEY UPDATE',[f.userId]);pending=link(f);await waiters(1);
  if(invalidation==='family')await holder.query("UPDATE session_families SET revoked_at=clock_timestamp(),revoke_reason='LOGOUT' WHERE id=(SELECT result_family_id FROM auth_transactions WHERE id=$1)",[f.proof]);
  if(invalidation==='session')await holder.query("UPDATE sessions SET expires_at=clock_timestamp() WHERE family_id=(SELECT result_family_id FROM auth_transactions WHERE id=$1)",[f.proof]);
  if(invalidation==='ticket')await holder.query("UPDATE auth_transactions SET expires_at=clock_timestamp() WHERE kind='LINK' AND user_id=$1 AND consumed_at IS NULL",[f.userId]);
  await holder.query('COMMIT');const response=await pending;expect(response.statusCode,response.body).toBe(invalidation==='ticket'?409:401);
  expect((await h.db.pool.query("SELECT 1 FROM identities WHERE user_id=$1 AND provider='GOOGLE'",[f.userId])).rows).toEqual([]);
  expect((await h.db.pool.query("SELECT 1 FROM audit_events WHERE aggregate_id=$1 AND action='identity.linked'",[f.userId])).rows).toEqual([]);
 }finally{await holder.query('ROLLBACK');holder.release();if(pending)await pending;}
});
it('normal current dual proof links once and concurrent new intents cannot consume the same ticket twice',async()=>{
 const f=await preparedLink(),holder=await h.db.pool.connect();let first:ReturnType<typeof link>|undefined,second:ReturnType<typeof link>|undefined;
 try{await holder.query('BEGIN');await holder.query('SELECT id FROM users WHERE id=$1 FOR NO KEY UPDATE',[f.userId]);first=link(f);await waiters(1);second=link(f);await waiters(2);await holder.query('COMMIT');const responses=await Promise.all([first,second]);expect(responses.map(r=>r.statusCode).sort()).toEqual([200,409]);
  expect((await h.db.pool.query("SELECT 1 FROM identities WHERE user_id=$1 AND provider='GOOGLE'",[f.userId])).rowCount).toBe(1);
  expect((await h.db.pool.query("SELECT 1 FROM audit_events WHERE aggregate_id=$1 AND action='identity.linked'",[f.userId])).rowCount).toBe(1);
 }finally{await holder.query('ROLLBACK');holder.release();if(first)await first;if(second)await second;}
});
for(const status of ['DELETING','DELETED'])it(`cannot migrate an identity from a ${status} shell`,async()=>{
 const f=await preparedLink();const {rows:[ticket]}=await h.db.pool.query("SELECT provider_state FROM auth_transactions WHERE kind='LINK' AND user_id=$1",[f.userId]);
 const shell=randomUUID();await h.db.pool.query('INSERT INTO users(id,status) VALUES($1,$2)',[shell,status]);
 await h.db.pool.query("INSERT INTO identities(user_id,issuer,subject,provider,email_verified) VALUES($1,$2,$3,'GOOGLE',true)",[shell,ticket.provider_state.issuer,ticket.provider_state.subject]);
 const response=await link(f);expect(response.statusCode,response.body).toBe(409);expect(json(response).error.code).toBe('ACCOUNT_LINK_CONFLICT');
 expect((await h.db.pool.query('SELECT user_id FROM identities WHERE issuer=$1 AND subject=$2',[ticket.provider_state.issuer,ticket.provider_state.subject])).rows[0].user_id).toBe(shell);
});
it('uses PostgreSQL microseconds on both sides of access expiry after preflight has passed',async()=>{
 for(const delta of [-1,1]){
  const f=await preparedLink();
  const {rows:[time]}=await h.db.pool.query<{instant:string}>(`SELECT (date_trunc('milliseconds',clock_timestamp())+interval '1 minute 900 microseconds')::text AS instant`);
  // Isolated disposable database function resolution: actual PostgreSQL comparisons and
  // HTTP transactions run against the same fixed instant, with no fake query results.
  await h.db.pool.query('CREATE SCHEMA link_precision_clock');
  await h.db.pool.query(`CREATE FUNCTION link_precision_clock.clock_timestamp() RETURNS timestamptz LANGUAGE sql VOLATILE AS $$ SELECT '${time!.instant}'::timestamptz $$`);
  const connections=await Promise.all(Array.from({length:h.db.pool.totalCount},()=>h.db.pool.connect()));
  for(const c of connections)await c.query('SET search_path=link_precision_clock,pg_catalog,public');for(const c of connections)c.release();
  const holder=await h.db.pool.connect();let pending:ReturnType<typeof link>|undefined;
  try{await holder.query('BEGIN');await holder.query('SELECT id FROM users WHERE id=$1 FOR NO KEY UPDATE',[f.userId]);pending=link(f);await waiters(1);
   await holder.query(`UPDATE sessions SET expires_at=$2::timestamptz+$3::integer*interval '1 microsecond' WHERE family_id=(SELECT result_family_id FROM auth_transactions WHERE id=$1)`,[f.proof,time!.instant,delta]);
   await holder.query('COMMIT');const response=await pending;expect(response.statusCode,response.body).toBe(delta<0?401:200);
   expect((await h.db.pool.query("SELECT 1 FROM identities WHERE user_id=$1 AND provider='GOOGLE'",[f.userId])).rowCount).toBe(delta<0?0:1);
  }finally{await holder.query('ROLLBACK');holder.release();if(pending)await pending;
   const reset=await Promise.all(Array.from({length:h.db.pool.totalCount},()=>h.db.pool.connect()));for(const c of reset)await c.query('RESET search_path');for(const c of reset)c.release();await h.db.pool.query('DROP SCHEMA link_precision_clock CASCADE');
  }
 }
});
