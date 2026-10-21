import type { Pool } from 'pg';
import type { OperationDef } from '@fancy/contracts';
import { DomainError } from '../common/errors.ts';
async function take(db:Pool,actor:string,bucket:string,seconds:number,limit:number){
 const {rows:[row]}=await db.query<{count:number;retry:number}>(`WITH tick AS (SELECT clock_timestamp() AS now), win AS (SELECT to_timestamp(floor(extract(epoch FROM now)/$3)*$3) AS start, now FROM tick), counted AS (
 INSERT INTO api_rate_limits(actor_id,bucket,window_start,count) SELECT $1,$2,start,1 FROM win
 ON CONFLICT(actor_id,bucket,window_start) DO UPDATE SET count=api_rate_limits.count+1 RETURNING count)
 SELECT counted.count, greatest(1,ceil(extract(epoch FROM (win.start+make_interval(secs=>$3)-win.now))))::int AS retry FROM counted,win`,[actor,bucket,seconds]);
 if(row!.count>limit)throw new DomainError('RATE_LIMITED','Too many requests. Please wait and try again.',{retryAfterSeconds:row!.retry});
}
export async function enforceRateLimit(db:Pool,actor:string,def:OperationDef,resource:string){
 if(def.operationId==='adminExport')await take(db,actor,'export',3600,5);
 if(def.method!=='GET'&&def.write!=='read'){
  await take(db,actor,def.operationId==='sendMessage'?'messages':'writes',60,def.operationId==='sendMessage'?30:60);
  await take(db,actor,'write-burst',1,10);
 }else if(def.operationId==='readMessages'||def.operationId==='inbox')await take(db,actor,`poll:${resource}`,60,40);
}
