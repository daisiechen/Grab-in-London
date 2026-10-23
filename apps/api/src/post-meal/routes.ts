import type {FastifyInstance} from 'fastify';
import type {AppDeps} from '../http/context.ts';
import {defineRoute,defineWrite} from '../http/routes.ts';
import {DomainError} from '../common/errors.ts';
import {connectionState,invalidateIneligiblePairs,type PairRow} from '../connections/service.ts';
import {loadSeatEvents,rosterAt,type MealRow} from '../meals/lifecycle.ts';
import {publicProfile} from '../meals/read.ts';
import {attendanceState,recordAttendanceRevision,isPresent,POST_MEAL_WINDOW_MS} from './attendance.ts';
import {lockPostMeal} from './lock.ts';
import {rateExperience} from './experience.ts';
import {reviewPerson,reviewVisibility} from './reviews.ts';
export function registerPostMealRoutes(app:FastifyInstance,deps:AppDeps) {
 async function replayAllowed(actorId:string,mealId:string,subjectId:string|undefined,requiresPresent:boolean) {
  const ids=[...new Set([actorId,...(subjectId?[subjectId]:[])])];
  const {rowCount}=await deps.pool.query(`SELECT 1 FROM start_roster r JOIN meals m ON m.id=r.meal_id JOIN users u ON u.id=r.user_id WHERE r.meal_id=$1 AND r.user_id=ANY($2::uuid[]) AND m.status<>'CANCELLED' AND u.status='ACTIVE'`,[mealId,ids]);
  if(rowCount!==ids.length)return false;
  if(requiresPresent)for(const id of ids)if(!await isPresent(deps.pool,mealId,id))return false;
  return true;
 }

 defineWrite(app,deps,'reportAttendance',async({request,auth,ifMatch},tx)=>{
  const {mealId,subjectId}=request.params as {mealId:string;subjectId:string};const {meal,now,pairs}=await lockPostMeal(tx,mealId,auth.userId,subjectId);
  const source=auth.userId===subjectId?'SELF':'HOST';const data=await recordAttendanceRevision(tx,meal,subjectId,source,(request.body as {value:'present'|'absent'}).value,auth.userId,ifMatch,now);
  await invalidateIneligiblePairs(tx,pairs,now);return {data,version:data.version,resourceId:mealId};
 },(auth,{request})=>{const p=request.params as {mealId:string;subjectId:string};return replayAllowed(auth.userId,p.mealId,p.subjectId,false);});
 defineWrite(app,deps,'rateExperience',async({request,auth,ifMatch},tx)=>{
  const {mealId}=request.params as {mealId:string};const {meal,now}=await lockPostMeal(tx,mealId,auth.userId);const data=await rateExperience(tx,meal,auth.userId,(request.body as {score:number}).score,ifMatch,now);return {data,version:data.version,resourceId:mealId};
 },(auth,{request})=>replayAllowed(auth.userId,(request.params as {mealId:string}).mealId,undefined,true));
 defineWrite(app,deps,'reviewPerson',async({request,auth,ifMatch},tx)=>{
  const {mealId,subjectId}=request.params as {mealId:string;subjectId:string};const {meal,now}=await lockPostMeal(tx,mealId,auth.userId,subjectId);const data=await reviewPerson(tx,meal,auth.userId,subjectId,(request.body as {body:string}).body,ifMatch,now);return {data,version:data.version,resourceId:mealId};
 },(auth,{request})=>{const p=request.params as {mealId:string;subjectId:string};return replayAllowed(auth.userId,p.mealId,p.subjectId,true);});
 defineRoute(app,deps,'postMealState',async({request,auth})=>{
  const {mealId}=request.params as {mealId:string};const {rows:[meal]}=await deps.pool.query<MealRow>(`SELECT * FROM meals WHERE id=$1`,[mealId]);if(!meal)throw new DomainError('NOT_FOUND','Meal not found.');const now=new Date();
  const members=now>=meal.starts_at?rosterAt(await loadSeatEvents({client:deps.pool as unknown as import('pg').PoolClient},mealId),meal.starts_at):[];
  if(meal.status==='CANCELLED'||!members.includes(auth!.userId))throw new DomainError('FORBIDDEN','Only the meal start roster can use this page.');
  const active=[];for(const id of members){const {rowCount}=await deps.pool.query(`SELECT 1 FROM users WHERE id=$1 AND status='ACTIVE'`,[id]);if(rowCount)active.push(id);}
  const attendance=await Promise.all(active.map(id=>attendanceState(deps.pool,mealId,id)));
  const {rows:[experience]}=await deps.pool.query(`SELECT score,revision FROM experience_revisions WHERE meal_id=$1 AND user_id=$2 ORDER BY revision DESC LIMIT 1`,[mealId,auth!.userId]);
  const {rows:reviewRows}=await deps.pool.query(`SELECT DISTINCT ON (subject_id) * FROM public_review_revisions WHERE meal_id=$1 AND author_id=$2 ORDER BY subject_id,revision DESC`,[mealId,auth!.userId]);
  const reviews=[];for(const row of reviewRows)reviews.push({subjectId:row.subject_id,version:String(row.revision),body:row.body,visibility:await reviewVisibility(deps.pool,mealId,auth!.userId,row.subject_id,now)});
  const reconnect=[];for(const subjectId of active.filter(id=>id!==auth!.userId)){const users=[auth!.userId,subjectId].sort();const {rows:[pair]}=await deps.pool.query<PairRow>(`SELECT * FROM user_pairs WHERE low_user=$1 AND high_user=$2`,users);reconnect.push(pair?await connectionState(deps.pool,pair,auth!.userId,subjectId):{subjectId,selected:false,version:'0',connection:'CLOSED'});}
  return {data:{mealId,windowOpensAt:meal.scheduled_end_at.toISOString(),windowClosesAt:new Date(meal.scheduled_end_at.getTime()+POST_MEAL_WINDOW_MS).toISOString(),windowOpen:now>=meal.scheduled_end_at&&now.getTime()<meal.scheduled_end_at.getTime()+POST_MEAL_WINDOW_MS,eligibleMembers:await Promise.all(active.map(id=>publicProfile(deps.pool,id))),attendance,experience:experience?{score:experience.score,version:String(experience.revision)}:null,reviews,reconnect}};
 });
}
