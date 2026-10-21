/** QA child: enable the actual Fastify/Pino logger, exercise fault/retry/receipt, capture stdout only in parent. */
import {randomUUID} from 'node:crypto';
import {createPool} from '../packages/db/src/index.ts';
import {loadConfig} from '../packages/config/src/index.ts';
import {buildServer} from '../apps/api/src/http/server.ts';
import {TestIdentityProvider} from '../apps/api/src/identity/test-provider.ts';
process.once('message',async(input:{url:string;accessToken:string;receiptToken:string;userId:string})=>{
 const pool=createPool(input.url,{application:'qa-deletion-log-child'});
 try{
  const config=loadConfig({ENVIRONMENT:'test',DATABASE_URL:input.url,AUTH_ADAPTER:'test',PLACES_ADAPTER:'fixture',MAIL_ADAPTER:'outbox_test',AI_PROVIDER:'disabled',WEB_ORIGIN:'http://localhost:5174',SESSION_SECRET:'synthetic-deletion-log-secret-01234567',IOS_REDIRECT_URI:'fancy://auth/callback'});
  const app=await buildServer({config,pool,identity:new TestIdentityProvider('test'),publicOrigin:config.webOrigin});app.log.level='info';
  // All values are synthetic. The exception deliberately contains the receipt secret to prove error messages are excluded.
  await pool.query(`CREATE FUNCTION qa_reject_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION '${input.receiptToken}'; END $$; CREATE TRIGGER qa_reject_receipt BEFORE INSERT ON deletion_journal FOR EACH ROW EXECUTE FUNCTION qa_reject_receipt()`);
  const headers={authorization:`Bearer ${input.accessToken}`,'if-match':'"1"','idempotency-key':randomUUID()},payload={confirm:true,receiptToken:input.receiptToken};
  const failed=await app.inject({method:'POST',url:'/v1/me/deletion',headers,payload});
  const intact=(await pool.query('SELECT status FROM users WHERE id=$1',[input.userId])).rows[0].status;
  const stillSignedIn=await app.inject({method:'GET',url:'/v1/auth/session',headers:{authorization:headers.authorization}});
  await pool.query('DROP TRIGGER qa_reject_receipt ON deletion_journal; DROP FUNCTION qa_reject_receipt()');
  const accepted=await app.inject({method:'POST',url:'/v1/me/deletion',headers,payload});
  const revoked=await app.inject({method:'GET',url:'/v1/auth/session',headers:{authorization:headers.authorization}});
  const status=await app.inject({method:'POST',url:'/v1/deletion-status',payload:{receiptToken:input.receiptToken}});
  process.send?.({event:'done',failed:failed.statusCode,intact,stillSignedIn:stillSignedIn.statusCode,accepted:accepted.statusCode,revoked:revoked.statusCode,receipt:status.statusCode,fields:Object.keys(status.json().data??{}).sort(),receiptContainsToken:status.body.includes(input.receiptToken)});
  await app.close();await new Promise<void>(resolve=>app.log.flush(()=>resolve()));await pool.end();process.disconnect();
 }catch(error){process.send?.({event:'error',name:error instanceof Error?error.name:'unknown'});await pool.end();process.exitCode=1;process.disconnect();}
});
