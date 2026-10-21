import {expect,it} from 'vitest';
import {calculateMetrics,type Facts,type Filters,type Meal} from './metrics.ts';
const HOUR=3600000,DAY=24*HOUR;
const iso=(n:number)=>new Date(n).toISOString();
const filters:Filters={from:null,to:null,areas:[],languages:[],budgetBands:[],sizes:[],sources:[],segments:[],budgetUpToPence:null};
const meal=(id:string,start:number):Meal=>({id,host_id:'host',starts_at:iso(start),closes_at:iso(start-HOUR),scheduled_end_at:iso(start+2*HOUR),minimum:2,capacity:4,budget_max_pence:3000,languages:['en'],area_code:'soho',status:'COMPLETED',cancel_reason:null,created_at:'2026-09-01T00:00:00Z'});
const empty=():Facts=>({users:[{id:'a',created_at:'2026-09-01T00:00:00Z'}],meals:[],applications:[],seats:[],attendance:[],surveys:[],events:[]});
function attended(f:Facts,id:string,start:number,applicationId:string|null=null){f.meals.push(meal(id,start));f.seats.push({meal_id:id,seq:'1',user_id:'a',application_id:applicationId,type:'GUEST_CONFIRMED',effective_at:iso(start-HOUR)});f.attendance!.push({meal_id:id,subject_id:'a',source:'SELF',value:'present',version:'1',created_at:iso(start+3*HOUR),actor_id:'a'});}
it('QA-METRIC-004 independent 14-day equality and all-history first application',()=>{
 const f=empty(),first=Date.parse('2026-10-01T12:00:00Z');attended(f,'meal',first+DAY,'first');
 f.applications=[{id:'first',meal_id:'meal',user_id:'a',state:'WITHDRAWN',created_at:iso(first),decided_at:null},{id:'later',meal_id:'meal',user_id:'a',state:'CONFIRMED',created_at:iso(first+DAY),decided_at:null}];
 const before=calculateMetrics(f,filters,iso(first+14*DAY-1)),at=calculateMetrics(f,filters,iso(first+14*DAY));
 expect(before.metrics.activation).toEqual({numerator:0,denominator:0});expect(before.rows.activation![0]!.attributes.observation).toBe('observing');expect(at.metrics.activation).toEqual({numerator:1,denominator:1});expect(at.rows.activation![0]!.attributes.firstAppliedAt).toBe(iso(first));
 expect(calculateMetrics(f,{...filters,from:'2026-10-02'},iso(first+20*DAY)).metrics.activation).toEqual({numerator:0,denominator:0});
});
it('QA-METRIC-005 independent repeat attendance excludes zero delay and same meal; includes 30 days and excludes 30 days plus 1ms',()=>{
 const first=Date.parse('2026-10-01T12:00:00Z');
 for(const [delay,numerator] of [[0,0],[30*DAY,1],[30*DAY+1,0]]){const f=empty();attended(f,'first',first);attended(f,'next',first+delay!);expect(calculateMetrics(f,filters,'2026-11-15T12:00:00Z').metrics.retention).toEqual({numerator,denominator:1});}
 const f=empty();attended(f,'same',first);f.attendance!.push({...f.attendance![0]!,version:'2',created_at:iso(first+4*HOUR)});expect(calculateMetrics(f,filters,'2026-11-15T12:00:00Z').metrics.retention).toEqual({numerator:0,denominator:1});
});
it('QA-METRIC-006 independent application maturity is start plus 26h at exact millisecond',()=>{
 const f=empty(),start=Date.parse('2026-10-01T18:00:00Z');attended(f,'meal',start,'applied');f.applications.push({id:'applied',meal_id:'meal',user_id:'a',state:'CONFIRMED',created_at:iso(start-DAY),decided_at:iso(start-HOUR)});
 expect(calculateMetrics(f,filters,iso(start+26*HOUR-1)).metrics.applicationAttendance).toEqual({numerator:0,denominator:0});expect(calculateMetrics(f,filters,iso(start+26*HOUR)).metrics.applicationAttendance).toEqual({numerator:1,denominator:1});expect(calculateMetrics(f,filters,iso(start+24*HOUR)).metrics.applicationAttendance).toEqual({numerator:0,denominator:0});
});
it('QA-METRIC-007 independent four rounds retain withdrawn declined and cancelled denominators with attendance only credited to r2',()=>{
 const f=empty(),start=Date.parse('2026-10-01T18:00:00Z');attended(f,'held',start,'r2');f.meals.push({...meal('cancelled',start),status:'CANCELLED',cancel_reason:'host'});
 f.applications=[['r1','held','a','WITHDRAWN'],['r2','held','a','CONFIRMED'],['r3','held','b','DECLINED'],['r4','cancelled','c','CANCELLED']].map(([id,meal_id,user_id,state])=>({id:id!,meal_id:meal_id!,user_id:user_id!,state:state!,created_at:iso(start-DAY),decided_at:iso(start-HOUR)}));
 f.users.push({id:'b',created_at:'2026-09-01T00:00:00Z'},{id:'c',created_at:'2026-09-01T00:00:00Z'});
 const r=calculateMetrics(f,filters,'2026-10-05T12:00:00Z');expect(r.metrics.applicationAttendance).toEqual({numerator:1,denominator:4});expect(r.rows.applicationAttendance!.filter(x=>x.inNumerator).map(x=>x.rowId)).toEqual(['r2']);expect(r.rows.applicationAttendance!.every(x=>x.inDenominator)).toBe(true);
});
it('QA-METRIC-009 independent survey selects latest asOf answer before date filtering; null remains unanswered',()=>{
 const f=empty();f.users.push({id:'b',created_at:'2026-09-01T00:00:00Z'});f.surveys=[{user_id:'a',version:'1',again:true,reasons:[],submitted_at:'2026-09-25T12:00:00Z'},{user_id:'a',version:'2',again:false,reasons:['cost'],submitted_at:'2026-10-02T12:00:00Z'},{user_id:'b',version:'1',again:null,reasons:['venue'],submitted_at:'2026-09-26T12:00:00Z'}];
 const september={...filters,from:'2026-09-01',to:'2026-09-30'};
 const late=calculateMetrics(f,september,'2026-10-18T12:00:00Z');expect(late.metrics.survey).toEqual({numerator:0,denominator:0});expect(late.rows.survey!.map(x=>x.rowId)).toEqual(['b']);expect(late.rows.survey![0]).toMatchObject({inDenominator:false,attributes:{again:null}});
 const early=calculateMetrics(f,september,'2026-09-30T12:00:00Z');expect(early.metrics.survey).toEqual({numerator:1,denominator:1});expect(early.rows.survey!.find(x=>x.rowId==='a')!.attributes.again).toBe(true);
 const all=calculateMetrics(f,filters,'2026-10-18T12:00:00Z');expect(all.metrics.survey).toEqual({numerator:0,denominator:1});expect(all.rows.survey!.find(x=>x.rowId==='a')!.attributes.again).toBe(false);expect(all.rows.survey!.find(x=>x.rowId==='b')!.inDenominator).toBe(false);
});
