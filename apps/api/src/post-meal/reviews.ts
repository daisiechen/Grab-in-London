import type {Pool,PoolClient} from 'pg';
import type {Tx} from '../common/transaction.ts';
import {DomainError} from '../common/errors.ts';
import type {MealRow} from '../meals/lifecycle.ts';
import {publicProfile} from '../meals/read.ts';
import {assertWindow,isPresent,POST_MEAL_WINDOW_MS} from './attendance.ts';
type Db=Pool|PoolClient;
export async function reviewVisibility(db:Db,mealId:string,authorId:string,subjectId:string,now:Date):Promise<'PENDING'|'PUBLISHED'|'WITHDRAWN'> {
 const {rows:[meal]}=await db.query<{scheduled_end_at:Date;status:string}>(`SELECT scheduled_end_at,status FROM meals WHERE id=$1`,[mealId]);
 if(!meal||meal.status==='CANCELLED'||!await isPresent(db,mealId,authorId)||!await isPresent(db,mealId,subjectId))return 'WITHDRAWN';
 const {rowCount}=await db.query(`SELECT 1 FROM public_review_revisions WHERE meal_id=$1 AND author_id=$2 AND subject_id=$3`,[mealId,subjectId,authorId]);
 return rowCount||now.getTime()>=meal.scheduled_end_at.getTime()+POST_MEAL_WINDOW_MS?'PUBLISHED':'PENDING';
}
export async function reviewPublicationAt(db:Db,mealId:string,authorId:string,subjectId:string):Promise<Date> {
 const {rows:[r]}=await db.query<{deadline:Date;authored:Date;reciprocal:Date|null}>(`SELECT m.scheduled_end_at + interval '168 hours' AS deadline,
  (SELECT max(created_at) FROM public_review_revisions WHERE meal_id=m.id AND author_id=$2 AND subject_id=$3) AS authored,
  (SELECT min(created_at) FROM public_review_revisions WHERE meal_id=m.id AND author_id=$3 AND subject_id=$2) AS reciprocal FROM meals m WHERE m.id=$1`,[mealId,authorId,subjectId]);
 if(!r)throw new DomainError('NOT_FOUND','Meal not found.');
 return r.reciprocal?new Date(Math.min(r.deadline.getTime(),Math.max(r.authored.getTime(),r.reciprocal.getTime()))):r.deadline;
}
export async function reviewPerson(tx:Tx,meal:MealRow,actorId:string,subjectId:string,body:string,expected:string|null,now:Date) {
 body=body.trim();if(!body||[...body].length>500)throw new DomainError('VALIDATION_FAILED','References must contain 1 to 500 characters.');
 assertWindow(meal,now);if(actorId===subjectId||!await isPresent(tx.client,meal.id,actorId)||!await isPresent(tx.client,meal.id,subjectId))throw new DomainError('FORBIDDEN','Both members must have attended this meal.');
 const {rows:[latest]}=await tx.client.query<{revision:string}>(`SELECT revision FROM public_review_revisions WHERE meal_id=$1 AND author_id=$2 AND subject_id=$3 ORDER BY revision DESC LIMIT 1`,[meal.id,actorId,subjectId]);const version=latest?.revision??'0';if(expected!==version)throw new DomainError('VERSION_CONFLICT','Your reference has changed.',{currentVersion:version});
 const revision=String(BigInt(version)+1n);await tx.client.query(`INSERT INTO public_review_revisions(meal_id,author_id,subject_id,body,revision,created_at) VALUES($1,$2,$3,$4,$5,$6)`,[meal.id,actorId,subjectId,body,revision,now]);
 return {subjectId,version:revision,publishAt:(await reviewPublicationAt(tx.client,meal.id,actorId,subjectId)).toISOString(),visibility:await reviewVisibility(tx.client,meal.id,actorId,subjectId,now)};
}
/** Public-profile owner calls this projection; private drafts and obsolete revisions never leave. */
export async function publishedReviewsForProfile(db:Db,subjectId:string,now=new Date()) {
 const {rows}=await db.query(`SELECT DISTINCT ON (meal_id,author_id) * FROM public_review_revisions WHERE subject_id=$1 ORDER BY meal_id,author_id,revision DESC`,[subjectId]);
 const result=[];
 for(const r of rows)if(await reviewVisibility(db,r.meal_id,r.author_id,subjectId,now)==='PUBLISHED')result.push({id:r.id,mealId:r.meal_id,author:await publicProfile(db,r.author_id),body:r.body,publishedAt:(await reviewPublicationAt(db,r.meal_id,r.author_id,subjectId)).toISOString()});
 return result.sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)||a.id.localeCompare(b.id));
}
