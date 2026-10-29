import type {Pool} from 'pg';
import {withTransaction} from '../common/transaction.ts';

/**
 * Analytics storage limits (ops analytics review 2026-10-29, P0-1; privacy notice "How long we keep
 * information"). Each value can be overridden in RETENTION_POLICY_JSON under the same key; anything
 * invalid keeps the default below.
 *  - analyticsHourlySnapshots: the most recent N snapshots are all kept (hourly cadence -> 48 hours);
 *  - analyticsDailySnapshotDays: older snapshots keep one per Europe/London day (that day's latest
 *    unrevoked snapshot) for N days; everything else is deleted with its facts, subjects and exports;
 *  - analyticsEventMonths: raw consented analytics events, by receipt time;
 *  - analyticsDiscoveryRequestDays: discovery request records (only used to validate events at ingest);
 *  - analyticsDeliveryDays: per-event delivery ledger (quality page).
 * Event retention must stay longer than the longest observation window (30 days) plus a comparison period.
 */
export const DEFAULT_ANALYTICS_RETENTION={analyticsHourlySnapshots:48,analyticsDailySnapshotDays:120,analyticsEventMonths:13,analyticsDiscoveryRequestDays:30,analyticsDeliveryDays:90} as const;
export type AnalyticsRetention={-readonly [K in keyof typeof DEFAULT_ANALYTICS_RETENTION]:number};
const LIMITS:Record<keyof AnalyticsRetention,[number,number]>={analyticsHourlySnapshots:[1,24*14],analyticsDailySnapshotDays:[1,3650],analyticsEventMonths:[2,120],analyticsDiscoveryRequestDays:[1,3650],analyticsDeliveryDays:[1,3650]};

export function analyticsRetention(policy:Record<string,unknown>|null|undefined):AnalyticsRetention{
 const out={...DEFAULT_ANALYTICS_RETENTION} as AnalyticsRetention;
 for(const key of Object.keys(LIMITS) as Array<keyof AnalyticsRetention>){const value=policy?.[key];const [min,max]=LIMITS[key];if(typeof value==='number'&&Number.isInteger(value)&&value>=min&&value<=max)out[key]=value;}
 return out;
}

/** Earliest receipt time still held for raw analytics events; snapshots never claim history before it. */
export async function analyticsEventFloor(pool:Pool,retention:AnalyticsRetention):Promise<Date>{
 const {rows:[row]}=await pool.query<{floor:Date}>(`SELECT clock_timestamp()-make_interval(months=>$1::int) AS floor`,[retention.analyticsEventMonths]);
 return row!.floor;
}

const BATCH=5000;
async function batchedDelete(pool:Pool,sql:string,params:unknown[]):Promise<number>{
 let total=0;
 for(;;){const {rowCount}=await pool.query(sql,[...params,BATCH]);total+=rowCount??0;if((rowCount??0)<BATCH)return total;}
}

export interface AnalyticsPurgeResult {snapshots:number;events:number;discoveryRequests:number;deliveries:number}

/**
 * Deletes analytics data beyond its retention period. Snapshot rows are removed together with their
 * facts, subject index and export metadata in one transaction; a page that is reading a snapshot holds
 * it FOR SHARE, so the delete waits for that read rather than tearing it.
 */
export async function purgeExpiredAnalytics(pool:Pool,retention:AnalyticsRetention=DEFAULT_ANALYTICS_RETENTION):Promise<AnalyticsPurgeResult>{
 const snapshots=await withTransaction(pool,async tx=>{
  const {rows}=await tx.client.query<{id:string}>(`WITH ranked AS (
     SELECT id,as_of,revoked_at,
            row_number() OVER (ORDER BY as_of DESC,id DESC) AS recent,
            row_number() OVER (PARTITION BY (as_of AT TIME ZONE 'Europe/London')::date ORDER BY (revoked_at IS NULL) DESC,as_of DESC,id DESC) AS in_day
       FROM analytics_snapshots)
   SELECT id FROM ranked
    WHERE recent>$1 AND NOT (in_day=1 AND revoked_at IS NULL AND as_of>=clock_timestamp()-make_interval(days=>$2::int))
    ORDER BY id`,[retention.analyticsHourlySnapshots,retention.analyticsDailySnapshotDays]);
  const ids=rows.map(r=>r.id);
  if(!ids.length)return 0;
  await tx.client.query(`SELECT id FROM analytics_snapshots WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE`,[ids]);
  await tx.client.query(`DELETE FROM analytics_exports WHERE snapshot_id=ANY($1::uuid[])`,[ids]);
  await tx.client.query(`DELETE FROM analytics_snapshot_facts WHERE snapshot_id=ANY($1::uuid[])`,[ids]);
  await tx.client.query(`DELETE FROM analytics_snapshot_subjects WHERE snapshot_id=ANY($1::uuid[])`,[ids]);
  const {rowCount}=await tx.client.query(`DELETE FROM analytics_snapshots WHERE id=ANY($1::uuid[])`,[ids]);
  return rowCount??0;
 });
 const events=await batchedDelete(pool,`DELETE FROM analytics_events WHERE event_id IN(SELECT event_id FROM analytics_events WHERE received_at<clock_timestamp()-make_interval(months=>$1::int) LIMIT $2)`,[retention.analyticsEventMonths]);
 const discoveryRequests=await batchedDelete(pool,`DELETE FROM analytics_discovery_requests WHERE request_id IN(SELECT request_id FROM analytics_discovery_requests WHERE received_at<clock_timestamp()-make_interval(days=>$1::int) LIMIT $2)`,[retention.analyticsDiscoveryRequestDays]);
 const deliveries=await batchedDelete(pool,`DELETE FROM analytics_deliveries WHERE id IN(SELECT id FROM analytics_deliveries WHERE received_at<clock_timestamp()-make_interval(days=>$1::int) LIMIT $2)`,[retention.analyticsDeliveryDays]);
 return {snapshots,events,discoveryRequests,deliveries};
}
