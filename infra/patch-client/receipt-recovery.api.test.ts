/** Codex independent acceptance: a purged receipt is not permission to replay an old intent. */
import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,inject,it} from 'vitest';
import {Browser,createHarness,json,type Harness} from '../../apps/api/src/test/harness.ts';
import {claimIntent,completeIntent,purgeExpiredIntents} from '../../apps/api/src/common/idempotency.ts';
import {outcomeFromReceipt,type CommandReceipt} from '../../packages/client/src/intents.ts';
let h:Harness;
beforeAll(async()=>{h=await createHarness(inject('pgServerUrl'));});
afterAll(async()=>{await h.close();});
it('does not offer resend when NONE could be a purged completed intent and no age proof exists',async()=>{
 const browser=new Browser(h);
 await browser.signInWithEmail(`${randomUUID()}@example.invalid`);
 const actorId=json(await browser.request('GET','/v1/me')).data.id as string;
 const intent={actorId,operation:'applyMeal',key:randomUUID(),requestHash:'a'.repeat(64)};
 const claim=await claimIntent(h.db.pool,intent);
 expect(claim.kind).toBe('claimed');if(claim.kind!=='claimed')throw new Error('fresh claim required');
 const tx=await h.db.pool.connect();
 try{await tx.query('BEGIN');await completeIntent(tx,claim,{status:201,body:{data:{id:randomUUID()}}});await tx.query('COMMIT');}finally{tx.release();}
 await h.db.pool.query(`UPDATE idempotency SET created_at=clock_timestamp()-interval '32 days',expires_at=clock_timestamp()-interval '1 day' WHERE actor_id=$1 AND operation=$2 AND key=$3`,[actorId,intent.operation,intent.key]);
 expect(await purgeExpiredIntents(h.db.pool)).toBe(1);
 const receipt=await browser.request('GET',`/v1/me/command-receipts/${intent.operation}/${intent.key}`);
 expect(receipt.statusCode).toBe(200);const data=json(receipt).data as CommandReceipt;
 expect(data.state).toBe('NONE');
 // After purge the kernel really treats the same old key as a fresh claim, proving that
 // same-key alone no longer supplies dedupe safety. No business command is executed here.
 expect((await claimIntent(h.db.pool,intent)).kind).toBe('claimed');
 expect(outcomeFromReceipt(data)).toBe('unknown');
});
