import {CASES} from './corpus.ts';
import {createHash} from 'node:crypto';
import {buildDeepSeekPayload,deepSeekInputUpperBound,maximumCost,DEEPSEEK_MODEL} from '../../../assistant/src/index.ts';
const PRICE={inputMicroCnyPerMillion:2_000_000n,outputMicroCnyPerMillion:8_000_000n};
/** Fixed synthetic plans only. No env, key, provider, callback or fetch can be supplied. */
export function syntheticSpikePlan(hostedProtocolExtraTokens:number){
 const inputs=['Find a synthetic dinner.','查找合成晚餐。','Compare synthetic meals A and B.','比较合成饭局 A 和 B。','Draft a synthetic introduction.','起草合成自我介绍。'];
 const calls=inputs.map((input,index)=>{const request={schema:{type:'object',properties:{intent:{type:'string'}},required:['intent']},input,maxOutputTokens:2000};const inputUpper=deepSeekInputUpperBound(request,hostedProtocolExtraTokens);if(inputUpper>16000)throw new Error('AI_PLAN_INPUT_EXCEEDED');return {id:`synthetic-spike-${index+1}`,payloadSha256:createHash('sha256').update(JSON.stringify(buildDeepSeekPayload(DEEPSEEK_MODEL,request))).digest('hex'),inputUpper,maxOutputTokens:2000,maxMicroCny:maximumCost(inputUpper,2000,PRICE).toString()};});
 return {mode:'dry-plan' as const,requiresApprovals:['MODEL','DATA','COST'],readyToSend:false,exactPlannedCalls:6,calls,maxMicroCny:calls.reduce((n,c)=>n+BigInt(c.maxMicroCny),0n).toString()};
}
export function syntheticEvalMaximumPlan(){
 if(CASES.length!==60)throw new Error('AI_EVAL_CORPUS_DRIFT');
 const perCall=maximumCost(16000,2000,PRICE),cases=CASES.length,maxCallsPerCase=2,maxCallSlots=cases*maxCallsPerCase;
 return {mode:'dry-plan' as const,readyToSend:false,cases,maxCallsPerCase,maxCallSlots,inputUpperPerCall:16000,maxOutputPerCall:2000,perCallMaxMicroCny:perCall.toString(),maxMicroCny:(BigInt(maxCallSlots)*perCall).toString(),currency:'CNY',actualCalls:0};
}
