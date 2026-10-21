import {AssistantRuntime} from '../../../../packages/assistant/src/index.ts';
import {randomBytes,randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,inject,it} from 'vitest';
import {loadConfig} from '@fancy/config';
import {migrate} from '@fancy/db';
import {createMigratedDatabase} from '@fancy/testkit/db';
import {buildServer} from '../http/server.ts';
import {TestIdentityProvider} from '../identity/test-provider.ts';
import {Browser,WEB_ORIGIN,type Harness} from '../test/harness.ts';
import {replayDeletionLedger,requireRecovery,type DeletionLedger} from '../recovery/replay.ts';
const key=Buffer.alloc(32,31).toString('base64');let h:Harness;
beforeAll(async()=>{const db=await createMigratedDatabase(inject('pgServerUrl'),migrate),idp=new TestIdentityProvider('test');const config=loadConfig({ENVIRONMENT:'test',DATABASE_URL:db.url,AUTH_ADAPTER:'test',PLACES_ADAPTER:'fixture',MAIL_ADAPTER:'outbox_test',AI_PROVIDER:'disabled',WEB_ORIGIN,SESSION_SECRET:'deletion-mail-api-synthetic-session-secret',DELETION_MAIL_KEY_VERSION:'v1',DELETION_MAIL_KEYS_JSON:JSON.stringify({v1:key})});const app=await buildServer({config,pool:db.pool,identity:idp,publicOrigin:WEB_ORIGIN});h={app,db,idp,close:async()=>{await app.close();await db.drop();}};});afterAll(async()=>h.close());
it('live accepted deletion atomically retains only encrypted verified owner address and a single refs-only received event',async()=>{
 const b=new Browser(h),email=`${randomUUID()}@example.invalid`,login=await b.signInWithEmail(email),user=login.body.data.session.user.id as string,token=randomBytes(32).toString('base64url'),intent=randomUUID();
 const response=await b.request('POST','/v1/me/deletion',{body:{confirm:true,receiptToken:token},headers:{'idempotency-key':intent,'if-match':'"1"'}});expect(response.statusCode,response.body).toBe(202);expect(response.body).not.toContain(email);expect(response.body).not.toContain(key);
 const envelope=(await h.db.pool.query(`SELECT * FROM deletion_mail_envelopes WHERE user_id=$1`,[user])).rows[0];expect(envelope.state).toBe('ACTIVE');expect(JSON.stringify(envelope)).not.toContain(email);
 const rows=(await h.db.pool.query(`SELECT template,payload FROM outbox WHERE recipient_id=$1`,[user])).rows;expect(rows).toEqual([{template:'deletion_received',payload:{deletionId:envelope.deletion_id}}]);expect((await b.request('POST','/v1/deletion-status',{body:{receiptToken:token}})).statusCode).toBe(200);
});
it('offline RESTORE never captures restored private_contact into a fresh destination',async()=>{
 const b=new Browser(h),login=await b.signInWithEmail(`${randomUUID()}@example.invalid`),user=login.body.data.session.user.id as string;
 const {rows:[clock]}=await h.db.pool.query(`SELECT clock_timestamp()::text AS now`);const ledger:DeletionLedger={version:1,entries:[{userId:user,deletionId:randomUUID(),acceptedAt:new Date(clock.now).toISOString(),receiptTokenHash:randomBytes(32).toString('hex'),expiresAt:null,policyVersion:'test'}]};
 const config=loadConfig({ENVIRONMENT:'test',DATABASE_URL:h.db.url,AUTH_ADAPTER:'test',PLACES_ADAPTER:'fixture',MAIL_ADAPTER:'outbox_test',AI_PROVIDER:'disabled',WEB_ORIGIN,SESSION_SECRET:'deletion-mail-api-synthetic-session-secret',DELETION_MAIL_KEY_VERSION:'v1',DELETION_MAIL_KEYS_JSON:JSON.stringify({v1:key})});const deps={config,pool:h.db.pool,identity:h.idp,publicOrigin:WEB_ORIGIN,assistantRuntime:new AssistantRuntime()};
 await requireRecovery(h.db.pool,ledger);await replayDeletionLedger(deps,ledger);expect((await h.db.pool.query(`SELECT * FROM deletion_mail_envelopes WHERE user_id=$1`,[user])).rows).toHaveLength(0);expect((await h.db.pool.query(`SELECT * FROM outbox WHERE recipient_id=$1`,[user])).rows).toHaveLength(0);
});
it('missing encryption configuration accepts deletion and anonymous receipt without retaining a destination',async()=>{
 const config=loadConfig({ENVIRONMENT:'test',DATABASE_URL:h.db.url,AUTH_ADAPTER:'test',PLACES_ADAPTER:'fixture',MAIL_ADAPTER:'outbox_test',AI_PROVIDER:'disabled',WEB_ORIGIN,SESSION_SECRET:'deletion-mail-api-synthetic-session-secret'}),app=await buildServer({config,pool:h.db.pool,identity:h.idp,publicOrigin:WEB_ORIGIN});
 try{const local={...h,app},b=new Browser(local),login=await b.signInWithEmail(`${randomUUID()}@example.invalid`),user=login.body.data.session.user.id as string,receiptToken=randomBytes(32).toString('base64url');
 const r=await b.request('POST','/v1/me/deletion',{body:{confirm:true,receiptToken},headers:{'idempotency-key':randomUUID(),'if-match':'"1"'}});expect(r.statusCode,r.body).toBe(202);expect((await h.db.pool.query(`SELECT state,ciphertext FROM deletion_mail_envelopes WHERE user_id=$1`,[user])).rows[0]).toEqual({state:'UNAVAILABLE',ciphertext:null});expect((await b.request('POST','/v1/deletion-status',{body:{receiptToken}})).statusCode).toBe(200);}finally{await app.close();}
});
