import {createHash} from 'node:crypto';
import type{Pool}from'pg';
import type{Static}from'@sinclair/typebox';
import type{OperationById}from'@fancy/contracts';
import{DomainError}from'../common/errors.ts';
import{canonicalJson}from'../common/canonical.ts';
import{loadAdminSnapshot}from'./pages.ts';
import type{Row}from'./metrics.ts';
import{encodeCursor,decodeCursor}from'../common/cursor.ts';
type DrillQuery=Static<OperationById<'adminDrilldown'>['query']>;
/**
 * Admin PRD: lists default to the record's actual date, newest first. The actual date is the
 * record's own event time (event/application/survey), else the meal start, else the cohort or
 * observation date. Rows without a date sort last in either direction; rowId breaks ties so
 * cursors stay stable.
 */
const ACTUAL_DATE=['occurredAt','appliedAt','submittedAt','startsAt','firstAttendedAt','firstObservedAt','receivedAt','week'] as const;
export const actualDate=(row:Row):string|null=>{for(const key of ACTUAL_DATE){const v=row.attributes[key];if(typeof v==='string'&&v)return v;}return null;};
export function sortRows(rows:Row[],sort:string|undefined,order:'asc'|'desc'|undefined){
 const direction=order==='asc'?1:-1;
 const value=(r:Row)=>{const v=sort?r.attributes[sort]:actualDate(r);return v===null||v===undefined||v===''?null:String(v);};
 return rows.sort((a,b)=>{const av=value(a),bv=value(b);if(av===null||bv===null)return av===bv?a.rowId.localeCompare(b.rowId):av===null?1:-1;return av.localeCompare(bv)*direction||a.rowId.localeCompare(b.rowId);});
}
export async function loadDrilldownRows(pool:Pool,metric:string,query:DrillQuery){
 const loaded=await loadAdminSnapshot(pool,query);
 if(query.filterHash!==loaded.filterHash)throw new DomainError('STATE_CONFLICT','The filters do not match this snapshot view. Reload the page.');
 const source=loaded.calculated.rows[metric];
 if(!source)throw new DomainError('PROVIDER_UNAVAILABLE','This metric source is not available for this snapshot.');
 const rows=source.filter(r=>{const a=r.attributes;return(!query.mealId||a.mealId===query.mealId)&&(!query.userId||a.userId===query.userId)&&(!query.cohortWeek||a.cohortWeek===query.cohortWeek)&&(!query.attendanceStatus||a.attendanceStatus===query.attendanceStatus)&&(!query.q||Object.values(a).some(v=>typeof v==='string'&&v.toLowerCase().includes(query.q!.toLowerCase())));});
 const sort=query.sort;
 sortRows(rows,sort,query.order);
 const binding=createHash('sha256').update(canonicalJson({snapshotId:query.snapshotId,metric,filterHash:query.filterHash,mealId:query.mealId,userId:query.userId,cohortWeek:query.cohortWeek,attendanceStatus:query.attendanceStatus,q:query.q,sort,order:query.order})).digest('hex');
 return{loaded,rows,binding};
}
export async function readDrilldown(pool:Pool,metric:string,query:DrillQuery,auth:{actor:string;secret:string}){
 const{loaded,rows,binding}=await loadDrilldownRows(pool,metric,query);
 const scope={actor:auth.actor,resource:'adminDrilldown:'+query.snapshotId+':'+metric,filterHash:binding,epoch:loaded.epoch};
 let start=0;
 if(query.cursor){try{const last=decodeCursor(auth.secret,scope,query.cursor);const index=rows.findIndex(r=>r.rowId===last);if(index<0)throw new Error('position');start=index+1;}catch{throw new DomainError('VALIDATION_FAILED','This drill-down cursor is invalid for the current filters.');}}
 const limit=query.limit??50;const data=rows.slice(start,start+limit);const hasMore=start+limit<rows.length;
 const nextCursor=hasMore?encodeCursor(auth.secret,scope,data.at(-1)!.rowId):null;
 return{data,page:{nextCursor,hasMore}};
}
