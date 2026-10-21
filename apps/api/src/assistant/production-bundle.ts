import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,resolve} from 'node:path';
import {deepSeekProvider,deepSeekInputUpperBound,validateByteBpeTokenizer,DEEPSEEK_MODEL,DEEPSEEK_REVISION,PUBLIC_ARTIFACTS,ARTIFACT_ORIGIN,type ModelInput} from '../../../../packages/assistant/src/index.ts';
import type {VerifiedPrice} from './provider-call.ts';
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const hash=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const instant=(v:unknown)=>typeof v==='string'?Date.parse(v):NaN;
const ref=(v:unknown):v is Record<string,unknown>&{path:string;sha256:string}=>obj(v)&&typeof v.path==='string'&&v.path.length>0&&typeof v.sha256==='string'&&/^[0-9a-f]{64}$/.test(v.sha256);
async function boundedRead(path:string,limit:number){const meta=await stat(path);if(!meta.isFile()||meta.size>limit)throw new Error('INVALID_AI_ARTIFACT');const data=await readFile(path);if(data.length>limit)throw new Error('INVALID_AI_ARTIFACT');return data;}
/** Structural check of explicitly supplied operator evidence; does not certify its substantive truth. */
export function approvalEvidenceValid(evidence:unknown,scope:'MODEL'|'DATA'|'COST',validUntil:number,now:number):evidence is Record<string,unknown>{
 if(!obj(evidence)||evidence.scope!==scope||evidence.decision!=='APPROVED'||evidence.revision!==DEEPSEEK_REVISION||typeof evidence.approvedBy!=='string'||!evidence.approvedBy.trim()||typeof evidence.evidenceRef!=='string'||!evidence.evidenceRef.trim()||!Number.isFinite(instant(evidence.approvedAt))||instant(evidence.approvedAt)>now||!Number.isFinite(instant(evidence.validUntil))||instant(evidence.validUntil)<validUntil)return false;
 return scope!=='COST'||(evidence.protocolProofKind==='HOSTED_PROTOCOL_UPPER_BOUND'&&Number.isSafeInteger(evidence.additionalInputTokenUpperBound)&&Number(evidence.additionalInputTokenUpperBound)>=0&&evidence.inputMicroCnyPerMillion==='2000000'&&evidence.outputMicroCnyPerMillion==='8000000');
}
export interface ProductionBundleOptions {bundleFile:string|null;apiKey:string|null;provider:'deepseek'|'mock'|'disabled';now?:()=>number}
/** Trusted operator files only. Validates provenance, explicit decisions and expiry; never authors approvals or probes network. */
export async function productionAssistantBundle(options:ProductionBundleOptions){
 if(options.provider!=='deepseek'||!options.bundleFile||!options.apiKey)return null;
 const now=options.now??Date.now;
 try{
  const m:unknown=JSON.parse((await boundedRead(options.bundleFile,32768)).toString('utf8'));
  if(!obj(m)||Object.keys(m).some(k=>!['schemaVersion','model','revision','validFrom','validUntil','priceVersion','currency','inputMicroCnyPerMillion','outputMicroCnyPerMillion','artifacts','approvals'].includes(k)))return null;
  if(m.schemaVersion!==1||m.model!==DEEPSEEK_MODEL||m.revision!==DEEPSEEK_REVISION||m.currency!=='CNY'||m.inputMicroCnyPerMillion!=='2000000'||m.outputMicroCnyPerMillion!=='8000000'||typeof m.priceVersion!=='string'||!m.priceVersion||m.priceVersion.length>100||!obj(m.artifacts)||!obj(m.approvals))return null;
  const validUntil=instant(m.validUntil),validFrom=instant(m.validFrom);
  if(!Number.isFinite(validUntil)||!Number.isFinite(validFrom)||validFrom>now()||validUntil<=now()||validUntil<=validFrom)return null;
  const base=dirname(options.bundleFile);let tokenizer:unknown;
  for(const key of Object.keys(PUBLIC_ARTIFACTS) as Array<keyof typeof PUBLIC_ARTIFACTS>){
   const file=m.artifacts[key],pinned=PUBLIC_ARTIFACTS[key];if(!ref(file)||file.sha256!==pinned.sha256||file.source!==ARTIFACT_ORIGIN+pinned.file)return null;
   const data=await boundedRead(resolve(base,file.path),key==='tokenizer'?10_000_000:100_000);if(hash(data)!==pinned.sha256)return null;
   if(key==='tokenizer')tokenizer=JSON.parse(data.toString('utf8'));
  }
  if(!validateByteBpeTokenizer(tokenizer))return null;
  let extra:number|undefined;
  for(const scope of ['MODEL','DATA','COST'] as const){
   const file=m.approvals[scope];if(!ref(file))return null;
   const data=await boundedRead(resolve(base,file.path),32768);if(hash(data)!==file.sha256)return null;
   const evidence:unknown=JSON.parse(data.toString('utf8'));
   if(!approvalEvidenceValid(evidence,scope,validUntil,now()))return null;
   if(scope==='COST')extra=Number(evidence.additionalInputTokenUpperBound);
  }
  if(extra===undefined)return null;
  const price:VerifiedPrice={version:m.priceVersion,inputMicroCnyPerMillion:2_000_000n,outputMicroCnyPerMillion:8_000_000n,verified:true,validUntil};
  const approvedExtra=extra;
  const countInputTokens=(request:ModelInput)=>{if(now()>=validUntil)throw new Error('AI_BUNDLE_EXPIRED');return deepSeekInputUpperBound(request,approvedExtra);};
  return {allowedAreas:[] as readonly string[],provider:deepSeekProvider({enabled:true,apiKey:options.apiKey,model:DEEPSEEK_MODEL,modelVerified:true,priceVersion:price.version,now}),price,countInputTokens};
 }catch{return null;}
}
