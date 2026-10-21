/** Contract-wide route/auth sweep; complements the per-command authorization and lock review. */
import {afterAll,beforeAll,expect,inject,it} from 'vitest';
import {operationsById} from '../packages/contracts/src/index.ts';
import {createHarness,type Harness} from '../apps/api/src/test/harness.ts';
let h:Harness;beforeAll(async()=>{h=await createHarness(inject('pgServerUrl'));});afterAll(async()=>h.close());
const route=(path:string)=>'/v1'+path.replace(/\{([A-Za-z]+)\}/g,':$1');
it('QA-CODE-004 every declared operation is registered and every idempotent write requires authenticated server identity',()=>{
 for(const def of Object.values(operationsById)){expect(h.app.hasRoute({method:def.method,url:route(def.path)}),def.operationId).toBe(true);if(def.write==='idempotencyKey')expect(['session','staff'],def.operationId).toContain(def.auth);if(def.auth==='staff')expect(def.roles?.length,def.operationId).toBeGreaterThan(0);}
});
it('QA-CODE-004 every protected HTTP operation rejects an unauthenticated caller without stack SQL or raw errors',async()=>{
 for(const def of Object.values(operationsById).filter(d=>['session','staff'].includes(d.auth))){
 const url='/v1'+def.path.replace(/\{([A-Za-z]+)\}/g,(_m,key:string)=>key==='page'?'overview':key==='metric'?'formation':'11111111-1111-4111-8111-111111111111');
 const r=await h.app.inject({method:def.method,url,...(def.method==='GET'?{}:{payload:{}})});expect([401,403,422,428],def.operationId+' '+r.body).toContain(r.statusCode);expect(r.body,def.operationId).not.toMatch(/"(?:stack|cause|sql|rawError|password)"|SELECT .+ FROM|node_modules/);
 }
});
