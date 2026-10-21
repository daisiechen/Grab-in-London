import {admitResendDispatch} from '../../api/src/mail/receipts.ts';
import {recoveryReady} from '../../api/src/recovery/replay.ts';
import {randomUUID,createHmac} from 'node:crypto';
import {loadConfig,type CoreConfig} from '@fancy/config';
import {createPool,type Pool} from '@fancy/db';
import {sealSourceSnapshot} from '../../api/src/admin/snapshots.ts';
import {UnavailableDeletionStep,type DeletionSteps} from './deletion/provider.ts';
import {Auth0DeletionStep} from './deletion/auth0.ts';
import {deletionHandler} from './handlers/deletion.ts';
import {lifecycleHandler} from './handlers/lifecycle.ts';
import {mailDelivery,logMailDead,UnavailableMailProvider,type MailProvider} from './mail/delivery.ts';
import {ResendMailProvider} from './mail/resend-provider.ts';
import {createRunner,idle} from './runner/runner.ts';

/** Configuration selection never performs I/O; absent credentials remain fail-closed. */
export function mailProviderFor(config:CoreConfig,pool?:Pool):MailProvider {
 if(config.adapters.MAIL_ADAPTER==='provider'&&config.resend)return new ResendMailProvider({...config.resend,webOrigin:config.webOrigin,onDispatch:(input)=>pool?admitResendDispatch(pool,{...input,payloadSha256:createHmac('sha256',config.sessionSecret).update(input.payloadSha256).digest('hex')}):Promise.resolve(false)});
 return new UnavailableMailProvider();
}

export function deletionStepsFor(pool:Pool,config:CoreConfig):DeletionSteps{
 return {auth0:config.adapters.AUTH_ADAPTER==='auth0'&&config.auth0Management?new Auth0DeletionStep(pool,config.auth0Management):new UnavailableDeletionStep(),apple:new UnavailableDeletionStep()};
}
/** Explicit operator declaration, independent of credentials; this does not certify policy content. */
export function deletionPolicyApproved(config:CoreConfig):boolean{
 return !!config.privacyPolicyVersion&&config.retentionPolicy?.accountDeletionApproved===true;
}

/** One runtime owns job leases; external integrations remain unavailable until configured. */
export function createWorkerRuntime(pool:Pool,config:CoreConfig){
 const lifecycle=lifecycleHandler(pool);
 const runner=createRunner({pool,owner:`fancy-worker:${randomUUID()}`,handlers:{
  'meal.close':lifecycle,'meal.start':lifecycle,'meal.end':lifecycle,
  'account.purge':deletionHandler(pool,deletionStepsFor(pool,config),deletionPolicyApproved(config)),
 },onDead:(job,errorCode)=>console.error(JSON.stringify({event:'job_dead',...job,errorCode}))});
 const mail=mailDelivery(pool,mailProviderFor(config,pool),config.environment,{onDead:logMailDead,deletionMailEncryption:config.deletionMailEncryption});
 let lastSnapshot=0;
 async function tick(){
  if(!await recoveryReady(pool))return {claimed:0,done:0,retried:0,dead:0,lost:0};
  const result=await runner.tick();await mail.tick();
  if(Date.now()-lastSnapshot>=3600_000){
   // Coverage starts at the actual ledger installation, never an invented historical date.
   const {rows:[coverage]}=await pool.query<{started_at:Date}>(`SELECT started_at FROM analytics_delivery_coverage WHERE id=1`);
   if(coverage){
    const declared=config.analyticsCoverageStart?new Date(config.analyticsCoverageStart):null;
    const start=declared&&declared>coverage.started_at?declared:coverage.started_at;
    await sealSourceSnapshot(pool,start,{verifiedDiscovery:!!declared,clientTelemetry:!!declared});lastSnapshot=Date.now();
   }
   await pool.query(`DELETE FROM idempotency WHERE expires_at<clock_timestamp()`);
  }
  return result;
 }
 async function run(signal:AbortSignal){while(!signal.aborted){await tick();await idle(signal,1000);}}
 return {tick,run};
}
if(import.meta.main){
 const config=loadConfig(process.env),pool=createPool(config.databaseUrl,{application:'fancy-worker'}),stop=new AbortController();
 process.once('SIGINT',()=>stop.abort());process.once('SIGTERM',()=>stop.abort());
 try{await createWorkerRuntime(pool,config).run(stop.signal);}finally{await pool.end();}
}
