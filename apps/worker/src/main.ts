import {randomUUID} from 'node:crypto';
import {loadConfig,type CoreConfig} from '@fancy/config';
import {createPool,type Pool} from '@fancy/db';
import {sealSourceSnapshot} from '../../api/src/admin/snapshots.ts';
import {deletionHandler,UnavailableDeletionProvider} from './handlers/deletion.ts';
import {lifecycleHandler} from './handlers/lifecycle.ts';
import {mailDelivery,UnavailableMailProvider} from './mail/delivery.ts';
import {createRunner,idle} from './runner/runner.ts';

/** One runtime owns job leases; external integrations remain unavailable until configured. */
export function createWorkerRuntime(pool:Pool,config:CoreConfig){
 const lifecycle=lifecycleHandler(pool);
 const runner=createRunner({pool,owner:`fancy-worker:${randomUUID()}`,handlers:{
  'meal.close':lifecycle,'meal.start':lifecycle,'meal.end':lifecycle,
  'account.purge':deletionHandler(pool,new UnavailableDeletionProvider()),
 },onDead:(job,errorCode)=>console.error(JSON.stringify({event:'job_dead',...job,errorCode}))});
 const mail=mailDelivery(pool,new UnavailableMailProvider(),config.environment);
 let lastSnapshot=0;
 async function tick(){
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
