"""J01 PM author checks: synthetic state/DOM, not browser/native/provider QA."""
from pathlib import Path
import hashlib
import json
import os
import shutil
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
DOC = ROOT / 'docs/product/journeys/j01'
DEMO = ROOT / 'demo/journeys/j01'

def node():
    for p in (os.environ.get('FANCY_PM_NODE'), str(ROOT.parent/'runtime/node/bin/node'), shutil.which('node')):
        if p and Path(p).exists():
            return p
    raise RuntimeError('Existing Node24/jsdom runtime required; not installed by this test')

class PMJ01Test(unittest.TestCase):
    def run_js(self, code):
        p = subprocess.run([node(),'--input-type=module','-e',code],cwd=ROOT,text=True,capture_output=True)
        self.assertEqual(p.returncode,0,p.stdout+p.stderr)

    def test_model_complete_application_and_ai_boundaries(self):
        self.run_js(r"""
import assert from 'node:assert/strict';import {initial,step as t,MEALS,otp,results} from './demo/journeys/j01/model.mjs';
let s=initial();s=t(s,{type:'VIEW',id:MEALS[0].id});s=t(s,{type:'APPLY'});assert.equal(s.screen,'account');
s=t(s,{type:'EMAIL'});s=t(s,{type:'EMAIL_INPUT',value:'new@example.test'});s=t(s,{type:'REQUEST'});s=t(s,{type:'CODE',value:otp(s)});s=t(s,{type:'VERIFY'});assert.equal(s.screen,'profile');
for(const [key,value] of Object.entries({name:'Alex',bio:'I enjoy meeting people over food and thoughtful conversation.',status:'new',language:'en',interest:'Books',adult:true,community:true}))s=t(s,{type:'PROFILE_FIELD',key,value});
s=t(s,{type:'SAVE_PROFILE'});assert.equal(s.screen,'apply');assert.equal(s.selected,MEALS[0].id);assert.equal(s.businessWrites,0);
s=t(s,{type:'MESSAGE',value:'Hello, I would enjoy joining this table and hearing everyone’s stories.'});s=t(s,{type:'CONSENT',value:true});s=t(s,{type:'SUBMIT'});assert.equal(s.application.status,'PENDING');assert.equal(s.businessWrites,1);s=t(s,{type:'SUBMIT'});assert.equal(s.businessWrites,1);
s=t(s,{type:'VIEW',id:MEALS[1].id});assert.equal(s.application,null);assert.equal(s.message,'');s=t(s,{type:'VIEW',id:MEALS[0].id});assert.equal(s.application.status,'PENDING');
s=t(s,{type:'WITHDRAW'});assert.equal(s.application.status,'WITHDRAWN');s=t(s,{type:'REAPPLY'});s=t(s,{type:'FAULT',value:'unknown'});s=t(s,{type:'SUBMIT'});assert.equal(s.screen,'unknown');let id=s.application.id;s=t(s,{type:'CHECK_STATUS'});assert.equal(s.application.id,id);assert.equal(s.round,2);
let ai=initial();ai=t(ai,{type:'AI_CONSENT',value:true});ai=t(ai,{type:'AI_INPUT',value:'周五Soho £35 4人'});ai=t(ai,{type:'AI_ASK'});assert.deepEqual(ai.aiIds,[MEALS[0].id]);assert.equal(ai.businessWrites,0);ai=t(ai,{type:'AI_INPUT',value:'any budget'});ai=t(ai,{type:'AI_ASK'});assert.equal(ai.aiIds.length,2);ai=t(ai,{type:'AI_INPUT',value:'Friday Soho'});ai=t(ai,{type:'AI_ASK'});assert.equal(ai.aiIds.length,2);
ai=t(ai,{type:'VIEW',id:MEALS[0].id});ai=t(ai,{type:'AI_DRAFT'});ai=t(ai,{type:'MESSAGE',value:'My existing manual introduction.'});ai=t(ai,{type:'AI_TRANSFER'});assert.equal(ai.replacePrompt,true);assert.equal(ai.message,'My existing manual introduction.');ai=t(ai,{type:'KEEP_TEXT'});assert.equal(ai.message,'My existing manual introduction.');assert.equal(ai.businessWrites,0);
ai=t(ai,{type:'FULL',value:true});ai=t(ai,{type:'AI_TRANSFER',replace:true});assert.equal(ai.message,'My existing manual introduction.');assert.match(ai.aiReply,/changed/);
let social=t(initial(),{type:'VIEW',id:MEALS[0].id});social=t(social,{type:'APPLY'});social=t(social,{type:'OAUTH',provider:'Google'});social=t(social,{type:'CANCEL_AUTH'});assert.equal(social.screen,'detail');assert.equal(social.account,'guest');social=t(social,{type:'EXISTING',value:true});social=t(social,{type:'OAUTH',provider:'Apple'});social=t(social,{type:'OAUTH_CONTINUE'});assert.equal(social.screen,'apply');assert.equal(social.businessWrites,0);
let code=t(t(t(initial(),{type:'EMAIL'}),{type:'EMAIL_INPUT',value:'a@example.test'}),{type:'REQUEST'});code=t(code,{type:'ADVANCE',seconds:300});code=t(code,{type:'CODE',value:otp(code)});assert.match(t(code,{type:'VERIFY'}).error,/expired/);
for(const m of MEALS){assert.ok(m.cuisine===null||['EUROPEAN','JAPANESE','SPANISH','CHINESE'].includes(m.cuisine));assert.ok(m.diet===null||['VEGETARIAN_OPTIONS','VEGAN'].includes(m.diet));}assert.equal(results(initial(),{diet:'VEGAN'}).length,0);
""")

    def test_dom_natural_journey_to_pending_and_withdrawal(self):
        self.run_js(r"""
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {JSDOM} from 'jsdom';const dom=new JSDOM(readFileSync('./demo/journeys/j01/index.html','utf8'),{runScripts:'dangerously'});const d=dom.window.document;
const click=q=>{const e=d.querySelector(q);assert.ok(e,q);e.click();};const input=(id,v,check=false)=>{const e=d.getElementById(id);assert.ok(e,id);if(check)e.checked=v;else e.value=v;e.dispatchEvent(new dom.window.Event(check?'change':'input',{bubbles:true}));};const submit=id=>d.getElementById(id).dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
click('[data-event="FILTER"]');click('[data-event="DATE"]');click('[data-event="CANCEL_FILTER"]');assert.match(d.querySelector('#app').textContent,/3 meals/);
click('[data-event="VIEW"]');click('[data-event="APPLY"]');click('[data-event="EMAIL"]');input('email','new@example.test');submit('email-form');input('code','000000');submit('code-form');assert.match(d.querySelector('[role=alert]').textContent,/doesn’t match/);input('code','123456');submit('code-form');assert.ok(d.getElementById('profile-form'));
for(const [k,v] of Object.entries({name:'Alex',bio:'I enjoy food, books and meeting new people over a relaxed meal.',status:'new',language:'en',interest:'Books'}))input(k,v);input('adult',true,true);input('community',true,true);submit('profile-form');assert.ok(d.getElementById('apply-form'));
input('message','Hello, I would enjoy a relaxed meal and meeting everyone at this table.');input('consent',true,true);submit('apply-form');assert.match(d.querySelector('#app').textContent,/Waiting for the host/);click('[data-event="WITHDRAW_CONFIRM"]');click('[data-event="WITHDRAW"]');assert.match(d.querySelector('#app').textContent,/Application withdrawn/);click('[data-event="REAPPLY"]');assert.ok(d.getElementById('apply-form'));
dom.window.close();
""")

    def test_coverage_exact_source_filter_and_artifact_hashes(self):
        ledger=json.loads((ROOT/'docs/product/requirements-traceability.json').read_text())
        expected={u['id'] for u in ledger['units'] if any(t['journey']=='J01' and t['version']=='IOS-0.1.0' for t in u['targets'])}
        coverage=json.loads((DOC/'coverage.json').read_text());actual={r['sourceUnitId'] for r in coverage['sourceUnits']}
        self.assertEqual(actual,expected)
        prd=(DOC/'requirements.zh-CN.md').read_text()
        for row in coverage['sourceUnits']:
            self.assertIn('id="'+row['prdSection']+'"',prd)
            self.assertTrue(row['reason'])
        manifest=json.loads((DOC/'artifact-manifest.json').read_text())
        for path,sha in manifest['files'].items():self.assertEqual(hashlib.sha256((ROOT/path).read_bytes()).hexdigest(),sha)
        self.assertEqual(manifest['stagesStarted'],{'PM':True,'UX':False,'RD':False,'QA':False})

    def test_self_contained_preview_has_no_runtime_network_or_storage(self):
        html=(DEMO/'index.html').read_text()
        for forbidden in ('type="module"','fetch(','XMLHttpRequest','localStorage','sessionStorage','https://'):
            self.assertNotIn(forbidden,html)
        self.assertIn('profile-form',html);self.assertIn('apply-form',html)
        import re
        expected=(DEMO/'preview.template.html').read_text().replace(
            '<link rel="stylesheet" href="style.css">','<style>\n'+(DEMO/'style.css').read_text()+'\n</style>')
        expected=expected.replace('<script type="module" src="app.mjs"></script>',
            '<script>\n(()=>{\n'+re.sub(r'^export ', '', (DEMO/'model.mjs').read_text(), flags=re.M)+'\n'+
            re.sub(r'^import .+;\n', '', (DEMO/'app.mjs').read_text())+'\n})();\n</script>')
        self.assertEqual(html,expected)


if __name__=='__main__':unittest.main()
