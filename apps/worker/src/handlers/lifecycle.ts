import type { Pool } from 'pg';
import type { JobHandler } from '../runner/runner.ts';
import { withTransaction } from '../../../api/src/common/transaction.ts';
import { registerLockTable } from '../../../api/src/common/locks.ts';
import { advanceLifecycle, type MealRow } from '../../../api/src/meals/lifecycle.ts';
registerLockTable('meals','meal');registerLockTable('conversations','conversation');
export function lifecycleHandler(pool:Pool):JobHandler {
 return async(job)=>withTransaction(pool,async(tx)=>{
  const {rows:[hint]}=await tx.client.query<{host_id:string}>(`SELECT host_id FROM meals WHERE id=$1`,[job.resourceId]);if(!hint)return;
  await tx.locks.lock('users',[hint.host_id],'share');
  const [meal]=await tx.locks.lock<MealRow>('meals',[job.resourceId],'update','*');if(!meal)return;
  const {rows:conversations}=await tx.client.query<{id:string}>(`SELECT id FROM conversations WHERE meal_id=$1 ORDER BY id`,[meal.id]);
  await tx.locks.lock('conversations',conversations.map(c=>c.id),'update');
  await advanceLifecycle(tx,meal,await tx.effectiveNow());
 });
}
