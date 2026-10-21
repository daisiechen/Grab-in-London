import { createHash } from 'node:crypto';
import { appendBusinessEvent, enqueueOutbox, insertNotification } from '@fancy/db';
import type { Tx } from '../common/transaction.ts';
export interface MealRow {
 id:string;host_id:string;venue_ref:string;title:string;description:string;starts_at:Date;closes_at:Date;scheduled_end_at:Date;
 start_local_date:string;start_local_time:string;start_offset:number;close_local_date:string;close_local_time:string;close_offset:number;
 minimum:number;capacity:number;budget_min_pence:number;budget_max_pence:number;languages:string[];mood:string;area_code:string;cuisine_code:string|null;dietary_codes:string[]|null;booking_mode:string;
 status:'OPEN'|'CANCELLED'|'COMPLETED';cancel_reason:string|null;version:string;head:string;arrangement_locked_at:Date|null;terms_version:string;attempt_id:string;created_at:Date;
}
export interface SeatEvent { userId:string;type:'HOST_CONFIRMED'|'GUEST_CONFIRMED'|'LEFT';effectiveAt:Date;seq:bigint }
/** Boundary semantics are deliberately asymmetric: confirmation is strict, exit inclusive. */
export function rosterAt(events: readonly SeatEvent[], at:Date):string[] {
 const active=new Set<string>();
 for(const event of [...events].sort((a,b)=>a.effectiveAt.getTime()-b.effectiveAt.getTime() || (a.seq<b.seq?-1:1))) {
  if(event.type==='LEFT' ? event.effectiveAt<=at : event.effectiveAt<at) { if(event.type==='LEFT')active.delete(event.userId);else active.add(event.userId); }
 }
 return [...active].sort();
}
export function projectLifecycle(meal: Pick<MealRow,'status'|'cancel_reason'|'closes_at'|'scheduled_end_at'|'minimum'>,events:readonly SeatEvent[],now:Date):{status:MealRow['status'];cancelReason:string|null} {
 if(meal.status!=='OPEN')return {status:meal.status,cancelReason:meal.cancel_reason};
 if(now>=meal.closes_at && rosterAt(events,meal.closes_at).length<meal.minimum)return {status:'CANCELLED',cancelReason:'insufficient'};
 return {status:now>=meal.scheduled_end_at?'COMPLETED':'OPEN',cancelReason:null};
}
export async function loadSeatEvents(tx:Pick<Tx,'client'>,mealId:string):Promise<SeatEvent[]> {
 const {rows}=await tx.client.query<{user_id:string;type:SeatEvent['type'];effective_at:Date;seq:string}>(`SELECT user_id,type,effective_at,seq FROM seat_events WHERE meal_id=$1 ORDER BY seq`,[mealId]);
 return rows.map(r=>({userId:r.user_id,type:r.type,effectiveAt:r.effective_at,seq:BigInt(r.seq)}));
}
export async function mealFact(tx:Tx,meal:MealRow,kind:string,at:Date,actorId:string|null) {
 const {rows:[row]}=await tx.client.query<{head:string}>(`UPDATE meals SET head=head+1 WHERE id=$1 RETURNING head`,[meal.id]);
 meal.head=row!.head;
 return appendBusinessEvent(tx.client,{aggregateType:'meal',aggregateId:meal.id,aggregateSeq:meal.head,kind,effectiveAt:at,actorKind:actorId?'USER':'SYSTEM',actorId});
}
export async function cancelMealState(tx:Tx,meal:MealRow,reason:string,at:Date,actorId:string|null):Promise<void> {
 if(meal.status==='CANCELLED')return;
 const {rows}=await tx.client.query<{user_id:string}>(`SELECT DISTINCT user_id FROM applications WHERE meal_id=$1 AND state IN ('PENDING','CONFIRMED') UNION SELECT host_id AS user_id FROM meals WHERE id=$1`,[meal.id]);
 await tx.client.query(`UPDATE meals SET status='CANCELLED',cancel_reason=$2,version=version+1 WHERE id=$1`,[meal.id,reason]);
 await tx.client.query(`UPDATE applications SET state='EXPIRED',version=version+1,decided_at=$2 WHERE meal_id=$1 AND state='PENDING'`,[meal.id,at]);
 meal.status='CANCELLED';meal.cancel_reason=reason;meal.version=String(BigInt(meal.version)+1n);
 const eventId=await mealFact(tx,meal,'meal.cancelled',at,actorId);
 for(const row of rows) {
  await insertNotification(tx.client,{eventId,recipientId:row.user_id,template:'meal_cancelled',refs:{mealId:meal.id}});
  await enqueueOutbox(tx.client,{eventId,recipientId:row.user_id,channel:'EMAIL',template:'meal_cancelled',payload:{mealId:meal.id}});
 }
}
/** Called with meal lock and all downstream conversation locks already held. */
export async function advanceLifecycle(tx:Tx,meal:MealRow,now:Date):Promise<void> {
 if(meal.status!=='OPEN')return;
 const events=await loadSeatEvents(tx,meal.id);
 for(const [kind,due] of [['CLOSE',meal.closes_at],['START',meal.starts_at],['END',meal.scheduled_end_at]] as const) {
  if(now<due || meal.status!=='OPEN')break;
  const mark=await tx.client.query(`INSERT INTO lifecycle_marks(meal_id,kind,due_at) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING kind`,[meal.id,kind,due]);
  if(!mark.rowCount)continue;
  let expired:Array<{id:string;user_id:string}>=[];
  if(kind==='CLOSE') {
   if(rosterAt(events,due).length<meal.minimum){await cancelMealState(tx,meal,'insufficient',due,null);break;}
   const result=await tx.client.query<{id:string;user_id:string}>(`UPDATE applications SET state='EXPIRED',version=version+1,decided_at=$2 WHERE meal_id=$1 AND state='PENDING' RETURNING id,user_id`,[meal.id,due]);expired=result.rows;
  }
  if(kind==='START') {
   const roster=rosterAt(events,due);
   const hash=createHash('sha256').update(JSON.stringify(events.map(e=>[e.userId,e.type,e.effectiveAt.toISOString(),String(e.seq)]))).digest('hex');
   for(const userId of roster)await tx.client.query(`INSERT INTO start_roster(meal_id,user_id,source_revision_hash,starts_at) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`,[meal.id,userId,hash,due]);
  }
  if(kind==='END') {
   await tx.client.query(`UPDATE meals SET status='COMPLETED',version=version+1 WHERE id=$1`,[meal.id]);
   meal.status='COMPLETED';meal.version=String(BigInt(meal.version)+1n);
  }
  const eventId=await mealFact(tx,meal,`meal.${kind.toLowerCase()}`,due,null);
  for(const application of expired){
    await insertNotification(tx.client,{eventId,recipientId:application.user_id,template:'application_expired',refs:{mealId:meal.id,applicationId:application.id}});
    await enqueueOutbox(tx.client,{eventId,recipientId:application.user_id,channel:'EMAIL',template:'application_expired',payload:{mealId:meal.id,applicationId:application.id}});
  }
 }
}
