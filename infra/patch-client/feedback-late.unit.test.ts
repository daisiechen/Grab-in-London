/** Codex acceptance: account clearance must fence all outstanding feedback continuations. */
import {expect,it} from 'vitest';
import {FeedbackRunner,planFeedback,type FeedbackScope} from '../../packages/client/src/feedback.ts';
const scope:FeedbackScope={accountId:'account-a',mealId:'meal-a',subjectId:'subject-a'};
it('does not resurrect a cleared account scope when an outstanding write finishes',async()=>{
 let finish!:()=>void;
 const held=new Promise<void>(resolve=>{finish=resolve;});
 const runner=new FeedbackRunner(async()=>held,()=>{});
 const plan=planFeedback({windowOpen:true,review:null,reconnect:{selected:false,version:'0',connection:'NONE'}},{review:'A synthetic reference',selected:false});
 expect(plan.kind).toBe('save');if(plan.kind!=='save')throw new Error('save plan required');
 const saving=runner.save(scope,plan);
 expect(runner.state(scope).running).toBe(true);
 runner.clear();finish();await saving;
 expect(runner.state(scope).statuses.review).toBe('idle');
 expect(runner.unresolved(scope)).toBe(false);
});
it('does not execute the queued reconnect after clearance during the reference write',async()=>{
 let finish!:()=>void;const held=new Promise<void>(r=>{finish=r;});let calls=0;let notifications=0;
 const runner=new FeedbackRunner(async()=>{calls++;await held;},()=>{notifications++;});
 const plan=planFeedback({windowOpen:true,review:null,reconnect:{selected:false,version:'0',connection:'NONE'}},{review:'A synthetic reference',selected:true});
 if(plan.kind!=='save')throw new Error('save plan required');
 const saving=runner.save(scope,plan);runner.clear();const before=notifications;finish();await saving;
 expect(calls).toBe(1);expect(notifications).toBe(before);expect(runner.state(scope).statuses.reconnect).toBe('idle');
});
it('does not revive an old scope or replay after clearance during receipt reconciliation',async()=>{
 let resolveReceipt!:(value:'resend')=>void;const receipt=new Promise<'resend'>(r=>{resolveReceipt=r;});let writes=0;let notifications=0;
 const runner=new FeedbackRunner(async()=>{writes++;throw new Error('connection lost');},()=>{notifications++;},async()=>receipt);
 const plan=planFeedback({windowOpen:true,review:null,reconnect:{selected:false,version:'0',connection:'NONE'}},{review:'A synthetic reference',selected:true});
 if(plan.kind!=='save')throw new Error('save plan required');
 await runner.save(scope,plan);expect(runner.unresolved(scope)).toBe(true);
 const recovering=runner.resume(scope);runner.clear();const before=notifications;resolveReceipt('resend');await recovering;
 expect(writes).toBe(1);expect(notifications).toBe(before);expect(runner.unresolved(scope)).toBe(false);expect(runner.state(scope).statuses.review).toBe('idle');
});
