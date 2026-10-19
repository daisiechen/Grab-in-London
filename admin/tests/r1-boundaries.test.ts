import {fixture} from "../src/fixtures.ts";
import {test} from "node:test";
import assert from "node:assert/strict";
import {applicationStateAt,attendance,latestAttendance,attendanceStageReady,reportWindowOpen,checkpointOutcome,cohorts,defaultFilters,filteredEvents,funnel,participation,summarize,type Dataset,type Event,type Meal} from "../src/analytics.ts";
const f={...defaultFilters,start:"2026-09-01"};
const meal:Meal={id:"m",title:"Meal",area:"Soho",language:"English",source:"user",hostId:"h",capacity:3,minimum:3,budget:25,startsAt:"2026-10-01T18:00:00Z",endsAt:"2026-10-01T20:00:00Z",publishedAt:"2026-09-20T10:00:00Z",cancelled:false,peakConfirmed:3};
const data:Dataset={users:["h","u","v"].map(id=>({id,joinedAt:"2026-09-01T10:00:00Z"})),meals:[meal],applications:[{id:"a1",userId:"u",mealId:"m",appliedAt:"2026-09-21T10:00:00Z",withdrawnAt:"2026-09-22T10:00:00Z"},{id:"a2",userId:"u",mealId:"m",appliedAt:"2026-09-23T10:00:00Z",decision:"approved",decidedAt:"2026-09-24T10:00:00Z",confirmedAt:"2026-09-24T10:00:00Z"}],attendance:[{userId:"u",mealId:"m",self:"present",host:"absent",updatedAt:"2026-10-02T10:00:00Z"}],feedback:[],events:[]};
test("R15 stage uses start +24h exactly, not end +24h; seven days remain separate",()=>{
 assert.equal(attendanceStageReady(meal,"2026-10-02T17:59:59Z"),false);assert.equal(attendanceStageReady(meal,"2026-10-02T18:00:00Z"),true);assert.equal(funnel(data,f,"2026-10-02T18:00:00Z").completed,2);assert.equal(funnel(data,f,"2026-10-02T20:00:00Z").stageWindowOpen,2);assert.equal(reportWindowOpen(meal,"2026-10-08T19:59:59Z"),true);assert.equal(reportWindowOpen(meal,"2026-10-08T20:00:00Z"),false);
});
test("R3/R8 self priority, source differences and reapplication rounds preserve one participation",()=>{
 const s=summarize(data,f);assert.equal(s.attendance.present,1);assert.equal(s.sourceDiffs,1);assert.equal(funnel(data,f).applications,2);assert.equal(participation(data).filter(p=>p.userId==="u").length,1);assert.equal(s.activation.numerator,1);
 const withdrawn={...data,applications:data.applications.map(a=>a.id==="a2"?{...a,withdrawnAt:meal.startsAt}:a)};assert.equal(participation(withdrawn).filter(p=>p.userId==="u").length,0);
 const history={...data,attendance:[{userId:"u",mealId:"m",self:"absent" as const,updatedAt:"2026-10-02T10:00:00Z",version:1},{userId:"u",mealId:"m",host:"present" as const,updatedAt:"2026-10-03T10:00:00Z",version:1}]};assert.equal(attendance(latestAttendance(history,"u","m")),"absent");
});
test("R16 multi-area requests, unknown dimensions and occurrence date do not invent attribution",()=>{
 const e:Event={id:"broad",name:"discovery_results",sessionId:"s",anonymousId:"anon",occurredAt:"2026-09-22T10:00:00Z",receivedAt:"2026-09-22T10:01:00Z",environment:"production",appVersion:"1",schemaVersion:1,resultCount:0};
 const requests={...data,events:[e,{...e,id:"ranged",request:{areas:["Soho","Camden"],dates:["2026-11-01"],budgetMin:20,budgetMax:35,sizes:[2,4],languages:["English","Chinese"],sources:["user"]}}]};
 assert.equal(filteredEvents(requests,f).length,2);assert.equal(filteredEvents(requests,{...f,area:"Camden",budget:"30-40"}).length,1);assert.equal(filteredEvents(requests,{...f,area:"Camden,Soho",budget:"20-30,30-40"}).length,1);assert.equal(filteredEvents(requests,{...f,area:"Fitzrovia"}).length,0);assert.equal(filteredEvents(requests,{...f,start:"2026-11-01",end:"2026-11-02"}).length,0);
});
test("R16 identity links are session scoped; classification removes linked test users without guessing others",()=>{
 const e:Event={id:"1",name:"discovery_results",sessionId:"s1",anonymousId:"same",occurredAt:"2026-09-22T10:00:00Z",receivedAt:"2026-09-22T10:01:00Z",environment:"production",appVersion:"1",schemaVersion:1,resultCount:1};
 const d={...data,users:data.users.map(u=>u.id==="u"?{...u,accountType:"test" as const}:u),events:[e,{...e,id:"2",sessionId:"s2"}],identityLinks:[{anonymousId:"same",sessionId:"s1",userId:"u"}]};assert.equal(filteredEvents(d,f).length,1);assert.equal(filteredEvents(d,{...f,segment:"new"}).length,0);
});
test("checkpoint facts retain both cancellation reasons and post-pass host decisions",()=>{
 const failed={...meal,cancelled:true,cancelReasons:["booking","insufficient"],checkpoint:{at:"2026-10-01T17:45:00Z",passed:false,count:2}};
 const d={...data,meals:[failed]};const sum=summarize(d,f);assert.equal(sum.checkpoint.both,1);assert.equal(sum.cancelReasons.booking,1);assert.equal(sum.cancelReasons.insufficient,1);assert.equal(sum.attendanceCoverage.denominator,0);
 const continued={...meal,minimum:3,checkpoint:{at:"2026-10-01T17:45:00Z",passed:true,count:2},lowCountDecision:"continue" as const};assert.equal(checkpointOutcome(data,continued).belowMinimumAfter,true);assert.equal(summarize({...data,meals:[continued]},f).lowCount.continued,1);
});
test("firsts are found in complete supplied history before cohort filters; late outcomes stay in correct cohorts",()=>{
 assert.equal(cohorts(data,{...f,start:"2026-10-03"}).length,0);assert.equal(summarize(data,{...f,end:"2026-09-30"},"2026-10-18T12:00:00Z").activation.numerator,1);
});

test("F5 pending uses selected asOf: exact review deadline and future facts do not leak",()=>{
 const a={id:"pending",userId:"u",mealId:"m",appliedAt:"2026-10-01T16:00:00Z",expired:true};
 assert.equal(applicationStateAt(a,meal,"2026-10-01T17:29:59Z"),"pending");
 assert.equal(applicationStateAt(a,meal,"2026-10-01T17:30:00Z"),"expired");
 assert.equal(applicationStateAt(a,meal,"2026-10-01T17:30:01Z"),"expired");
 assert.equal(applicationStateAt(a,meal,"2026-10-01T15:59:59Z"),"future");
 const reviewed={...a,decision:"approved" as const,decidedAt:"2026-10-01T17:20:00Z",confirmedAt:"2026-10-01T17:20:00Z",withdrawnAt:"2026-10-01T17:25:00Z"};
 assert.equal(applicationStateAt(reviewed,meal,"2026-10-01T17:19:59Z"),"pending");
 assert.equal(applicationStateAt(reviewed,meal,"2026-10-01T17:20:00Z"),"confirmed");
 assert.equal(applicationStateAt(reviewed,meal,"2026-10-01T17:25:00Z"),"withdrawn");
 const cancelled={...meal,cancelled:true,cancelledAt:"2026-10-01T17:00:00Z"};
 assert.equal(applicationStateAt(a,cancelled,"2026-10-01T16:59:59Z"),"pending");
 assert.equal(applicationStateAt(a,cancelled,"2026-10-01T17:00:00Z"),"expired");
 assert.equal(applicationStateAt(a,{...meal,cancelled:true},"2026-10-01T17:00:00Z"),"pending");
});
test("F6 pre-check cancellation needs a recorded and effective timestamp",()=>{
 const cancelled={...meal,cancelled:true,cancelledAt:"2026-10-01T16:00:00Z"};
 assert.equal(checkpointOutcome(data,cancelled,"2026-10-01T15:59:59Z").status,"not_reached");
 assert.equal(checkpointOutcome(data,cancelled,"2026-10-01T16:00:00Z").status,"cancelled_before");
 assert.equal(checkpointOutcome(data,{...cancelled,cancelledAt:undefined}).status,"missing");
 const s=summarize({...data,meals:[cancelled]},f);assert.equal(s.checkpoint.cancelledBefore,1);assert.equal(s.checkpoint.missing,0);
});
test("F2 pending low-count decision becomes unresolved history at start",()=>{
 const m={...meal,checkpoint:{at:"2026-10-01T17:45:00Z",passed:true,count:2},lowCountDecision:"pending" as const};
 const d={...data,meals:[m]};
 const before=summarize(d,f,"2026-10-01T17:59:59Z").lowCount;assert.equal(before.pending,1);assert.equal(before.unresolvedAtStart,0);
 const at=summarize(d,f,meal.startsAt).lowCount;assert.equal(at.pending,0);assert.equal(at.unresolvedAtStart,1);
 const after=summarize(d,f,"2026-10-02T18:00:00Z").lowCount;assert.equal(after.pending,0);assert.equal(after.unresolvedAtStart,1);
});

test("F5/F6 fixtures reconcile overdue applications and timestamped host cancellations",()=>{
 for(const id of ["A-59-0","A-60-0","A-61-0"]){const a=fixture.applications.find(a=>a.id===id)!;assert.ok(a,id);assert.equal(applicationStateAt(a,fixture.meals.find(m=>m.id===a.mealId)!),"expired");}
 const cancelled=fixture.meals.filter(m=>m.cancelReasons?.includes("host"));assert.equal(cancelled.length,3);for(const m of cancelled)assert.equal(checkpointOutcome(fixture,m).status,"cancelled_before");
 assert.equal(summarize(fixture,{...f,start:"2026-08-01"}).checkpoint.missing,0);
});
