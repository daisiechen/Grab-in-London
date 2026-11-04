/** Local integration rig; shutdown preserves its owned PostgreSQL cluster by default. */
import {writeRigReceipt,cleanupOwnedRig} from './local-rig-owner.ts';
import {createInterface} from 'node:readline';
import {RigAdvanceError,advanceRigClock,createLocalClock,localClockGate,parseClockCommand,type LocalClock} from './local-clock.ts';
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
 await pool.query(`INSERT INTO roles(user_id,role,granted_by) SELECT $1,role,'local-acceptance-fixture' FROM unnest(ARRAY['analyst','data_admin','support']) AS role ON CONFLICT DO NOTHING`,[session.user.id]);
 // Bootstrap credentials remain local to this function and are revoked, never printed or reused.
 const logout=await app.inject({method:'POST',url:'/v1/auth/logout',headers:{...headers,cookie:verify.cookies.map(c=>`${c.name}=${c.value}`).join('; '),'x-csrf-token':session.csrfToken},payload:{clientRequestId:randomUUID()}});
 if(logout.statusCode!==204)throw new Error('Local staff fixture bootstrap logout failed');
 // Remove only the consumed bootstrap OTP, so it does not consume the first browser resend window.
 await pool.query(`DELETE FROM auth_transactions WHERE id=$1 AND kind='EMAIL_OTP' AND consumed_at IS NOT NULL`,[start.json().data.challengeId]);
}
async function settleWithin(job:Promise<unknown>,timeoutMs=10_000){
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{await Promise.race([job,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('LOCAL_RIG_SHUTDOWN_TIMEOUT')),timeoutMs);})]);}finally{clearTimeout(timer);}
}
async function runClockRig(clock:LocalClock,gate:ReturnType<typeof localClockGate>,runtime:ReturnType<typeof createWorkerRuntime>){
 let stopped=false,abort=new AbortController(),worker=runtime.run(abort.signal),queued=Promise.resolve();
 let finish!:()=>void;const done=new Promise<void>(resolve=>{finish=resolve;});
 const watch=()=>{void worker.catch(()=>{stopped=true;gate.block();process.exitCode=1;finish();});};watch();
 const reader=createInterface({input:process.stdin,terminal:false});
 const close=()=>{stopped=true;reader.close();finish();};process.once('SIGINT',close);process.once('SIGTERM',close);
 reader.on('line',line=>{
  queued=queued.then(async()=>{
   if(stopped)return;let transition=false;
   try{
    const value=parseClockCommand(line);clock.validateAdvanceTo(value);transition=true;
    await advanceRigClock(clock,gate,{stop:async()=>{abort.abort();await worker;},tick:()=>runtime.tick(),start:()=>{abort=new AbortController();worker=runtime.run(abort.signal);watch();}},value);
    console.warn(`FIXED LOCAL CLOCK ${clock.now()}`);
   }catch(error){
    if(error instanceof RigAdvanceError)console.warn(JSON.stringify({fixtureClockFailure:error.diagnostic}));
    if(transition){stopped=true;gate.block();abort.abort();process.exitCode=1;console.warn(`LOCAL CLOCK STOPPED; current=${clock.now()}; data preserved; inspect phase diagnostic`);finish();}
    else console.warn(`LOCAL CLOCK COMMAND REJECTED; current=${clock.now()}`);
   }
  });
 });
 try{await done;}finally{stopped=true;reader.close();await queued;abort.abort();await settleWithin(worker).catch(()=>{console.warn('LOCAL RIG WORKER STOP INCOMPLETE; DATA PRESERVED; active work unknown');});process.removeListener('SIGINT',close);process.removeListener('SIGTERM',close);}
}
/** No drop/stop capability is accepted by this shutdown boundary. */
export async function preserveLocalRig(resources:{closeApp:()=>Promise<unknown>;closeClock:()=>Promise<unknown>;closePool:()=>Promise<unknown>}){
 try{await resources.closeApp();}finally{try{await resources.closeClock();}finally{await resources.closePool();}}
}
async function main(){
 assertLocal(process.env);
 if(process.env.FANCY_LOCAL_CLOCK==='1'&&process.env.FANCY_TEST_DATABASE_URL)throw new Error('Clock rig requires a new disposable PostgreSQL cluster');
 const pg=await startPostgres17();
 const receipt=await writeRigReceipt(pg);
 console.warn(`LOCAL RIG OWNERSHIP RECEIPT ${receipt}; default shutdown preserves PostgreSQL and data.`);
 let cleanupDb:Awaited<ReturnType<typeof createMigratedDatabase>>|undefined;
 let clock:LocalClock|undefined;let app:Awaited<ReturnType<typeof buildServer>>|undefined;
 try{
 const db=await createMigratedDatabase(pg.url,migrate);cleanupDb=db;await writeRigReceipt(pg,new URL(db.url).pathname.slice(1));
 if(process.env.FANCY_LOCAL_CLOCK==='1')clock=await createLocalClock(db,process.env);
 const pool=clock?.pool??db.pool;
 const config=loadConfig({ENVIRONMENT:'development',DATABASE_URL:db.url,AUTH_ADAPTER:'test',PLACES_ADAPTER:'fixture',MAIL_ADAPTER:'outbox_test',AI_PROVIDER:'mock',WEB_ORIGIN,SESSION_SECRET:randomBytes(32).toString('hex'),IOS_REDIRECT_URI:'fancy://auth/callback'});
 const identity=localFixtureIdentity(process.env);
 app=await buildServer({config,pool,identity,publicOrigin:config.webOrigin});
 const gate=clock?localClockGate(app):undefined;
  await seedLocalStaff(app,pool,process.env);
  await app.listen({port:3000,host:'127.0.0.1'});
  console.warn('LOCAL FIXTURE ACCEPTANCE ONLY: API 127.0.0.1:3000; Web/Admin serially 127.0.0.1:5174; email code 000000. No real email, maps, identity or AI integration.');
  if(process.env.FANCY_LOCAL_STAFF_FIXTURE==='1')console.warn(`SYNTHETIC STAFF ONLY: ${LOCAL_STAFF_EMAIL}; analyst/data_admin/support; fixture MFA, not real MFA.`);
  if(clock&&gate){
   console.warn(`FIXED LOCAL CLOCK ${clock.now()}; stdin: {"advanceTo":"YYYY-MM-DDTHH:mm:ss.sssZ"}. Browser clock remains real.`);
   await runClockRig(clock,gate,createWorkerRuntime(pool,config));
  }else{
   const stop=new AbortController(),close=()=>stop.abort();process.once('SIGINT',close);process.once('SIGTERM',close);
   try{await createWorkerRuntime(pool,config).run(stop.signal);}finally{process.removeListener('SIGINT',close);process.removeListener('SIGTERM',close);}
  }
 }finally{await preserveLocalRig({closeApp:()=>app?settleWithin(app.close()):Promise.resolve(),closeClock:()=>clock?.close()??Promise.resolve(),closePool:()=>cleanupDb?.pool.end()??Promise.resolve()});console.warn(`LOCAL RIG DATA PRESERVED; receipt=${receipt}; app.close may write AI recovery metadata; active work not certified quiescent`);}
}
if(import.meta.main){
 const args=process.argv.slice(2);
 try{if(args.length){if(args.length!==4||args[0]!=='--cleanup-own'||args[2]!=='--owner')throw new Error('OWN_CLEANUP_REFUSED');await cleanupOwnedRig(args[1]!,args[3]!);}else await main();}
 catch{console.warn('LOCAL RIG STOPPED; DATA PRESERVATION REQUIRED; inspect ownership receipt and phase metadata');process.exitCode=1;}
}
