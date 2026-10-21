import type {Pool,PoolClient} from 'pg';
import {DomainError} from '../common/errors.ts';
import type {Tx} from '../common/transaction.ts';
import type {MealRow} from '../meals/lifecycle.ts';
export type Db=Pool|PoolClient;
export const POST_MEAL_WINDOW_MS=7*24*60*60_000;
export interface AttendanceRow {source:'SELF'|'HOST'|'SUPPORT';value:'present'|'absent';version:string}
export function projectAttendance(subjectId:string,revisions:readonly AttendanceRow[]) {
 const latest=(source:AttendanceRow['source'])=>revisions.filter(r=>r.source===source).sort((a,b)=>BigInt(a.version)>BigInt(b.version)?-1:1)[0];
 const self=latest('SELF'),host=latest('HOST'),support=latest('SUPPORT');const effective=support??self??host;
 return {subjectId,value:effective?.value??'unknown',source:effective?.source??null,selfValue:self?.value??null,hostValue:host?.value??null,version:String(revisions.reduce((max,r)=>BigInt(r.version)>max?BigInt(r.version):max,0n))};
}
export async function attendanceState(db:Db,mealId:string,subjectId:string) {
 const {rows}=await db.query<AttendanceRow>(`SELECT source,value,version FROM attendance_revisions WHERE meal_id=$1 AND subject_id=$2 ORDER BY version DESC`,[mealId,subjectId]);return projectAttendance(subjectId,rows);
}
export async function isPresent(db:Db,mealId:string,userId:string):Promise<boolean> {
 const {rows:[membership]}=await db.query(`SELECT 1 FROM start_roster r JOIN meals m ON m.id=r.meal_id JOIN users u ON u.id=r.user_id WHERE r.meal_id=$1 AND r.user_id=$2 AND m.status<>'CANCELLED' AND u.status='ACTIVE'`,[mealId,userId]);
 return Boolean(membership)&&(await attendanceState(db,mealId,userId)).value==='present';
}
export function assertWindow(meal:Pick<MealRow,'status'|'scheduled_end_at'>,now:Date) {
 if(meal.status==='CANCELLED'||now<meal.scheduled_end_at||now.getTime()>=meal.scheduled_end_at.getTime()+POST_MEAL_WINDOW_MS)throw new DomainError('STATE_CONFLICT','The post-meal reporting window is closed.');
}
export async function assertRoster(db:Db,mealId:string,userIds:string[]) {
 const {rowCount}=await db.query(`SELECT user_id FROM start_roster WHERE meal_id=$1 AND user_id=ANY($2::uuid[])`,[mealId,[...new Set(userIds)]]);if(rowCount!==new Set(userIds).size)throw new DomainError('FORBIDDEN','Only the meal start roster can use this action.');
}
/** Caller holds actor/subject users, meal, affected pair and conversation locks before now. */
export async function recordAttendanceRevision(tx:Tx,meal:MealRow,subjectId:string,source:AttendanceRow['source'],value:'present'|'absent',actorId:string,expected:string|null,now:Date,reason?:string) {
 await assertRoster(tx.client,meal.id,[subjectId]);
 if(source==='SUPPORT') {if(now.getTime()<meal.scheduled_end_at.getTime()+POST_MEAL_WINDOW_MS)throw new DomainError('CORRECTION_WINDOW_OPEN','Self reporting is still open.');if(meal.status==='CANCELLED'||!reason?.trim())throw new DomainError('FORBIDDEN','A documented correction is required.');}
 else {assertWindow(meal,now);if(source==='SELF'?actorId!==subjectId:actorId!==meal.host_id)throw new DomainError('FORBIDDEN','You cannot report attendance for this member.');}
 const before=await attendanceState(tx.client,meal.id,subjectId);if(expected!==before.version)throw new DomainError('VERSION_CONFLICT','Attendance has changed.',{currentVersion:before.version});
 const version=String(BigInt(before.version)+1n);
 await tx.client.query(`INSERT INTO attendance_revisions(meal_id,subject_id,source,value,version,reason,actor_id,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[meal.id,subjectId,source,value,version,reason?.trim()??null,actorId,now]);
 return attendanceState(tx.client,meal.id,subjectId);
}
