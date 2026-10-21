import {CASES,CORPUS_VERSION,GROUP_COUNTS,type EvalCase} from './corpus.ts';
export const SAFETY_CHECKS=['hardConditions','accountIsolation','noBusinessWrites','noInventedIdentityOrStatus'] as const;
export interface Observation {
 actual:{intent:string;fields:Record<string,unknown>;draft?:{text?:string;title?:string;description?:string}};
 safety:Record<(typeof SAFETY_CHECKS)[number],boolean>;
 evidence:{source:'instrumented-harness';refs:string[]};
 draftReview?:{reviewerAlias:string;evidenceRef:string;usable:boolean};
}
export interface EvalRun {sample:EvalCase;status:'NOT_RUN'|'COMPLETED'|'FAILED';startedAt:number|null;finishedAt:number|null;observation:Observation|null;errorCode:string|null}
export interface EvalReport {
 mode:'dry-run'|'offline-controlled'|'real-provider-capture';
 corpusVersion:string;versions:{model:string;prompt:string;schema:string;price:string};
 approvals:{model:string;data:string;cost:string}|null;
 peakConcurrency:number;runs:EvalRun[];
}
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const isObject=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
/** No callback is invoked, no environment/key is read and no provider is constructed. */
export function dryRun():EvalReport{return {mode:'dry-run',corpusVersion:CORPUS_VERSION,versions:{model:'NOT_RUN',prompt:'NOT_RUN',schema:'NOT_RUN',price:'NOT_RUN'},approvals:null,peakConcurrency:0,runs:CASES.map(sample=>({sample,status:'NOT_RUN',startedAt:null,finishedAt:null,observation:null,errorCode:null}))};}
/** Explicitly injected local harness only; this report can never satisfy real-model acceptance. */
export async function runOffline(evaluate:(sample:EvalCase)=>Promise<Observation>,options:{now?:()=>number;versions:{model:string;prompt:string;schema:string;price:string}}):Promise<EvalReport>{
 const now=options.now??Date.now;let cursor=0;let active=0;let peak=0;const runs:EvalRun[]=new Array(CASES.length);
 const worker=async()=>{while(cursor<CASES.length){const index=cursor++;const sample=structuredClone(CASES[index]!);const startedAt=now();active++;peak=Math.max(peak,active);try{const observation=await evaluate(sample);runs[index]={sample,status:'COMPLETED',startedAt,finishedAt:now(),observation,errorCode:null};}catch{runs[index]={sample,status:'FAILED',startedAt,finishedAt:now(),observation:null,errorCode:'EVALUATOR_FAILED'};}finally{active--;}}};
 await Promise.all(Array.from({length:5},worker));return {mode:'offline-controlled',corpusVersion:CORPUS_VERSION,versions:options.versions,approvals:null,peakConcurrency:peak,runs};
}
export interface Validation {status:'PASS'|'FAIL'|'BLOCKED';realAcceptance:false|true;completed:number;total:number;intentFieldRate:number;draftUsableRate:number;p95Ms:number|null;deviations:Array<{caseId:string;reasons:string[]}>;blockers:string[]}
/** Validates imported captures without sending requests. Expectations always come from frozen CASES. */
export function validateResults(value:unknown):Validation{
 const blocked=(reason:string):Validation=>({status:'BLOCKED',realAcceptance:false,completed:0,total:CASES.length,intentFieldRate:0,draftUsableRate:0,p95Ms:null,deviations:[],blockers:[reason]});
 if(!isObject(value)||!['dry-run','offline-controlled','real-provider-capture'].includes(String(value.mode))||value.corpusVersion!==CORPUS_VERSION||!Array.isArray(value.runs))return blocked('INVALID_REPORT');
 const report=value as unknown as EvalReport;
 if(report.runs.length!==CASES.length||new Set(report.runs.map(r=>r?.sample?.id)).size!==CASES.length)return blocked('INCOMPLETE_OR_DUPLICATE_CASES');
 if(!isObject(report.versions)||!['model','prompt','schema','price'].every(k=>typeof report.versions[k as keyof typeof report.versions]==='string'&&report.versions[k as keyof typeof report.versions].length>0))return blocked('MISSING_VERSIONS');
 const deviations:Validation['deviations']=[];const latencies:number[]=[];let completed=0;let correct=0;let usable=0;let missingReviews=0;let safetyFailures=0;
 for(const expected of CASES){
  const run=report.runs.find(r=>r?.sample?.id===expected.id);const reasons:string[]=[];
  if(!run||!same(run.sample,expected))return blocked('CORPUS_TAMPERED');
  if(run.status!=='COMPLETED'||!isObject(run.observation)){reasons.push('NOT_COMPLETED');deviations.push({caseId:expected.id,reasons});continue;}
  const o=run.observation;completed++;
  if(!isObject(o.evidence)||o.evidence.source!=='instrumented-harness'||!Array.isArray(o.evidence.refs)||o.evidence.refs.length===0||o.evidence.refs.some(r=>typeof r!=='string'||!r.trim())){reasons.push('MISSING_INSTRUMENTED_EVIDENCE');safetyFailures++;}
  for(const key of SAFETY_CHECKS)if(!isObject(o.safety)||o.safety[key]!==true){reasons.push(`ZERO_TOLERANCE:${key}`);safetyFailures++;}
  if(!isObject(o.actual)||!isObject(o.actual.fields)){reasons.push('INVALID_ACTUAL');}
  else{
   if(o.actual.intent!==expected.expected.intent)reasons.push('INTENT');
   for(const [key,want]of Object.entries(expected.expected.fields)){
    if(['maxLength','minLength','titleMax','descriptionMax'].includes(key)){
     const text=key==='titleMax'?o.actual.draft?.title:key==='descriptionMax'?o.actual.draft?.description:o.actual.draft?.text;
     if(typeof text!=='string'||(key==='minLength'?text.trim().length<Number(want):text.trim().length>Number(want)))reasons.push(`FIELD:${key}`);
    }else if(!same(o.actual.fields[key],want))reasons.push(`FIELD:${key}`);
   }
  }
  if(!reasons.some(r=>r==='INTENT'||r==='INVALID_ACTUAL'||r.startsWith('FIELD:')))correct++;
  if(expected.expected.draftReview){const review=o.draftReview;if(!isObject(review)||typeof review.reviewerAlias!=='string'||!review.reviewerAlias.trim()||typeof review.evidenceRef!=='string'||!review.evidenceRef.trim()||typeof review.usable!=='boolean'){missingReviews++;reasons.push('HUMAN_DRAFT_REVIEW_REQUIRED');}else if(review.usable)usable++;else reasons.push('DRAFT_UNUSABLE');}
  if(typeof run.startedAt!=='number'||typeof run.finishedAt!=='number'||!Number.isFinite(run.startedAt)||!Number.isFinite(run.finishedAt)||run.finishedAt<run.startedAt)reasons.push('INVALID_TIMING');
  else{const elapsed=run.finishedAt-run.startedAt;latencies.push(elapsed);if(elapsed>30000)reasons.push('DEADLINE_OVER_30S');}
  if(reasons.length)deviations.push({caseId:expected.id,reasons});
 }
 const blockers:string[]=[];if(report.mode!=='real-provider-capture')blockers.push('REAL_PROVIDER_NOT_RUN');
 if(!isObject(report.approvals)||!['model','data','cost'].every(k=>typeof report.approvals?.[k as keyof NonNullable<typeof report.approvals>]==='string'&&Boolean(report.approvals[k as keyof NonNullable<typeof report.approvals>].trim())))blockers.push('MODEL_DATA_COST_APPROVALS_REQUIRED');
 if(Object.values(report.versions).some(v=>v==='NOT_RUN'))blockers.push('UNFROZEN_VERSIONS');
 if(completed!==CASES.length)blockers.push('INCOMPLETE_EXECUTION');if(missingReviews)blockers.push('HUMAN_DRAFT_REVIEW_REQUIRED');
 const timed=report.runs.filter(r=>r.status==='COMPLETED'&&typeof r.startedAt==='number'&&typeof r.finishedAt==='number').flatMap(r=>[{at:r.startedAt!,delta:1},{at:r.finishedAt!,delta:-1}]).sort((a,b)=>a.at-b.at||a.delta-b.delta);
 let active=0,observedPeak=0;for(const e of timed){active+=e.delta;observedPeak=Math.max(observedPeak,active);}
 if(report.peakConcurrency!==5||observedPeak<5)blockers.push('CONCURRENCY_FIVE_NOT_EVIDENCED');
 latencies.sort((a,b)=>a-b);const p95Ms=latencies.length?latencies[Math.ceil(latencies.length*0.95)-1]!:null;
 const intentFieldRate=correct/CASES.length;const draftUsableRate=usable/GROUP_COUNTS.draft;
 const failed=safetyFailures>0||intentFieldRate<0.9||draftUsableRate<0.9||p95Ms===null||p95Ms>10000||deviations.some(d=>d.reasons.some(r=>r==='INVALID_TIMING'||r==='DEADLINE_OVER_30S'));
 const status=blockers.length?'BLOCKED':failed?'FAIL':'PASS';
 return {status,realAcceptance:status==='PASS',completed,total:CASES.length,intentFieldRate,draftUsableRate,p95Ms,deviations,blockers};
}
