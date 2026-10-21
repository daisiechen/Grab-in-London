/** Disposable local integration rig. Never deploy this test identity provider. */
import type {IdentityProvider} from '../apps/api/src/identity/provider.ts';
import {randomBytes,randomUUID} from 'node:crypto';
import {loadConfig} from '../packages/config/src/index.ts';
import {migrate} from '../packages/db/src/index.ts';
import {startPostgres17} from '../packages/testkit/src/postgres/server.ts';
import {createMigratedDatabase} from '../packages/testkit/src/db/index.ts';
import {buildServer} from '../apps/api/src/http/server.ts';
import {TestIdentityProvider} from '../apps/api/src/identity/test-provider.ts';
import {createWorkerRuntime} from '../apps/worker/src/main.ts';

export const LOCAL_STAFF_EMAIL='qa-staff@example.invalid';
const WEB_ORIGIN='http://127.0.0.1:5174';
function assertLocal(env:NodeJS.ProcessEnv){
 if(env.FANCY_LOCAL_ACCEPTANCE!=='1'||(env.ENVIRONMENT&&env.ENVIRONMENT!=='development'))throw new Error('Explicit local acceptance mode is required');
}
export function localFixtureIdentity(env:NodeJS.ProcessEnv){
 assertLocal(env);
 const testIdentity=new TestIdentityProvider('development');
 const identity:IdentityProvider=testIdentity,verify=identity.verifyEmailOtp.bind(identity);
 identity.verifyEmailOtp=async input=>{
  const result=await verify({...input,code:input.code==='000000'?testIdentity.inbox.get(input.email)?.at(-1)??input.code:input.code});
  // Synthetic MFA is only for the explicit local staff fixture; it is not provider MFA evidence.
  return result&&env.FANCY_LOCAL_STAFF_FIXTURE==='1'&&input.email===LOCAL_STAFF_EMAIL?{...result,amr:['otp','mfa']}:result;
 };
 return identity;
}
export async function seedLocalStaff(app:Awaited<ReturnType<typeof buildServer>>,pool:Parameters<typeof buildServer>[0]['pool'],env:NodeJS.ProcessEnv){
 assertLocal(env);if(env.FANCY_LOCAL_STAFF_FIXTURE!=='1')return;
 const headers={origin:WEB_ORIGIN};
 const start=await app.inject({method:'POST',url:'/v1/auth/email/start',headers,payload:{clientRequestId:randomUUID(),email:LOCAL_STAFF_EMAIL,client:'WEB'}});
 if(start.statusCode!==201)throw new Error('Local staff fixture start failed');
 const cookie=start.cookies.map(c=>`${c.name}=${c.value}`).join('; ');
 const verify=await app.inject({method:'POST',url:'/v1/auth/email/verify',headers:{...headers,cookie},payload:{clientRequestId:randomUUID(),challengeId:start.json().data.challengeId,code:'000000'}});
 if(verify.statusCode!==200||verify.json().data.outcome!=='AUTHENTICATED')throw new Error('Local staff fixture sign-in failed');
 const session=verify.json().data.session;
 await pool.query(`INSERT INTO roles(user_id,role,granted_by) SELECT $1,role,'local-acceptance-fixture' FROM unnest(ARRAY['analyst','data_admin']) AS role ON CONFLICT DO NOTHING`,[session.user.id]);
 // Bootstrap credentials remain local to this function and are revoked, never printed or reused.
 const logout=await app.inject({method:'POST',url:'/v1/auth/logout',headers:{...headers,cookie:verify.cookies.map(c=>`${c.name}=${c.value}`).join('; '),'x-csrf-token':session.csrfToken},payload:{clientRequestId:randomUUID()}});
 if(logout.statusCode!==204)throw new Error('Local staff fixture bootstrap logout failed');
 // Remove only the consumed bootstrap OTP, so it does not consume the first browser resend window.
 await pool.query(`DELETE FROM auth_transactions WHERE id=$1 AND kind='EMAIL_OTP' AND consumed_at IS NOT NULL`,[start.json().data.challengeId]);
}
async function main(){
 assertLocal(process.env);
 const pg=await startPostgres17(),db=await createMigratedDatabase(pg.url,migrate),stop=new AbortController();
 const config=loadConfig({ENVIRONMENT:'development',DATABASE_URL:db.url,AUTH_ADAPTER:'test',PLACES_ADAPTER:'fixture',MAIL_ADAPTER:'outbox_test',AI_PROVIDER:'mock',WEB_ORIGIN,SESSION_SECRET:randomBytes(32).toString('hex'),IOS_REDIRECT_URI:'fancy://auth/callback'});
 const identity=localFixtureIdentity(process.env);
 const app=await buildServer({config,pool:db.pool,identity,publicOrigin:config.webOrigin});
 try{
  await seedLocalStaff(app,db.pool,process.env);
  await app.listen({port:3000,host:'127.0.0.1'});
  const worker=createWorkerRuntime(db.pool,config).run(stop.signal);
  const close=()=>stop.abort();process.once('SIGINT',close);process.once('SIGTERM',close);
  console.warn('LOCAL FIXTURE ACCEPTANCE ONLY: API 127.0.0.1:3000; Web/Admin serially 127.0.0.1:5174; email code 000000. No real email, maps, identity or AI integration.');
  if(process.env.FANCY_LOCAL_STAFF_FIXTURE==='1')console.warn(`SYNTHETIC STAFF ONLY: ${LOCAL_STAFF_EMAIL}; analyst/data_admin; fixture MFA, not real MFA.`);
  await worker;
 }finally{await app.close();await db.drop();await pg.stop();}
}
if(import.meta.main)await main();
