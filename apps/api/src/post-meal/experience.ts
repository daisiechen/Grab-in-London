import {DomainError} from '../common/errors.ts';
import type {Tx} from '../common/transaction.ts';
import type {MealRow} from '../meals/lifecycle.ts';
import {assertWindow,isPresent} from './attendance.ts';
export async function rateExperience(tx:Tx,meal:MealRow,userId:string,score:number,expected:string|null,now:Date) {
 assertWindow(meal,now);if(!await isPresent(tx.client,meal.id,userId))throw new DomainError('FORBIDDEN','Attendance is required to rate this meal.');
 const {rows:[latest]}=await tx.client.query<{revision:string}>(`SELECT revision FROM experience_revisions WHERE meal_id=$1 AND user_id=$2 ORDER BY revision DESC LIMIT 1`,[meal.id,userId]);const version=latest?.revision??'0';if(expected!==version)throw new DomainError('VERSION_CONFLICT','Your rating has changed.',{currentVersion:version});
 const revision=String(BigInt(version)+1n);await tx.client.query(`INSERT INTO experience_revisions(meal_id,user_id,score,revision,created_at) VALUES($1,$2,$3,$4,$5)`,[meal.id,userId,score,revision,now]);return {version:revision,updatedAt:now.toISOString()};
}
