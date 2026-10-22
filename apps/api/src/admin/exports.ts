import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { ADMIN_PAGE_KEYS, type OperationById } from '@fancy/contracts';
import type { Static } from '@sinclair/typebox';
import { appendAudit } from '@fancy/db';
import type { AppDeps } from '../http/context.ts';
import { defineRawRoute, defineWrite } from '../http/routes.ts';
import { DomainError } from '../common/errors.ts';
import { lockActiveActor } from '../common/actor.ts';
import { canonicalFilters, loadAdminSnapshot } from './pages.ts';
import {loadDrilldownRows} from './drilldown.ts';

const MAX_BYTES=5*1024*1024;
const MAX_ROWS=10_000;
const TTL_MS=15*60_000;
type Page=keyof typeof ADMIN_PAGE_KEYS;
type ExportBody=Static<OperationById<'adminExport'>['body']>;

/** Provenance comes only from validated server configuration, never export input. */
export function exportProvenance(config:Pick<AppDeps['config'],'environment'|'adapters'>):{environment:AppDeps['config']['environment'];dataSource:'synthetic_fixture'|'production'|'non_production'}{
  const a=config.adapters;
  const synthetic=a.AUTH_ADAPTER==='test'||a.PLACES_ADAPTER==='fixture'||a.MAIL_ADAPTER==='outbox_test'||a.AI_PROVIDER==='mock';
  return {environment:config.environment,dataSource:synthetic?'synthetic_fixture':config.environment==='production'?'production':'non_production'};
}

/** RFC4180 quoting and spreadsheet formula suppression apply to every string cell. */
export function csvCell(value:unknown):string{
  let text=value===null||value===undefined?'':String(value);
  if(/^[\s\p{Cc}]*[=+\-@]/u.test(text)||/^[\t\r\n]/.test(text))text="'"+text;
  return '"'+text.replaceAll('"','""')+'"';
}
export function boundedCsv(rows:readonly (readonly unknown[])[],limits={rows:MAX_ROWS,bytes:MAX_BYTES}):Buffer{
  if(rows.length>limits.rows)throw new DomainError('VALIDATION_FAILED','The export exceeds the row limit. Narrow the filters.');
  const lines:string[]=[];let length=0;
  for(const row of rows){const line=row.map(csvCell).join(',')+'\r\n';length+=Buffer.byteLength(line);if(length>limits.bytes)throw new DomainError('VALIDATION_FAILED','The export exceeds the file limit. Narrow the filters.');lines.push(line);}
  return Buffer.from(lines.join(''),'utf8');
}
type Blob={snapshotId:string;data:Buffer;expires:number;timer:ReturnType<typeof setTimeout>};
const stores=new Set<Map<string,Blob>>();
/** Deletion barrier/worker hook: physically drops process-held CSV buffers for these snapshots. */
export function purgeSnapshotExports(snapshotIds:readonly string[]):void{
  const ids=new Set(snapshotIds);for(const store of stores)for(const [id,blob] of store)if(ids.has(blob.snapshotId)){clearTimeout(blob.timer);blob.data.fill(0);store.delete(id);}
}
function exportPage(metric:string):Page{
  if(metric.startsWith('summary.'))return metric.slice(8) as Page;
  const lists:Record<string,Page>={meals:'supply',attendance:'supply','cohort.users':'retention','quality.events':'quality'};
  if(lists[metric])return lists[metric];
  const page=(Object.keys(ADMIN_PAGE_KEYS) as Page[]).find(p=>(ADMIN_PAGE_KEYS[p].metrics as readonly string[]).includes(metric));
  if(!page)throw new DomainError('PROVIDER_UNAVAILABLE','This source-row export is not available yet.');
  return page;
}
function metricRow(metric:string,value:unknown,knownSource=false):unknown[]{
  if(value===null&&knownSource)return [metric,'','',''];
  if(typeof value==='number')return [metric,value,'',''];
  if(value&&typeof value==='object'&&'numerator' in value&&'denominator' in value){const n=Number(value.numerator),d=Number(value.denominator);return [metric,d===0?'':n/d,n,d];}
  throw new DomainError('PROVIDER_UNAVAILABLE',`The ${metric} source is not available for this snapshot.`);
}
/** Summary rows preserve unavailable cells instead of aborting the other sealed metrics. */
export function summaryMetricRow(metric:string,value:unknown,knownSource=false):unknown[]{
  if(value===null)return [...metricRow(metric,value,true),knownSource?'no_data':'unavailable'];
  const row=metricRow(metric,value,knownSource);
  const noDenominator=typeof value==='object'&&value!==null&&'denominator' in value&&Number(value.denominator)===0;
  return [...row,noDenominator?'no_denominator':'available'];
}
export function registerExportRoutes(app:FastifyInstance,deps:AppDeps){
  const blobs=new Map<string,Blob>();stores.add(blobs);
  const drop=(id:string)=>{const blob=blobs.get(id);if(blob){clearTimeout(blob.timer);blob.data.fill(0);}blobs.delete(id);};
  app.addHook('onClose',async()=>{for(const id of blobs.keys())drop(id);stores.delete(blobs);});
  defineWrite(app,deps,'adminExport',async({request,auth},tx)=>{
    await lockActiveActor(tx,auth.userId);
    const body=request.body as ExportBody;
    const rowFilters=['mealId','userId','cohortWeek','attendanceStatus','q','sort','order'].some(k=>k in body.filters);
    if(body.metric.startsWith('summary.')&&rowFilters)throw new DomainError('VALIDATION_FAILED','Row filters do not apply to page summaries.');
    const page=exportPage(body.metric);
    const query={...body.filters,snapshotId:body.snapshotId};
    // Uses exactly the same filter canonicalizer and sealed source facts as the visible page.
    const loaded=await loadAdminSnapshot(deps.pool,query);
    const report={snapshot:loaded.snapshot,filterHash:loaded.filterHash,...loaded.calculated.summaries[page]};
    const provenance=exportProvenance(deps.config);
    const rows:unknown[][]=[['dataSource',provenance.dataSource],['environment',provenance.environment],['snapshotId',report.snapshot.id],['asOf',report.snapshot.asOf],['filters',JSON.stringify(canonicalFilters(query))],['filterHash',report.filterHash],['definitionVersion',report.snapshot.definitionVersion],[],['metric','value','numerator','denominator',...(body.metric.startsWith('summary.')?['status']:[])]];
    if(body.metric.startsWith('summary.')){
      // Keep every page metric and mark missing sources without inventing zeroes.
      for(const [key,value] of Object.entries(report.metrics))rows.push(summaryMetricRow(key,value,key in loaded.calculated.rows));
    }else{
      if(body.metric in report.metrics)rows.push(metricRow(body.metric,report.metrics[body.metric],body.metric in loaded.calculated.rows));
      if(body.metric==='survey'){
        const surveyRows=loaded.calculated.rows.survey??[];
        rows.push(['surveyScope','date_and_user_segment'],['unit','users'],['surveySubmittedUsers',surveyRows.length],['surveyUnansweredAgain',surveyRows.filter(r=>r.attributes.again===null).length]);
        const value=loaded.calculated.metrics.survey;
        rows.push(metricRow('surveyWillingToReturn',value));
        for(const factor of loaded.calculated.series['survey.reasons']??[])rows.push(['surveyFactor:'+factor.key,factor.value]);
      }
      if(body.metric==='feedback')for(const score of loaded.calculated.series['rating.distribution']??[])rows.push(['rating:'+score.key,score.value]);
      const detail=await loadDrilldownRows(deps.pool,body.metric,{...query,filterHash:report.filterHash});
      const columns=[...new Set(detail.rows.flatMap(r=>Object.keys(r.attributes)))].sort();
      rows.push([],['rowId','inNumerator','inDenominator',...columns]);
      for(const r of detail.rows)rows.push([r.rowId,r.inNumerator,r.inDenominator,...columns.map(c=>r.attributes[c])]);
    }
    const data=boundedCsv(rows);
    const used=[...blobs.values()].reduce((sum,b)=>sum+b.data.byteLength,0);
    if(used+data.byteLength>32*1024*1024)throw new DomainError('PROVIDER_UNAVAILABLE','Export capacity is busy. Try again after earlier exports expire.');
    // Reserve synchronously before the next await, so concurrent creations cannot all
    // observe the same free capacity and exceed the process memory bound.
    const id=randomUUID();
    const timer=setTimeout(()=>drop(id),TTL_MS);timer.unref();
    blobs.set(id,{snapshotId:body.snapshotId,data,expires:Date.now()+TTL_MS,timer});
    try {
    const {rows:privacy}=await tx.client.query<{epoch:string}>(`SELECT epoch::text FROM privacy_control WHERE id=1 FOR SHARE`);
    const {rows:snapshots}=await tx.client.query<{privacy_epoch:string;revoked_at:Date|null}>(`SELECT privacy_epoch::text,revoked_at FROM analytics_snapshots WHERE id=$1 FOR SHARE`,[body.snapshotId]);
    if(!snapshots[0]||snapshots[0].revoked_at||snapshots[0].privacy_epoch!==privacy[0]!.epoch)throw new DomainError('SNAPSHOT_REVOKED','This snapshot was revoked.');
    const {rows:clock}=await tx.client.query<{now:Date}>(`SELECT clock_timestamp() AS now`);
    const expiresAt=new Date(clock[0]!.now.getTime()+TTL_MS);
    await tx.client.query(`INSERT INTO analytics_exports(id,actor_id,snapshot_id,privacy_epoch,metric,filter_hash,filters,byte_count,row_count,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[id,auth.userId,body.snapshotId,privacy[0]!.epoch,body.metric,report.filterHash,canonicalFilters(query),data.byteLength,rows.length,expiresAt]);
    await appendAudit(tx.client,{actorKind:'SUPPORT',actorId:auth.userId,action:'analytics.export_created',aggregateType:'snapshot',aggregateId:body.snapshotId,requestId:request.id,payload:{exportId:id,metric:body.metric,filterHash:report.filterHash}});
    return {data:{exportId:id,snapshotId:body.snapshotId,expiresAt:expiresAt.toISOString()},resourceId:id};
    } catch(e) {drop(id);throw e;}
  });
  defineRawRoute(app,deps,'getExport',async({request,reply,auth})=>{
    const {exportId} = request.params as {exportId:string};
    const db=await deps.pool.connect();
    try{
      await db.query('BEGIN');
      const {rows:privacy}=await db.query<{epoch:string}>(`SELECT epoch::text FROM privacy_control WHERE id=1 FOR SHARE`);
      const {rows}=await db.query(`SELECT e.*,e.privacy_epoch::text AS epoch,s.revoked_at AS snapshot_revoked,s.privacy_epoch::text AS snapshot_epoch FROM analytics_exports e JOIN analytics_snapshots s ON s.id=e.snapshot_id WHERE e.id=$1 FOR SHARE OF e,s`,[exportId]);
      const row=rows[0];
      if(!row||row.actor_id!==auth!.userId)throw new DomainError('NOT_FOUND','This export is unavailable.');
      const blob=blobs.get(exportId);
      if(row.revoked_at||row.snapshot_revoked||row.epoch!==privacy[0]!.epoch||row.snapshot_epoch!==privacy[0]!.epoch){purgeSnapshotExports([row.snapshot_id]);throw new DomainError('SNAPSHOT_REVOKED','This export was revoked for privacy.');}
      if(row.expires_at.getTime()<=Date.now()||!blob||blob.expires<=Date.now()){drop(exportId);throw new DomainError('RECEIPT_EXPIRED','This export expired. Create a new export.');}
      // Shared preflight authenticates the actor/MFA. This final privacy checkpoint queues
      // the authorised response while the deletion barrier is still held.
      reply.header('content-type','text/csv; charset=utf-8');reply.header('content-disposition',`attachment; filename="fancy-${exportId}.csv"`);reply.header('cache-control','private, no-store');reply.header('x-content-type-options','nosniff');
      const sent=reply.send(blob.data);
      await db.query('COMMIT');return sent;
    }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
  });
}
