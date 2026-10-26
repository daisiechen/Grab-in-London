"""J10 PM author self-checks: synthetic scope, not independent QA."""
from pathlib import Path
import hashlib
import json
import subprocess
import unittest
ROOT=Path(__file__).resolve().parents[1]
NODE=ROOT.parent/'runtime/node/bin/node'

class J10PMTest(unittest.TestCase):
    def node(self,code):
        r=subprocess.run([str(NODE),'--input-type=module','-e',code],cwd=ROOT,text=True,capture_output=True)
        self.assertEqual(r.returncode,0,r.stdout+r.stderr)
    def test_query_metrics_and_authorization_boundaries(self):
        self.node("""import assert from 'node:assert/strict';import {Model} from './demo/journeys/j10/model.mjs';const m=new Model();let old=JSON.stringify(m.query);assert.equal(m.apply('2026-10-27','2026-10-01'),false);assert.equal(JSON.stringify(m.query),old);assert.equal(m.apply('2026-09-01','2026-10-26'),true);const x=m.metrics();assert.equal(x.retention.d,1);assert.equal(x.retention.n,1);assert.equal(x.activation.d,2);assert.equal(x.activation.n,1);assert.equal(m.result({}, {self:'present',host:'absent'}),'present');m.filter('languages',['en','zh']);assert.equal(new Set(m.rows().map(x=>x.id)).size,m.rows().length);m.open('metric','coverage');m.open('meal','M-101');m.back();assert.equal(m.stack.at(-1).kind,'metric');m.fail('410');assert.equal(m.snapshot,null);assert.equal(m.rows().length,0);assert.equal(m.stack.length,0);assert.equal(m.query.from,'2026-09-01');m.recover();assert.equal(m.snapshot,'SYN-S27');assert.ok(m.rows().length);m.filter('areas',['nowhere']);assert.equal(m.metrics().coverage.d,0);m.role='forbidden';assert.equal(m.open('sources',''),false);""")
    def test_dom_complete_analysis_and_recovery(self):
        self.node("""import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {JSDOM} from 'jsdom';const dom=new JSDOM(readFileSync('./demo/journeys/j10/index.html','utf8'),{runScripts:'dangerously',url:'file:///preview/index.html'});const d=dom.window.document,click=s=>{assert.ok(d.querySelector(s),s);d.querySelector(s).click()};d.querySelector('#from').value='2026-09-01';d.querySelector('#to').value='2026-10-26';d.querySelector('#query').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));click('[data-metric="coverage"]');assert.match(d.querySelector('.drawer').textContent,/本人优先/);click('.drawer [data-act="sources"]');click('.drawer [data-meal="M-101"]');assert.match(d.querySelector('.drawer').textContent,/self present.*host absent/);click('.drawer [data-person="U-101"]');assert.match(d.querySelector('.drawer').textContent,/M-102/);click('.drawer [data-act="back"]');click('.drawer [data-act="close"]');assert.equal(d.querySelector('.drawer'),null);click('[data-act="locale"]');assert.equal(d.querySelector('#from').value,'2026-09-01');click('[data-fail="410"]');assert.match(d.querySelector('main').textContent,/410/);assert.equal(d.querySelector('[data-metric="coverage"]'),null);click('[data-act="recover"]');assert.ok(d.querySelector('[data-metric="coverage"]'));dom.window.close();""")
    def test_self_contained_and_manifest(self):
        html=(ROOT/'demo/journeys/j10/index.html').read_text();model=(ROOT/'demo/journeys/j10/model.mjs').read_text().split('\nexport { Model };')[0]
        self.assertIn(model,html);self.assertNotIn('<script src=',html);self.assertNotIn('fetch(',html)
        manifest=json.loads((ROOT/'docs/product/journeys/j10/artifact-manifest.json').read_text())
        for path,sha in manifest['files'].items():self.assertEqual(hashlib.sha256((ROOT/path).read_bytes()).hexdigest(),sha,path)
        self.assertEqual(manifest['stagesStarted'],{'PM':True,'UX':False,'RD':False,'QA':False})
