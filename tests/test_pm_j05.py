"""J05 PM author checks: synthetic state/DOM, not browser/native/provider QA."""
from pathlib import Path
import hashlib
import json
import os
import shutil
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
DOC = ROOT / 'docs/product/journeys/j05'
DEMO = ROOT / 'demo/journeys/j05'

def node():
    for p in (os.environ.get('FANCY_PM_NODE'), str(ROOT.parent/'runtime/node/bin/node'), shutil.which('node')):
        if p and Path(p).exists():
            return p
    raise RuntimeError('Existing Node24/jsdom runtime required; not installed by this test')

class PMJ05Test(unittest.TestCase):
    def run_js(self, code):
        p = subprocess.run([node(),'--input-type=module','-e',code],cwd=ROOT,text=True,capture_output=True)
        self.assertEqual(p.returncode,0,p.stdout+p.stderr)

    def test_profile_preferences_conflict_clear_and_logout(self):
        self.run_js(r"""
import assert from 'node:assert/strict';import {initial,step as t} from './demo/journeys/j05/model.mjs';let s=initial();s=t(s,{type:'EDIT'});s=t(s,{type:'PROFILE_FIELD',key:'bio',value:'short'});s=t(s,{type:'SAVE_PROFILE'});assert.ok(s.error);assert.notEqual(s.profile.bio,'short');s=t(s,{type:'CANCEL'});assert.notEqual(s.profile.bio,'short');
s=t(s,{type:'PREFS'});s=t(s,{type:'PREF_FIELD',key:'budget',value:'25'});s=t(s,{type:'FAULT',value:'prefs-conflict'});s=t(s,{type:'SAVE_PREFS'});assert.equal(s.screen,'prefs-conflict');assert.equal(s.prefs.budget,45);assert.equal(s.prefsDraft.budget,'25');s=t(s,{type:'REVIEW_PREFS'});s=t(s,{type:'SAVE_PREFS'});assert.equal(s.prefs.budget,25);s=t(s,{type:'CLEAR_BUDGET'});s=t(s,{type:'QUERY_BUDGET'});assert.equal(s.clearBudget,true);assert.equal(s.aiHard.budget,undefined);let draft=s.editorDraft;s=t(s,{type:'DELETE_PREFS'});assert.equal(s.prefConfirmed,false);assert.deepEqual(s.aiHard,{});assert.equal(s.editorDraft,draft);s=t(s,{type:'SIGNOUT'});assert.equal(s.user,null);assert.equal(s.screen,'signedout');
""")

    def test_dom_edit_and_explicit_preference_recovery(self):
        self.run_js(r"""
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {JSDOM} from 'jsdom';const dom=new JSDOM(readFileSync('./demo/journeys/j05/index.html','utf8'),{runScripts:'dangerously'});const d=dom.window.document;const click=q=>{const e=d.querySelector(q);assert.ok(e,q);e.click();};const input=(id,v)=>{const e=d.getElementById(id);e.value=v;e.dispatchEvent(new dom.window.Event('input',{bubbles:true}));};const submit=id=>d.getElementById(id).dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
click('[data-e="EDIT"]');input('bio','A new introduction about meeting people through conversation and food.');submit('profile-form');assert.match(d.querySelector('#app').textContent,/new introduction/);click('[data-e="SETTINGS"]');click('[data-e="PREFS"]');input('budget','25');d.getElementById('fault').value='prefs-conflict';d.getElementById('fault').dispatchEvent(new dom.window.Event('change'));submit('prefs-form');assert.match(d.querySelector('#app').textContent,/Latest saved budget: £45/);click('[data-e="REVIEW_PREFS"]');submit('prefs-form');assert.match(d.querySelector('[role=status]').textContent,/saved after your confirmation/);click('[data-e="CLEAR_BUDGET"]');click('[data-e="QUERY_BUDGET"]');assert.match(d.querySelector('[role=status]').textContent,/still has any budget/);click('[data-e="DELETE_PREFS_CONFIRM"]');click('[data-e="DELETE_PREFS"]');assert.match(d.querySelector('[role=status]').textContent,/removed/);click('[data-e="SIGNOUT_CONFIRM"]');click('[data-e="SIGNOUT"]');assert.match(d.querySelector('#app').textContent,/visitor/);dom.window.close();
""")

    def test_coverage_exact_source_filter_and_artifact_hashes(self):
        ledger=json.loads((ROOT/'docs/product/requirements-traceability.json').read_text())
        expected={u['id'] for u in ledger['units'] if any(t['journey']=='J05' and t['version']=='IOS-0.1.0' for t in u['targets'])}
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
        self.assertIn('profile-form',html);self.assertIn('prefs-form',html)
        import re
        expected=(DEMO/'preview.template.html').read_text().replace(
            '<link rel="stylesheet" href="style.css">','<style>\n'+(DEMO/'style.css').read_text()+'\n</style>')
        expected=expected.replace('<script type="module" src="app.mjs"></script>',
            '<script>\n(()=>{\n'+re.sub(r'^export ', '', (DEMO/'model.mjs').read_text(), flags=re.M)+'\n'+
            re.sub(r'^import .+;\n', '', (DEMO/'app.mjs').read_text())+'\n})();\n</script>')
        self.assertEqual(html,expected)


if __name__=='__main__':unittest.main()
