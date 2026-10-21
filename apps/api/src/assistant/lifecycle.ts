import type { AssistantRuntime } from '../../../../packages/assistant/src/index.ts';
import type { BudgetLedger } from './budget.ts';
import type { RequestService } from './requests.ts';

/** Wire once in the sole API instance. No text is recovered, and background work never calls AI. */
export async function startAssistantLifecycle(runtime:AssistantRuntime,requests:Pick<RequestService,'recoverAfterRestart'|'expireDeadlines'>,budget:Pick<BudgetLedger,'recoverAfterRestart'>,onError:(code:string)=>void=()=>{}){
  await budget.recoverAfterRestart();
  await requests.recoverAfterRestart();
  let sweep:Promise<void>|null=null;
  const timer=setInterval(()=>{
    runtime.sweep();
    if(sweep)return;
    sweep=requests.expireDeadlines().catch(()=>onError('AI_DEADLINE_SWEEP_FAILED')).finally(()=>{sweep=null;});
  },1000);
  timer.unref();
  return async()=>{clearInterval(timer);await sweep;runtime.shutdown();await requests.recoverAfterRestart();await budget.recoverAfterRestart();};
}
