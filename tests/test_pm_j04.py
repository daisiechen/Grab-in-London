"""Author evidence for J04 independent objects, partial saves, and consent boundaries."""
from pathlib import Path
import hashlib,json,shutil,subprocess,unittest
ROOT=Path(__file__).resolve().parents[1]
NODE=str(ROOT.parent/'runtime/node/bin/node') if (ROOT.parent/'runtime/node/bin/node').exists() else shutil.which('node')
class J04PMTest(unittest.TestCase):
 def node(self,code):
  r=subprocess.run([NODE,'--input-type=module','-e',code],cwd=ROOT,text=True,capture_output=True);self.assertEqual(r.returncode,0,r.stdout+r.stderr)
 def test_attendance_window_score_and_publication(self):
  self.node("""
import assert from 'node:assert/strict';import {createState,transition as t,attendance,windowOpen,eligible,published,END} from './demo/journeys/j04/model.mjs';let s=createState();assert.equal(attendance(s,'mia'),'unknown');s=t(s,{type:'ACTOR',id:'alex'});s=t(s,{type:'REPORT_HOST',subject:'mia',value:'absent'});assert.equal(attendance(s,'mia'),'absent');s=t(s,{type:'ACTOR',id:'mia'});s=t(s,{type:'REPORT_SELF',value:'present'});assert.equal(attendance(s,'mia'),'present');s=t(s,{type:'SCORE',value:4});s=t(s,{type:'SAVE_SCORE'});assert.equal(s.users.mia.score,4);assert.equal(Object.keys(s.reviews).length,0);s=t(s,{type:'OPEN_FEEDBACK'});s=t(s,{type:'BODY',value:'A lovely conversation with a thoughtful person.'});s=t(s,{type:'SAVE'});assert.equal(published(s,'mia','alex'),false);s=t(s,{type:'OTHER_REVIEW'});assert.equal(published(s,'mia','alex'),true);s=t(s,{type:'SUPPORT_ABSENT'});assert.equal(published(s,'mia','alex'),false);s=t(s,{type:'ADVANCE_7D'});assert.equal(windowOpen(s),false);let before=s.writes.attendance;s=t(s,{type:'REPORT_SELF',value:'present'});assert.equal(s.writes.attendance,before);let edge=createState();edge.now=END;assert.equal(windowOpen(edge),true);edge=t(edge,{type:'BEFORE_END'});assert.equal(windowOpen(edge),false);
""")
 def test_partial_failure_unknown_conflict_and_only_failed_retry(self):
  self.node("""
import assert from 'node:assert/strict';import {createState,transition as t} from './demo/journeys/j04/model.mjs';function base(){let s=t(createState(),{type:'REPORT_SELF',value:'present'});s=t(s,{type:'OPEN_FEEDBACK'});s=t(s,{type:'BODY',value:'A friendly and thoughtful dinner companion.'});s=t(s,{type:'SELECTED',value:true});return s;}
let s=t(base(),{type:'RECONNECT_FAULT',value:'failed'});s=t(s,{type:'SAVE'});assert.equal(s.writes.review,1);assert.equal(s.writes.reconnect,0);assert.equal(s.results['mia:alex'].reconnect,'failed');s=t(s,{type:'RETRY_FAILED'});assert.equal(s.writes.review,1);assert.equal(s.writes.reconnect,1);
let first=t(base(),{type:'REVIEW_FAULT',value:'failed'});first=t(first,{type:'SAVE'});assert.equal(first.writes.review,0);assert.equal(first.writes.reconnect,0);assert.equal(first.results['mia:alex'].reconnectMessage,'Not saved yet');first=t(first,{type:'RETRY_FAILED'});assert.equal(first.writes.review,1);assert.equal(first.writes.reconnect,1);
let unknown=t(base(),{type:'REVIEW_FAULT',value:'unknown'});unknown=t(unknown,{type:'SAVE'});assert.equal(unknown.writes.review,1);assert.equal(unknown.writes.reconnect,0);unknown=t(unknown,{type:'SAVE'});assert.match(unknown.error,/previous result/);unknown=t(unknown,{type:'CHECK_STATUS'});assert.equal(unknown.writes.review,1);assert.equal(unknown.writes.reconnect,1);
let conflict=t(base(),{type:'REVIEW_FAULT',value:'conflict'});conflict=t(conflict,{type:'SAVE'});assert.equal(conflict.results['mia:alex'].review,'conflict');assert.equal(conflict.writes.reconnect,0);conflict=t(conflict,{type:'CONFIRM_CONFLICT'});assert.equal(conflict.writes.review,1);assert.equal(conflict.writes.reconnect,1);
""")
 def test_confirmed_revocation_after_window_block_and_other_basis(self):
  self.node("""
import assert from 'node:assert/strict';import {createState,transition as t,connectionOpen} from './demo/journeys/j04/model.mjs';function linked(){let s=t(createState(),{type:'REPORT_SELF',value:'present'});s=t(s,{type:'OPEN_FEEDBACK'});s=t(s,{type:'SELECTED',value:true});s=t(s,{type:'SAVE'});s=t(s,{type:'OTHER_RECONNECT'});return s;}
let s=linked();assert.equal(connectionOpen(s),true);s=t(s,{type:'DM_DRAFT',value:'Fancy another meal next month?'});s=t(s,{type:'SEND_DM'});assert.equal(s.writes.message,1);s=t(s,{type:'BODY',value:'A thoughtful guest.'});s=t(s,{type:'SELECTED',value:false});s=t(s,{type:'SAVE'});assert.equal(s.confirm,'save-revoke');assert.equal(s.writes.review,0);s=t(s,{type:'CANCEL_CONFIRM'});assert.equal(s.writes.review,0);assert.equal(connectionOpen(s),true);
s=t(s,{type:'BODY',value:''});s=t(s,{type:'ADVANCE_7D'});s=t(s,{type:'SAVE'});assert.equal(s.confirm,'save-revoke');s=t(s,{type:'SAVE_REVOKE_YES'});assert.equal(connectionOpen(s),false);s=t(s,{type:'SEND_DM'});assert.match(s.error,/read-only/);assert.equal(s.writes.message,1);
let late=linked();late=t(late,{type:'BODY',value:'A reference changed after the window.'});late=t(late,{type:'SELECTED',value:false});late=t(late,{type:'ADVANCE_7D'});late=t(late,{type:'SAVE'});late=t(late,{type:'SAVE_REVOKE_YES'});assert.equal(late.results['mia:alex'].review,'failed');assert.equal(late.results['mia:alex'].reconnect,'pending');assert.equal(connectionOpen(late),true);late=t(late,{type:'REVOKE_REQUEST'});late=t(late,{type:'REVOKE_YES'});assert.equal(connectionOpen(late),false);
let blocked=linked();blocked=t(blocked,{type:'BLOCK_REQUEST'});blocked=t(blocked,{type:'BLOCK_YES'});blocked=t(blocked,{type:'UNBLOCK'});assert.equal(connectionOpen(blocked),false);
let other=linked();other=t(other,{type:'OTHER_BASIS'});other=t(other,{type:'SUPPORT_ABSENT'});assert.equal(connectionOpen(other),true);other=t(other,{type:'OTHER_BASIS'});assert.equal(connectionOpen(other),false);
""")
 def test_actual_dom_feedback_partial_retry_private_chat_and_withdraw(self):
  self.node("""
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {JSDOM} from 'jsdom';const dom=new JSDOM(readFileSync('demo/journeys/j04/index.html','utf8'),{runScripts:'dangerously',url:'file:///j04/index.html'});const d=dom.window.document;const click=s=>{const e=d.querySelector(s);assert.ok(e,s);e.click();};const input=(id,v)=>{const e=d.getElementById(id);assert.ok(e,id);if(e.type==='checkbox')e.checked=v;else e.value=v;e.dispatchEvent(new dom.window.Event('input',{bubbles:true}));};click('[data-action="REPORT_SELF"][data-value="present"]');input('score','4');click('[data-action="SAVE_SCORE"]');assert.match(d.querySelector('#notice').textContent,/private meal score/);click('[data-action="OPEN_FEEDBACK"]');input('reference','A great conversation and a welcoming table.');input('reconnect',true);click('[data-action="RECONNECT_FAULT"][data-value="failed"]');click('[data-action="SAVE"]');assert.match(d.querySelector('#app').textContent,/Reconnect choice could not be saved/);click('[data-action="RETRY_FAILED"]');click('[data-action="OTHER_RECONNECT"]');click('[data-action="OPEN_DM"]');input('dm-message','Would you like to meet again?');click('[data-action="SEND_DM"]');assert.match(d.querySelector('#app').textContent,/Would you like to meet again/);click('[data-action="REVOKE_REQUEST"]');click('[data-action="REVOKE_YES"]');assert.ok(!d.querySelector('#dm-message'));assert.match(d.querySelector('#app').textContent,/Read-only history/);dom.window.close();
""")
 def test_manifest_and_self_contained(self):
  html=(ROOT/'demo/journeys/j04/index.html').read_text();self.assertNotIn('<script src=',html);self.assertNotIn('fetch(',html)
  m=json.loads((ROOT/'docs/product/journeys/j04/artifact-manifest.json').read_text())
  for p,h in m['files'].items():self.assertEqual(hashlib.sha256((ROOT/p).read_bytes()).hexdigest(),h,p)
  self.assertEqual(m['stagesStarted'],{'PM':True,'UX':False,'RD':False,'QA':False})
if __name__=='__main__':unittest.main()
