/** QA-F03: consume-age protocol must use milliseconds consistently at the HTTP boundary. */
import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,describe,expect,inject,it} from 'vitest';
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
describe('QA-F03 HTTP account linking proof freshness',()=>{
 for(const ageSeconds of[0,1,299,301])it(`QA-API-008 linking proof age ${ageSeconds}s with matching authTime`,async()=>{
  const f=await preparedLink();await h.db.pool.query("UPDATE auth_transactions SET consumed_at=clock_timestamp()-make_interval(secs=>$2::double precision) WHERE id=$1",[f.proof,ageSeconds]);await h.db.pool.query("UPDATE session_families SET auth_time=clock_timestamp()-make_interval(secs=>$2::double precision) WHERE id=(SELECT result_family_id FROM auth_transactions WHERE id=$1)",[f.proof,ageSeconds]);
  const r=await f.b.request('POST','/v1/auth/links',{body:{linkTicket:f.ticket,originalChallengeProof:f.proof},headers:{'idempotency-key':randomUUID()}});
  if(ageSeconds<300){expect(r.statusCode,r.body).toBe(200);expect(json(r).data.identities.map((i:{provider:string})=>i.provider)).toContain('GOOGLE');}
  else{expect(r.statusCode,r.body).toBe(403);expect(json(r).error.code).toBe('REAUTH_REQUIRED');expect((await h.db.pool.query("SELECT count(*)::int n FROM identities WHERE user_id=$1 AND provider='GOOGLE'",[f.userId])).rows[0].n).toBe(0);}
 });
});
