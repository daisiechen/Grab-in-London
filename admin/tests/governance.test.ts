import {test} from "node:test";
import assert from "node:assert/strict";
import {createFixture} from "../src/fixtures.ts";
import {actions,accountVersion,advanceReport,buildSnapshot,can,classifyAccount,createStore,founder,importHandoff,outsider,pendingWrites,reportFixtures} from "../src/governance.ts";
import {summarize,defaultFilters} from "../src/analytics.ts";
const full={...defaultFilters,start:"2026-07-21"};
test("all actions reject non-allowlisted stable IDs, including exports and audit",()=>{
 for(const action of actions) assert.equal(can(outsider,action),false);
 const store=createStore(createFixture(),reportFixtures);
 assert.throws(()=>classifyAccount(store,outsider,{userId:"U-001",to:"test",reason:"Testing",expectedVersion:0}),/classify_account/);
 assert.throws(()=>advanceReport(store,outsider,{id:"CASE-001",basis:"Reviewed",expectedVersion:1}),/handle_report/);
 assert.throws(()=>importHandoff(store,outsider,{data:store.data,asOf:store.asOf,contractVersion:"r1-1"}),/rebuild_snapshot/);
 assert.equal(store.version,0);assert.equal(store.audit.length,0);
});
test("classification requires reason and expected version; conflict does not mutate store",()=>{
 const original=createStore(createFixture());
 assert.throws(()=>classifyAccount(original,founder,{userId:"U-001",to:"test",reason:"",expectedVersion:0}));
 const store=classifyAccount(original,founder,{userId:"U-001",to:"test",reason:"Acceptance fixture",expectedVersion:0});
 assert.equal(accountVersion(store,"U-001"),1);assert.equal(store.audit[0].actorId,founder.id);assert.equal(store.audit[0].from,"regular");assert.equal(store.audit[0].reason,"Acceptance fixture");
 assert.throws(()=>classifyAccount(store,founder,{userId:"U-001",to:"regular",reason:"Restore",expectedVersion:0}));assert.equal(store.version,1);assert.equal(original.data.users[0].accountType,undefined);
 const restored=classifyAccount(store,founder,{userId:"U-001",to:"regular",reason:"Restore",expectedVersion:1});assert.equal(accountVersion(restored,"U-001"),2);
});
test("old snapshots retain data and reproducible metrics before and after classification/build/import",()=>{
 const store=createStore(createFixture()),first=buildSnapshot(store,[]),before=JSON.stringify(summarize(first.data,full,first.asOf));
 const changed=classifyAccount(store,founder,{userId:"U-001",to:"test",reason:"Fixture",expectedVersion:0});assert.equal(pendingWrites(changed,first).length,1);
 const next=buildSnapshot(changed,[first]);assert.notEqual(next.id,first.id);assert.notEqual(JSON.stringify(summarize(next.data,full,next.asOf)),before);assert.equal(JSON.stringify(summarize(first.data,full,first.asOf)),before);assert.throws(()=>{first.data.users[0].accountType="staff";});
 const imported=importHandoff(changed,founder,{data:createFixture(),asOf:store.asOf,contractVersion:"r1-1"});assert.equal(imported.data.users[0].accountType,"test");assert.equal(imported.audit.at(-1)?.action,"import_handoff");assert.equal(JSON.stringify(summarize(first.data,full,first.asOf)),before);
});
test("on-demand report receipt transitions are versioned, basis required, resolved is terminal",()=>{
 let store=createStore(createFixture(),reportFixtures);
 assert.throws(()=>advanceReport(store,founder,{id:"CASE-001",basis:"",expectedVersion:1}));
 store=advanceReport(store,founder,{id:"CASE-001",basis:"Receipt reviewed; no automatic decision",expectedVersion:1});assert.equal(store.reports[0].status,"in_progress");assert.equal(store.reports[0].version,2);
 assert.throws(()=>advanceReport(store,founder,{id:"CASE-001",basis:"Done",expectedVersion:1}));
 store=advanceReport(store,founder,{id:"CASE-001",basis:"Case-specific action recorded",expectedVersion:2});assert.equal(store.reports[0].status,"resolved");assert.equal(store.audit.length,2);assert.throws(()=>advanceReport(store,founder,{id:"CASE-001",basis:"Again",expectedVersion:3}));
});
