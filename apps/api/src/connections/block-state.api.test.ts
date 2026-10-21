import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,inject,it} from 'vitest';
import {Browser,createHarness,json,type Harness} from '../test/harness.ts';
let h:Harness;beforeAll(async()=>{h=await createHarness(inject('pgServerUrl'));});afterAll(async()=>h.close());
async function actor(){const b=new Browser(h),r=await b.signInWithEmail(`${randomUUID()}@example.invalid`);return{b,id:r.body.data.session.user.id as string};}
const path=(id:string)=>`/v1/blocks/${id}`;
async function counts(){const names=['user_pairs','blocks','block_revisions','pair_consents','business_events','outbox'];const result:Record<string,string>={};for(const name of names)result[name]=(await h.db.pool.query(`SELECT count(*)::text AS count FROM ${name}`)).rows[0].count;return result;}
it('starts false/version0 for active subject without profile; GET creates no pair or business records',async()=>{
 const a=await actor(),b=await actor(),before=await counts();const r=await a.b.request('GET',path(b.id));expect(r.statusCode,r.body).toBe(200);expect(json(r).data).toEqual({subjectId:b.id,blocked:false,version:'0'});expect(json(r).meta.version).toBe('0');expect(await counts()).toEqual(before);
});
it('returns only actor direction and latest revision through block/unblock, without revealing reverse block',async()=>{
 const a=await actor(),b=await actor();const change=(who:Browser,other:string,method:string,version:string)=>who.request(method,path(other),{headers:{'idempotency-key':randomUUID(),'if-match':`"${version}"`}});
 expect((await change(b.b,a.id,'PUT','0')).statusCode).toBe(200);expect(json(await a.b.request('GET',path(b.id))).data).toEqual({subjectId:b.id,blocked:false,version:'0'});
 expect((await change(a.b,b.id,'PUT','0')).statusCode).toBe(200);const blocked=await a.b.request('GET',path(b.id));expect(json(blocked).data).toEqual({subjectId:b.id,blocked:true,version:'1'});expect(json(blocked).meta.version).toBe('1');
 expect((await change(a.b,b.id,'DELETE','1')).statusCode).toBe(200);expect(json(await a.b.request('GET',path(b.id))).data).toEqual({subjectId:b.id,blocked:false,version:'2'});expect(json(await b.b.request('GET',path(a.id))).data).toEqual({subjectId:a.id,blocked:true,version:'1'});
});
it('requires session, rejects self and masks missing/deleting/deleted subjects uniformly',async()=>{
 const a=await actor(),b=await actor(),anonymous=new Browser(h);expect((await anonymous.request('GET',path(a.id))).statusCode).toBe(401);expect((await a.b.request('GET',path(a.id))).statusCode).toBe(403);
 const missing=await a.b.request('GET',path(randomUUID()));expect(missing.statusCode).toBe(404);
 for(const status of ['DELETING','DELETED']){await h.db.pool.query(`UPDATE users SET status=$2 WHERE id=$1`,[b.id,status]);const r=await a.b.request('GET',path(b.id));expect(r.statusCode).toBe(404);expect(json(r).error.code).toBe(json(missing).error.code);expect(json(r).error.message).toBe(json(missing).error.message);}
});
