import type {Pool} from 'pg';
import type {DeletionStep,StepResult} from './provider.ts';
export interface Auth0ManagementConfig {domain:string;clientId:string;clientSecret:string}
type Token={value:string;usableUntil:number};
const scopes=['delete:grants','delete:users'] as const;
const hasControl=(value:string)=>Array.from(value).some(char=>char.charCodeAt(0)<32||char.charCodeAt(0)===127);
/** Exact-user Management API deletion, separate from BFF login credentials. No provider bodies are persisted or logged.
 * https://auth0.com/docs/api/management/v2/grants/delete-grants-by-user-id */
export class Auth0DeletionStep implements DeletionStep {
 private readonly pool:Pick<Pool,'query'>;private readonly config:Auth0ManagementConfig;private readonly origin:string;
 private readonly fetch:typeof fetch;private readonly now:()=>number;private readonly timeoutMs:number;
 private cached:Token|null=null;private acquiring:Promise<Token>|null=null;
 constructor(pool:Pick<Pool,'query'>,config:Auth0ManagementConfig,options:{fetch?:typeof fetch;now?:()=>number;timeoutMs?:number}={}){
  if(!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(config.domain)||!config.clientId||!config.clientSecret)throw new Error('INVALID_AUTH0_MANAGEMENT_CONFIG');
  this.pool=pool;this.config={...config,domain:config.domain.toLowerCase()};this.origin=`https://${this.config.domain}`;
  this.fetch=options.fetch??fetch;this.now=options.now??Date.now;this.timeoutMs=options.timeoutMs??10000;
  if(!Number.isSafeInteger(this.timeoutMs)||this.timeoutMs<1||this.timeoutMs>30000)throw new Error('INVALID_AUTH0_MANAGEMENT_CONFIG');
 }
 private async token():Promise<Token>{
  if(this.cached&&this.cached.usableUntil>this.now())return this.cached;
  if(this.acquiring)return this.acquiring;
  const task=(async()=>{
   const response=await this.fetch(`${this.origin}/oauth/token`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(this.timeoutMs),headers:{'content-type':'application/json'},body:JSON.stringify({grant_type:'client_credentials',client_id:this.config.clientId,client_secret:this.config.clientSecret,audience:`${this.origin}/api/v2/`,scope:scopes.join(' ')})});
   if(response.status!==200)throw new Error('MANAGEMENT_TOKEN_UNAVAILABLE');
   const data:unknown=await response.json();
   if(!data||typeof data!=='object')throw new Error('MANAGEMENT_TOKEN_INVALID');
   const value=data as Record<string,unknown>;
   const granted=typeof value.scope==='string'?new Set(value.scope.split(' ').filter(Boolean)):new Set<string>();
   if(typeof value.access_token!=='string'||!value.access_token||value.access_token.length>16384||(/\s/.test(value.access_token)||hasControl(value.access_token))||value.token_type!=='Bearer'||typeof value.expires_in!=='number'||!Number.isSafeInteger(value.expires_in)||value.expires_in<1||value.expires_in>86400||scopes.some(scope=>!granted.has(scope))||granted.size!==scopes.length)throw new Error('MANAGEMENT_TOKEN_INVALID');
   const lifetime=value.expires_in*1000;const token={value:value.access_token,usableUntil:this.now()+lifetime-Math.min(30000,Math.ceil(lifetime/10))};this.cached=token;return token;
  })();
  this.acquiring=task;
  try{return await task;}finally{if(this.acquiring===task)this.acquiring=null;}
 }
 private async remove(path:string,token:Token){
  const response=await this.fetch(this.origin+path,{method:'DELETE',redirect:'error',signal:AbortSignal.timeout(this.timeoutMs),headers:{authorization:`Bearer ${token.value}`}});
  if(response.status===401&&this.cached===token)this.cached=null;
  // Resource absence at the exact trusted tenant/subject is idempotent; never infer Apple revocation.
  return response.status===204||response.status===404;
 }
 async revoke(input:Parameters<DeletionStep['revoke']>[0]):Promise<StepResult>{
  try{
   const {rows}=await this.pool.query<{issuer:string|null;subject:string|null}>(`SELECT i.issuer,i.subject FROM deletion_requests d JOIN users u ON u.id=d.user_id LEFT JOIN identities i ON i.user_id=u.id WHERE d.id=$2 AND d.user_id=$1 AND u.status='DELETING' AND d.status<>'COMPLETED' AND d.provider_steps->>'local'='COMPLETED' ORDER BY i.subject`,[input.userId,input.deletionId]);
   if(!rows.length||rows.length>100||rows.some(row=>row.issuer!==this.origin+'/'||typeof row.subject!=='string'||!row.subject||row.subject.length>255||hasControl(row.subject)))return 'NEEDS_SUPPORT';
   const subjects=[...new Set(rows.map(row=>row.subject!))].sort();const token=await this.token();
   for(const subject of subjects){
    if(!await this.remove('/api/v2/grants?'+new URLSearchParams({user_id:subject}).toString(),token))return 'NEEDS_SUPPORT';
    if(!await this.remove('/api/v2/users/'+encodeURIComponent(subject),token))return 'NEEDS_SUPPORT';
   }
   return 'COMPLETED';
  }catch{return 'NEEDS_SUPPORT';}
 }
}
