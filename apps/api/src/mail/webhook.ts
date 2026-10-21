import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import type {FastifyInstance} from 'fastify';
import type {AppDeps} from '../http/context.ts';
import {DomainError} from '../common/errors.ts';
import {recordResendReceipt,type VerifiedMailReceipt} from './receipts.ts';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const invalid=()=>new DomainError('INVALID_REQUEST','Invalid mail webhook.');
function base64(value:string):Buffer {if(!/^[A-Za-z0-9+/]+={0,2}$/.test(value)||value.length%4!==0)throw invalid();const decoded=Buffer.from(value,'base64');if(decoded.toString('base64')!==value)throw invalid();return decoded;}
/** Svix symmetric v1 signature over exact message id.timestamp.raw-body bytes. */
export function verifyResendWebhook(raw:Buffer,headers:Record<string,string|string[]|undefined>,secret:string,nowMs=Date.now()):VerifiedMailReceipt|null {
 const id=headers['svix-id'],timestamp=headers['svix-timestamp'],signatures=headers['svix-signature'];
 if(raw.length>65536||typeof id!=='string'||!/^[-A-Za-z0-9_]{1,128}$/.test(id)||typeof timestamp!=='string'||!/^\d{1,12}$/.test(timestamp)||typeof signatures!=='string'||signatures.length>2048||secret.length>350||!secret.startsWith('whsec_'))throw invalid();
 const seconds=Number(timestamp);if(!Number.isSafeInteger(seconds)||Math.abs(nowMs/1000-seconds)>300)throw invalid();
 const key=base64(secret.slice(6));if(key.length<32||key.length>256)throw invalid();
 const expected=createHmac('sha256',key).update(id+'.'+timestamp+'.').update(raw).digest();
 const values=signatures.split(' ');if(values.length>8)throw invalid();
 let verified=false;for(const value of values){if(!value.startsWith('v1,'))continue;let given:Buffer;try{given=base64(value.slice(3));}catch{continue;}if(given.length===expected.length&&timingSafeEqual(given,expected))verified=true;}
 if(!verified)throw invalid();
 let payload:unknown;try{payload=JSON.parse(raw.toString('utf8'));}catch{throw invalid();}
 if(!payload||typeof payload!=='object'||!('type'in payload)||typeof payload.type!=='string')throw invalid();
 if(!['email.sent','email.delivered','email.bounced'].includes(payload.type))return null;
 if(!('data'in payload)||!payload.data||typeof payload.data!=='object'||!('created_at'in payload)||typeof payload.created_at!=='string'||payload.created_at.length>64||!Number.isFinite(Date.parse(payload.created_at)))throw invalid();
 const data=payload.data;if(!('email_id'in data)||typeof data.email_id!=='string'||!UUID.test(data.email_id))throw invalid();
 if(!('tags'in data)||!data.tags||typeof data.tags!=='object'||Array.isArray(data.tags)||!('outbox_id'in data.tags))return null;
 const outbox=data.tags.outbox_id;if(typeof outbox!=='string'||!UUID.test(outbox))throw invalid();
 return {svixId:id,outboxId:outbox.toLowerCase(),providerEmailId:data.email_id.toLowerCase(),eventType:payload.type as VerifiedMailReceipt['eventType'],payloadSha256:createHash('sha256').update(raw).digest('hex'),occurredAt:payload.created_at,signedAttemptAt:new Date(seconds*1000).toISOString()};
}
export function registerResendWebhook(app:FastifyInstance,deps:AppDeps):void {
 const secret=deps.config.resendWebhookSecret;if(!secret||deps.config.adapters.MAIL_ADAPTER!=='provider')return;
 app.register(async scoped=>{
  scoped.removeContentTypeParser('application/json');
  scoped.addContentTypeParser('application/json',{parseAs:'buffer',bodyLimit:65536},(_request,body,done)=>done(null,body));
  scoped.post('/v1/webhooks/resend',{bodyLimit:65536},async(request,reply)=>{
   for(const header of ['svix-id','svix-timestamp','svix-signature'])if(request.raw.rawHeaders.filter((value,index)=>index%2===0&&value.toLowerCase()===header).length!==1)throw invalid();
   if(!Buffer.isBuffer(request.body))throw invalid();
   const event=verifyResendWebhook(request.body,request.headers,secret);
   if(event)await recordResendReceipt(deps.pool,event);
   return reply.code(200).send({received:true});
  });
 });
}
