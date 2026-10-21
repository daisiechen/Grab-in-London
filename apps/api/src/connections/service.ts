import type {Pool,PoolClient} from 'pg';
import {DomainError,InvariantError} from '../common/errors.ts';
import {registerLockTable} from '../common/locks.ts';
import type {Tx} from '../common/transaction.ts';
import {createDirectConversation} from '../membership/intervals.ts';
import {isPresent} from '../post-meal/attendance.ts';
registerLockTable('user_pairs','pair');
type Db=Pool|PoolClient;
export interface PairRow {id:string;low_user:string;high_user:string;consent_epoch:string;version:string}
export async function directLockPlan(db:Db,pairId:string):Promise<{userIds:string[];mealIds:string[]}> {
 const {rows:[pair]}=await db.query<PairRow>(`SELECT * FROM user_pairs WHERE id=$1`,[pairId]);if(!pair)throw new DomainError('NOT_FOUND','Conversation not found.');
 const {rows}=await db.query<{meal_id:string}>(`SELECT a.meal_id FROM start_roster a JOIN start_roster b ON b.meal_id=a.meal_id WHERE a.user_id=$1 AND b.user_id=$2 ORDER BY a.meal_id`,[pair.low_user,pair.high_user]);
 return {userIds:[pair.low_user,pair.high_user],mealIds:rows.map(r=>r.meal_id)};
}
export async function validSharedMeals(db:Db,pair:PairRow):Promise<string[]> {
 const plan=await directLockPlan(db,pair.id);const valid=[];
 for(const mealId of plan.mealIds)if(await isPresent(db,mealId,pair.low_user)&&await isPresent(db,mealId,pair.high_user))valid.push(mealId);
 return valid;
}
async function pairBlocked(db:Db,pair:PairRow):Promise<boolean>{const {rowCount}=await db.query(`SELECT 1 FROM blocks WHERE (blocker=$1 AND blocked=$2) OR (blocker=$2 AND blocked=$1)`,[pair.low_user,pair.high_user]);return Boolean(rowCount);}
export async function assertDirectAuthorized(db:Db,pairId:string,senderId:string):Promise<void> {
 const {rows:[pair]}=await db.query<PairRow>(`SELECT * FROM user_pairs WHERE id=$1`,[pairId]);
 if(!pair||![pair.low_user,pair.high_user].includes(senderId))throw new DomainError('NOT_FOUND','Conversation not found.');
 const {rowCount}=await db.query(`SELECT 1 FROM users WHERE id=ANY($1::uuid[]) AND status='ACTIVE'`,[[pair.low_user,pair.high_user]]);
 const {rows}=await db.query<{user_id:string}>(`SELECT user_id FROM pair_consents WHERE pair_id=$1 AND epoch=$2 AND revoked_at IS NULL`,[pair.id,pair.consent_epoch]);
 if(rowCount!==2||rows.length!==2||!rows.some(r=>r.user_id===pair.low_user)||!rows.some(r=>r.user_id===pair.high_user)||await pairBlocked(db,pair)||!(await validSharedMeals(db,pair)).length)throw new DomainError('CONNECTION_NOT_AUTHORIZED','This conversation is currently read-only.');
}
export async function connectionState(db:Db,pair:PairRow,actorId:string,subjectId:string) {
 const {rows:[latest]}=await db.query<{revision:string}>(`SELECT revision FROM pair_consents WHERE pair_id=$1 AND user_id=$2 ORDER BY revision DESC LIMIT 1`,[pair.id,actorId]);
 const {rowCount}=await db.query(`SELECT 1 FROM pair_consents WHERE pair_id=$1 AND user_id=$2 AND epoch=$3 AND revoked_at IS NULL`,[pair.id,actorId,pair.consent_epoch]);
 const selected=Boolean(rowCount);let open=false;try{await assertDirectAuthorized(db,pair.id,actorId);open=true;}catch(error){if(!(error instanceof DomainError))throw error;}
 return {subjectId,selected,version:latest?.revision??'0',connection:open?'OPEN':selected?'WAITING':'CLOSED'};
}
export function assertPairLocked(tx:Tx,pairId:string):void {if(!tx.locks.held.some(l=>l.table==='user_pairs'&&l.id===pairId&&l.mode==='update'))throw new InvariantError('Pair UPDATE lock is required');}
export async function clearPairConsents(tx:Tx,pair:PairRow,now:Date):Promise<void> {
 assertPairLocked(tx,pair.id);
 await tx.client.query(`UPDATE pair_consents SET revoked_at=$2,revision=revision+1 WHERE pair_id=$1 AND epoch=$3 AND revoked_at IS NULL`,[pair.id,now,pair.consent_epoch]);
 await tx.client.query(`UPDATE user_pairs SET consent_epoch=consent_epoch+1,version=version+1 WHERE id=$1`,[pair.id]);pair.consent_epoch=String(BigInt(pair.consent_epoch)+1n);pair.version=String(BigInt(pair.version)+1n);
}
/** Deletion caller prelocks all this user's pairs in the global order. History stays readable. */
export async function revokePairsForDeletion(tx:Tx,userId:string,now:Date):Promise<void> {
 const {rows}=await tx.client.query<PairRow>(`SELECT * FROM user_pairs WHERE low_user=$1 OR high_user=$1 ORDER BY id`,[userId]);for(const pair of rows)await clearPairConsents(tx,pair,now);
}
/** Attendance/support correction uses the prelocked affected pairs; another valid basis survives. */
export async function invalidateIneligiblePairs(tx:Tx,pairs:readonly PairRow[],now:Date):Promise<void> {
 for(const pair of pairs){assertPairLocked(tx,pair.id);if(!(await validSharedMeals(tx.client,pair)).length)await clearPairConsents(tx,pair,now);}
}
export async function lockConnection(tx:Tx,actorId:string,subjectId:string,extraMealIds:string[]=[]):Promise<{pair:PairRow;now:Date}> {
 if(actorId===subjectId)throw new DomainError('FORBIDDEN','Choose another meal member.');
 const users=[actorId,subjectId].sort();const active=await tx.locks.lock<{id:string;status:string}>('users',users,'share','id,status');if(active.length!==2||active.some(u=>u.status!=='ACTIVE'))throw new DomainError('NOT_FOUND','This member is unavailable.');
 await tx.client.query(`INSERT INTO user_pairs(low_user,high_user) VALUES($1,$2) ON CONFLICT DO NOTHING`,users);
 const {rows:[hint]}=await tx.client.query<PairRow>(`SELECT * FROM user_pairs WHERE low_user=$1 AND high_user=$2`,users);const plan=await directLockPlan(tx.client,hint!.id);
 if(extraMealIds.length||plan.mealIds.length)await tx.locks.lock('meals',[...plan.mealIds,...extraMealIds],'share');
 const [pair]=await tx.locks.lock<PairRow>('user_pairs',[hint!.id],'update','*');
 const {rows:[conversation]}=await tx.client.query<{id:string}>(`SELECT id FROM conversations WHERE pair_id=$1`,[pair!.id]);if(conversation)await tx.locks.lock('conversations',[conversation.id],'update');
 return {pair:pair!,now:await tx.effectiveNow()};
}
export async function selectPair(tx:Tx,pair:PairRow,actorId:string,subjectId:string,mealId:string,selected:boolean,expected:string|null,now:Date) {
 const before=await connectionState(tx.client,pair,actorId,subjectId);if(expected!==before.version)throw new DomainError('VERSION_CONFLICT','Your connection choice has changed.',{currentVersion:before.version});
 if(!selected){await clearPairConsents(tx,pair,now);return connectionState(tx.client,pair,actorId,subjectId);}
 if(await pairBlocked(tx.client,pair))throw new DomainError('FORBIDDEN','This connection is unavailable.');
 if(!(await validSharedMeals(tx.client,pair)).includes(mealId))throw new DomainError('FORBIDDEN','Both members must have attended this meal.');
 const revision=String(BigInt(before.version)+1n);
 await tx.client.query(`INSERT INTO pair_consents(pair_id,user_id,epoch,revision,basis_meal_id,selected_at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(pair_id,user_id,epoch) DO UPDATE SET revision=EXCLUDED.revision,basis_meal_id=EXCLUDED.basis_meal_id,selected_at=EXCLUDED.selected_at,revoked_at=NULL`,[pair.id,actorId,pair.consent_epoch,revision,mealId,now]);
 const state=await connectionState(tx.client,pair,actorId,subjectId);
 if(state.connection==='OPEN')await createDirectConversation(tx,{pairId:pair.id,userIds:[pair.low_user,pair.high_user],effectiveAt:now});
 return state;
}
export async function setBlock(tx:Tx,pair:PairRow,actorId:string,subjectId:string,blocked:boolean,expected:string|null,now:Date) {
 const {rows:[latest]}=await tx.client.query<{version:string}>(`SELECT version FROM block_revisions WHERE blocker=$1 AND blocked=$2 ORDER BY version DESC LIMIT 1`,[actorId,subjectId]);const version=latest?.version??'0';if(version!==expected)throw new DomainError('VERSION_CONFLICT','Your block setting changed.',{currentVersion:version});
 const next=String(BigInt(version)+1n);
 if(blocked){await tx.client.query(`INSERT INTO blocks(blocker,blocked,created_at) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,[actorId,subjectId,now]);await clearPairConsents(tx,pair,now);}else await tx.client.query(`DELETE FROM blocks WHERE blocker=$1 AND blocked=$2`,[actorId,subjectId]);
 await tx.client.query(`INSERT INTO block_revisions(blocker,blocked,active,version,created_at) VALUES($1,$2,$3,$4,$5)`,[actorId,subjectId,blocked,next,now]);return {subjectId,blocked,version:next};
}
