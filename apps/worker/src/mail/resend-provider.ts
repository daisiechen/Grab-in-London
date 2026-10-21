import {createHash} from 'node:crypto';
import type {DeliveryOutcome,MailProvider} from './delivery.ts';

interface ResendOptions {
 apiKey:string;
 from:string;
 /** Already validated server Web origin; rechecked here before producing links. */
 webOrigin:string;
 fetch?:typeof fetch;
 timeoutMs?:number;
 onDispatch?:(input:{outboxId:string;claimToken:string;payloadSha256:string})=>Promise<boolean>;
}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REF_KEYS=new Set(['mealId','applicationId','conversationId','deletionId']);
const TEMPLATES:Readonly<Record<string,{subject:string;message:string;deletion?:true}>>={
 application_approved:{subject:'Your Fancy application was approved',message:'Your application was approved. Open Fancy to see the meal details.'},
 application_declined:{subject:'Your Fancy application was declined',message:'Your application was declined. Open Fancy to review your application.'},
 application_expired:{subject:'Your Fancy application has expired',message:'Applications have closed. Open Fancy to review your application.'},
 meal_cancelled:{subject:'Your Fancy meal was cancelled',message:'This meal was cancelled. Open Fancy to see its current status.'},
 deletion_received:{subject:'Fancy received your account deletion request',message:'Your account deletion request was received. Use your saved deletion receipt in Fancy to check its status.',deletion:true},
 deletion_completed:{subject:'Your Fancy account deletion is complete',message:'Your account deletion is complete. Use your saved deletion receipt in Fancy to check its status.',deletion:true},
};
const escapeHtml=(value:string)=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');

/** Sending-only Resend adapter. It never logs inputs/errors or invents lookup evidence.
 * Provider idempotency is limited to24h; durable UNKNOWN recovery is owned by a later
 * integration slice and must retain the exact original request, not blindly resend.
 */
export class ResendMailProvider implements MailProvider {
 readonly kind='real' as const;
 private readonly options:ResendOptions;
 private readonly origin:string;
 private readonly doFetch:typeof fetch;
 constructor(options:ResendOptions){
  let origin:URL;
  try{origin=new URL(options.webOrigin);}catch{throw new Error('Invalid mail provider configuration');}
  const local=['localhost','127.0.0.1','[::1]'].includes(origin.hostname);
  if((origin.protocol!=='https:'&&!(origin.protocol==='http:'&&local))||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash||!options.apiKey||options.apiKey.length>4096||/[\p{Cc}\s]/u.test(options.apiKey)||!options.from.trim()||options.from.length>320||/\p{Cc}/u.test(options.from)||!Number.isInteger(options.timeoutMs??10000)||(options.timeoutMs??10000)<1||(options.timeoutMs??10000)>30000)throw new Error('Invalid mail provider configuration');
  this.options={...options};this.origin=origin.origin;this.doFetch=options.fetch??fetch;
 }
 async send(input:Parameters<MailProvider['send']>[0]):Promise<DeliveryOutcome>{
  const template=Object.hasOwn(TEMPLATES,input.template)?TEMPLATES[input.template]:undefined;
  if(!template||!UUID.test(input.idempotencyKey)||typeof input.email!=='string'||input.email.length>320||!/^[^\s@<>]+@[^\s@<>]+$/.test(input.email)||Object.entries(input.refs).some(([key,value])=>!REF_KEYS.has(key)||typeof value!=='string'||!UUID.test(value)))return {status:'RETRY'};
  const path=template.deletion?'/settings/deletion':input.refs.mealId?'/meals/'+input.refs.mealId:'/inbox';
  const link=new URL(path,this.origin).href;
  const body=JSON.stringify({from:this.options.from,to:[input.email],subject:template.subject,tags:[{name:'outbox_id',value:input.idempotencyKey}],text:template.message+'\n\n'+link,html:'<p>'+escapeHtml(template.message)+'</p><p><a href="'+escapeHtml(link)+'">Open Fancy</a></p>'});
  if(this.options.onDispatch){
   if(!input.claimToken||!UUID.test(input.claimToken))return {status:'UNKNOWN'};
   try{if(!await this.options.onDispatch({outboxId:input.idempotencyKey,claimToken:input.claimToken,payloadSha256:createHash('sha256').update(body).digest('hex')}))return {status:'UNKNOWN'};}catch{return {status:'UNKNOWN'};}
  }
  // Monotonic budget originates from DB remaining TTL before recipient resolution.
  // It is deliberately conservative across lock/query/commit delays and ignores wall-clock skew.
  if(input.dispatchDeadlineMs!==undefined&&(!Number.isFinite(input.dispatchDeadlineMs)||performance.now()>=input.dispatchDeadlineMs))return {status:'RETRY'};
  let response:Response;
  try{response=await this.doFetch('https://api.resend.com/emails',{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+this.options.apiKey,'Content-Type':'application/json','Idempotency-Key':input.idempotencyKey},body,signal:AbortSignal.timeout(this.options.timeoutMs??10000)});}catch{return {status:'UNKNOWN'};}
  // A response rejecting admission is retryable by the existing bounded delivery policy.
  //409 may be an in-progress idempotent request;5xx/timeouts may follow acceptance.
  if([400,401,403,404,422,429].includes(response.status))return {status:'RETRY'};
  if(!response.ok)return {status:'UNKNOWN'};
  try{const data:unknown=await response.json();if(data&&typeof data==='object'&&'id'in data&&typeof data.id==='string'&&UUID.test(data.id))return {status:'SENT',providerId:data.id};}catch{/* A lost/malformed response is not proof that sending failed. */}
  return {status:'UNKNOWN'};
 }
 async lookup(_idempotencyKey:string):Promise<DeliveryOutcome>{
  // Resend GET requires its provider email ID, and a Sending-only key cannot be assumed
  // to have read access. Missing response/ID must remain UNKNOWN, never NOT_SENT.
  return {status:'UNKNOWN'};
 }
}
