/** A re-authentication rejection is not sealed: the same deletion intent succeeds after re-authenticating. */
import {randomBytes,randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,inject,it} from 'vitest';
import {Browser,createHarness,json,type Harness} from '../test/harness.ts';
let h:Harness;
beforeAll(async()=>{h=await createHarness(inject('pgServerUrl'));});afterAll(async()=>{await h.close();});

it('retries the same Idempotency-Key and body after REAUTH_REQUIRED instead of replaying the rejection',async()=>{
 const email=`${randomUUID()}@example.invalid`,b=new Browser(h);const {body}=await b.signInWithEmail(email);const userId=body.data.session.user.id as string;
 await h.db.pool.query(`UPDATE session_families SET auth_time=clock_timestamp()-interval '6 minutes' WHERE user_id=$1`,[userId]);
 const key=randomUUID(),receiptToken=randomBytes(32).toString('base64url');
 const remove=()=>b.request('POST','/v1/me/deletion',{body:{confirm:true,receiptToken},headers:{'idempotency-key':key,'if-match':'"1"'}});
 const first=await remove();expect(first.statusCode,first.body).toBe(403);expect(json(first).error.code).toBe('REAUTH_REQUIRED');
 expect((await h.db.pool.query(`SELECT 1 FROM idempotency WHERE actor_id=$1`,[userId])).rowCount).toBe(0);
 // Still stale: the retry is evaluated again, not answered from a stored rejection.
 const stale=await remove();expect(stale.statusCode).toBe(403);expect(stale.headers['idempotent-replay']).toBeUndefined();
 await h.db.pool.query(`UPDATE auth_transactions SET created_at=created_at-interval '1 minute' WHERE kind='EMAIL_OTP'`);
 const start=await b.request('POST','/v1/auth/reauth',{body:{clientRequestId:randomUUID(),method:'EMAIL'}});expect(start.statusCode,start.body).toBe(201);
 const verified=await b.request('POST','/v1/auth/email/verify',{body:{clientRequestId:randomUUID(),challengeId:json(start).data.challengeId,code:h.idp.inbox.get(email)!.at(-1)!}});expect(verified.statusCode,verified.body).toBe(200);
 const accepted=await remove();expect(accepted.statusCode,accepted.body).toBe(202);expect(accepted.headers['idempotent-replay']).toBeUndefined();
 expect((await h.db.pool.query(`SELECT count(*)::int AS n FROM deletion_requests WHERE user_id=$1`,[userId])).rows[0].n).toBe(1);
});
