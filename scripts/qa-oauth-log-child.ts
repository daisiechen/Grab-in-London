/** QA-only log capture with synthetic, valid OAuth code/state; no external account or network. */
import {randomUUID} from 'node:crypto';
import {createPool} from '../packages/db/src/index.ts';
import {loadConfig} from '../packages/config/src/index.ts';
import {buildServer} from '../apps/api/src/http/server.ts';
import {TestIdentityProvider} from '../apps/api/src/identity/test-provider.ts';
process.once('message',async(input:{url:string})=>{
 const pool=createPool(input.url,{application:'qa-oauth-log-child'});
 try{
  const config=loadConfig({ENVIRONMENT:'test',DATABASE_URL:input.url,AUTH_ADAPTER:'test',PLACES_ADAPTER:'fixture',MAIL_ADAPTER:'outbox_test',AI_PROVIDER:'disabled',WEB_ORIGIN:'http://localhost:5174',SESSION_SECRET:'synthetic-oauth-log-secret-0123456789',IOS_REDIRECT_URI:'fancy://auth/callback'}),identity=new TestIdentityProvider('test');
  const app=await buildServer({config,pool,identity,publicOrigin:config.webOrigin});app.log.level='info';
  const headers={origin:config.webOrigin};
  const start=await app.inject({method:'POST',url:'/v1/auth/oauth/start',headers,payload:{clientRequestId:randomUUID(),provider:'GOOGLE',client:'WEB'}});if(start.statusCode!==201)throw Error('QA OAuth start failed');
  const email=`qa-log-${randomUUID()}@example.invalid`,consent=identity.consent(start.json().data.authorizationUrl,{subject:randomUUID(),email});
  const callback=await app.inject({method:'GET',url:`/v1/auth/oauth/callback?code=${consent.code}&state=${consent.state}`,headers:{...headers,cookie:start.cookies.map(c=>`${c.name}=${c.value}`).join('; ')}});
  process.send?.({event:'done',status:callback.statusCode,code:consent.code,state:consent.state,email});
  await app.close();await new Promise<void>(resolve=>app.log.flush(()=>resolve()));await pool.end();process.disconnect();
 }catch(error){process.send?.({event:'error',name:error instanceof Error?error.name:'unknown'});await pool.end();process.exitCode=1;process.disconnect();}
});
