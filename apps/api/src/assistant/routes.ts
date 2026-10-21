import type { FastifyInstance,FastifyRequest } from 'fastify';
import { AssistantError,type SessionBinding } from '../../../../packages/assistant/src/index.ts';
import { DomainError } from '../common/errors.ts';
import type { AppDeps,AuthContext } from '../http/context.ts';
import { defineRoute } from '../http/routes.ts';
import { assertCsrf,assertWebOrigin,cookieOptions,csrfTokenFor,keyedHash } from '../http/security.ts';
import { AssistantController,type AssistantTurn } from './controller.ts';
import { authenticateGuest,createGuest } from './sessions.ts';
const GUEST_COOKIE='__Host-fancy_guest';
const bridge=async<T>(action:()=>Promise<T>):Promise<T>=>{
  try{return await action();}catch(e){if(e instanceof AssistantError)throw new DomainError(e.code,'The assistant request could not be completed. Please refresh or start again.');throw e;}
};
const fieldsDto=(row:Record<string,unknown>)=>({fields:row.fields,version:row.version,epoch:row.epoch,confirmedAt:row.confirmed_at instanceof Date?row.confirmed_at.toISOString():null});
function intentKey(request:FastifyRequest){if(typeof request.headers['idempotency-key']!=='string'||!/^[0-9a-f-]{36}$/i.test(request.headers['idempotency-key']))throw new DomainError('VALIDATION_FAILED','An explicit request intent key is required.');}

/** Core envelope/security hooks remain active. AI never uses persistent response-body idempotency. */
export function registerAssistantRoutes(app:FastifyInstance,deps:AppDeps,controller:AssistantController){
  async function subject(request:FastifyRequest,auth:AuthContext|null){
    if(auth)return `user:${auth.userId}`;
    const bearer=/^Bearer ([A-Za-z0-9_-]{43})$/.exec(request.headers.authorization??'');
    const cookie=request.cookies[GUEST_COOKIE];const token=bearer?.[1]??cookie;
    if(!token)throw new DomainError('AUTH_REQUIRED','Start a guest session or sign in.');
    const s=await authenticateGuest(deps.pool,token);
    if(!bearer&&request.method!=='GET'){
      assertWebOrigin(request,deps.config.webOrigin);
      assertCsrf(request,deps.config.sessionSecret,s);
    }
    return s;
  }
  async function binding(request:FastifyRequest,auth:AuthContext|null,id:string,generation?:number):Promise<SessionBinding>{
    const principal=await subject(request,auth);
    const deviceToken=request.headers['ai-device-token'];
    if(typeof deviceToken!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(deviceToken))throw new AssistantError('AI_SESSION_EXPIRED');
    const {rows:[meta]}=await deps.pool.query(`SELECT generation::text,preference_epoch::text FROM ai_session_meta WHERE id=$1 AND subject=$2`,[id,principal]);
    if(!meta)throw new AssistantError('AI_SESSION_EXPIRED');
    return {subject:principal,deviceToken,generation:generation??Number(meta.generation),preferenceEpoch:meta.preference_epoch};
  }
  defineRoute(app,deps,'createGuestSession',async({request})=>bridge(async()=>{
    const body=request.body as {clientRequestId:string;client:'WEB'|'IOS'};
    if(body.client==='WEB'||request.headers.origin!==undefined)assertWebOrigin(request,deps.config.webOrigin);
    // A page reload loses RAM bootstrap state, not the fixed 24h quota subject.
    // Reuse its HttpOnly credential without extending the cookie/database expiry.
    const existing=body.client==='WEB'?request.cookies[GUEST_COOKIE]:undefined;
    if(existing){
      try{
        const principal=await authenticateGuest(deps.pool,existing);
        const {rows:[current]}=await deps.pool.query<{expires_at:Date}>(`SELECT expires_at FROM guest_sessions WHERE id=$1`,[principal.slice(6)]);
        if(current)return {data:{guestToken:null,csrfToken:csrfTokenFor(deps.config.sessionSecret,principal),expiresAt:current.expires_at.toISOString()}};
      }catch(error){if(!(error instanceof AssistantError)||error.code!=='AI_SESSION_EXPIRED')throw error;}
    }
    const guest=await createGuest(deps.pool,body.clientRequestId,keyedHash(deps.config.sessionSecret,'ai-guest-ip',request.ip));
    const web=body.client==='WEB';
    return {data:{guestToken:web?null:guest.token,csrfToken:web?csrfTokenFor(deps.config.sessionSecret,`guest:${guest.id}`):null,expiresAt:guest.expiresAt.toISOString()},after:(reply)=>{if(web)reply.setCookie(GUEST_COOKIE,guest.token,cookieOptions(24*60*60));}};
  }));
  defineRoute(app,deps,'readAIPreferences',async({auth})=>bridge(async()=>({data:fieldsDto(await controller.preferences.read(auth!.userId))})));
  defineRoute(app,deps,'replaceAIPreferences',async({request,auth,ifMatch})=>bridge(async()=>{
    intentKey(request);const body=request.body as {fields:unknown;confirmation:boolean;proposalId?:string;sessionId?:string;generation?:number};
    if(body.proposalId){if(!body.sessionId||!body.generation)throw new DomainError('VALIDATION_FAILED','The preference proposal needs its original session.');await controller.confirmProposal(body.sessionId,await binding(request,auth,body.sessionId,body.generation),body.proposalId,body.fields,ifMatch!);}
    const data=fieldsDto(await controller.preferences.replace(auth!.userId,ifMatch!,body.fields,body.confirmation));return {data,version:String(data.version)};
  }));
  defineRoute(app,deps,'deleteAIPreferences',async({request,auth,ifMatch})=>bridge(async()=>{
    intentKey(request);const data=fieldsDto(await controller.preferences.remove(auth!.userId,ifMatch!));return {data,version:String(data.version)};
  }));
  defineRoute(app,deps,'bootstrapAI',async({request,auth})=>bridge(async()=>{
    intentKey(request);const s=await subject(request,auth);const body=request.body as {deviceChallenge:string;previousRevokeHandle?:string};
    const created=await controller.sessions.create(s,body.previousRevokeHandle,body.deviceChallenge);
    return {data:{sessionId:created.id,generation:created.generation,deviceToken:created.deviceToken,revokeHandle:created.revokeHandle,expiresAt:new Date(created.expiresAt).toISOString()}};
  }));
  defineRoute(app,deps,'readAI',async({request,auth})=>bridge(async()=>{
    const {sessionId}=request.params as {sessionId:string};const b=await binding(request,auth,sessionId);const session=await controller.sessions.read(sessionId,b);
    const {rows:[latest]}=await deps.pool.query(`SELECT request_id FROM ai_requests WHERE session_id=$1 AND subject=$2 ORDER BY created_at DESC LIMIT 1`,[sessionId,b.subject]);
    return {data:{sessionId,generation:b.generation,expiresAt:new Date(session.expiresAt).toISOString(),turns:session.messages,latestRequestId:latest?.request_id??null}};
  }));
  defineRoute(app,deps,'activityAI',async({request,auth})=>bridge(async()=>{
    const {sessionId}=request.params as {sessionId:string};const body=request.body as {generation:number;activityType:'SEND'|'EDIT'|'EXPLICIT_ACTION';activityEventId:string};
    const b=await binding(request,auth,sessionId,body.generation);const active=await controller.sessions.activity(sessionId,b,body.activityEventId,body.activityType);
    return {data:{expiresAt:new Date(active.expiresAt).toISOString()}};
  }));
  defineRoute(app,deps,'resetAI',async({request,auth})=>bridge(async()=>{
    intentKey(request);const {sessionId}=request.params as {sessionId:string};const {generation}=request.body as {generation:number};
    await controller.sessions.reset(sessionId,await binding(request,auth,sessionId,generation));return {};
  }));
  defineRoute(app,deps,'requestAI',async({request,auth})=>bridge(async()=>{
    const {sessionId}=request.params as {sessionId:string};const turn=request.body as AssistantTurn;
    return {data:await controller.request(sessionId,await binding(request,auth,sessionId,turn.generation),turn)};
  }));
  defineRoute(app,deps,'validateAIDraft',async({request,auth})=>bridge(async()=>{
    intentKey(request);const {draftId}=request.params as {draftId:string};
    const body=request.body as {sessionId:string;generation:number;editorKind:'APPLICATION'|'CREATE'|'GROUP';targetId:string|null;editorVersion:string;replaceConfirmed:boolean};
    return {data:await controller.transfer(body.sessionId,await binding(request,auth,body.sessionId,body.generation),{draftId,editorKind:body.editorKind,targetId:body.targetId,editorVersion:body.editorVersion,replaceConfirmed:body.replaceConfirmed})};
  }));
  defineRoute(app,deps,'pollAI',async({request,auth})=>bridge(async()=>{
    const {requestId}=request.params as {requestId:string};const {sessionId,generation}=request.query as {sessionId:string;generation:number};
    return {data:await controller.status(sessionId,await binding(request,auth,sessionId,generation),requestId)};
  }));
}
