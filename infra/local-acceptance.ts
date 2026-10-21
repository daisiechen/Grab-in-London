/** Disposable local integration rig. Never deploy this test identity provider. */
import {randomBytes} from 'node:crypto';
import {loadConfig} from '../packages/config/src/index.ts';
import {migrate} from '../packages/db/src/index.ts';
import {startPostgres17} from '../packages/testkit/src/postgres/server.ts';
import {createMigratedDatabase} from '../packages/testkit/src/db/index.ts';
import {buildServer} from '../apps/api/src/http/server.ts';
import {TestIdentityProvider} from '../apps/api/src/identity/test-provider.ts';
import {createWorkerRuntime} from '../apps/worker/src/main.ts';

if(process.env.FANCY_LOCAL_ACCEPTANCE!=='1'||(process.env.ENVIRONMENT&&process.env.ENVIRONMENT!=='development'))throw new Error('Explicit local acceptance mode is required');
const pg=await startPostgres17(),db=await createMigratedDatabase(pg.url,migrate),stop=new AbortController();
const config=loadConfig({ENVIRONMENT:'development',DATABASE_URL:db.url,AUTH_ADAPTER:'test',PLACES_ADAPTER:'fixture',MAIL_ADAPTER:'outbox_test',AI_PROVIDER:'mock',WEB_ORIGIN:'http://127.0.0.1:5174',SESSION_SECRET:randomBytes(32).toString('hex'),IOS_REDIRECT_URI:'fancy://auth/callback'});
const identity=new TestIdentityProvider('development');
const verify=identity.verifyEmailOtp.bind(identity);
identity.verifyEmailOtp=async input=>verify({...input,code:input.code==='000000'?identity.inbox.get(input.email)?.at(-1)??input.code:input.code});
const app=await buildServer({config,pool:db.pool,identity,publicOrigin:config.webOrigin});
await app.listen({port:3000,host:'127.0.0.1'});
const worker=createWorkerRuntime(db.pool,config).run(stop.signal);
const close=()=>stop.abort();process.once('SIGINT',close);process.once('SIGTERM',close);
console.warn('LOCAL FIXTURE ACCEPTANCE ONLY: API 127.0.0.1:3000; Web 127.0.0.1:5174; email code 000000. No real email, maps, identity or AI integration.');
try{await worker;}finally{await app.close();await db.drop();await pg.stop();}
