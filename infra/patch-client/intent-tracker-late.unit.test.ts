/** Codex independent acceptance: form-intent reset must fence old asynchronous completions. */
import {expect,it} from 'vitest';
import {createApiClient} from '../../packages/client/src/http.ts';
import {IntentTracker} from '../../packages/client/src/intents.ts';
it('does not resurrect an intent after reset when an old request rejects late',async()=>{
 let reject!:(e:Error)=>void;const held=new Promise<never>((_,r)=>{reject=r;});
 const tracker=new IntentTracker(()=> 'old-key');
 const pending=tracker.run({body:'old account'},()=>held).catch(()=>{});
 tracker.reset();reject(new Error('network lost'));await pending;
 expect(tracker.pending).toBeNull();
});
it('does not erase a newer unresolved intent when an old request succeeds late',async()=>{
 let finish!:()=>void;const held=new Promise<void>(r=>{finish=r;});let n=0;
 const tracker=new IntentTracker(()=>String(++n));
 const old=tracker.run({body:'old account'},()=>held);
 tracker.reset();await tracker.run({body:'new account'},async()=>{throw new Error('network lost');}).catch(()=>{});
 expect(tracker.pending?.fingerprint).toContain('new account');
 finish();await old;
 expect(tracker.pending?.fingerprint).toContain('new account');
});
it('does not start a second write while the first is still in flight',async()=>{
 let finish!:()=>void;const held=new Promise<void>(r=>{finish=r;});let calls=0;let keys=0;
 const tracker=new IntentTracker(()=>String(++keys));
 const first=tracker.run({body:'first draft'},async()=>{calls++;await held;});
 let blocked=false;
 await tracker.run({body:'second draft'},async()=>{calls++;}).catch(()=>{blocked=true;});
 finish();await first;
 expect(blocked).toBe(true);expect(calls).toBe(1);expect(keys).toBe(1);
});
it('keeps a new unresolved write when a receipt read from the previous session completes',async()=>{
 let finish!:(r:Response)=>void;const held=new Promise<Response>(r=>{finish=r;});let n=0;
 const tracker=new IntentTracker(()=>String(++n));
 const client=createApiClient({baseUrl:'https://api.test',credentials:{kind:'none'},fetch:async()=>held});
 await tracker.run({body:'old account'},async()=>{throw new Error('network lost');}).catch(()=>{});
 const reading=tracker.reconcile(client,'updateMe');
 tracker.reset();await tracker.run({body:'new account'},async()=>{throw new Error('network lost');}).catch(()=>{});
 finish(new Response(JSON.stringify({data:{state:'SUCCEEDED'},meta:{requestId:'synthetic'}}),{status:200,headers:{'content-type':'application/json'}}));
 expect(await reading).toBe('unknown');expect(tracker.pending?.fingerprint).toContain('new account');
});
