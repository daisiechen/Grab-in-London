"""PM author checks for the isolated M01-01 preview; not native or provider QA."""
from pathlib import Path
import json
import os
import shutil
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
DEMO = ROOT / 'demo/batches/m01-01'
DOCS = ROOT / 'docs/product/batches/m01-01'


def node_binary():
    candidates = [os.environ.get('FANCY_PM_NODE'),
                  str(ROOT.parent / 'runtime/node/bin/node'), shutil.which('node')]
    for candidate in candidates:
        if candidate and Path(candidate).exists():
            return candidate
    raise RuntimeError('Node is required for the existing project author checks')


class M0101PMDemoTest(unittest.TestCase):
    def run_node(self, code):
        result = subprocess.run([node_binary(), '--input-type=module', '-e', code],
                                cwd=ROOT, text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        return result.stdout

    def test_model_otp_boundaries_recovery_and_zero_business_writes(self):
        result = self.run_node(r"""
import assert from 'node:assert/strict';
import {createState, transition as t, demoCode, resendRemaining, SYNTHETIC_MEAL_ID} from './demo/batches/m01-01/model.mjs';
const send = (options={}) => {
 let s=t(createState(options),{type:'START'});
 s=t(s,{type:'EMAIL',value:'  alex@example.test  '});
 return t(s,{type:'SEND'});
};
let s=send({origin:'meal'});assert.equal(s.email,'alex@example.test');assert.equal(s.screen,'code');assert.equal(s.targetId,SYNTHETIC_MEAL_ID);
assert.equal(resendRemaining(s),30);assert.equal(t(s,{type:'RESEND'}).challenge,1);
s=t(s,{type:'ADVANCE',seconds:29});assert.equal(t(s,{type:'RESEND'}).challenge,1);
s=t(s,{type:'ADVANCE',seconds:1});let old=demoCode(s);s=t(s,{type:'RESEND'});
assert.equal(s.targetId,SYNTHETIC_MEAL_ID);assert.equal(s.challenge,2);assert.notEqual(demoCode(s),old);assert.equal(s.issuedAt,30);
s=t(s,{type:'CODE',value:old});assert.match(t(s,{type:'VERIFY'}).error,/doesn’t match/);
s=t(s,{type:'CODE',value:demoCode(s)});s=t(s,{type:'VERIFY'});assert.equal(s.verified,true);
s=t(s,{type:'CONTINUE'});assert.equal(s.boundary,'meal');assert.equal(s.targetId,SYNTHETIC_MEAL_ID);assert.equal(s.businessWrites,0);
let before=send();before=t(before,{type:'ADVANCE',seconds:299});before=t(before,{type:'CODE',value:demoCode(before)});
assert.equal(t(before,{type:'VERIFY'}).verified,true);
let exact=send();exact=t(exact,{type:'ADVANCE',seconds:300});exact=t(exact,{type:'CODE',value:demoCode(exact)});
assert.match(t(exact,{type:'VERIFY'}).error,/expired/);assert.equal(t(exact,{type:'VERIFY'}).verified,false);
let wrong=send();wrong=t(wrong,{type:'CODE',value:'000000'});assert.match(t(wrong,{type:'VERIFY'}).error,/doesn’t match/);
let short=send();short=t(short,{type:'CODE',value:'12'});assert.match(t(short,{type:'VERIFY'}).error,/6-digit/);
let fail=t(createState(),{type:'START'});fail=t(fail,{type:'EMAIL',value:'alex@example.test'});fail=t(fail,{type:'FAIL_SEND'});fail=t(fail,{type:'SEND'});
assert.equal(fail.screen,'email');assert.equal(fail.email,'alex@example.test');assert.equal(fail.verified,false);
fail=t(fail,{type:'SEND'});fail=t(fail,{type:'CODE',value:demoCode(fail)});fail=t(fail,{type:'FAIL_VERIFY'});fail=t(fail,{type:'VERIFY'});
assert.equal(fail.screen,'code');assert.equal(fail.code,demoCode(fail));assert.equal(fail.verified,false);
assert.equal(t(fail,{type:'VERIFY'}).verified,true);
let change=t(send(),{type:'CHANGE_EMAIL'});assert.equal(change.screen,'email');assert.equal(change.issuedAt,null);assert.equal(change.code,'');
let cancel=t(send({origin:'meal'}),{type:'CANCEL'});assert.equal(cancel.boundary,'meal');assert.equal(cancel.targetId,SYNTHETIC_MEAL_ID);assert.equal(cancel.verified,false);
let fresh=send({origin:'meal',profileComplete:false});fresh=t(fresh,{type:'CODE',value:demoCode(fresh)});fresh=t(fresh,{type:'VERIFY'});fresh=t(fresh,{type:'CONTINUE'});
assert.equal(fresh.boundary,'profile');assert.equal(fresh.origin,'meal');assert.equal(fresh.targetId,SYNTHETIC_MEAL_ID);assert.equal(fresh.businessWrites,0);
for (const candidate of [s,before,exact,wrong,short,fail,change,cancel,fresh]) assert.equal(candidate.businessWrites,0);
console.log('model boundaries/recovery/intent assertions passed');
""")
        self.assertIn('assertions passed', result)

    def test_self_contained_preview_matches_source_and_uses_no_storage_or_network(self):
        html = (DEMO / 'index.html').read_text()
        model = (DEMO / 'model.mjs').read_text()
        app = (DEMO / 'app.mjs').read_text()
        import re
        expected = (DEMO / 'preview.template.html').read_text().replace(
            '<link rel="stylesheet" href="style.css">', '<style>\n' + (DEMO / 'style.css').read_text() + '\n</style>')
        expected = expected.replace('<script type="module" src="app.mjs"></script>',
            '<script>\n(() => {\n' + re.sub(r'^export ', '', model, flags=re.M) + '\n' +
            re.sub(r'^import .+;\n', '', app) + '\n})();\n</script>')
        self.assertEqual(html, expected)
        self.assertNotIn('type="module"', html)
        self.assertNotIn('src="app.mjs"', html)
        for forbidden in ('localStorage', 'sessionStorage', 'fetch(', 'XMLHttpRequest', 'https://'):
            self.assertNotIn(forbidden, html)
        self.assertIn('Preview boundary', html)
        self.assertIn('M01-04', html)

    def test_dom_author_journey_events(self):
        result = self.run_node(r"""
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {JSDOM} from 'jsdom';
const html=readFileSync('./demo/batches/m01-01/index.html','utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',url:'file:///preview/index.html'});const d=dom.window.document;
const click=(selector)=>{const e=d.querySelector(selector);assert.ok(e,selector);e.click();};
const input=(id,value)=>{const e=d.getElementById(id);assert.ok(e,id);e.value=value;e.dispatchEvent(new dom.window.Event('input',{bubbles:true}));};
const submit=(id)=>d.getElementById(id).dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
click('[data-action="BROWSE"]');assert.match(d.querySelector('#app').textContent,/Preview boundary/);
click('[data-action="RESTART"]');click('[data-action="START"]');input('email','bad');submit('email-form');assert.match(d.getElementById('error').textContent,/valid email/);
input('email','alex@example.test');submit('email-form');assert.ok(d.getElementById('code'));assert.equal(d.getElementById('resend').disabled,true);
input('code','000000');submit('code-form');assert.match(d.getElementById('error').textContent,/doesn’t match/);
input('code','123456');submit('code-form');assert.match(d.querySelector('#app').textContent,/You’re signed in/);
click('[data-action="CONTINUE"]');assert.match(d.querySelector('#review-status').textContent,/业务写入：0/);
d.getElementById('origin').value='meal';d.getElementById('profile').value='incomplete';click('#reset');click('[data-action="START"]');input('email','new@example.test');submit('email-form');click('#advance300');input('code','123456');submit('code-form');assert.match(d.getElementById('error').textContent,/expired/);
click('#advance30');click('[data-action="RESEND"]');const latest=d.getElementById('demo-code').textContent;assert.notEqual(latest,'123456');input('code',latest);submit('code-form');assert.match(d.querySelector('#app').textContent,/Email verified/);click('[data-action="CONTINUE"]');assert.match(d.querySelector('#app').textContent,/M01-04/);assert.match(d.querySelector('#review-status').textContent,/来源：meal \/ 11111111-1111-4111-8111-111111111111/);
dom.window.close();console.log('DOM author journey assertions passed');
""")
        self.assertIn('assertions passed', result)

    def test_manifest_and_requirement_pair_are_current(self):
        import hashlib
        manifest = json.loads((DOCS / 'artifact-manifest.json').read_text())
        self.assertEqual(manifest['batch'], 'M01-01')
        self.assertEqual(manifest['revision'], 'PM-r01')
        for path, expected in manifest['files'].items():
            with self.subTest(path=path):
                self.assertEqual(hashlib.sha256((ROOT / path).read_bytes()).hexdigest(), expected)
        self.assertFalse(manifest['stagesStarted']['UX'])
        self.assertFalse(manifest['stagesStarted']['RD'])
        self.assertFalse(manifest['stagesStarted']['QA'])


if __name__ == '__main__':
    unittest.main()
