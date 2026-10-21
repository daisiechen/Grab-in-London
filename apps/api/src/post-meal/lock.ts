import type {Tx} from '../common/transaction.ts';
import {DomainError} from '../common/errors.ts';
import {registerLockTable} from '../common/locks.ts';
import {advanceLifecycle,type MealRow} from '../meals/lifecycle.ts';
import type {PairRow} from '../connections/service.ts';
registerLockTable('meals','meal');registerLockTable('user_pairs','pair');registerLockTable('conversations','conversation');
/** Attendance can withdraw direct-send qualifications, so it shares the pair locks used by sends. */
export async function lockPostMeal(tx:Tx,mealId:string,actorId:string,subjectId?:string,lockAuthorization?:()=>Promise<void>) {
 const {rows:[hint]}=await tx.client.query<MealRow>(`SELECT * FROM meals WHERE id=$1`,[mealId]);if(!hint)throw new DomainError('NOT_FOUND','Meal not found.');
 const {rows:roster}=await tx.client.query<{user_id:string}>(`SELECT user_id FROM start_roster WHERE meal_id=$1`,[mealId]);const rosterIds=roster.map(r=>r.user_id);
 // Before a delayed lifecycle materialises the roster, all historical confirmed users form a safe lock superset.
 const {rows:history}=await tx.client.query<{user_id:string}>(`SELECT DISTINCT user_id FROM seat_events WHERE meal_id=$1`,[mealId]);const candidates=[...new Set([...rosterIds,...history.map(r=>r.user_id)])];
 const userIds=[...new Set([actorId,...(subjectId?[subjectId]:[]),...candidates])].sort();
 const users=await tx.locks.lock<{id:string;status:string}>('users',userIds,'share','id,status');if(!users.some(u=>u.id===actorId&&u.status==='ACTIVE'))throw new DomainError('AUTH_REQUIRED','Your session is no longer valid.');
 const [meal]=await tx.locks.lock<MealRow>('meals',[mealId],'update','*');if(!meal)throw new DomainError('NOT_FOUND','Meal not found.');
 // Re-read after acquiring the meal lock: a concurrent selection may have committed a new pair while we waited.
 const {rows:pairHints}=await tx.client.query<PairRow>(`SELECT * FROM user_pairs WHERE low_user=ANY($1::uuid[]) AND high_user=ANY($1::uuid[]) AND ($2::uuid IS NULL OR low_user=$2 OR high_user=$2) ORDER BY id`,[candidates,subjectId??null]);
 const pairs=pairHints.length?await tx.locks.lock<PairRow>('user_pairs',pairHints.map(p=>p.id),'update','*'):[];
 const {rows:conversations}=pairs.length?await tx.client.query<{id:string}>(`SELECT id FROM conversations WHERE pair_id=ANY($1::uuid[]) ORDER BY id`,[pairs.map(p=>p.id)]):{rows:[]};
 if(conversations.length)await tx.locks.lock('conversations',conversations.map(c=>c.id),'update');
 if(lockAuthorization)await lockAuthorization();
 const now=await tx.effectiveNow();await advanceLifecycle(tx,meal,now);return {meal,now,pairs};
}
