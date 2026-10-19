import {test} from "node:test";
import assert from "node:assert/strict";
import {summarize,defaultFilters} from "../src/analytics.ts";
import {parseHandoff,MAX_HANDOFF_BYTES} from "../src/handoff.ts";
import {pilotSeed,projectAnalytics} from "../../shared/pilot.ts";
export const payload=()=>({contractVersion:"r1-1",demo:true,asOf:"2026-10-03T12:00:00.000Z",users:[{id:"h",joinedAt:"2026-09-01T10:00:00.000Z"},{id:"u",joinedAt:"2026-09-01T10:00:00.000Z"}],meals:[{id:"m",title:"Meal m",hostId:"h",startsAt:"2026-10-01T18:00:00.000Z",endsAt:"2026-10-01T20:00:00.000Z",publishedAt:"2026-09-20T10:00:00.000Z",area:"Soho",language:"English",capacity:2,minimum:2,budget:30,source:"user",cancelled:false,peakConfirmed:2,checkpoint:{at:"2026-10-01T17:45:00.000Z",passed:true,count:2}}],applications:[{id:"a",userId:"u",mealId:"m",appliedAt:"2026-09-21T10:00:00.000Z",decidedAt:"2026-09-22T10:00:00.000Z",decision:"approved",confirmedAt:"2026-09-22T10:00:00.000Z",expired:false}],attendance:[{userId:"u",mealId:"m",host:"absent",self:"present",updatedAt:"2026-10-02T10:00:00.000Z"}],feedback:[{userId:"u",mealId:"m",score:4,again:true,reasons:["company"],at:"2026-10-02T11:00:00.000Z",issue:"none"}],events:[]});
test("real shared App export roundtrips through strict admin parser",()=>{ const exported=projectAnalytics(pilotSeed()); const handoff=parseHandoff(JSON.stringify(exported));assert.equal(handoff.data.meals.length,exported.meals.length);assert.equal(handoff.data.users.length,exported.users.length); assert.ok(summarize(handoff.data,{...defaultFilters,start:"2026-09-01",end:"2026-10-19"},handoff.asOf).attendance.present > 0, "ordinary demo attendees must remain in the analytics scope"); });
test("handoff accepts complete sanitized projection, preserves self priority, rejects production and unsupported versions",()=>{
 const d=parseHandoff(JSON.stringify(payload()));assert.equal(d.data.attendance[0].self,"present");assert.throws(()=>parseHandoff(JSON.stringify({...payload(),demo:false})));assert.throws(()=>parseHandoff(JSON.stringify({...payload(),contractVersion:"unknown"})));
});
test("forbidden private fields including verified, messages, report body and unilateral choices never enter analytics",()=>{
 for(const key of ["messages","reports","reconnect","email"]) assert.throws(()=>parseHandoff(JSON.stringify({...payload(),[key]:[]})),/not allowed/);
 const p=payload();assert.throws(()=>parseHandoff(JSON.stringify({...p,attendance:[{...p.attendance[0],verified:"present"}]})),/not allowed/);assert.throws(()=>parseHandoff(JSON.stringify({...p,users:[{...p.users[0],email:"test@example.com"}]})),/not allowed/);
});
test("size, shape, duplicates, relationships, classification and time window errors are rejected",()=>{
 assert.throws(()=>parseHandoff(" ".repeat(MAX_HANDOFF_BYTES+1)));assert.throws(()=>parseHandoff("[]"));const p=payload();
 assert.throws(()=>parseHandoff(JSON.stringify({...p,users:[...p.users,p.users[0]]})),/duplicate/);
 assert.throws(()=>parseHandoff(JSON.stringify({...p,applications:[{...p.applications[0],userId:"missing"}]})),/relation/);
 assert.throws(()=>parseHandoff(JSON.stringify({...p,users:[{...p.users[0],accountType:"admin"},p.users[1]]})),/accountType/);
 assert.throws(()=>parseHandoff(JSON.stringify({...p,applications:[{...p.applications[0],appliedAt:"2026-10-01T17:15:00.000Z"}]})),/cutoff/);
 assert.throws(()=>parseHandoff(JSON.stringify({...p,meals:[{...p.meals[0],startsAt:"2026-02-30T18:00:00.000Z"}]})),/startsAt/);
 assert.throws(()=>parseHandoff(JSON.stringify({...p,asOf:"2026-10-10T12:00:00.000Z",attendance:[{...p.attendance[0],updatedAt:"2026-10-08T20:00:00.000Z"}]})),/window/);
 assert.throws(()=>parseHandoff(JSON.stringify({...p,applications:[{...p.applications[0],withdrawnAt:p.meals[0].startsAt}]})),/ineligible/);
});

test("R1 forbids account classification in import, rejection re-entry, overlapping rounds and overbooking",()=>{
 const p=payload();
 assert.throws(()=>parseHandoff(JSON.stringify({...p,users:[{...p.users[0],accountType:"regular"},p.users[1]]})),/not allowed/);
 const rejected={...p.applications[0],id:"x1",decision:"declined",confirmedAt:undefined};
 const second={...p.applications[0],id:"x2",appliedAt:"2026-09-23T10:00:00.000Z",decidedAt:"2026-09-24T10:00:00.000Z",confirmedAt:"2026-09-24T10:00:00.000Z"};
 assert.throws(()=>parseHandoff(JSON.stringify({...p,applications:[rejected,second]})),/after decline/);
 assert.throws(()=>parseHandoff(JSON.stringify({...p,applications:[p.applications[0],second]})),/overlapping/);
 const overbooked={...p,users:[...p.users,{id:"v",joinedAt:p.users[0].joinedAt}],applications:[p.applications[0],{...p.applications[0],id:"v1",userId:"v"}]};
 assert.throws(()=>parseHandoff(JSON.stringify(overbooked)),/capacity/);
});
