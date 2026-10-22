import { randomUUID } from 'node:crypto';
import { cancelPendingJobs,enqueueJob,enqueueOutbox,insertNotification } from '@fancy/db';
import type { Tx } from '../common/transaction.ts';
import { lockActiveActor } from '../common/actor.ts';
import { DomainError } from '../common/errors.ts';
import { registerLockTable } from '../common/locks.ts';
import { loadMe } from '../identity/me.ts';
import { createGroupConversation,joinConversation } from '../membership/intervals.ts';
import { advanceLifecycle,cancelMealState,loadSeatEvents,mealFact,rosterAt,type MealRow } from './lifecycle.ts';
import { arrangementHash } from './read.ts';
import { resolveLondonTime,type TimeInput } from './time.ts';
registerLockTable('meals','meal');
registerLockTable('conversations','conversation');
export interface Arrangement {
 venueRef:string;title:string;description:string;start:TimeInput;close:TimeInput;minimum:number;capacity:number;budgetMinPence:number;budgetMaxPence:number;languages:string[];mood:string;cuisineCode?:string|null;dietaryCodes?:string[]|null;
}
export interface CreateMealInput extends Arrangement { bookingMode:string;attemptId:string;bookingDeclarationConfirmed:true;reviewConfirmed:true;termsVersion:string }
export async function requireProfile(tx:Tx,userId:string) {const me=await loadMe(tx.client,userId);if(!me.profileGate.profileComplete)throw new DomainError('PROFILE_INCOMPLETE','Complete your profile before continuing.');}
export function validateArrangement(input:Arrangement,now:Date) {
 if([...input.title.trim()].length<5||[...input.title.trim()].length>80||[...input.description.trim()].length<20||[...input.description.trim()].length>1000)throw new DomainError('VALIDATION_FAILED','Check the title and description length.');
 const start=resolveLondonTime(input.start),close=resolveLondonTime(input.close);
 if(new Date(start.instant)<=now || new Date(close.instant)<=now)throw new DomainError('VALIDATION_FAILED','Choose a future start and application deadline.');
 if(Date.parse(close.instant)>Date.parse(start.instant)-30*60_000)throw new DomainError('VALIDATION_FAILED','Applications must close at least 30 minutes before the meal.');
 if(input.minimum>input.capacity || input.minimum<2 || input.capacity>6 || input.budgetMinPence<=0 || input.budgetMaxPence<input.budgetMinPence)throw new DomainError('VALIDATION_FAILED','Check the table size and budget range.');
 return {start,close};
}
export async function lockMeal(tx:Tx,mealId:string,actorId:string,extraUserIds:string[]=[]) {
 // Discover immutable aggregate references before locks, then re-read mutable state under meal lock.
 const {rows:[hint]}=await tx.client.query<{host_id:string;conversation_id:string|null}>(`SELECT m.host_id,c.id AS conversation_id FROM meals m LEFT JOIN conversations c ON c.meal_id=m.id WHERE m.id=$1`,[mealId]);
 if(!hint)throw new DomainError('NOT_FOUND','Meal not found.');
 const users=[...new Set([actorId,...extraUserIds])].sort();
 const active=await tx.locks.lock<{id:string;status:string}>('users',users,'share','id,status');
 if(!active.some(u=>u.id===actorId&&u.status==='ACTIVE'))throw new DomainError('AUTH_REQUIRED','Your session is no longer valid.');
 // Extra users are applicants in host decisions. Their account state is a business failure,
 // never evidence that the caller's own session expired. Authorize before exposing that state.
 if(extraUserIds.length&&hint.host_id!==actorId)throw new DomainError('FORBIDDEN','Only the host can decide this application.');
 if(active.length!==users.length||active.some(u=>u.status!=='ACTIVE'))throw new DomainError('NOT_FOUND','This participant is unavailable.');
 const [meal]=await tx.locks.lock<MealRow>('meals',[mealId],'update','*');
 if(!meal)throw new DomainError('NOT_FOUND','Meal not found.');
 if(hint.conversation_id)await tx.locks.lock('conversations',[hint.conversation_id],'update');
 const now=await tx.effectiveNow();
 await advanceLifecycle(tx,meal,now);
 return {meal,now,conversationId:hint.conversation_id};
}
export function checkVersion(actual:string,expected:string|null){if(expected!==actual)throw new DomainError('VERSION_CONFLICT','This meal has changed. Refresh and try again.',{currentVersion:actual});}
export function openMeal(meal:MealRow){if(meal.status==='CANCELLED')throw new DomainError('MEAL_CANCELLED','This meal was cancelled.');if(meal.status!=='OPEN')throw new DomainError('DEADLINE_PASSED','This meal has ended.');}
export async function currentSeats(tx:Tx,meal:MealRow,now:Date){return rosterAt(await loadSeatEvents(tx,meal.id),new Date(now.getTime()+1));}
export async function addSeat(tx:Tx,meal:MealRow,userId:string,applicationId:string|null,type:'HOST_CONFIRMED'|'GUEST_CONFIRMED'|'LEFT',now:Date,commandId:string) {
 const eventId=await mealFact(tx,meal,type==='LEFT'?'seat.left':type==='HOST_CONFIRMED'?'meal.published':'application.approved',now,userId);
 await tx.client.query(`INSERT INTO seat_events(meal_id,seq,user_id,application_id,type,effective_at,command_id) VALUES($1,$2,$3,$4,$5,$6,$7)`,[meal.id,meal.head,userId,applicationId,type,now,commandId]);
 return eventId;
}
async function schedule(tx:Tx,meal:MealRow){for(const [kind,dueAt] of [['meal.close',meal.closes_at],['meal.start',meal.starts_at],['meal.end',meal.scheduled_end_at]] as const){await cancelPendingJobs(tx.client,kind,meal.id);await enqueueJob(tx.client,{kind,resourceId:meal.id,dueAt});}}
export interface VerifiedVenue {venueRef:string;placeId:string}
async function checkedVenue(tx:Tx,venueRef:string,verified:VerifiedVenue){
 const {rows:[venue]}=await tx.client.query<{place_id:string;area_code:string}>(`SELECT place_id,area_code FROM venues WHERE id=$1`,[venueRef]);
 if(!venue)throw new DomainError('NOT_FOUND','Confirm a restaurant first.');
 if(verified.venueRef!==venueRef||verified.placeId!==venue.place_id)throw new DomainError('STATE_CONFLICT','The restaurant changed. Refresh and try again.');
 return venue;
}
export async function publishMeal(tx:Tx,actorId:string,input:CreateMealInput,verified:VerifiedVenue) {
 input={...input,title:input.title.trim(),description:input.description.trim()};
 await lockActiveActor(tx,actorId);
 const now=await tx.effectiveNow();await requireProfile(tx,actorId);
 const venue=await checkedVenue(tx,input.venueRef,verified);
 const {start,close}=validateArrangement(input,now);
 const {rows:[existing]}=await tx.client.query(`SELECT id FROM meals WHERE host_id=$1 AND attempt_id=$2`,[actorId,input.attemptId]);
 if(existing)throw new DomainError('STATE_CONFLICT','This publishing attempt already created a meal.');
 const {rows:[meal]}=await tx.client.query<MealRow>(`INSERT INTO meals(host_id,venue_ref,title,description,starts_at,closes_at,scheduled_end_at,start_local_date,start_local_time,start_offset,close_local_date,close_local_time,close_offset,minimum,capacity,budget_min_pence,budget_max_pence,languages,mood,area_code,cuisine_code,dietary_codes,booking_mode,terms_version,attempt_id) VALUES($1,$2,$3,$4,$5,$6,$5::timestamptz+interval '2 hours',$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24) RETURNING *`,[actorId,input.venueRef,input.title,input.description,start.instant,close.instant,start.localDate,start.localTime,start.utcOffsetMinutes,close.localDate,close.localTime,close.utcOffsetMinutes,input.minimum,input.capacity,input.budgetMinPence,input.budgetMaxPence,input.languages,input.mood,venue.area_code,input.cuisineCode??null,input.dietaryCodes??null,input.bookingMode,input.termsVersion,input.attemptId]);
 await addSeat(tx,meal!,actorId,null,'HOST_CONFIRMED',now,randomUUID());
 await createGroupConversation(tx,{mealId:meal!.id,hostId:actorId,effectiveAt:now});
 await schedule(tx,meal!);
 // The host reports booking the planned capacity; the hash captures the current host-only roster baseline.
 // Later roster or arrangement changes still make this self-reported declaration stale.
 await tx.client.query(`INSERT INTO booking_declarations(meal_id,revision,reported_by,declared_count,reported_at,status,arrangement_hash) VALUES($1,1,$2,$3,$4,'REPORTED_CONFIRMED',$5)`,[meal!.id,actorId,input.capacity,now,arrangementHash(meal!,1)]);
 return {meal:meal!,now};
}
export async function editArrangement(tx:Tx,mealId:string,actorId:string,expected:string|null,patch:Partial<Arrangement>,verified:VerifiedVenue) {
 const {meal,now}=await lockMeal(tx,mealId,actorId);if(meal.host_id!==actorId)throw new DomainError('FORBIDDEN','Only the host can edit this meal.');
 openMeal(meal);checkVersion(meal.version,expected);
 if(meal.arrangement_locked_at)throw new DomainError('ARRANGEMENT_LOCKED','The arrangement is locked after the first guest is approved.');
 if(now>=meal.closes_at)throw new DomainError('DEADLINE_PASSED','Applications have closed.');
 const full:Arrangement={venueRef:meal.venue_ref,title:meal.title,description:meal.description,start:{localDate:meal.start_local_date,localTime:meal.start_local_time,timeZone:'Europe/London',utcOffsetMinutes:meal.start_offset},close:{localDate:meal.close_local_date,localTime:meal.close_local_time,timeZone:'Europe/London',utcOffsetMinutes:meal.close_offset},minimum:meal.minimum,capacity:meal.capacity,budgetMinPence:meal.budget_min_pence,budgetMaxPence:meal.budget_max_pence,languages:meal.languages,mood:meal.mood,cuisineCode:meal.cuisine_code,dietaryCodes:meal.dietary_codes,...patch};
 full.title=full.title.trim();full.description=full.description.trim();
 const {start,close}=validateArrangement(full,now);
 const venue=await checkedVenue(tx,full.venueRef,verified);
 await requireProfile(tx,actorId);
 const {rows:[updated]}=await tx.client.query<MealRow>(`UPDATE meals SET venue_ref=$2,title=$3,description=$4,starts_at=$5,closes_at=$6,scheduled_end_at=$5::timestamptz+interval '2 hours',start_local_date=$7,start_local_time=$8,start_offset=$9,close_local_date=$10,close_local_time=$11,close_offset=$12,minimum=$13,capacity=$14,budget_min_pence=$15,budget_max_pence=$16,languages=$17,mood=$18,area_code=$19,cuisine_code=$20,dietary_codes=$21,version=version+1 WHERE id=$1 RETURNING *`,[mealId,full.venueRef,full.title,full.description,start.instant,close.instant,start.localDate,start.localTime,start.utcOffsetMinutes,close.localDate,close.localTime,close.utcOffsetMinutes,full.minimum,full.capacity,full.budgetMinPence,full.budgetMaxPence,full.languages,full.mood,full.venueRef===meal.venue_ref?meal.area_code:venue.area_code,full.cuisineCode??null,full.dietaryCodes??null]);
 await schedule(tx,updated!);await mealFact(tx,updated!,'meal.edited',now,actorId);return {meal:updated!,now};
}
export async function declareBooking(tx:Tx,mealId:string,actorId:string,expected:string|null,input:{status:string;count:number}) {
 const {meal,now}=await lockMeal(tx,mealId,actorId);if(meal.host_id!==actorId)throw new DomainError('FORBIDDEN','Only the host can report a booking.');openMeal(meal);checkVersion(meal.version,expected);
  await tx.client.query(`INSERT INTO booking_declarations(meal_id,revision,reported_by,declared_count,reported_at,status,arrangement_hash) SELECT $1,COALESCE(max(revision),0)+1,$2,$3,$4,$5,$6 FROM booking_declarations WHERE meal_id=$1`,[mealId,actorId,input.count,now,input.status,arrangementHash(meal,input.count)]);
 await tx.client.query(`UPDATE meals SET version=version+1 WHERE id=$1`,[mealId]);meal.version=String(BigInt(meal.version)+1n);
 const eventId=await mealFact(tx,meal,'booking.declared',now,actorId);
 for(const userId of await currentSeats(tx,meal,now))await insertNotification(tx.client,{eventId,recipientId:userId,template:'booking_updated',refs:{mealId}});
 return {meal,now};
}
export async function cancelByHost(tx:Tx,mealId:string,actorId:string,expected:string|null,reason:string) {
 const {meal,now}=await lockMeal(tx,mealId,actorId);if(meal.host_id!==actorId)throw new DomainError('FORBIDDEN','Only the host can cancel.');openMeal(meal);checkVersion(meal.version,expected);if(now>=meal.starts_at)throw new DomainError('DEADLINE_PASSED','This meal has already started.');await cancelMealState(tx,meal,reason,now,actorId);return {meal,now};
}
export async function approveApplication(tx:Tx,applicationId:string,actorId:string,expected:string|null,decision:'APPROVE'|'DECLINE') {
 const {rows:[hint]}=await tx.client.query<{meal_id:string;user_id:string}>(`SELECT meal_id,user_id FROM applications WHERE id=$1`,[applicationId]);if(!hint)throw new DomainError('NOT_FOUND','Application not found.');
 const {meal,now,conversationId}=await lockMeal(tx,hint.meal_id,actorId,[hint.user_id]);
 if(meal.host_id!==actorId)throw new DomainError('FORBIDDEN','Only the host can decide this application.');
 const {rows:[app]}=await tx.client.query(`SELECT * FROM applications WHERE id=$1`,[applicationId]);
 openMeal(meal);checkVersion(String(app.version),expected);
 if(now>=meal.closes_at)throw new DomainError('DEADLINE_PASSED','Applications have closed.');if(app.state!=='PENDING')throw new DomainError('STATE_CONFLICT','This application has already been decided.');
 if(decision==='APPROVE' && (await currentSeats(tx,meal,now)).length>=meal.capacity)throw new DomainError('MEAL_FULL','This table is full.');
 const {rows:[updated]}=await tx.client.query(`UPDATE applications SET state=$2,version=version+1,decided_at=$3 WHERE id=$1 RETURNING *`,[applicationId,decision==='APPROVE'?'CONFIRMED':'DECLINED',now]);
 let eventId:string;
 if(decision==='APPROVE') {
  eventId=await addSeat(tx,meal,hint.user_id,applicationId,'GUEST_CONFIRMED',now,randomUUID());
  await tx.client.query(`UPDATE meals SET arrangement_locked_at=COALESCE(arrangement_locked_at,$2),version=version+1 WHERE id=$1`,[meal.id,now]);meal.arrangement_locked_at??=now;meal.version=String(BigInt(meal.version)+1n);
  if(conversationId){const {rows:[c]}=await tx.client.query(`SELECT dissolved_at FROM conversations WHERE id=$1`,[conversationId]);if(!c.dissolved_at)await joinConversation(tx,conversationId,hint.user_id,now);}
 }else eventId=await mealFact(tx,meal,'application.declined',now,actorId);
 await insertNotification(tx.client,{eventId,recipientId:hint.user_id,template:decision==='APPROVE'?'application_approved':'application_declined',refs:{mealId:meal.id}});
 await enqueueOutbox(tx.client,{eventId,recipientId:hint.user_id,channel:'EMAIL',template:decision==='APPROVE'?'application_approved':'application_declined',payload:{mealId:meal.id,applicationId}});
 return {application:updated!,meal,now,conversationId};
}
