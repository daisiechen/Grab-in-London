"""Synthetic author checks for J03, including real DOM events and history boundaries."""
from pathlib import Path
import hashlib,json,shutil,subprocess,unittest
ROOT=Path(__file__).resolve().parents[1]
NODE=str(ROOT.parent/'runtime/node/bin/node') if (ROOT.parent/'runtime/node/bin/node').exists() else shutil.which('node')
class J03PMTest(unittest.TestCase):
 def node(self,code):
  r=subprocess.run([NODE,'--input-type=module','-e',code],cwd=ROOT,text=True,capture_output=True);self.assertEqual(r.returncode,0,r.stdout+r.stderr)
 def test_seat_group_gap_and_dissolve_are_separate(self):
  self.node("""
import assert from 'node:assert/strict';import {createState,transition as t,active,visibleMessages} from './demo/journeys/j03/model.mjs';let s=createState();s=t(s,{type:'LEAVE_SEAT_REQUEST'});s=t(s,{type:'LEAVE_SEAT_YES'});assert.equal(s.users.mia.seat,'CANCELLED');assert.equal(active(s),true);s=t(s,{type:'LEAVE_GROUP_REQUEST'});s=t(s,{type:'LEAVE_GROUP_YES'});assert.equal(s.screen,'settings');assert.equal(active(s),false);assert.equal(s.users.mia.seat,'CANCELLED');let before=visibleMessages(s).length;s=t(s,{type:'OTHER_MESSAGE',body:'PRIVATE GAP'});assert.equal(visibleMessages(s).length,before);s=t(s,{type:'REAPPLY'});assert.equal(active(s),false);s=t(s,{type:'APPROVE_CURRENT'});assert.equal(active(s),true);s=t(s,{type:'OTHER_MESSAGE',body:'AFTER JOIN'});assert.ok(visibleMessages(s).some(m=>m.body==='AFTER JOIN'));assert.ok(!visibleMessages(s).some(m=>m.body==='PRIVATE GAP'));
s=t(s,{type:'DISSOLVE_REQUEST'});assert.match(s.error,/Only the host/);s=t(s,{type:'ACTOR',id:'alex'});s=t(s,{type:'DISSOLVE_REQUEST'});s=t(s,{type:'DISSOLVE_YES'});assert.equal(s.dissolved,true);assert.equal(s.users.mia.seat,'CONFIRMED');assert.equal(active(s,'mia'),false);assert.ok(visibleMessages(s,'mia').length>0);
""")
 def test_drafts_unread_notifications_and_ai_authorization(self):
  self.node("""
import assert from 'node:assert/strict';import {createState,transition as t,unread,active} from './demo/journeys/j03/model.mjs';let s=createState();assert.equal(unread(s),1);s=t(s,{type:'OPEN_CHAT'});s=t(s,{type:'VISIBLE'});assert.equal(unread(s),0);assert.equal(s.notifications[0].read,false);s=t(s,{type:'READ_NOTICE',id:'n1'});assert.equal(s.notifications[0].read,true);s=t(s,{type:'OLDER'});s=t(s,{type:'OTHER_MESSAGE'});s=t(s,{type:'VISIBLE'});assert.equal(unread(s),1);
s=t(s,{type:'DRAFT',value:'I will meet you there.'});s=t(s,{type:'OFFLINE'});s=t(s,{type:'SEND'});assert.equal(s.users.mia.draft,'I will meet you there.');assert.equal(s.sends,0);s=t(s,{type:'OFFLINE'});s=t(s,{type:'SEND'});assert.equal(s.sends,1);s=t(s,{type:'SEND'});assert.equal(s.sends,1);
s=t(s,{type:'AI_GENERATE'});s=t(s,{type:'AI_TRANSFER'});assert.equal(s.sends,1);s=t(s,{type:'AI_REPLACE'});assert.equal(s.users.mia.draft,s.aiDraft);s=t(s,{type:'LEAVE_GROUP_REQUEST'});s=t(s,{type:'LEAVE_GROUP_YES'});s=t(s,{type:'AI_TRANSFER'});assert.match(s.error,/access changed/);s=t(s,{type:'SEND'});assert.match(s.error,/read-only/);assert.equal(s.sends,1);
let meal=t(createState(),{type:'MEAL_CANCELLED'});assert.equal(active(meal),true);meal=t(meal,{type:'MEAL_ENDED'});assert.equal(active(meal),true);let pending=t(createState(),{type:'ACTOR',id:'sam'});pending=t(pending,{type:'OPEN_CHAT'});assert.match(pending.error,/pending/);
""")
 def test_actual_dom_message_failure_and_exit(self):
  self.node("""
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {JSDOM} from 'jsdom';const dom=new JSDOM(readFileSync('demo/journeys/j03/index.html','utf8'),{runScripts:'dangerously',url:'file:///j03/index.html'});const d=dom.window.document;const click=s=>{const e=d.querySelector(s);assert.ok(e,s);e.click();};const input=v=>{const e=d.querySelector('#message');assert.ok(e);e.value=v;e.dispatchEvent(new dom.window.Event('input',{bubbles:true}));};click('[data-action="OPEN_CHAT"]');input('See you at seven!');click('[data-action="OFFLINE"]');click('[data-action="SEND"]');assert.match(d.querySelector('#error').textContent,/not sent/);assert.equal(d.querySelector('#message').value,'See you at seven!');click('[data-action="OFFLINE"]');click('[data-action="SEND"]');assert.match(d.querySelector('#app').textContent,/See you at seven/);click('[data-action="OPEN_SETTINGS"]');click('[data-action="LEAVE_GROUP_REQUEST"]');click('[data-action="LEAVE_GROUP_YES"]');assert.match(d.querySelector('#app').textContent,/Left group/);assert.ok(!d.querySelector('#app').textContent.includes('Current group members'));click('[data-action="CLOSE_SETTINGS"]');assert.ok(!d.querySelector('#message'));assert.match(d.querySelector('#app').textContent,/See you at seven/);dom.window.close();
""")
 def test_manifest_and_no_external_dependency(self):
  html=(ROOT/'demo/journeys/j03/index.html').read_text();self.assertNotIn('<script src=',html);self.assertNotIn('fetch(',html)
  m=json.loads((ROOT/'docs/product/journeys/j03/artifact-manifest.json').read_text())
  for p,h in m['files'].items():self.assertEqual(hashlib.sha256((ROOT/p).read_bytes()).hexdigest(),h,p)
  self.assertFalse(m['stagesStarted']['UX']);self.assertFalse(m['stagesStarted']['RD']);self.assertFalse(m['stagesStarted']['QA'])
if __name__=='__main__':unittest.main()
