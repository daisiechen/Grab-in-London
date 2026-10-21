import { AssistantError, ProviderError, maximumCost, type ModelInput, type ModelProvider, type ModelResult } from '../../../../packages/assistant/src/index.ts';
import type { BudgetLedger } from './budget.ts';

export interface VerifiedPrice {
  version: string;
  inputMicroCnyPerMillion: bigint;
  outputMicroCnyPerMillion: bigint;
  /** Real spike has verified peak price, tokenizer overhead and all billable output components. */
  verified: boolean;
  validUntil: number;
}

/** Each of the maximum two internal calls goes through this gate. No network retry exists here. */
export async function runBudgetedCall(deps: {
  ledger: BudgetLedger; provider: ModelProvider; price: VerifiedPrice;
  /** Counts full messages + schema + protocol overhead conservatively, not characters / 4. */
  countInputTokens: (request: ModelInput) => number;
  now?: () => number;
}, subject: string, requestId: string, request: ModelInput): Promise<ModelResult> {
  const now=deps.now??Date.now;
  if(!deps.price.verified || deps.price.validUntil<=now() || request.deadline<=now() || request.signal?.aborted)throw new AssistantError('AI_UNAVAILABLE');
  const input=deps.countInputTokens(request);
  if(!Number.isSafeInteger(input)||input<1||input>16000)throw new AssistantError('AI_UNAVAILABLE');
  const maxMicroCny=maximumCost(input,request.maxOutputTokens,deps.price);
  const admission=await deps.ledger.reserve({subject,requestId,callId:request.callId,priceVersion:deps.price.version,maxMicroCny});
  if(!admission.admitted)throw new AssistantError('AI_CONFLICT');
  if(request.deadline<=now()||request.signal?.aborted){await deps.ledger.cancelBeforeDispatch(request.callId);throw new AssistantError('AI_SUPERSEDED');}
  if(!await deps.ledger.dispatch(request.callId))throw new AssistantError('AI_CONFLICT');
  let result:ModelResult;
  try{result=await deps.provider.generate(request);}
  catch(error){
    if(error instanceof ProviderError&&error.cost==='KNOWN'&&error.usage&&error.providerRequestId){
      await deps.ledger.settle(request.callId,maximumCost(error.usage.inputTokens,error.usage.outputTokens,deps.price),{...error.usage,providerRequestId:error.providerRequestId});
    }else await deps.ledger.unknown(request.callId);
    throw error;
  }
  await deps.ledger.settle(request.callId,maximumCost(result.usage.inputTokens,result.usage.outputTokens,deps.price),{...result.usage,providerRequestId:result.providerRequestId});
  if(request.deadline<=now()||request.signal?.aborted)throw new AssistantError('AI_SUPERSEDED');
  return result;
}
