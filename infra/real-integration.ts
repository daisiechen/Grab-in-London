/** Isolated real-provider development entry. Default is configuration-only; never seeds users or starts mail/AI workers. */
import {readFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {randomBytes} from 'node:crypto';
import {spawn,type ChildProcess} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {createRequire} from 'node:module';
import {loadConfig} from '../packages/config/src/index.ts';
import {migrate} from '../packages/db/src/index.ts';
import {startPostgres17} from '../packages/testkit/src/postgres/server.ts';
import {createMigratedDatabase} from '../packages/testkit/src/db/index.ts';
import {buildServer} from '../apps/api/src/http/server.ts';
import {Auth0IdentityProvider} from '../apps/api/src/identity/auth0-provider.ts';
import {GooglePlacesProvider} from '../apps/api/src/venues/google-provider.ts';
const root=fileURLToPath(new URL('../',import.meta.url));
const origin='http://127.0.0.1:5174';
const required=['AUTH0_DOMAIN','AUTH0_CLIENT_ID','AUTH0_CLIENT_SECRET','GOOGLE_MAPS_API_KEY'] as const;
const reject=()=>new Error('REAL_INTEGRATION_CONFIGURATION_INVALID');
export function buildRealPlan(values:NodeJS.ProcessEnv,_runtime:NodeJS.ProcessEnv){
 const missing=required.filter(key=>!values[key]?.trim());if(missing.length)throw new Error('Missing configuration keys: '+missing.join(', '));
 if(!/^[a-z0-9.-]+$/i.test(values.AUTH0_DOMAIN!))throw reject();
 const allowed=Object.fromEntries(required.map(key=>[key,values[key]]));
 try{
  const config=loadConfig({...allowed,ENVIRONMENT:'development',DATABASE_URL:'postgres://fancy@127.0.0.1:1/isolated_pending',AUTH_ADAPTER:'auth0',PLACES_ADAPTER:'google',MAIL_ADAPTER:'provider',AI_PROVIDER:'disabled',WEB_ORIGIN:origin,PORT:'62074',LOG_LEVEL:'error',SESSION_SECRET:values.SESSION_SECRET||randomBytes(32).toString('hex')});
  return {config};
 }catch{throw reject();}
}
export function publicPlan(_plan:ReturnType<typeof buildRealPlan>){return {mode:'real-provider-development',webOrigin:origin,identity:'auth0',places:'google',database:'new-disposable-pg17',ai:'disabled',businessMailWorker:'not-started',credentials:'not-displayed',startRequires:'explicit-real-mode-and-QA-port-release'};}
export function assertRealStartAllowed(env:NodeJS.ProcessEnv){if(env.FANCY_REAL_INTEGRATION!=='1'||env.FANCY_REAL_PORT_5174_RELEASED!=='1')throw new Error('Real integration start requires explicit mode and QA release of port 5174.');}
export function postgresEnvironment(env:NodeJS.ProcessEnv):NodeJS.ProcessEnv{return env.FANCY_PG_BIN?{FANCY_PG_BIN:env.FANCY_PG_BIN}:{};}
export function webChildEnvironment(env:NodeJS.ProcessEnv,apiOrigin:string):NodeJS.ProcessEnv{
 const result:NodeJS.ProcessEnv={};for(const key of ['PATH','HOME','TMPDIR','LANG','LC_ALL'])if(env[key])result[key]=env[key];
 return {...result,FANCY_API_ORIGIN:apiOrigin};
}
async function stopChild(child:ChildProcess|undefined){
 if(!child||child.exitCode!==null||child.signalCode!==null)return;
 await new Promise<void>(done=>{const timer=setTimeout(()=>{child.kill('SIGKILL');},3000);child.once('exit',()=>{clearTimeout(timer);done();});child.kill('SIGTERM');});
}
async function start(plan:ReturnType<typeof buildRealPlan>,env:NodeJS.ProcessEnv){
 assertRealStartAllowed(env);
 // Deliberately omit external DATABASE_URL/FANCY_TEST_DATABASE_URL. This always creates an owned cluster.
 const pg=await startPostgres17(postgresEnvironment(env));
 let db:Awaited<ReturnType<typeof createMigratedDatabase>>|undefined,app:Awaited<ReturnType<typeof buildServer>>|undefined,web:ChildProcess|undefined;
 try{
  db=await createMigratedDatabase(pg.url,migrate);
  const config={...plan.config,databaseUrl:db.url};
  app=await buildServer({config,pool:db.pool,identity:new Auth0IdentityProvider(config.auth0!),placesProvider:new GooglePlacesProvider(config.googleMapsApiKey!),publicOrigin:origin});
  const apiOrigin=await app.listen({host:'127.0.0.1',port:0});
  // Existing Web .env.local contains browser-public keys only; root credentials never enter this child.
  const webRoot=resolve(root,'apps/web');
  const require=createRequire(resolve(webRoot,'package.json'));
  const vite=resolve(dirname(require.resolve('vite/package.json')),'bin/vite.js');
  web=spawn(process.execPath,[vite],{cwd:webRoot,env:webChildEnvironment(env,apiOrigin),stdio:'ignore'});
  await new Promise<void>((done,fail)=>{
   const cleanup=()=>{process.removeListener('SIGINT',close);process.removeListener('SIGTERM',close);web!.removeListener('error',childError);web!.removeListener('exit',childExit);};
   const close=()=>{cleanup();done();};
   const childError=()=>{cleanup();fail(new Error('REAL_INTEGRATION_WEB_START_FAILED'));};
   const childExit=(code:number|null)=>{cleanup();if(code===0)done();else fail(new Error('REAL_INTEGRATION_WEB_EXITED'));};
   process.once('SIGINT',close);process.once('SIGTERM',close);web!.once('error',childError);web!.once('exit',childExit);
   console.warn('Real-provider integration starting on 127.0.0.1:5174; isolated database, AI disabled, no business mail worker. No credentials or provider URLs are logged.');
  });
 }finally{try{await stopChild(web);}finally{try{await app?.close();}finally{try{await db?.drop();}finally{await pg.stop();}}}}
}
export async function main(args=process.argv.slice(2),env=process.env){
 if(args.some(arg=>arg!=='--start'&&arg!=='--dry-run')||args.includes('--start')&&args.includes('--dry-run'))throw reject();
 // Read the existing root source in-process, never copy it or merge its unrestricted environment.
 const values=parseEnv(await readFile(resolve(root,'.env'),'utf8'));
 const plan=buildRealPlan(values,env);
 if(!args.includes('--start')){console.warn(JSON.stringify(publicPlan(plan)));return;}
 await start(plan,env);
}
if(import.meta.main){try{await main();}catch{console.error('Real integration could not start or validate. Check required key presence, isolated PostgreSQL17 and explicit port release; private provider/configuration details are withheld.');process.exitCode=1;}}
