"""PM author evidence for J02. Synthetic state/DOM checks, not production QA."""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import unittest
ROOT=Path(__file__).resolve().parents[1]
NODE=str(ROOT.parent/'runtime/node/bin/node') if (ROOT.parent/'runtime/node/bin/node').exists() else shutil.which('node')
class J02PMTest(unittest.TestCase):
 def node(self,code):
  r=subprocess.run([NODE,'--input-type=module','-e',code],cwd=ROOT,text=True,capture_output=True)
  self.assertEqual(r.returncode,0,r.stdout+r.stderr)
 def test_publish_approval_lock_cancel_and_lifecycle(self):
  self.node("""
import assert from 'node:assert/strict';import {createState,transition as t,londonChoices,getStart,validate} from './demo/journeys/j02/model.mjs';
assert.equal(londonChoices('2026-10-25','01:30').length,2);assert.equal(londonChoices('2027-03-28','01:30').length,0);
let s=t(createState(),{type:'EXISTING_HOST'});s=t(s,{type:'VENUE',id:'sample-place-soho-01'});assert.equal(s.draft.time,'');s=t(s,{type:'FIELD',key:'time',value:'19:00'});assert.equal(validate(s,0),'');s=t(s,{type:'FIELD',key:'booking',value:true});s=t(s,{type:'FIELD',key:'review',value:true});s=t(s,{type:'PUBLISH'});assert.equal(s.publicationCount,1);s=t(s,{type:'PUBLISH'});assert.equal(s.publicationCount,1);
s=t(s,{type:'ADD_APPLICANTS'});s=t(s,{type:'DECIDE',id:'mia',decision:'CONFIRMED'});assert.equal(s.meal.confirmed,2);assert.equal(s.meal.locked,true);assert.equal(s.meal.bookingStale,true);const draft=s.draft.capacity;s=t(s,{type:'FIELD',key:'capacity',value:6});assert.equal(s.draft.capacity,draft);assert.match(s.error,/locked/);
s=t(s,{type:'DECIDE',id:'mia',decision:'CONFIRMED'});assert.equal(s.meal.confirmed,2);s=t(s,{type:'DECIDE',id:'noah',decision:'CONFIRMED'});s=t(s,{type:'DECIDE',id:'leo',decision:'CONFIRMED'});s=t(s,{type:'DECIDE',id:'ava',decision:'CONFIRMED'});assert.equal(s.meal.confirmed,4);assert.match(s.error,/last seat/);s=t(s,{type:'DECLARE'});assert.equal(s.meal.bookingCount,4);assert.equal(s.meal.bookingStale,false);
let cancel=t(s,{type:'CANCEL_REQUEST'});cancel=t(cancel,{type:'CANCEL_NO'});assert.equal(cancel.meal.status,'OPEN');cancel=t(cancel,{type:'CANCEL_REQUEST'});cancel=t(cancel,{type:'CANCEL_YES',reason:'booking'});assert.equal(cancel.meal.status,'CANCELLED');assert.equal(cancel.meal.cancelReason,'booking');
let minimum=structuredClone(s);minimum=t(minimum,{type:'ADVANCE_CLOSE'});assert.equal(minimum.meal.status,'OPEN');minimum=t(minimum,{type:'GUEST_LEAVE'});minimum=t(minimum,{type:'GUEST_LEAVE'});assert.equal(minimum.meal.status,'CANCELLED');assert.equal(minimum.meal.cancelReason,'insufficient');
let insufficient=structuredClone(s);insufficient.meal.confirmed=1;insufficient=t(insufficient,{type:'ADVANCE_CLOSE'});assert.equal(insufficient.meal.status,'CANCELLED');assert.equal(insufficient.applications.find(a=>a.id==='ava').status,'EXPIRED');
let started=t(s,{type:'ADVANCE_START'});started=t(started,{type:'CANCEL_REQUEST'});assert.match(started.error,/already started/);
""")
 def test_failure_preserves_draft_and_ai_never_publishes(self):
  self.node("""
import assert from 'node:assert/strict';import {createState,transition as t} from './demo/journeys/j02/model.mjs';let s=t(createState(),{type:'EXISTING_HOST'});s=t(s,{type:'VENUE',id:'sample-place-soho-01'});s=t(s,{type:'FIELD',key:'time',value:'19:00'});s=t(s,{type:'FIELD',key:'booking',value:true});s=t(s,{type:'FIELD',key:'review',value:true});s=t(s,{type:'FAIL_NEXT',value:'publish'});s=t(s,{type:'PUBLISH'});assert.equal(s.publicationCount,0);assert.match(s.error,/failed/);assert.equal(s.draft.title,'A relaxed Friday supper');s=t(s,{type:'FAIL_NEXT',value:'unknown'});s=t(s,{type:'PUBLISH'});assert.equal(s.publicationCount,0);s=t(s,{type:'CHECK_PUBLICATION'});assert.equal(s.publicationCount,1);
let ai=t(createState(),{type:'AI_GENERATE'});assert.equal(ai.meal,null);let original=ai.draft.description;ai=t(ai,{type:'AI_TRANSFER'});assert.equal(ai.draft.description,original);ai=t(ai,{type:'CANCEL_NO'});assert.equal(ai.draft.description,original);ai=t(ai,{type:'AI_TRANSFER'});ai=t(ai,{type:'AI_REPLACE'});assert.equal(ai.draft.description,ai.aiDraft);assert.equal(ai.publicationCount,0);
""")
 def test_actual_dom_four_steps_and_approval(self):
  self.node("""
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {JSDOM} from 'jsdom';const dom=new JSDOM(readFileSync('demo/journeys/j02/index.html','utf8'),{runScripts:'dangerously',url:'file:///j02/index.html'});const d=dom.window.document;const click=s=>{const e=d.querySelector(s);assert.ok(e,s);e.click();};const fill=(s,v)=>{const e=d.querySelector(s);assert.ok(e,s);if(e.type==='checkbox')e.checked=v;else e.value=v;e.dispatchEvent(new dom.window.Event('input',{bubbles:true}));e.dispatchEvent(new dom.window.Event('change',{bubbles:true}));};
click('[data-action="EXISTING_HOST"]');fill('#query','Soho');click('[data-action="SEARCH"]');click('[data-action="VENUE"]');fill('#time','19:00');click('[data-action="NEXT"]');assert.ok(d.querySelector('#description'));click('[data-action="AI_GENERATE"]');click('[data-action="AI_TRANSFER"]');click('[data-action="CANCEL_NO"]');click('[data-action="NEXT"]');fill('#booking',true);click('[data-action="NEXT"]');click('[data-action="TERMS"]');assert.match(d.querySelector('.dialog').textContent,/minimum/);click('[data-action="CLOSE_TERMS"]');fill('#review',true);click('[data-action="PUBLISH"]');assert.match(d.querySelector('#app').textContent,/published/);click('[data-action="ADD_APPLICANTS"]');click('[data-action="DECIDE"][data-id="mia"][data-decision="CONFIRMED"]');assert.match(d.querySelector('#app').textContent,/2\/4 confirmed/);click('[data-action="EDIT"]');assert.match(d.querySelector('#error').textContent,/locked/);dom.window.close();
""")
 def test_self_contained_manifest_and_scope(self):
  html=(ROOT/'demo/journeys/j02/index.html').read_text()
  self.assertNotIn('<script src=',html);self.assertNotIn('fetch(',html)
  m=json.loads((ROOT/'docs/product/journeys/j02/artifact-manifest.json').read_text())
  for path,digest in m['files'].items():self.assertEqual(hashlib.sha256((ROOT/path).read_bytes()).hexdigest(),digest,path)
  self.assertEqual(m['stagesStarted'],{'PM':True,'UX':False,'RD':False,'QA':False})
if __name__=='__main__':unittest.main()
