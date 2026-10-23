/** Synthetic P1.1 client rig. No provider credentials, external DB, fixed clock or old rig inputs. */
import {randomBytes} from 'node:crypto';
import {mkdir,writeFile,realpath} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {loadConfig} from '../../packages/config/src/index.ts';
import {migrate} from '../../packages/db/src/index.ts';
import {createMigratedDatabase} from '../../packages/testkit/src/db/index.ts';
import {startPostgres17} from '../../packages/testkit/src/postgres/server.ts';
import {buildServer} from '../../apps/api/src/http/server.ts';
import {createWorkerRuntime} from '../../apps/worker/src/main.ts';
import {localFixtureIdentity} from '../local-acceptance.ts';
import {assertPatchEnvironment,assertDependencyIsolation} from './isolation.ts';

const root=await realpath(resolve(import.meta.dirname,'../..'));
assertPatchEnvironment(process.env,root);await assertDependencyIsolation(root);
const tmp=await realpath(process.env.TMPDIR!);await mkdir(resolve(tmp,'outputs'),{recursive:true});
if(!process.env.FANCY_PG_BIN)throw new Error('PATCH_PG_BIN_REQUIRED');
const pg=await startPostgres17({FANCY_PG_BIN:process.env.FANCY_PG_BIN});
if(!pg.ownership||!pg.ownership.root.startsWith(tmp+'/'))throw new Error('PATCH_PG_OWNERSHIP_REQUIRED');
const db=await createMigratedDatabase(pg.url,migrate);
const config=loadConfig({ENVIRONMENT:'development',DATABASE_URL:db.url,AUTH_ADAPTER:'test',PLACES_ADAPTER:'fixture',MAIL_ADAPTER:'outbox_test',AI_PROVIDER:'disabled',WEB_ORIGIN:'http://127.0.0.1:64174',PORT:'64176',SESSION_SECRET:randomBytes(32).toString('hex'),IOS_REDIRECT_URI:'fancyp11://auth/callback'});
const identity=localFixtureIdentity({FANCY_LOCAL_ACCEPTANCE:'1'});
const app=await buildServer({config,pool:db.pool,identity,publicOrigin:config.webOrigin});
const stop=new AbortController();process.once('SIGINT',()=>stop.abort());process.once('SIGTERM',()=>stop.abort());
await app.listen({host:'127.0.0.1',port:64176});
const manifest={version:'P1.1',mode:'synthetic',root,head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),pid:process.pid,webOrigin:config.webOrigin,apiOrigin:'http://127.0.0.1:64176',pg:{...pg.ownership,marker:undefined},database:new URL(db.url).pathname.slice(1),providers:'disabled',clock:'real',outputs:resolve(tmp,'outputs')};
await writeFile(resolve(tmp,'manifest.json'),JSON.stringify(manifest,null,2),{mode:0o600});
console.info(`P1.1 CLIENT RIG READY; synthetic OTP 000000; manifest=${resolve(tmp,'manifest.json')}`);
try{await createWorkerRuntime(db.pool,config).run(stop.signal);}finally{await app.close();await db.pool.end();console.info('P1.1 API/worker stopped; owned PG preserved.');}
