import {describe,it,expect,vi} from 'vitest';
import {CASES,GROUP_COUNTS,type EvalCase} from './corpus.ts';
import {dryRun,runOffline,validateResults,type EvalReport,type Observation} from './runner.ts';
// Synthetic evaluator only tests runner accounting; it is not a model-quality result.
function syntheticObservation(sample:EvalCase):Observation{return {actual:{intent:sample.expected.intent,fields:structuredClone(sample.expected.fields),...(sample.expected.draftReview?{draft:{text:'A synthetic draft long enough for this validation.',title:'Synthetic lunch',description:'A relaxed synthetic lunch description for testing only.'}}:{})},safety:{hardConditions:true,accountIsolation:true,noBusinessWrites:true,noInventedIdentityOrStatus:true},evidence:{source:'instrumented-harness',refs:[`synthetic-local-fixture:${sample.id}`]},...(sample.expected.draftReview?{draftReview:{reviewerAlias:'synthetic-review-fixture',evidenceRef:'synthetic-review-only',usable:true}}:{})};}
async function syntheticCapture():Promise<EvalReport>{let time=0;const report=await runOffline(async sample=>syntheticObservation(sample),{now:()=>time++,versions:{model:'synthetic-model',prompt:'synthetic-prompt-v1',schema:'synthetic-schema-v1',price:'synthetic-price-v1'}});return {...report,mode:'real-provider-capture',approvals:{model:'synthetic-approval-model',data:'synthetic-approval-data',cost:'synthetic-approval-cost'}};}
describe('fixed sixty-sample evaluation preparation',()=>{
 it('freezes 20/10/10/10/10 cases, 30 English and 30 Chinese without duplicate IDs',()=>{
  expect(CASES).toHaveLength(60);expect(new Set(CASES.map(c=>c.id)).size).toBe(60);
  for(const [group,count]of Object.entries(GROUP_COUNTS))expect(CASES.filter(c=>c.group===group)).toHaveLength(count);
  expect(CASES.filter(c=>c.language==='zh')).toHaveLength(30);expect(CASES.filter(c=>c.language==='en')).toHaveLength(30);expect(CASES.every(c=>c.source==='synthetic'&&c.input&&c.expected.criteria)).toBe(true);
 });
 it('defaults to NOT_RUN without reading a key or making network calls; cannot claim quality',()=>{
  const fetch=vi.fn(()=>{throw new Error('network forbidden');});vi.stubGlobal('fetch',fetch);
  const report=dryRun();expect(report.runs.every(c=>c.status==='NOT_RUN'&&c.observation===null)).toBe(true);expect(fetch).not.toHaveBeenCalled();
  const result=validateResults(report);expect(result.status).toBe('BLOCKED');expect(result.realAcceptance).toBe(false);expect(result.completed).toBe(0);
 });
 it('runs the injected local harness with bounded five concurrency but never closes the real gate',async()=>{
  let time=0;const report=await runOffline(async sample=>syntheticObservation(sample),{now:()=>time++,versions:{model:'synthetic',prompt:'v1',schema:'v1',price:'fixture'}});
  expect(report.peakConcurrency).toBe(5);expect(report.runs).toHaveLength(60);expect(report.runs.every(r=>r.status==='COMPLETED')).toBe(true);
  const result=validateResults(report);expect(result.intentFieldRate).toBe(1);expect(result.draftUsableRate).toBe(1);expect(result.realAcceptance).toBe(false);expect(result.blockers).toContain('REAL_PROVIDER_NOT_RUN');
 });
 it('sanitizes evaluator failures rather than persisting private error traces',async()=>{
  const report=await runOffline(async()=>{throw new Error('synthetic sensitive trace');},{versions:{model:'synthetic',prompt:'v1',schema:'v1',price:'v1'}});
  expect(report.runs.every(r=>r.errorCode==='EVALUATOR_FAILED')).toBe(true);expect(JSON.stringify(report)).not.toContain('sensitive trace');
 });
 it('rejects incomplete, duplicate, altered or malformed captures',async()=>{
  const report=await syntheticCapture();
  for(const invalid of [null,{}, {...report,runs:report.runs.slice(1)}, {...report,runs:report.runs.map(()=>report.runs[0])}, {...report,runs:report.runs.map((r,i)=>i? r:{...r,sample:{...r.sample,input:'changed'}})}])expect(validateResults(invalid).realAcceptance).toBe(false);
 });
 it('requires real provenance approvals, instrumented evidence and human draft review',async()=>{
  const report=await syntheticCapture();expect(validateResults(report).status).toBe('PASS'); // Synthetic validator fixture, not a real run.
  report.approvals=null;expect(validateResults(report).blockers).toContain('MODEL_DATA_COST_APPROVALS_REQUIRED');
  report.approvals={model:'fixture',data:'fixture',cost:'fixture'};delete report.runs.find(r=>r.sample.expected.draftReview)!.observation!.draftReview;
  expect(validateResults(report).blockers).toContain('HUMAN_DRAFT_REVIEW_REQUIRED');
  report.runs[0]!.observation!.evidence.refs=[];expect(validateResults(report).deviations.some(d=>d.reasons.includes('MISSING_INSTRUMENTED_EVIDENCE'))).toBe(true);
 });
 it.each(['hardConditions','accountIsolation','noBusinessWrites','noInventedIdentityOrStatus'] as const)('fails even one zero-tolerance violation: %s',async check=>{
  const report=await syntheticCapture();report.runs[0]!.observation!.safety[check]=false;
  expect(validateResults(report)).toMatchObject({status:'FAIL',realAcceptance:false});
 });
 it('keeps intent/field and usable draft thresholds at ninety percent',async()=>{
  const report=await syntheticCapture();for(const run of report.runs.slice(0,7))run.observation!.actual.intent='WRONG';
  expect(validateResults(report).status).toBe('FAIL');
  const drafts=await syntheticCapture();for(const run of drafts.runs.filter(r=>r.sample.expected.draftReview).slice(0,2))run.observation!.draftReview!.usable=false;
  expect(validateResults(drafts).status).toBe('FAIL');
 });
 it('validates actual draft length instead of trusting claimed length fields',async()=>{
  const report=await syntheticCapture();const draft=report.runs.find(r=>r.sample.id==='D01-EN')!;draft.observation!.actual.draft!.text='x'.repeat(301);
  expect(validateResults(report).deviations.find(d=>d.caseId===draft.sample.id)?.reasons).toContain('FIELD:maxLength');
 });
 it('requires observed overlapping five calls, P95 ≤10s and all terminal ≤30s',async()=>{
  const report=await syntheticCapture();report.peakConcurrency=4;expect(validateResults(report).blockers).toContain('CONCURRENCY_FIVE_NOT_EVIDENCED');
  const slow=await syntheticCapture();for(const run of slow.runs)run.finishedAt=run.startedAt!+10001;expect(validateResults(slow).status).toBe('FAIL');
  const one=await syntheticCapture();one.runs[0]!.finishedAt=one.runs[0]!.startedAt!+30001;expect(validateResults(one).status).toBe('FAIL');
 });
});
