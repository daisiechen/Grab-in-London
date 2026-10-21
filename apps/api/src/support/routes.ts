import { randomBytes } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { FastifyInstance } from 'fastify';
import { appendAudit } from '@fancy/db';
import { DomainError } from '../common/errors.ts';
import { lockActiveActor } from '../common/actor.ts';
import { encodeCursor, decodeCursor } from '../common/cursor.ts';
import { defineRoute, defineWrite } from '../http/routes.ts';
import type { AppDeps } from '../http/context.ts';
import { lockPostMeal } from '../post-meal/lock.ts';
import { recordAttendanceRevision } from '../post-meal/attendance.ts';
import { invalidateIneligiblePairs } from '../connections/service.ts';
const reportDto = (r: Record<string, unknown>) => ({ id:r.id, receipt:r.receipt, targetType:r.target_type, status:r.status, publicOutcome:r.public_outcome, createdAt:(r.created_at as Date).toISOString() });
const notificationDto = (r: Record<string, unknown>) => { const refs = r.refs as Record<string,string>; return { id:r.id,template:r.template,createdAt:(r.created_at as Date).toISOString(),readAt:(r.read_at as Date | null)?.toISOString() ?? null,mealId:refs.mealId ?? null,applicationId:refs.applicationId ?? null,conversationId:refs.conversationId ?? null }; };
async function caseFor(db: Pool | PoolClient, caseId: string, actor: string,lockGrant=false) {
  const { rows:[r] } = await db.query(`SELECT c.* FROM support_cases c JOIN support_case_grants g ON g.case_id=c.id AND g.user_id=$2 WHERE c.id=$1${lockGrant?' FOR SHARE OF c,g':''}`,[caseId,actor]);
  if(!r) throw new DomainError('NOT_FOUND','Case not found.'); return r;
}
const caseDto = (r: Record<string, unknown>) => ({ id:r.id,version:r.version,status:r.status,reportId:r.report_id,targetType:r.target_type,targetId:r.target_id,details:r.details,createdAt:(r.created_at as Date).toISOString() });
export function registerSupportRoutes(app: FastifyInstance, deps: AppDeps) {
  defineWrite(app,deps,'correctAttendance',async({request,auth},tx)=>{
    const caseId=(request.params as {caseId:string}).caseId;
    const body=request.body as {mealId:string;subjectId:string;value:'present'|'absent';expectedVersion:string;reason:string};
    const supportCase=await caseFor(tx.client,caseId,auth.userId);
    if(supportCase.target_type!=='MEAL'||supportCase.target_id!==body.mealId)throw new DomainError('FORBIDDEN','This case does not authorize a correction for that meal.');
    const {meal,now,pairs}=await lockPostMeal(tx,body.mealId,auth.userId,body.subjectId,async()=>{
      const current=await caseFor(tx.client,caseId,auth.userId,true);
      if(current.target_type!=='MEAL'||current.target_id!==body.mealId)throw new DomainError('FORBIDDEN','This case does not authorize a correction for that meal.');
    });
    const attendance=await recordAttendanceRevision(tx,meal,body.subjectId,'SUPPORT',body.value,auth.userId,body.expectedVersion,now,body.reason);
    await invalidateIneligiblePairs(tx,pairs,now);
    await appendAudit(tx.client,{actorKind:'SUPPORT',actorId:auth.userId,action:'attendance.corrected',aggregateType:'case',aggregateId:caseId,requestId:request.id,reason:body.reason,payload:{mealId:body.mealId,subjectId:body.subjectId,revision:attendance.version}});
    return {data:{mealId:body.mealId,subjectId:body.subjectId,value:body.value,version:attendance.version,correctedAt:now.toISOString()},version:attendance.version,resourceId:caseId};
  },async(auth,{request})=>{const {rows}=await deps.pool.query(`SELECT 1 FROM support_case_grants WHERE case_id=$1 AND user_id=$2`,[(request.params as {caseId:string}).caseId,auth.userId]);return rows.length===1;});
  defineRoute(app,deps,'listNotifications',async({request,auth})=>{
    const q=request.query as {cursor?:string;limit?:number};const scope={actor:auth!.userId,resource:'notifications',filterHash:'all',epoch:'1'};
    const key=q.cursor?decodeCursor(deps.config.sessionSecret,scope,q.cursor):null;
    let boundary: [string,string] | null=null;
    if(key){try { const value=JSON.parse(key);if(!Array.isArray(value)||value.length!==2||!Number.isFinite(Date.parse(value[0]))||!/^[a-f0-9-]{36}$/.test(value[1]))throw new Error();boundary=value as [string,string]; }catch {throw new DomainError('VALIDATION_FAILED','Invalid notification page.');}}
    const limit=q.limit??20;
    const {rows}=await deps.pool.query(`SELECT *,created_at::text AS cursor_created_at FROM notifications WHERE recipient_id=$1 AND ($2::timestamptz IS NULL OR (created_at,id)<($2::timestamptz,$3::uuid)) ORDER BY created_at DESC,id DESC LIMIT $4`,[auth!.userId,boundary?.[0]??null,boundary?.[1]??null,limit+1]);
    const page=rows.slice(0,limit),last=page.at(-1);return {data:page.map(notificationDto),page:{hasMore:rows.length>limit,nextCursor:rows.length>limit&&last?encodeCursor(deps.config.sessionSecret,scope,JSON.stringify([last.cursor_created_at,last.id])):null}};
  });
  defineWrite(app,deps,'markRead',async({request,auth},tx)=>{
    await lockActiveActor(tx,auth.userId);const {notificationId}=request.params as {notificationId:string};
    const {rows:[row]}=await tx.client.query(`UPDATE notifications SET read_at=COALESCE(read_at,clock_timestamp()) WHERE id=$1 AND recipient_id=$2 RETURNING *`,[notificationId,auth.userId]);
    if(!row)throw new DomainError('NOT_FOUND','Notification not found.');return {data:notificationDto(row),resourceId:row.id};
  });
  defineWrite(app,deps,'createReport',async({request,auth},tx)=>{
    await lockActiveActor(tx,auth.userId);const body=request.body as {targetType:'USER'|'MEAL'|'MESSAGE';targetId:string;reason:string;details:string};
    const sql=body.targetType==='USER'?`SELECT id FROM users WHERE id=$1 AND status='ACTIVE'`:body.targetType==='MEAL'?`SELECT m.id FROM meals m JOIN users u ON u.id=m.host_id WHERE m.id=$1 AND u.status='ACTIVE'`:`SELECT msg.id FROM messages msg WHERE msg.id=$1 AND EXISTS(SELECT 1 FROM membership_intervals i WHERE i.conversation_id=msg.conversation_id AND i.user_id=$2 AND i.join_seq<msg.seq AND (i.leave_seq IS NULL OR msg.seq<i.leave_seq))`;
    const target=await tx.client.query(sql,body.targetType==='MESSAGE'?[body.targetId,auth.userId]:[body.targetId]);
    if(!target.rowCount)throw new DomainError('NOT_FOUND','This content is unavailable.');
    const details=body.details.trim();if(!details)throw new DomainError('VALIDATION_FAILED','Describe your concern.');
    const {rows:[r]}=await tx.client.query(`INSERT INTO reports(reporter_id,target_type,target_id,reason,details,receipt) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[auth.userId,body.targetType,body.targetId,body.reason,details,randomBytes(12).toString('base64url')]);
    await tx.client.query(`INSERT INTO support_cases(report_id,target_type,target_id,details) VALUES($1,$2,$3,$4)`,[r.id,r.target_type,r.target_id,details]);
    await appendAudit(tx.client,{actorKind:'USER',actorId:auth.userId,action:'report.created',aggregateType:'report',aggregateId:r.id,requestId:request.id});
    return {data:reportDto(r),resourceId:r.id};
  });
  defineRoute(app,deps,'reportStatus',async({request,auth})=>{
    const {reportId}=request.params as {reportId:string};const {rows:[r]}=await deps.pool.query(`SELECT * FROM reports WHERE id=$1 AND reporter_id=$2`,[reportId,auth!.userId]);if(!r)throw new DomainError('NOT_FOUND','Report not found.');return {data:reportDto(r)};
  });
  defineRoute(app,deps,'supportCase',async({request,auth})=>{
    const r=await caseFor(deps.pool,(request.params as {caseId:string}).caseId,auth!.userId);
    await appendAudit(deps.pool as unknown as PoolClient,{actorKind:'SUPPORT',actorId:auth!.userId,action:'support.case_viewed',aggregateType:'case',aggregateId:r.id,requestId:request.id});return {data:caseDto(r)};
  });
  defineWrite(app,deps,'resolveCase',async({request,auth,ifMatch},tx)=>{
    await lockActiveActor(tx,auth.userId);const id=(request.params as {caseId:string}).caseId;await caseFor(tx.client,id,auth.userId,true);
    const body=request.body as {status:string;publicOutcome:string|null;reason:string};
    const {rows:[r]}=await tx.client.query(`UPDATE support_cases SET status=$2,version=version+1 WHERE id=$1 AND version=$3 RETURNING *`,[id,body.status,ifMatch]);
    if(!r)throw new DomainError('VERSION_CONFLICT','The case changed. Reload it.');
    if(r.report_id)await tx.client.query(`UPDATE reports SET status=$2,public_outcome=$3 WHERE id=$1`,[r.report_id,body.status==='RESOLVED'?'RESPONDED':'IN_REVIEW',body.publicOutcome]);
    await appendAudit(tx.client,{actorKind:'SUPPORT',actorId:auth.userId,action:'support.case_resolved',aggregateType:'case',aggregateId:id,reason:body.reason,requestId:request.id});return {data:caseDto(r),version:r.version,resourceId:id};
  },async(auth,{request})=>{
    const {rows}=await deps.pool.query(`SELECT 1 FROM support_case_grants WHERE case_id=$1 AND user_id=$2`,[(request.params as {caseId:string}).caseId,auth.userId]);return rows.length===1;
  });
}
