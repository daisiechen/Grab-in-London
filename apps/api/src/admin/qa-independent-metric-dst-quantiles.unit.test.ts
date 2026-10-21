import {expect,it} from 'vitest';
import {calculateMetrics,type Facts,type Filters,type Meal} from './metrics.ts';
const HOUR=3600000,DAY=24*HOUR;
const iso=(n:number)=>new Date(n).toISOString();
const filters:Filters={from:null,to:null,areas:[],languages:[],budgetBands:[],sizes:[],sources:[],segments:[],budgetUpToPence:null};
const meal=(id:string,start:number):Meal=>({id,host_id:'host',starts_at:iso(start),closes_at:iso(start-HOUR),scheduled_end_at:iso(start+2*HOUR),minimum:2,capacity:4,budget_max_pence:3000,languages:['en'],area_code:'soho',status:'COMPLETED',cancel_reason:null,created_at:'2026-09-01T00:00:00Z'});
const empty=():Facts=>({users:[{id:'a',created_at:'2026-09-01T00:00:00Z'}],meals:[],applications:[],seats:[],attendance:[],surveys:[],events:[]});
function attended(f:Facts,id:string,start:number,applicationId:string|null=null){f.meals.push(meal(id,start));f.seats.push({meal_id:id,seq:'1',user_id:'a',application_id:applicationId,type:'GUEST_CONFIRMED',effective_at:iso(start-HOUR)});f.attendance!.push({meal_id:id,subject_id:'a',source:'SELF',value:'present',version:'1',created_at:iso(start+3*HOUR),actor_id:'a'});}

it('QA-METRIC-015 repeated London0130 stays one local day and Monday starts a new week',()=>{
 const f=empty(),one=Date.parse('2026-10-25T00:30:00Z'),two=Date.parse('2026-10-25T01:30:00Z'),monday=Date.parse('2026-10-26T00:00:00Z');
 const clock=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit'});expect(clock.format(new Date(one))).toBe('01:30');expect(clock.format(new Date(two))).toBe('01:30');
 attended(f,'bst',one);attended(f,'gmt',two);f.users.push({id:'b',created_at:'2026-09-01T00:00:00Z'});f.seats[1]!.user_id='b';f.attendance![1]!.subject_id='b';f.attendance![1]!.actor_id='b';attended(f,'monday',monday);
 const all=calculateMetrics(f,filters,'2026-11-30T12:00:00Z');expect(all.series['weekly.trend']).toEqual([{key:'2026-10-19',value:2},{key:'2026-10-26',value:1}]);
 const sunday=calculateMetrics(f,{...filters,from:'2026-10-25',to:'2026-10-25'},'2026-11-30T12:00:00Z');expect(sunday.metrics.coverage).toEqual({numerator:2,denominator:2});expect(sunday.series['weekly.trend']).toEqual([{key:'2026-10-19',value:2}]);
});
it('QA-METRIC-015 14 and30 day maturity across fallback use elapsedUTC not calendar wall hours',()=>{
 const first=Date.parse('2026-10-18T12:00:00Z'),f=empty();attended(f,'attended',first+DAY,'applied');f.applications.push({id:'applied',meal_id:'attended',user_id:'a',state:'CONFIRMED',created_at:iso(first),decided_at:iso(first+HOUR)});
 expect(calculateMetrics(f,filters,iso(first+14*DAY-1)).metrics.activation).toEqual({numerator:0,denominator:0});expect(calculateMetrics(f,filters,iso(first+14*DAY)).metrics.activation).toEqual({numerator:1,denominator:1});
 const attendedAt=Date.parse('2026-10-01T12:00:00Z');for(const [delay,numerator]of [[30*DAY,1],[30*DAY+HOUR,0]]){const r=empty();attended(r,'first',attendedAt);attended(r,'second',attendedAt+delay!);expect(calculateMetrics(r,filters,'2026-11-15T12:00:00Z').metrics.retention).toEqual({numerator,denominator:1});}
});
it.each([{hours:[1,2,3,10]},{hours:[1,2,4,10]}])('QA-METRIC-017 handcomputed nearest rank $hours givesP50=2/P90=10; terminal rounds not pending',({hours:delays})=>{
 const f=empty(),created=Date.parse('2026-10-25T00:00:00Z'),asOf=Date.parse('2026-10-27T12:00:00Z');f.meals.push({...meal('future',Date.parse('2026-10-30T18:00:00Z')),status:'OPEN'});
 for(const [i,hours]of delays.entries()){
  const id=`decision-${i}`;f.applications.push({id,meal_id:'future',user_id:'a',state:i%2===0?'CONFIRMED':'DECLINED',created_at:iso(created),decided_at:iso(created+hours*HOUR)});
  if(i%2===0){f.seats.push({meal_id:'future',seq:String(i+1),user_id:'a',application_id:id,type:'GUEST_CONFIRMED',effective_at:iso(created+hours*HOUR)});f.seats.push({meal_id:'future',seq:String(i+10),user_id:'a',application_id:id,type:'GUEST_CONFIRMED',effective_at:iso(created+20*HOUR)});}
 }
 for(const state of ['WITHDRAWN','EXPIRED','CANCELLED'])f.applications.push({id:state,meal_id:'future',user_id:'a',state,created_at:iso(created),decided_at:iso(created+30*HOUR)});
 f.applications.push({id:'waiting',meal_id:'future',user_id:'a',state:'PENDING',created_at:iso(asOf-HOUR),decided_at:null});
 f.meals.push({...meal('cancelled',asOf),status:'CANCELLED',cancel_reason:'host'},meal('closed',asOf+HOUR));
 for(const id of ['cancelled','closed'])f.applications.push({id:`pending-${id}`,meal_id:id,user_id:'a',state:'PENDING',created_at:iso(created),decided_at:null});
 const result=calculateMetrics(f,filters,iso(asOf));expect(result.metrics.approvalP50).toBe(2);expect(result.metrics.approval).toBe(10);expect(result.metrics.pendingApplications).toBe(1);expect(result.metrics.oldestPendingHours).toBe(1);expect(result.rows.pendingApplications!.map(r=>r.rowId)).toEqual(['waiting']);
 expect(result.rows.applications!.filter(r=>['WITHDRAWN','EXPIRED','CANCELLED'].includes(r.rowId)).every(r=>r.attributes.decisionHours===null)).toBe(true);
});
