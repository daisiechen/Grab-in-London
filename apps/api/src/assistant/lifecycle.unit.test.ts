import {afterEach,expect,it,vi} from 'vitest';
import {AssistantRuntime} from '../../../../packages/assistant/src/index.ts';
import {startAssistantLifecycle} from './lifecycle.ts';
afterEach(()=>vi.useRealTimers());
it('drains the in-flight deadline sweep before closing or recovering database state',async()=>{
 vi.useFakeTimers();let release!:()=>void;const pending=new Promise<void>(r=>{release=r;});
 const events:string[]=[];
 const requests={recoverAfterRestart:async()=>{events.push('requests.recover');},expireDeadlines:async()=>{events.push('sweep.start');await pending;events.push('sweep.end');}};
 const budget={recoverAfterRestart:async()=>{events.push('budget.recover');}};
 const stop=await startAssistantLifecycle(new AssistantRuntime(),requests,budget);
 await vi.advanceTimersByTimeAsync(1000);let stopped=false;const closing=stop().then(()=>{stopped=true;});
 await Promise.resolve();await Promise.resolve();await Promise.resolve();
 const before=stopped;release();await closing;
 expect(before).toBe(false);
 expect(events).toEqual(['budget.recover','requests.recover','sweep.start','sweep.end','requests.recover','budget.recover']);
 await vi.advanceTimersByTimeAsync(5000);expect(events.filter(e=>e==='sweep.start')).toHaveLength(1);
});
