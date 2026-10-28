import { createHash } from 'node:crypto';
import type { Pool,PoolClient } from 'pg';
import { DomainError } from '../common/errors.ts';
import type { VenueService } from '../venues/service.ts';
import { loadSeatEvents,projectLifecycle,rosterAt,type MealRow } from './lifecycle.ts';
import { londonTime } from './time.ts';
export type Db=Pool|PoolClient;
export async function publicProfile(db:Db,id:string) {
 const {rows:[p]}=await db.query(`SELECT u.status,p.* FROM users u LEFT JOIN profiles p ON p.user_id=u.id WHERE u.id=$1`,[id]);
 return {id,displayName:p?.status==='ACTIVE'?(p.display_name??'Fancy member'):'Deleted member',avatarUrl:null,bio:p?.status==='ACTIVE'?(p.bio??null):null,languages:p?.status==='ACTIVE'?(p.languages??[]):[],interests:p?.status==='ACTIVE'?(p.interests??[]):[],background:p?.status==='ACTIVE'?(p.background??{}):{}};
}
// Seat-event watermark survives count round trips; non-seat events cannot invalidate it.
// Legacy unversioned declarations compare stale until the host explicitly declares again.
export function arrangementHash(meal:MealRow,count:number,seatRevision:bigint|string):string {
 return createHash('sha256').update(JSON.stringify(['booking-arrangement-v2',String(seatRevision),meal.venue_ref,meal.title,meal.description,meal.starts_at.toISOString(),meal.closes_at.toISOString(),meal.minimum,meal.capacity,meal.budget_min_pence,meal.budget_max_pence,meal.languages,meal.mood,meal.cuisine_code,meal.dietary_codes,count])).digest('hex');
}
export async function applicationDto(db:Db,row:Record<string,unknown>,includePrivate:boolean) {
 const {rows:[owner]}=await db.query<{status:string}>(`SELECT status FROM users WHERE id=$1`,[row.user_id]);
 let state=row.state;
 if(state==='PENDING'){const {rows:[meal]}=await db.query<{closes_at:Date;status:string}>(`SELECT closes_at,status FROM meals WHERE id=$1`,[row.meal_id]);if(meal&&(meal.closes_at<=new Date()||meal.status==='CANCELLED'))state='EXPIRED';}
 return {id:row.id,mealId:row.meal_id,version:String(row.version),round:row.round,state,createdAt:(row.created_at as Date).toISOString(),...(row.decided_at?{decidedAt:(row.decided_at as Date).toISOString()}:{}),...(includePrivate?{message:owner?.status==='ACTIVE'?row.message:'This application is no longer available.',applicant:await publicProfile(db,row.user_id as string)}:{})};
}
export async function mealDto(db:Db,meal:MealRow,now:Date,venues:VenueService,userId:string|null,withProviderDisplay=true) {
 const {rows:[hostStatus]}=await db.query<{status:string}>(`SELECT status FROM users WHERE id=$1`,[meal.host_id]);
 const events=await loadSeatEvents({client:db as PoolClient},meal.id);
 const projected=projectLifecycle(meal,events,now);
 // Current seats use now+1ms to include the command's own confirmation at its effectiveNow.
 const roster=rosterAt(events,new Date(now.getTime()+1));
 const count=roster.length;
 // Seat holders' public profiles, host first; same projection as the host field.
 const memberIds=[...new Set([meal.host_id,...roster])].filter(id=>roster.includes(id)||id===meal.host_id);
 const members=await Promise.all(memberIds.map(id=>publicProfile(db,id)));
 const {rows:[v]}=await db.query<{place_id:string;area_code:string}>(`SELECT place_id,area_code FROM venues WHERE id=$1`,[meal.venue_ref]);
 let place=null;
 if(v && withProviderDisplay) {try{place=await venues.details(v.place_id);}catch(error){if(!(error instanceof DomainError))throw error;}}
 const {rows:[booking]}=await db.query(`SELECT * FROM booking_declarations WHERE meal_id=$1 ORDER BY revision DESC LIMIT 1`,[meal.id]);
 const {rows:applications}=userId?await db.query(`SELECT * FROM applications WHERE meal_id=$1 AND user_id=$2 ORDER BY round DESC`,[meal.id,userId]):{rows:[]};
 const mine=applications[0];
 const {rows:[conversation]}=await db.query(`SELECT c.id,c.dissolved_at,EXISTS(SELECT 1 FROM membership_intervals i WHERE i.conversation_id=c.id AND i.user_id=$2) AS readable FROM conversations c WHERE c.meal_id=$1`,[meal.id,userId]);
 const allowedActions:string[]=[];
 if(userId && conversation?.readable)allowedActions.push('OPEN_GROUP');
 if(projected.status==='OPEN' && now<meal.starts_at){
  if(userId===meal.host_id){allowedActions.push('CANCEL','DECLARE_BOOKING','REVIEW_APPLICATIONS');if(!meal.arrangement_locked_at && now<meal.closes_at)allowedActions.push('EDIT');}
  else if(userId){if(mine?.state==='PENDING')allowedActions.push('WITHDRAW');else if(mine?.state==='CONFIRMED')allowedActions.push('LEAVE');else if(now<meal.closes_at && count<meal.capacity && !applications.some(a=>a.state==='DECLINED'))allowedActions.push('APPLY');}
 }
 if(userId && projected.status==='COMPLETED') {
 const {rowCount}=await db.query(`SELECT 1 FROM start_roster WHERE meal_id=$1 AND user_id=$2`,[meal.id,userId]);if(rowCount)allowedActions.push('POST_MEAL');
 }
 return {id:meal.id,version:String(meal.version),host:await publicProfile(db,meal.host_id),venue:{venueRef:meal.venue_ref,placeId:v?.place_id??'unavailable',available:place!==null,name:place?.name??null,address:place?.address??null,location:place?.location??null,areaCode:v?.area_code??'unknown',attributions:place?.attributions??[],displayExpiresAt:null},title:hostStatus?.status==='ACTIVE'?meal.title:'Meal unavailable',description:hostStatus?.status==='ACTIVE'?meal.description:'This meal description is no longer available.',startsAt:londonTime(meal.starts_at),closesAt:londonTime(meal.closes_at),scheduledEndAt:meal.scheduled_end_at.toISOString(),minimum:meal.minimum,capacity:meal.capacity,confirmedCount:count,members:members.slice(0,6),budgetMinPence:meal.budget_min_pence,budgetMaxPence:meal.budget_max_pence,currency:'GBP',languages:meal.languages,mood:meal.mood,areaCode:meal.area_code,cuisineCode:meal.cuisine_code,dietaryCodes:meal.dietary_codes,declarationSource:'host_reported',bookingMode:meal.booking_mode,status:projected.status,cancelReason:projected.cancelReason,arrangementLocked:meal.arrangement_locked_at!==null,bookingDeclaration:booking?{id:booking.id,revision:String(booking.revision),status:booking.status,declaredCount:booking.declared_count,reportedAt:booking.reported_at.toISOString(),stale:booking.arrangement_hash!==arrangementHash(meal,count,events.at(-1)?.seq??0n)}:null,allowedActions};
}
export function parseCursor(cursor:string|undefined):{startsAt:string;id:string}|null {
 if(!cursor)return null;
 try {const p=JSON.parse(Buffer.from(cursor,'base64url').toString('utf8'));if(typeof p.startsAt!=='string'||!Number.isFinite(Date.parse(p.startsAt))||typeof p.id!=='string'||!/^[0-9a-f-]{36}$/i.test(p.id))throw new Error();return p;}catch{throw new DomainError('VALIDATION_FAILED','Invalid page cursor.');}
}
export const mealCursor=(meal:Pick<MealRow,'starts_at'|'id'>)=>Buffer.from(JSON.stringify({startsAt:meal.starts_at.toISOString(),id:meal.id})).toString('base64url');
