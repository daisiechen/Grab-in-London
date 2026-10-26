"""J06 PM author checks: synthetic state/DOM, not browser/native/provider QA."""
from pathlib import Path
import hashlib
import json
import os
import shutil
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
DOC = ROOT / 'docs/product/journeys/j06'
DEMO = ROOT / 'demo/journeys/j06'

def node():
    for p in (os.environ.get('FANCY_PM_NODE'), str(ROOT.parent/'runtime/node/bin/node'), shutil.which('node')):
        if p and Path(p).exists():
            return p
    raise RuntimeError('Existing Node24/jsdom runtime required; not installed by this test')

class PMJ06Test(unittest.TestCase):
    def run_js(self, code):
        p = subprocess.run([node(),'--input-type=module','-e',code],cwd=ROOT,text=True,capture_output=True)
        self.assertEqual(p.returncode,0,p.stdout+p.stderr)

    def test_survey_null_reason_update_and_no_meal_gate(self):
        self.run_js(r"""
import assert from 'node:assert/strict';import {initial,step as t,REASONS} from './demo/journeys/j06/model.mjs';let s=initial();assert.equal(Object.keys(REASONS).length,7);s=t(s,{type:'OPEN'});assert.equal(s.again,null);s=t(s,{type:'SAVE'});assert.ok(s.error);assert.equal(s.saved,null);s=t(s,{type:'REASON',value:'company'});s=t(s,{type:'SAVE'});assert.equal(s.saved.again,null);assert.deepEqual(s.saved.reasons,['company']);assert.equal(s.saved.userId,'user-alex');assert.equal('mealId' in s.saved,false);let id=s.saved.userId;s=t(s,{type:'OPEN'});s=t(s,{type:'AGAIN',value:false});s=t(s,{type:'REASON',value:'company'});s=t(s,{type:'FAULT',value:'unused'});s=t(s,{type:'FAIL'});s=t(s,{type:'SAVE'});assert.ok(s.error);assert.equal(s.saved.again,null);assert.equal(s.again,false);s=t(s,{type:'SAVE'});assert.equal(s.saved.again,false);assert.deepEqual(s.saved.reasons,[]);assert.equal(s.saved.userId,id);assert.equal(s.version,2);s=t(s,{type:'ADVANCE'});s=t(s,{type:'OPEN'});s=t(s,{type:'AGAIN',value:null});s=t(s,{type:'REASON',value:'conversation'});s=t(s,{type:'SAVE'});assert.equal(s.saved.again,null);assert.equal(s.version,3);assert.equal(s.attended,false);assert.ok(s.daysAfterMeal>7);
""")

    def test_dom_submit_return_clear_and_failure_recovery(self):
        self.run_js(r"""
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {JSDOM} from 'jsdom';const dom=new JSDOM(readFileSync('./demo/journeys/j06/index.html','utf8'),{runScripts:'dangerously'});const d=dom.window.document;const click=q=>{const e=d.querySelector(q);assert.ok(e,q);e.click();};click('[data-e="OPEN"]');click('[data-e="SAVE"]');assert.match(d.querySelector('[role=alert]').textContent,/Choose/);click('[data-reason="conversation"]');click('[data-e="SAVE"]');assert.match(d.querySelector('#app').textContent,/Not answered/);click('[data-e="BACK"]');click('[data-e="OPEN"]');assert.equal(d.querySelector('[data-reason="conversation"]').checked,true);click('[data-e="YES"]');click('#fail');click('[data-e="SAVE"]');assert.match(d.querySelector('[role=alert]').textContent,/wasn’t saved/);click('[data-e="SAVE"]');assert.match(d.querySelector('#app').textContent,/Join again: Yes/);click('[data-e="OPEN"]');click('[data-e="CLEAR"]');click('[data-e="SAVE"]');assert.match(d.querySelector('#app').textContent,/Not answered/);assert.match(d.querySelector('#review-status').textContent,/出席 无/);dom.window.close();
""")

    def test_coverage_exact_source_filter_and_artifact_hashes(self):
        ledger=json.loads((ROOT/'docs/product/requirements-traceability.json').read_text())
        expected={u['id'] for u in ledger['units'] if any(t['journey']=='J06' and t['version']=='IOS-0.1.0' for t in u['targets'])}
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
        self.assertIn('Product survey',html);self.assertIn('Not answered',html)
        import re
        expected=(DEMO/'preview.template.html').read_text().replace(
            '<link rel="stylesheet" href="style.css">','<style>\n'+(DEMO/'style.css').read_text()+'\n</style>')
        expected=expected.replace('<script type="module" src="app.mjs"></script>',
            '<script>\n(()=>{\n'+re.sub(r'^export ', '', (DEMO/'model.mjs').read_text(), flags=re.M)+'\n'+
            re.sub(r'^import .+;\n', '', (DEMO/'app.mjs').read_text())+'\n})();\n</script>')
        self.assertEqual(html,expected)


if __name__=='__main__':unittest.main()
