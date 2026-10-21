import type {Pool,PoolClient} from 'pg';
export const REMOVED_SUPPORT_TEXT='This content has been removed for privacy.';
/** Aliases are constants owned by this module, never request input. Polymorphic links are explicit. */
function targetMatches(alias:string,userParameter:string){return `(${alias}.target_type='USER' AND ${alias}.target_id=${userParameter}) OR (${alias}.target_type='MEAL' AND EXISTS(SELECT 1 FROM meals pm WHERE pm.id=${alias}.target_id AND pm.host_id=${userParameter})) OR (${alias}.target_type='MESSAGE' AND EXISTS(SELECT 1 FROM messages pmsg WHERE pmsg.id=${alias}.target_id AND pmsg.sender_id=${userParameter}))`;}
const affected=(alias:string)=>`EXISTS(SELECT 1 FROM users pu WHERE pu.status<>'ACTIVE' AND (${targetMatches(alias,'pu.id')}))`;
/** Used within the same SELECT as the DTO source, before any free text leaves the server. */
export const reportPrivateTextHidden=`(EXISTS(SELECT 1 FROM users pu WHERE pu.id=r.reporter_id AND pu.status<>'ACTIVE') OR ${affected('r')} OR EXISTS(SELECT 1 FROM support_cases pc WHERE pc.report_id=r.id AND ${affected('pc')}))`;
export const casePrivateTextHidden=`(${affected('c')} OR EXISTS(SELECT 1 FROM reports r WHERE r.id=c.report_id AND ${reportPrivateTextHidden}))`;

/** Known structured associations only. Arbitrary text mentions are neither guessed nor copied. */
export async function purgeKnownSupportText(c:PoolClient,userId:string){
 const {rows:reports}=await c.query<{id:string}>(`SELECT r.id FROM reports r WHERE r.reporter_id=$1 OR (${targetMatches('r','$1')}) OR EXISTS(SELECT 1 FROM support_cases pc WHERE pc.report_id=r.id AND (${targetMatches('pc','$1')})) ORDER BY r.id`,[userId]);
 const reportIds=reports.map(r=>r.id);
 const {rows:cases}=await c.query<{id:string}>(`SELECT c.id FROM support_cases c WHERE c.report_id=ANY($2::uuid[]) OR (${targetMatches('c','$1')}) ORDER BY c.id`,[userId,reportIds]);
 const caseIds=cases.map(r=>r.id);
 // Match resolveCase's case -> report -> audit ordering; deletion already holds the user's barrier.
 if(caseIds.length)await c.query(`SELECT id FROM support_cases WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE`,[caseIds]);
 if(reportIds.length)await c.query(`SELECT id FROM reports WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE`,[reportIds]);
 if(caseIds.length)await c.query(`UPDATE support_cases SET details=$2,version=version+1 WHERE id=ANY($1::uuid[]) AND details<>$2`,[caseIds,REMOVED_SUPPORT_TEXT]);
 if(reportIds.length)await c.query(`UPDATE reports SET details=$2,reason='PRIVACY_REDACTED',public_outcome=NULL WHERE id=ANY($1::uuid[])`,[reportIds,REMOVED_SUPPORT_TEXT]);
 await c.query(`UPDATE attendance_revisions ar SET reason='PRIVACY_REDACTED' FROM audit_events ae WHERE ae.aggregate_type='case' AND ae.aggregate_id=ANY($1::uuid[]) AND ae.action='attendance.corrected' AND ar.source='SUPPORT' AND ar.meal_id::text=ae.payload->>'mealId' AND ar.subject_id::text=ae.payload->>'subjectId' AND ar.version::text=ae.payload->>'revision' AND ar.reason IS DISTINCT FROM 'PRIVACY_REDACTED'`,[caseIds]);
 await c.query(`UPDATE audit_events SET reason=NULL WHERE reason IS NOT NULL AND ((aggregate_type='case' AND aggregate_id=ANY($1::uuid[])) OR (aggregate_type='report' AND aggregate_id=ANY($2::uuid[])))`,[caseIds,reportIds]);
 // Keep dedupe metadata intact: deleting a staff intent would permit the same write to run twice.
 await c.query(`UPDATE idempotency SET response_json=jsonb_set(response_json,'{data}',(response_json->'data') || CASE WHEN response_json->'data' ? 'details' THEN jsonb_build_object('details',$2::text) ELSE '{}'::jsonb END || CASE WHEN response_json->'data' ? 'publicOutcome' THEN '{"publicOutcome":null}'::jsonb ELSE '{}'::jsonb END || CASE WHEN response_json->'data' ? 'reason' THEN '{"reason":"PRIVACY_REDACTED"}'::jsonb ELSE '{}'::jsonb END,false) WHERE state='COMPLETED' AND operation IN('resolveCase','createReport','correctAttendance') AND resource_id=ANY($1::uuid[]) AND jsonb_typeof(response_json->'data')='object'`,[[...caseIds,...reportIds],REMOVED_SUPPORT_TEXT]);
 return {reports:reportIds.length,cases:caseIds.length};
}

/** Immutable case/report targets establish the dependency set before any case/report row locks. */
export async function supportRelatedUserIds(db:Pool|PoolClient,caseId:string):Promise<string[]>{
 const {rows}=await db.query<{user_id:string}>(`WITH targets AS(SELECT target_type,target_id FROM support_cases WHERE id=$1 UNION SELECT r.target_type,r.target_id FROM reports r JOIN support_cases c ON c.report_id=r.id WHERE c.id=$1), subjects AS(SELECT target_id AS user_id FROM targets WHERE target_type='USER' UNION SELECT m.host_id FROM meals m JOIN targets t ON t.target_type='MEAL' AND t.target_id=m.id UNION SELECT msg.sender_id FROM messages msg JOIN targets t ON t.target_type='MESSAGE' AND t.target_id=msg.id UNION SELECT r.reporter_id FROM reports r JOIN support_cases c ON c.report_id=r.id WHERE c.id=$1) SELECT DISTINCT user_id FROM subjects ORDER BY user_id`,[caseId]);
 return rows.map(r=>r.user_id);
}
