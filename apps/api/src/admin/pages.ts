import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import type { OperationById } from '@fancy/contracts';
import type { Static } from '@sinclair/typebox';
import { DomainError } from '../common/errors.ts';
import { canonicalJson } from '../common/canonical.ts';
import {calculateMetrics,type Facts,type Page} from './metrics.ts';
export type Query=Static<OperationById<'adminPage'>['query']>;
const list=(value:string|undefined)=>value?[...new Set(value.split(','))].sort():[];
export function canonicalFilters(query:Query){
 if(query.from&&query.to&&query.from>query.to)throw new DomainError('VALIDATION_FAILED','The start date must precede the end date.');
 if(query.budgetBands&&query.budgetUpToPence)throw new DomainError('VALIDATION_FAILED','Use one budget filter.');
 if(query.segments&&!query.from)throw new DomainError('VALIDATION_FAILED','User segments need a cohort start date.');
 return{from:query.from??null,to:query.to??null,areas:list(query.areas),languages:list(query.languages),budgetBands:list(query.budgetBands),sizes:list(query.sizes),sources:list(query.sources),segments:list(query.segments),budgetUpToPence:query.budgetUpToPence??null};
}
export async function loadAdminSnapshot(pool:Pool,query:Query){
 const filters=canonicalFilters(query);
 const db=await pool.connect();
 try{
  await db.query('BEGIN');
  const{rows:privacy}=await db.query(`SELECT epoch::text FROM privacy_control WHERE id=1 FOR SHARE`);
  const{rows}=await db.query(`SELECT *,classification_revision::text AS revision,privacy_epoch::text AS epoch FROM analytics_snapshots WHERE id=$1 FOR SHARE`,[query.snapshotId]);
  const snapshot=rows[0];
  if(!snapshot)throw new DomainError('NOT_FOUND','This snapshot is unavailable.');
  if(snapshot.revoked_at||snapshot.epoch!==privacy[0].epoch)throw new DomainError('SNAPSHOT_REVOKED','This snapshot was revoked for privacy. Select a new snapshot.');
  const{rows:stored}=await db.query(`SELECT kind,facts FROM analytics_snapshot_facts WHERE snapshot_id=$1`,[snapshot.id]);
  const facts=Object.fromEntries(stored.map(r=>[r.kind,r.facts]));
  if(!facts.meals||!facts.applications||!facts.seats||!facts.surveys)throw new DomainError('PROVIDER_UNAVAILABLE','This snapshot has no supported source facts.');
  // Sign-up sources exist from definition v5 (users.signup_source); older snapshots cannot be filtered by them.
  if(filters.sources.length&&snapshot.definition_version==='v4')throw new DomainError('PROVIDER_UNAVAILABLE','Source attribution history is not available for this snapshot.');
  const metadata={id:snapshot.id as string,dimensions:snapshot.dimensions,asOf:(snapshot.as_of as Date).toISOString(),createdAt:(snapshot.created_at as Date).toISOString(),definitionVersion:snapshot.definition_version as string,classificationRevision:snapshot.revision as string,status:'SEALED' as const};
  const calculated=calculateMetrics({...facts,historyCoverageStart:(snapshot.history_coverage_start as Date).toISOString()} as Facts,filters,metadata.asOf);
  const filterHash=createHash('sha256').update(canonicalJson(filters)).digest('hex');
  await db.query('COMMIT');return{snapshot:metadata,filterHash,calculated,filters,epoch:snapshot.epoch as string,privacyExcludedCount:0};
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
export async function readAdminPage(pool:Pool,page:Page,query:Query){
 const loaded=await loadAdminSnapshot(pool,query);
 return{page,snapshot:loaded.snapshot,filterHash:loaded.filterHash,...loaded.calculated.summaries[page],privacyExcludedCount:loaded.privacyExcludedCount};
}
