import type { AssistantRuntime } from '../../../../packages/assistant/src/index.ts';
import type { BudgetLedger } from './budget.ts';
import type { RequestService } from './requests.ts';

/** Wire once in the sole API instance. No text is recovered, and background work never calls AI. */
export async function startAssistantLifecycle(runtime:AssistantRuntime,requests:RequestService,budget:BudgetLedger,onError:(code:string)=>void=()=>{}){
  await budget.recoverAfterRestart();
  await requests.recoverAfterRestart();
  let sweeping=false;
  const timer=setInterval(()=>{
    runtime.sweep();
    if(sweeping)return;
    sweeping=true;
    void requests.expireDeadlines().catch(()=>onError('AI_DEADLINE_SWEEP_FAILED')).finally(()=>{sweeping=false;});
  },1000);
  timer.unref();
  return async()=>{clearInterval(timer);runtime.shutdown();await requests.recoverAfterRestart();await budget.recoverAfterRestart();};
}
