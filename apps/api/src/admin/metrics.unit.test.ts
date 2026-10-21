import {describe,expect,it}from'vitest';
import{calculateMetrics,type Facts,type Meal,type Filters,type AttendanceRevision}from'./metrics.ts';
const asOf='2026-11-01T12:00:00.000Z';
const filters:Filters={from:null,to:null,areas:[],languages:[],budgetBands:[],sizes:[],sources:[],segments:[],budgetUpToPence:null};
const meal=(id:string,start:string,extra:Partial<Meal>={}):Meal=>({id,host_id:'h',starts_at:start,closes_at:new Date(Date.parse(start)-3600000).toISOString(),scheduled_end_at:new Date(Date.parse(start)+7200000).toISOString(),minimum:2,capacity:4,budget_max_pence:3000,languages:['en','zh'],area_code:'soho',status:'COMPLETED',cancel_reason:null,created_at:'2026-09-01T00:00:00Z',...extra});
function sample():Facts{
 const meals=[meal('m1','2026-10-01T12:00:00Z',{minimum:3,budget_max_pence:2000}),meal('m2','2026-10-20T12:00:00Z'),meal('m3','2026-10-25T12:00:00Z',{status:'CANCELLED',cancel_reason:'insufficient'}),meal('m4','2026-11-03T12:00:00Z',{status:'OPEN'})];
 const seat=(meal_id:string,seq:number,user_id:string,type:string,effective_at:string,application_id:string|null=null)=>({meal_id,seq:String(seq),user_id,type,effective_at,application_id});
 const attendance=(meal_id:string,subject_id:string,source:'SELF'|'HOST',value:'present'|'absent',version:string,created_at:string):AttendanceRevision=>({meal_id,subject_id,source,value,version,created_at,actor_id:source==='SELF'?subject_id:'h'});
 return{users:['h','a','b','c','d','u'].map(id=>({id,created_at:'2026-09-01T00:00:00Z'})),meals,
 applications:[{id:'old',meal_id:'m1',user_id:'a',state:'WITHDRAWN',created_at:'2026-09-24T10:00:00Z',decided_at:'2026-09-25T10:00:00Z'},{id:'new',meal_id:'m1',user_id:'a',state:'CONFIRMED',created_at:'2026-09-26T10:00:00Z',decided_at:'2026-09-26T13:00:00Z'},{id:'repeat',meal_id:'m2',user_id:'a',state:'CONFIRMED',created_at:'2026-10-10T10:00:00Z',decided_at:'2026-10-10T15:00:00Z'},{id:'declined',meal_id:'m1',user_id:'c',state:'DECLINED',created_at:'2026-10-01T00:00:00Z',decided_at:'2026-10-01T10:00:00Z'},{id:'recent',meal_id:'m3',user_id:'b',state:'EXPIRED',created_at:'2026-10-20T10:00:00Z',decided_at:'2026-10-25T10:00:00Z'},{id:'pending',meal_id:'m4',user_id:'d',state:'PENDING',created_at:'2026-11-01T11:00:00Z',decided_at:null}],
 seats:[seat('m1',1,'h','HOST_CONFIRMED','2026-09-20T00:00:00Z'),seat('m1',2,'a','GUEST_CONFIRMED','2026-09-24T11:00:00Z','old'),seat('m1',3,'a','LEFT','2026-09-25T10:00:00Z','old'),seat('m1',4,'a','GUEST_CONFIRMED','2026-09-26T13:00:00Z','new'),seat('m1',5,'u','GUEST_CONFIRMED','2026-09-27T10:00:00Z'),seat('m2',1,'h','HOST_CONFIRMED','2026-10-01T00:00:00Z'),seat('m2',2,'a','GUEST_CONFIRMED','2026-10-10T15:00:00Z','repeat'),seat('m3',1,'h','HOST_CONFIRMED','2026-10-15T00:00:00Z'),seat('m4',1,'h','HOST_CONFIRMED','2026-10-30T00:00:00Z')],
 attendance:[attendance('m1','h','SELF','present','1','2026-10-01T15:00:00Z'),attendance('m1','a','HOST','absent','1','2026-10-01T15:00:00Z'),attendance('m1','a','SELF','present','2','2026-10-02T15:00:00Z'),attendance('m2','h','SELF','present','1','2026-10-20T15:00:00Z'),attendance('m2','a','SELF','present','1','2026-10-20T15:00:00Z')],
 experiences:[{meal_id:'m1',user_id:'a',score:4,revision:'1',created_at:'2026-10-02T16:00:00Z'},{meal_id:'m1',user_id:'a',score:5,revision:'2',created_at:'2026-10-03T16:00:00Z'}],
 surveys:[{user_id:'a',version:'1',again:true,reasons:['company'],submitted_at:'2026-09-20T00:00:00Z'},{user_id:'a',version:'2',again:false,reasons:['cost'],submitted_at:'2026-10-02T00:00:00Z'},{user_id:'b',version:'1',again:null,reasons:['cost'],submitted_at:'2026-10-03T00:00:00Z'}],events:[]};
}
describe('measurement v4 hand-calculated source facts',()=>{
 it('weekly card and its drilldown use the latest visible week rather than distinct users across the entire range',()=>{
  const facts=sample();facts.attendance=facts.attendance!.filter(r=>!(r.meal_id==='m2'&&r.subject_id==='a'));
  const result=calculateMetrics(facts,filters,asOf);
  expect(result.series['weekly.trend']!.map(p=>p.value)).toEqual([2,1]);expect(result.metrics.weekly).toBe(1);
  expect(result.rows.weekly!.map(r=>r.attributes)).toEqual([{userId:'h',week:'2026-10-19'}]);
 });
 it('counts fixed form errors as events by step and field while preserving the no-telemetry null gate',()=>{
  const facts=sample();facts.telemetryReady=true;
  facts.events=[['a','arrange','venue'],['b','arrange','venue'],['c','introduce','title']].map(([id,step,field])=>({event_id:id!,anonymous_id:'anonymous',user_id:'a',session_id:'session',type:'form_error',occurred_at:'2026-10-02T10:00:00Z',received_at:'2026-10-02T10:00:01Z',properties:{attemptId:'attempt',step:step!,field:field!,errorCode:'required'}}));
  const result=calculateMetrics(facts,filters,asOf);
  expect(result.metrics.formErrors).toBe(3);expect(result.rows.formErrors).toHaveLength(3);
  expect(result.series['form.errors.byStep']).toEqual([{key:'arrange',value:2},{key:'introduce',value:1}]);
  expect(result.series['form.errors.byField']).toEqual([{key:'title',value:1},{key:'venue',value:2}]);
  expect(calculateMetrics({...facts,telemetryReady:false},filters,asOf).metrics.formErrors).toBeNull();
 });
 it('keeps unknown separate, resolves self over host and counts user/week rather than duplicate visits',()=>{
  const r=calculateMetrics(sample(),filters,asOf);
  expect(r.metrics.coverage).toEqual({numerator:4,denominator:5});expect(r.metrics.weekly).toBe(2);
  expect(r.series['weekly.trend']!.map(p=>p.value)).toEqual([2,2]);
  expect(r.rows.attendance!.find(p=>p.attributes.userId==='a'&&p.attributes.mealId==='m1')!.attributes).toMatchObject({attendanceStatus:'present',source:'SELF',sourceDifference:true});
  expect(r.metrics.feedback).toEqual({numerator:1,denominator:4});expect(r.series['rating.distribution']!.find(p=>p.key==='5')!.value).toBe(1);
 });
 it('uses full-history firsts, mature exact observation windows and distinct repeat meals',()=>{
  const r=calculateMetrics(sample(),filters,asOf);
  expect(r.metrics.activation).toEqual({numerator:1,denominator:2});expect(r.metrics.retention).toEqual({numerator:2,denominator:2});
  expect(r.rows.activation!.filter(row=>row.attributes.observation==='observing')).toHaveLength(2);
  const clipped=calculateMetrics(sample(),{...filters,from:'2026-10-01',to:'2026-10-01'},asOf);
  expect(clipped.metrics.activation).toEqual({numerator:0,denominator:1});
  const exact=calculateMetrics(sample(),filters,'2026-10-31T12:00:00Z');expect(exact.metrics.retention).toEqual({numerator:2,denominator:2});
  const before=calculateMetrics(sample(),filters,'2026-10-31T11:59:59Z');expect(before.metrics.retention).toEqual({numerator:0,denominator:0});
 });
 it('attributes attendance only to the start-confirmed round and separates real decisions from withdrawal/expiry',()=>{
  const r=calculateMetrics(sample(),filters,asOf);
  expect(r.metrics.applications).toBe(6);expect(r.metrics.approved).toBe(3);expect(r.metrics.confirmed).toBe(3);
  expect(r.metrics.applicationAttendance).toEqual({numerator:2,denominator:5});
  expect(r.rows.applicationAttendance!.find(row=>row.rowId==='old')!.inNumerator).toBe(false);
  expect(r.metrics.approval).toBe(10);expect(r.metrics.approvalP50).toBe(3);expect(r.metrics.pendingApplications).toBe(1);expect(r.metrics.oldestPendingHours).toBe(1);
 });
 it('rebuilds formation with seat history, includes cancellation in denominator and applies language OR/budget boundaries',()=>{
  const r=calculateMetrics(sample(),filters,asOf);expect(r.metrics.formation).toEqual({numerator:2,denominator:3});expect(r.metrics.cancellation).toEqual({numerator:1,denominator:3});
  const narrowed=calculateMetrics(sample(),{...filters,languages:['en','zh'],budgetBands:['0-20']},asOf);expect(narrowed.metrics.formation).toEqual({numerator:1,denominator:1});
  const upper=calculateMetrics(sample(),{...filters,budgetBands:['20-30']},asOf);expect(upper.metrics.formation).toEqual({numerator:1,denominator:2});
 });
 it('latest survey precedes date filtering, null is not No and meal filters never slice product survey',()=>{
  const r=calculateMetrics(sample(),filters,asOf);expect(r.metrics.survey).toEqual({numerator:0,denominator:1});expect(r.series['survey.reasons']!.find(p=>p.key==='cost')!.value).toBe(2);
  const september=calculateMetrics(sample(),{...filters,from:'2026-09-01',to:'2026-09-30'},asOf);expect(september.metrics.survey).toEqual({numerator:0,denominator:0});
  const unrelated=calculateMetrics(sample(),{...filters,areas:['not-existing']},asOf);expect(unrelated.metrics.survey).toEqual(r.metrics.survey);
 });
 it('support correction changes future calculations but cannot resurrect invalid/late self reports or count cancelled meals',()=>{
  const data=sample();data.attendance!.push({meal_id:'m1',subject_id:'a',source:'SUPPORT',value:'absent',version:'3',actor_id:'support',created_at:'2026-10-10T00:00:00Z'});
  const r=calculateMetrics(data,filters,asOf);expect(r.metrics.coverage).toEqual({numerator:4,denominator:5});expect(r.metrics.feedback).toEqual({numerator:0,denominator:3});
  data.attendance!.push({meal_id:'m3',subject_id:'h',source:'SELF',value:'present',version:'1',actor_id:'h',created_at:'2026-10-25T15:00:00Z'});
  expect(calculateMetrics(data,filters,asOf).metrics.weekly).toBe(2);
 });
 it('leaves unverifiable discovery/duplicate/rejection sources unavailable',()=>{
  const r=calculateMetrics(sample(),filters,asOf);for(const key of ['discovery','discovery7','impressionNoApply','laterOpportunity','missingRequired','duplicates'])expect(r.metrics[key]).toBeNull();
 });
 it('excludes an exit exactly at start and a confirmation at start, while preserving historical recruitment peaks',()=>{
  const data=sample();data.seats.push({meal_id:'m1',seq:'6',user_id:'a',application_id:'new',type:'LEFT',effective_at:'2026-10-01T12:00:00Z'});
  const r=calculateMetrics(data,filters,asOf);expect(r.metrics.coverage).toEqual({numerator:3,denominator:4});expect(r.metrics.formation).toEqual({numerator:2,denominator:3});
  const start=sample();start.seats.find(s=>s.meal_id==='m1'&&s.user_id==='u')!.effective_at='2026-10-01T12:00:00Z';
  expect(calculateMetrics(start,filters,asOf).metrics.coverage).toEqual({numerator:4,denominator:4});
 });
 it('filters user segments without changing the meal denominator and rejects late self attendance',()=>{
  const r=calculateMetrics(sample(),{...filters,from:'2026-10-01',segments:['new']},asOf);expect(r.metrics.coverage).toEqual({numerator:0,denominator:0});expect(r.metrics.formation).toEqual({numerator:2,denominator:3});
  const data=sample();data.attendance!.push({meal_id:'m1',subject_id:'u',source:'SELF',value:'present',version:'1',actor_id:'u',created_at:'2026-10-08T14:00:00Z'});
  expect(calculateMetrics(data,filters,asOf).metrics.coverage).toEqual({numerator:4,denominator:5});
 });
 it('computes verified discovery/exposure cohorts and raw-delivery quality only after their readiness gates',()=>{
  const data=sample();data.discoveryReady=true;data.telemetryReady=true;data.quality={deliveryComplete:true,excludedEvents:2};data.excludedEvents=[];
  const e=(id:string,type:string,user_id:string|null,occurred_at:string,properties:Record<string,unknown>,lag=1)=>({event_id:id,type,user_id,anonymous_id:'visitor-'+id,session_id:'session-'+id,occurred_at,received_at:new Date(Date.parse(occurred_at)+lag*1000).toISOString(),properties});
  data.events=[e('server-zero','discovery_results','a','2026-10-09T00:00:00Z',{serverOnly:true,resultCount:0,filters:{}},0),e('server-three','discovery_results','c','2026-10-10T00:00:00Z',{serverOnly:true,resultCount:3,filters:{}},0),e('server-fail','discovery_failed','b','2026-10-12T00:00:00Z',{serverOnly:true,resultCount:0},0),e('render-a','discovery_results','a','2026-10-09T00:00:01Z',{rendered:true,resultCount:0,filters:{}}),e('render-c','discovery_results','c','2026-10-10T00:00:01Z',{rendered:true,resultCount:3,filters:{}}),e('render-b','discovery_results','b','2026-10-31T00:00:00Z',{rendered:true,resultCount:3,filters:{}}),e('impression-a','meal_impression','a','2026-10-09T00:00:05Z',{mealId:'m2'},2),e('impression-c','meal_impression','c','2026-10-10T00:00:05Z',{mealId:'m2'},2),e('impression-b','meal_impression','b','2026-10-31T00:00:05Z',{mealId:'m4'},2),e('anonymous-detail','detail_view',null,'2026-10-12T00:00:00Z',{mealId:'m2'},9)];
  data.deliveries=[{id:'d1',event_id:'e1',outcome:'duplicate',reason:null,received_at:asOf},{id:'d2',event_id:'e2',outcome:'duplicate',reason:null,received_at:asOf},{id:'d3',event_id:null,outcome:'rejected',reason:'missing_required',received_at:asOf}];
  data.meals.push(meal('created','2026-10-08T12:00:00Z',{host_id:'a',created_at:'2026-10-04T00:00:00Z',attempt_id:'attempt-one'}));
  data.events.push(e('create-start','create_started','a','2026-10-02T10:00:00Z',{attemptId:'attempt-one'}),e('create-duplicate','create_started','a','2026-10-02T11:00:00Z',{attemptId:'attempt-one'}),e('create-arranged','create_arranged','a','2026-10-03T10:00:00Z',{attemptId:'attempt-one'}));
  const r=calculateMetrics(data,filters,asOf);expect(r.metrics.discovery).toEqual({numerator:1,denominator:2});expect(r.metrics.discovery7).toEqual({numerator:1,denominator:2});expect(r.metrics.impressionNoApply).toEqual({numerator:1,denominator:2});expect(r.metrics.laterOpportunity).toEqual({numerator:1,denominator:2});expect(r.metrics.receiveLatencyP90).toBe(2);expect(r.metrics.duplicates).toBe(2);expect(r.metrics.missingRequired).toBe(1);expect(r.metrics.excluded).toBe(2);
  expect(r.series['browse.people']!.map(s=>s.value)).toEqual([3,3,1]);
  expect(r.series['funnel.create']!.map(s=>s.value)).toEqual([1,1,1]);
  const narrow=calculateMetrics(data,{...filters,from:'2026-10-01',to:'2026-10-01'},asOf);expect(narrow.metrics.laterOpportunity).toEqual({numerator:1,denominator:2});
 });
});
