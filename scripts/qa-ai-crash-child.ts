/** QA-only child process. IPC accepts synthetic database/session material; nothing is logged or persisted here. */
import {randomBytes,randomUUID} from 'node:crypto';
import {createPool} from '../packages/db/src/index.ts';
import {loadConfig} from '../packages/config/src/index.ts';
import {mockProvider} from '../packages/assistant/src/index.ts';
import {buildServer} from '../apps/api/src/http/server.ts';
import {TestIdentityProvider} from '../apps/api/src/identity/test-provider.ts';
type Input={url:string;accessToken:string;requestId:string;mode:'dispatch'|'recover';sessionId?:string;deviceToken?:string};
process.once('message',async(input:Input)=>{
 const pool=createPool(input.url,{application:'qa-ai-crash-child'});let calls=0;
 try{
  const config=loadConfig({ENVIRONMENT:'test',DATABASE_URL:input.url,AUTH_ADAPTER:'test',PLACES_ADAPTER:'fixture',MAIL_ADAPTER:'outbox_test',AI_PROVIDER:'mock',WEB_ORIGIN:'http://localhost:5174',SESSION_SECRET:'synthetic-process-restart-secret-012345',IOS_REDIRECT_URI:'fancy://auth/callback'});
  const app=await buildServer({config,pool,identity:new TestIdentityProvider('test'),publicOrigin:config.webOrigin,assistant:{allowedAreas:[],provider:mockProvider('test',async request=>{calls++;process.send?.({event:'dispatch',callId:request.callId});return new Promise(()=>{});}),price:{version:'synthetic-process-test-not-real',verified:true,inputMicroCnyPerMillion:1000000n,outputMicroCnyPerMillion:1000000n,validUntil:Date.now()+300000},countInputTokens:()=>1024}});
  const auth={authorization:`Bearer ${input.accessToken}`};let sessionId=input.sessionId,deviceToken=input.deviceToken;
  if(input.mode==='dispatch'){
   const boot=await app.inject({method:'POST',url:'/v1/ai/sessions',headers:{...auth,'idempotency-key':randomUUID()},payload:{deviceChallenge:randomBytes(32).toString('base64url')}});
   if(boot.statusCode!==201)throw Error('QA bootstrap failed');const data=boot.json().data;sessionId=data.sessionId;deviceToken=data.deviceToken;
  }
  const response=await app.inject({method:'POST',url:`/v1/ai/sessions/${sessionId}/requests`,headers:{...auth,'ai-device-token':deviceToken!,'idempotency-key':input.requestId},payload:{requestId:input.requestId,generation:1,input:'Find meals',sourcePage:'DISCOVER',queryVersion:'0',preferenceVersion:'0',contextVersion:'0'}});
  process.send?.({event:input.mode==='dispatch'?'accepted':'recovered',status:response.statusCode,sessionId,deviceToken,calls,errorCode:response.json().error?.code??null});
  if(input.mode==='recover'){await app.close();await pool.end();process.disconnect();}
 }catch(error){process.send?.({event:'error',name:error instanceof Error?error.name:'unknown'});await pool.end();process.exitCode=1;process.disconnect();}
});
