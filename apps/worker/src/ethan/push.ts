/**
 * Moderation push to the owner's assistant, Ethan (owner decision 2026-10-29; runbook §4).
 * Outbox channel ETHAN, one row per moderation_alerts row. The body carries queue counts and one admin
 * link only: no report text, names, emails or user ids. The Bearer token is never logged or stored in
 * the outbox. Development and test use the in-memory adapter (no network).
 */
import {randomUUID} from 'node:crypto';
import type {Pool} from 'pg';
import type {CoreConfig} from '@fancy/config';

export type EthanPushKind='morning'|'evening'|'urgent';
/** The exact JSON body POSTed to ETHAN_MODERATION_URL. */
export interface EthanPushPayload {
 kind:EthanPushKind;
 sentAt:string;
 open:number;
 autoLimited:number;
 overdue:number;
 dueWithin6h:number;
 oldestHoursLeft:number|null;
 urgentOpen:number;
 reason:'safety'|'harassment'|'under_18'|null;
 count:number;
 adminUrl:string;
}
export type PushOutcome={status:'SENT'}|{status:'RETRY';errorCode:string}|{status:'REJECTED';httpStatus:number};
export interface EthanPushAdapter {
 readonly kind:'http'|'test';
 send(input:{idempotencyKey:string;payload:EthanPushPayload}):Promise<PushOutcome>;
}

/** Real transport: POST JSON with the Bearer token; 2xx = delivered, 429/5xx/network = retry, other 4xx = terminal. */
export class HttpEthanPush implements EthanPushAdapter {
 readonly kind='http' as const;
 readonly #url:string;readonly #token:string;readonly #fetch:typeof fetch;readonly #timeoutMs:number;
 constructor(options:{url:string;token:string;fetch?:typeof fetch;timeoutMs?:number}){
  this.#url=options.url;this.#token=options.token;this.#fetch=options.fetch??fetch;this.#timeoutMs=options.timeoutMs??10_000;
 }
 async send(input:{idempotencyKey:string;payload:EthanPushPayload}):Promise<PushOutcome>{
  let response:Response;
  try{
   response=await this.#fetch(this.#url,{method:'POST',redirect:'error',headers:{Authorization:`Bearer ${this.#token}`,'Content-Type':'application/json','Idempotency-Key':input.idempotencyKey},body:JSON.stringify(input.payload),signal:AbortSignal.timeout(this.#timeoutMs)});
  }catch{return {status:'RETRY',errorCode:'NETWORK'};}
  // The response body is never read or logged.
  try{await response.body?.cancel();}catch{/* ignore */}
  if(response.ok)return {status:'SENT'};
  if(response.status===429||response.status>=500)return {status:'RETRY',errorCode:`HTTP_${response.status}`};
  return {status:'REJECTED',httpStatus:response.status};
 }
 /** Keeps the token out of accidental serialization. */
 toJSON(){return {kind:this.kind};}
}

/** Development/test adapter: records payloads in memory, never touches the network. */
export class TestEthanPush implements EthanPushAdapter {
 readonly kind='test' as const;
 readonly sent:{idempotencyKey:string;payload:EthanPushPayload}[]=[];
 next:PushOutcome[]=[];
 async send(input:{idempotencyKey:string;payload:EthanPushPayload}):Promise<PushOutcome>{
  const outcome=this.next.shift()??{status:'SENT'};
  if(outcome.status==='SENT')this.sent.push(input);
  return outcome;
 }
}

/** No push unless both URL and token are configured; only staging/production use the network. */
export function ethanPushFor(config:Pick<CoreConfig,'environment'|'ethanModeration'>):EthanPushAdapter|null{
 if(!config.ethanModeration)return null;
 if(config.environment==='staging'||config.environment==='production')return new HttpEthanPush(config.ethanModeration);
 return new TestEthanPush();
}

interface AlertRow {kind:EthanPushKind;reason:EthanPushPayload['reason'];report_ids:string[];report_count:number;stats:Record<string,unknown>}
const int=(v:unknown)=>typeof v==='number'&&Number.isInteger(v)&&v>=0?v:0;

/** Builds the push body from an alert row; only whitelisted numeric fields and the admin link. */
export function buildEthanPayload(alert:AlertRow,sentAt:Date,adminUrl:string):EthanPushPayload{
 const hoursLeft=alert.stats.oldestHoursLeft;
 // One urgent report: deep link to it (opaque id); otherwise the queue.
 const link=alert.kind==='urgent'&&alert.report_ids.length===1?`${adminUrl}#moderation/${alert.report_ids[0]}`:`${adminUrl}#moderation`;
 return {
  kind:alert.kind,sentAt:sentAt.toISOString(),
  open:int(alert.stats.open),autoLimited:int(alert.stats.autoLimited),overdue:int(alert.stats.overdue),dueWithin6h:int(alert.stats.dueWithin6h),
  oldestHoursLeft:typeof hoursLeft==='number'&&Number.isFinite(hoursLeft)?hoursLeft:null,
  urgentOpen:int(alert.stats.urgentOpen),
  reason:alert.kind==='urgent'?alert.reason:null,
  count:int(alert.report_count),adminUrl:link,
 };
}

const TEMPLATE_KIND:Readonly<Record<string,EthanPushKind>>={moderation_morning:'morning',moderation_evening:'evening',moderation_urgent:'urgent'};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_PUSH_ATTEMPTS=8;
export interface EthanDeadEvent {readonly event:'ethan_push_dead';readonly outboxId:string;readonly errorCode:string;readonly attempts:number}
/** Bounded metadata only: never the URL, token, payload or response. */
export function logEthanDead(event:EthanDeadEvent){console.error(JSON.stringify({event:'ethan_push_dead',outboxId:event.outboxId,errorCode:event.errorCode,attempts:event.attempts}));}

interface PushRow {id:string;template:string;payload:Record<string,unknown>;attempts:number}

/** Delivery loop for outbox rows on the ETHAN channel: at least once, exponential backoff, 8 tries / 24 hours. */
export function ethanDelivery(pool:Pool,adapter:EthanPushAdapter|null,options:{adminUrl:string;environment:CoreConfig['environment'];onDead?:(event:EthanDeadEvent)=>void;now?:()=>Date}){
 if(adapter?.kind==='test'&&options.environment!=='development'&&options.environment!=='test')throw new Error('TEST_PUSH_FORBIDDEN');
 const onDead=options.onDead??logEthanDead;
 const dead=(id:string,errorCode:string,attempts:number)=>{try{onDead(Object.freeze({event:'ethan_push_dead',outboxId:id,errorCode,attempts}));}catch{/* observer failure cannot undo the transition */}};
 async function markDead(row:{id:string;attempts:number},token:string,errorCode:string){
  const {rowCount}=await pool.query(`UPDATE outbox SET status='DEAD',claim_token=NULL,lease_until=NULL,last_error_code=$3,updated_at=clock_timestamp() WHERE id=$1 AND claim_token=$2`,[row.id,token,errorCode]);
  if(rowCount)dead(row.id,errorCode,row.attempts);
 }
 async function tick(){
  await pool.query(`UPDATE outbox SET status='FAILED',claim_token=NULL,lease_until=NULL,next_attempt_at=clock_timestamp(),last_error_code='LEASE_EXPIRED' WHERE channel='ETHAN' AND status='SENDING' AND lease_until<clock_timestamp()`);
  const {rows:exhausted}=await pool.query<{id:string;attempts:number}>(`UPDATE outbox SET status='DEAD',claim_token=NULL,lease_until=NULL,last_error_code='RETRY_EXHAUSTED',updated_at=clock_timestamp() WHERE channel='ETHAN' AND status IN('PENDING','FAILED') AND (attempts>=$1 OR created_at<=clock_timestamp()-interval '24 hours') RETURNING id,attempts`,[MAX_PUSH_ATTEMPTS]);
  for(const row of exhausted)dead(row.id,'RETRY_EXHAUSTED',row.attempts);
  if(!adapter)return 0;
  const token=randomUUID();
  const {rows}=await pool.query<PushRow>(`WITH due AS(SELECT id FROM outbox WHERE channel='ETHAN' AND status IN('PENDING','FAILED') AND next_attempt_at<=clock_timestamp() AND attempts<$2 ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 10)
   UPDATE outbox o SET claim_token=$1,lease_until=clock_timestamp()+interval '60 seconds',status='SENDING',attempts=o.attempts+1 FROM due WHERE o.id=due.id RETURNING o.id,o.template,o.payload,o.attempts`,[token,MAX_PUSH_ATTEMPTS]);
  for(const row of rows){
   const kind=TEMPLATE_KIND[row.template];
   const alertId=row.payload.alertId;
   if(!kind||Object.keys(row.payload).length!==1||typeof alertId!=='string'||!UUID.test(alertId)){await markDead(row,token,'INVALID_PAYLOAD');continue;}
   const {rows:[alert]}=await pool.query<AlertRow>(`SELECT kind,reason,report_ids,report_count,stats FROM moderation_alerts WHERE id=$1 AND kind=$2`,[alertId,kind]);
   if(!alert){await markDead(row,token,'INVALID_PAYLOAD');continue;}
   let outcome:PushOutcome;
   try{outcome=await adapter.send({idempotencyKey:row.id,payload:buildEthanPayload(alert,options.now?.()??new Date(),options.adminUrl)});}catch{outcome={status:'RETRY',errorCode:'ADAPTER_ERROR'};}
   if(outcome.status==='REJECTED'){await markDead(row,token,`HTTP_${outcome.httpStatus}`);continue;}
   await pool.query(`UPDATE outbox SET status=$3,claim_token=NULL,lease_until=NULL,updated_at=clock_timestamp(),next_attempt_at=clock_timestamp()+make_interval(secs=>$4),last_error_code=$5 WHERE id=$1 AND claim_token=$2`,
    [row.id,token,outcome.status==='SENT'?'SENT':'FAILED',Math.min(3600,30*2**row.attempts),outcome.status==='SENT'?null:outcome.errorCode]);
  }
  return rows.length;
 }
 return {tick};
}
