import type {Pool,PoolClient} from 'pg';
import {withTransaction} from '../common/transaction.ts';
export const REMOVED_SUPPORT_TEXT='This content has been removed for privacy.';
/** Owner decision 2026-10-29: safety records linked to a deleted account are kept 12 months, then deleted. */
export const DEFAULT_SAFETY_RECORD_DAYS=365;
/** RETENTION_POLICY_JSON.safetyRecordDays (1–3650 whole days); anything else keeps the approved default. */
export function safetyRecordRetentionDays(policy:Record<string,unknown>|null|undefined):number{
 const days=policy?.safetyRecordDays;
 return typeof days==='number'&&Number.isInteger(days)&&days>=1&&days<=3650?days:DEFAULT_SAFETY_RECORD_DAYS;
}
/** Aliases are constants owned by this module, never request input. Polymorphic links are explicit. */
function targetMatches(alias:string,userParameter:string){return `(${alias}.target_type='USER' AND ${alias}.target_id=${userParameter}) OR (${alias}.target_type='MEAL' AND EXISTS(SELECT 1 FROM meals pm WHERE pm.id=${alias}.target_id AND pm.host_id=${userParameter})) OR (${alias}.target_type='MESSAGE' AND EXISTS(SELECT 1 FROM messages pmsg WHERE pmsg.id=${alias}.target_id AND pmsg.sender_id=${userParameter}))`;}
/**
 * Free text is withheld once it has been redacted, i.e. when the safety-record retention period of a
 * deleted account has ended (or an immediate erasure ran). While a hold lasts, the text stays readable
 * to support staff with a case grant, even though the reporter or the reported member deleted their
 * account. Used within the same SELECT as the DTO source, before any free text leaves the server.
 */
export const reportPrivateTextHidden=`(r.reason='PRIVACY_REDACTED')`;
export const casePrivateTextHidden=`(c.details='${REMOVED_SUPPORT_TEXT}' OR EXISTS(SELECT 1 FROM reports pr WHERE pr.id=c.report_id AND pr.reason='PRIVACY_REDACTED'))`;

interface LinkedCase {case_id:string;report_id:string|null;target_type:'USER'|'MEAL'|'MESSAGE';target_id:string;subject:boolean}
const subjectOf=(userParameter:string)=>`((${targetMatches('c',userParameter)}) OR (r.id IS NOT NULL AND (${targetMatches('r',userParameter)})) OR EXISTS(SELECT 1 FROM moderation_actions ma WHERE ma.case_id=c.id AND ma.subject_user_id=${userParameter}))`;
/** Cases about the member (they own the reported profile, meal or message) or reported by them. */
async function linkedCases(c:PoolClient,userId:string):Promise<LinkedCase[]>{
 const {rows}=await c.query<LinkedCase>(`SELECT c.id AS case_id,c.report_id,c.target_type,c.target_id,${subjectOf('$1')} AS subject FROM support_cases c LEFT JOIN reports r ON r.id=c.report_id
   WHERE ${subjectOf('$1')} OR r.reporter_id=$1 ORDER BY c.id`,[userId]);
 return rows;
}
/** Reports with no case (not created by the app) cannot be held and are redacted at once. */
async function orphanReports(c:PoolClient,userId:string):Promise<string[]>{
 const {rows}=await c.query<{id:string}>(`SELECT r.id FROM reports r WHERE (r.reporter_id=$1 OR (${targetMatches('r','$1')})) AND NOT EXISTS(SELECT 1 FROM support_cases c WHERE c.report_id=r.id) ORDER BY r.id`,[userId]);
 return rows.map(r=>r.id);
}
// Match resolveCase's case -> report -> audit ordering; deletion already holds the user's barrier.
async function lockSupportRows(c:PoolClient,caseIds:string[],reportIds:string[]){
 if(caseIds.length)await c.query(`SELECT id FROM support_cases WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE`,[caseIds]);
 if(reportIds.length)await c.query(`SELECT id FROM reports WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE`,[reportIds]);
}

export interface SafetyEvidence {
 profile?:{displayName:string|null;bio:string|null;languages:string[];interests:string[]};
 meal?:{title:string;description:string};
 /** The deleted member's own messages within the three lines either side of a reported message. */
 messages?:Record<string,string>;
}
/** A copy of the reported content the deleting member owns, taken before the purge replaces it. */
async function captureEvidence(c:PoolClient,userId:string,link:LinkedCase):Promise<SafetyEvidence>{
 if(link.target_type==='USER'){
  if(link.target_id!==userId)return {};
  const {rows:[p]}=await c.query(`SELECT display_name,bio,languages,interests FROM profiles WHERE user_id=$1`,[userId]);
  return p?{profile:{displayName:p.display_name??null,bio:p.bio??null,languages:p.languages??[],interests:p.interests??[]}}:{};
 }
 if(link.target_type==='MEAL'){
  const {rows:[m]}=await c.query(`SELECT title,description FROM meals WHERE id=$1 AND host_id=$2`,[link.target_id,userId]);
  return m?{meal:{title:m.title,description:m.description}}:{};
 }
 const {rows:lines}=await c.query<{id:string;body:string}>(`SELECT m.id,m.body FROM messages t JOIN messages m ON m.conversation_id=t.conversation_id AND m.seq BETWEEN t.seq-3 AND t.seq+3
   WHERE t.id=$1 AND m.sender_id=$2 AND NOT m.redacted ORDER BY m.seq`,[link.target_id,userId]);
 return lines.length?{messages:Object.fromEntries(lines.map(l=>[l.id,l.body]))}:{};
}

/**
 * Account deletion: instead of redacting, hold every case linked to the member for the safety-record
 * retention period. Must run in the purge transaction before profiles, meals and messages are replaced.
 * `heldAt` is the deletion's acceptance time, so a restore replay does not extend the period.
 */
export async function holdSafetyRecords(c:PoolClient,userId:string,heldAt:Date){
 const links=await linkedCases(c,userId);
 const orphans=await orphanReports(c,userId);
 await lockSupportRows(c,links.map(l=>l.case_id),[...new Set([...links.flatMap(l=>l.report_id?[l.report_id]:[]),...orphans])].sort());
 for(const link of links){
  const evidence=link.subject?await captureEvidence(c,userId,link):{};
  await c.query(`INSERT INTO safety_record_holds(case_id,user_id,role,evidence,held_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT (case_id,user_id) DO NOTHING`,[link.case_id,userId,link.subject?'SUBJECT':'REPORTER',JSON.stringify(evidence),heldAt]);
 }
 if(orphans.length)await redactSupportText(c,[],orphans);
 return {cases:links.length,orphanReports:orphans.length};
}

/** Merged evidence of the deleted members a case is about; empty when none is held. */
export async function heldEvidence(db:Pool|PoolClient,caseId:string):Promise<SafetyEvidence>{
 const {rows}=await db.query<{evidence:SafetyEvidence}>(`SELECT evidence FROM safety_record_holds WHERE case_id=$1 AND role='SUBJECT' ORDER BY held_at,user_id`,[caseId]);
 const merged:SafetyEvidence={};
 for(const {evidence:e} of rows){if(e.profile)merged.profile=e.profile;if(e.meal)merged.meal=e.meal;if(e.messages)merged.messages={...merged.messages,...e.messages};}
 return merged;
}

/** Redacts the support free text of these cases (and their reports) and deletes their holds. Caller sets fancy.privacy_purge. */
async function redactSupportText(c:PoolClient,caseIds:string[],extraReportIds:string[]){
 const {rows}=await c.query<{report_id:string}>(`SELECT report_id FROM support_cases WHERE id=ANY($1::uuid[]) AND report_id IS NOT NULL`,[caseIds]);
 const reportIds=[...new Set([...rows.map(r=>r.report_id),...extraReportIds])].sort();
 if(caseIds.length)await c.query(`UPDATE support_cases SET details=$2,version=version+1 WHERE id=ANY($1::uuid[]) AND details<>$2`,[caseIds,REMOVED_SUPPORT_TEXT]);
 if(reportIds.length)await c.query(`UPDATE reports SET details=$2,reason='PRIVACY_REDACTED',public_outcome=NULL WHERE id=ANY($1::uuid[])`,[reportIds,REMOVED_SUPPORT_TEXT]);
 await c.query(`UPDATE attendance_revisions ar SET reason='PRIVACY_REDACTED' FROM audit_events ae WHERE ae.aggregate_type='case' AND ae.aggregate_id=ANY($1::uuid[]) AND ae.action='attendance.corrected' AND ar.source='SUPPORT' AND ar.meal_id::text=ae.payload->>'mealId' AND ar.subject_id::text=ae.payload->>'subjectId' AND ar.version::text=ae.payload->>'revision' AND ar.reason IS DISTINCT FROM 'PRIVACY_REDACTED'`,[caseIds]);
 // Moderation notes, before/after snapshots (including cleared profile text) and outcomes are staff text too.
 await c.query(`UPDATE moderation_actions SET note=CASE WHEN actor_kind='SUPPORT' THEN 'PRIVACY_REDACTED' END,before_state='{}'::jsonb,after_state='{}'::jsonb,public_outcome=NULL WHERE (case_id=ANY($1::uuid[]) OR report_id=ANY($2::uuid[])) AND (note IS DISTINCT FROM CASE WHEN actor_kind='SUPPORT' THEN 'PRIVACY_REDACTED' END OR before_state<>'{}'::jsonb OR after_state<>'{}'::jsonb OR public_outcome IS NOT NULL)`,[caseIds,reportIds]);
 await c.query(`UPDATE audit_events SET reason=NULL WHERE reason IS NOT NULL AND ((aggregate_type='case' AND aggregate_id=ANY($1::uuid[])) OR (aggregate_type='report' AND aggregate_id=ANY($2::uuid[])))`,[caseIds,reportIds]);
 // Keep dedupe metadata intact: deleting a staff intent would permit the same write to run twice.
 await c.query(`UPDATE idempotency SET response_json=jsonb_set(response_json,'{data}',(response_json->'data') || CASE WHEN response_json->'data' ? 'details' THEN jsonb_build_object('details',$2::text) ELSE '{}'::jsonb END || CASE WHEN response_json->'data' ? 'publicOutcome' THEN '{"publicOutcome":null}'::jsonb ELSE '{}'::jsonb END || CASE WHEN response_json->'data' ? 'reason' THEN '{"reason":"PRIVACY_REDACTED"}'::jsonb ELSE '{}'::jsonb END,false) WHERE state='COMPLETED' AND operation IN('resolveCase','createReport','correctAttendance') AND resource_id=ANY($1::uuid[]) AND jsonb_typeof(response_json->'data')='object'`,[[...caseIds,...reportIds],REMOVED_SUPPORT_TEXT]);
 if(caseIds.length)await c.query(`DELETE FROM safety_record_holds WHERE case_id=ANY($1::uuid[])`,[caseIds]);
 return reportIds.length;
}

/** Immediate erasure of every structurally linked support text (for example an upheld erasure request). Caller sets fancy.privacy_purge. */
export async function purgeKnownSupportText(c:PoolClient,userId:string){
 const links=await linkedCases(c,userId),orphans=await orphanReports(c,userId);
 const caseIds=links.map(l=>l.case_id),reportIds=[...new Set([...links.flatMap(l=>l.report_id?[l.report_id]:[]),...orphans])].sort();
 await lockSupportRows(c,caseIds,reportIds);
 const reports=await redactSupportText(c,caseIds,orphans);
 return {reports,cases:caseIds.length};
}

/** Last closing activity of a case: auto-close, a moderation action or a support resolution. Views do not count. */
const closedAtSql=(caseExpr:string)=>`(SELECT GREATEST(sc.auto_closed_at,(SELECT max(ma.created_at) FROM moderation_actions ma WHERE ma.case_id=sc.id),(SELECT max(ae.occurred_at) FROM audit_events ae WHERE ae.aggregate_type='case' AND ae.aggregate_id=sc.id AND ae.action='support.case_resolved')) FROM support_cases sc WHERE sc.id=${caseExpr})`;
/** Held cases whose retention has ended: closed, and `days` past the later of the deletion and the closure. */
const dueSql=(caseExpr:string)=>`EXISTS(SELECT 1 FROM support_cases dc WHERE dc.id=${caseExpr} AND dc.status='RESOLVED') AND COALESCE($2::timestamptz,clock_timestamp())>=GREATEST((SELECT max(dh.held_at) FROM safety_record_holds dh WHERE dh.case_id=${caseExpr}),${closedAtSql(caseExpr)})+make_interval(days=>$1::int)`;

/** Worker housekeeping: redact held safety records whose retention period has ended. */
export async function purgeExpiredSafetyRecords(pool:Pool,days:number,asOf:Date|null=null,limit=200):Promise<number>{
 const {rows}=await pool.query<{case_id:string}>(`SELECT DISTINCT h.case_id FROM safety_record_holds h WHERE ${dueSql('h.case_id')} ORDER BY h.case_id LIMIT $3`,[days,asOf,limit]);
 let purged=0;
 for(const {case_id} of rows){
  purged+=await withTransaction(pool,async(tx)=>{
   await tx.client.query(`SET LOCAL fancy.privacy_purge='on'`);
   await lockSupportRows(tx.client,[case_id],[]);
   // Re-check under the case lock: a staff action may have reopened or extended the case.
   const {rows:[due]}=await tx.client.query(`SELECT ${dueSql('$3::uuid')} AS due`,[days,asOf,case_id]);
   if(!due?.due)return 0;
   const {rows:[r]}=await tx.client.query<{report_id:string|null}>(`SELECT report_id FROM support_cases WHERE id=$1`,[case_id]);
   if(r?.report_id)await lockSupportRows(tx.client,[],[r.report_id]);
   await redactSupportText(tx.client,[case_id],[]);
   return 1;
  });
 }
 return purged;
}

/** Immutable case/report targets establish the dependency set before any case/report row locks. */
export async function supportRelatedUserIds(db:Pool|PoolClient,caseId:string):Promise<string[]>{
 const {rows}=await db.query<{user_id:string}>(`WITH targets AS(SELECT target_type,target_id FROM support_cases WHERE id=$1 UNION SELECT r.target_type,r.target_id FROM reports r JOIN support_cases c ON c.report_id=r.id WHERE c.id=$1), subjects AS(SELECT target_id AS user_id FROM targets WHERE target_type='USER' UNION SELECT m.host_id FROM meals m JOIN targets t ON t.target_type='MEAL' AND t.target_id=m.id UNION SELECT msg.sender_id FROM messages msg JOIN targets t ON t.target_type='MESSAGE' AND t.target_id=msg.id UNION SELECT r.reporter_id FROM reports r JOIN support_cases c ON c.report_id=r.id WHERE c.id=$1) SELECT DISTINCT user_id FROM subjects ORDER BY user_id`,[caseId]);
 return rows.map(r=>r.user_id);
}
