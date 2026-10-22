import * as SecureStore from 'expo-secure-store';
export type AIConversationOwner={kind:'USER';userId:string}|{kind:'GUEST';credentialSha256:string};
export interface AIConversationCredential {sessionId:string;generation:number;deviceToken:string;revokeHandle:string;expiresAt:number;owner:AIConversationOwner}
export interface AIConversationStore {read():Promise<AIConversationCredential|null>;write(value:AIConversationCredential):Promise<void>;clear():Promise<void>}
const KEY='fancy.assistant.session.v1';
const OPTIONS:SecureStore.SecureStoreOptions={keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY};
const uuid=(x:unknown):x is string=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
function valid(value:unknown):value is AIConversationCredential{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const v=value as Record<string,unknown>;
 if(Object.keys(v).sort().join(',')!=='deviceToken,expiresAt,generation,owner,revokeHandle,sessionId'||!uuid(v.sessionId)||!Number.isSafeInteger(v.generation)||Number(v.generation)<1||typeof v.expiresAt!=='number'||!Number.isFinite(v.expiresAt)||v.expiresAt<=0)return false;
 if(![v.deviceToken,v.revokeHandle].every(x=>typeof x==='string'&&/^[A-Za-z0-9_-]{43}$/.test(x)))return false;
 if(!v.owner||typeof v.owner!=='object'||Array.isArray(v.owner))return false;const o=v.owner as Record<string,unknown>;
 return o.kind==='USER'?Object.keys(o).sort().join(',')==='kind,userId'&&uuid(o.userId):o.kind==='GUEST'&&Object.keys(o).sort().join(',')==='credentialSha256,kind'&&typeof o.credentialSha256==='string'&&/^[0-9a-f]{64}$/.test(o.credentialSha256);
}
/** Explicit projection prevents text, preferences, boot intent or draft values from reaching storage. */
function projection(v:AIConversationCredential):AIConversationCredential{return {sessionId:v.sessionId,generation:v.generation,deviceToken:v.deviceToken,revokeHandle:v.revokeHandle,expiresAt:v.expiresAt,owner:v.owner.kind==='USER'?{kind:'USER',userId:v.owner.userId}:{kind:'GUEST',credentialSha256:v.owner.credentialSha256}};}
export function secureAIConversationStore():AIConversationStore{return {
 async read(){const raw=await SecureStore.getItemAsync(KEY,OPTIONS);if(!raw)return null;let value:unknown;try{value=JSON.parse(raw);}catch{/* Delete malformed data before proceeding. */}if(!valid(value)){await SecureStore.deleteItemAsync(KEY,OPTIONS);return null;}return projection(value);},
 async write(value){if(!valid(value))throw new Error('Invalid AI credential metadata');await SecureStore.setItemAsync(KEY,JSON.stringify(projection(value)),OPTIONS);},
 async clear(){await SecureStore.deleteItemAsync(KEY,OPTIONS);},
};}
/** Isolated tests may use synthetic identifiers; production services always inject the secure store. */
export function memoryAIConversationStore():AIConversationStore{let current:AIConversationCredential|null=null;return {read:async()=>current?projection(current):null,write:async value=>{current=projection(value);},clear:async()=>{current=null;}};}
