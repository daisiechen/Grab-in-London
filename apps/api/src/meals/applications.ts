import { randomUUID } from 'node:crypto';
import { insertNotification } from '@fancy/db';
import type { Tx } from '../common/transaction.ts';
import { DomainError } from '../common/errors.ts';
import { addSeat,checkVersion,currentSeats,lockMeal,openMeal,requireProfile } from './commands.ts';
import { cancelMealState,mealFact } from './lifecycle.ts';
export async function applyForMeal(tx:Tx,mealId:string,actorId:string,message:string) {
 message=message.trim();if([...message].length<20||[...message].length>300)throw new DomainError('VALIDATION_FAILED','Application messages must contain 20 to 300 characters.');
 const {meal,now}=await lockMeal(tx,mealId,actorId);openMeal(meal);await requireProfile(tx,actorId);
 if(meal.host_id===actorId)throw new DomainError('FORBIDDEN','You already host this meal.');
 // A meal limited by moderation accepts no new applicants until staff restore it.
 if(meal.moderation_hidden_at)throw new DomainError('NOT_FOUND','This meal is unavailable.');
 if(now>=meal.closes_at)throw new DomainError('DEADLINE_PASSED','Applications have closed.');
 if((await currentSeats(tx,meal,now)).length>=meal.capacity)throw new DomainError('MEAL_FULL','This table is full.');
 const {rows}=await tx.client.query(`SELECT state,round FROM applications WHERE meal_id=$1 AND user_id=$2 ORDER BY round DESC`,[mealId,actorId]);
 if(rows.some(a=>a.state==='DECLINED'))throw new DomainError('APPLICATION_DECLINED_FINAL','You cannot reapply to this meal after being declined.');
 if(rows.some(a=>a.state==='PENDING'||a.state==='CONFIRMED'))throw new DomainError('STATE_CONFLICT','You already have an active application.');
 const {rows:[application]}=await tx.client.query(`INSERT INTO applications(meal_id,user_id,round,state,message,created_at) VALUES($1,$2,$3,'PENDING',$4,$5) RETURNING *`,[mealId,actorId,(rows[0]?.round??0)+1,message,now]);
 const eventId=await mealFact(tx,meal,'application.submitted',now,actorId);
 await insertNotification(tx.client,{eventId,recipientId:meal.host_id,template:'application_submitted',refs:{mealId,applicationId:application!.id}});return application!;
}
export async function withdrawPending(tx:Tx,applicationId:string,actorId:string,expected:string|null) {
 const {rows:[hint]}=await tx.client.query<{meal_id:string;user_id:string}>(`SELECT meal_id,user_id FROM applications WHERE id=$1`,[applicationId]);if(!hint)throw new DomainError('NOT_FOUND','Application not found.');
 // Do not leak another user's application progress.
 if(hint.user_id!==actorId)throw new DomainError('FORBIDDEN','This application belongs to another member.');
 const {meal,now}=await lockMeal(tx,hint.meal_id,actorId);
 const {rows:[application]}=await tx.client.query(`SELECT * FROM applications WHERE id=$1`,[applicationId]);checkVersion(String(application.version),expected);
 if(application.state!=='PENDING')throw new DomainError('STATE_CONFLICT','Only pending applications can be withdrawn.');
 const {rows:[updated]}=await tx.client.query(`UPDATE applications SET state='WITHDRAWN',version=version+1,decided_at=$2 WHERE id=$1 RETURNING *`,[applicationId,now]);
 const eventId=await mealFact(tx,meal,'application.withdrawn',now,actorId);
 await insertNotification(tx.client,{eventId,recipientId:meal.host_id,template:'application_withdrawn',refs:{mealId:meal.id,applicationId}});return updated!;
}
export async function leaveConfirmed(tx:Tx,mealId:string,actorId:string,expected:string|null) {
 const {meal,now}=await lockMeal(tx,mealId,actorId);openMeal(meal);checkVersion(meal.version,expected);
 if(meal.host_id===actorId)throw new DomainError('FORBIDDEN','Hosts must cancel their meal instead.');
 if(now>=meal.starts_at)throw new DomainError('DEADLINE_PASSED','You cannot leave after the meal starts.');
 const {rows:[application]}=await tx.client.query(`SELECT * FROM applications WHERE meal_id=$1 AND user_id=$2 AND state='CONFIRMED'`,[mealId,actorId]);if(!application)throw new DomainError('STATE_CONFLICT','You do not hold a confirmed seat.');
 const {rows:[updated]}=await tx.client.query(`UPDATE applications SET state='CANCELLED',version=version+1,decided_at=$2 WHERE id=$1 RETURNING *`,[application.id,now]);
 const eventId=await addSeat(tx,meal,actorId,application.id,'LEFT',now,randomUUID());
 await insertNotification(tx.client,{eventId,recipientId:meal.host_id,template:'guest_left',refs:{mealId,applicationId:application.id}});
 await tx.client.query(`UPDATE meals SET version=version+1 WHERE id=$1`,[mealId]);meal.version=String(BigInt(meal.version)+1n);
 // Seat exit deliberately preserves group membership and history.
 if(now>=meal.closes_at && (await currentSeats(tx,meal,now)).length<meal.minimum)await cancelMealState(tx,meal,'insufficient',now,actorId);
 return {application:updated!,meal,now};
}
