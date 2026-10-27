"""J07 PM author model and DOM checks, synthetic only."""
from pathlib import Path
import hashlib,json,subprocess,unittest,os
ROOT=Path(__file__).resolve().parents[1];NODE=ROOT.parent/'runtime/node/bin/node'
class J07PMTest(unittest.TestCase):
 def node(self,s):
  r=subprocess.run([str(NODE),'--input-type=module','-e',s],cwd=ROOT,text=True,capture_output=True);self.assertEqual(r.returncode,0,r.stdout+r.stderr)
 def test_receipt_recovery_and_owner_privacy(self):
  self.node("""import assert from 'node:assert/strict';import {Model} from './demo/journeys/j07/model.mjs';const m=new Model();m.start();m.cancel();assert.equal(m.records.length,0);m.start();assert.equal(m.submit('','private words'),false);assert.equal(m.details,'private words');m.next='failure';assert.equal(m.submit('safety','keep this'),false);assert.equal(m.records.length,0);m.next='unknown';assert.equal(m.submit('safety','keep this'),true);assert.equal(m.screen,'unknown');assert.equal(m.submit('safety','again'),false);assert.equal(m.requests,1);assert.equal(m.lookup(),true);assert.equal(m.receipt().status,'RECEIVED');assert.equal(m.support('REPLIED'),false);assert.equal(m.support('IN_PROGRESS'),true);assert.equal(m.support('REPLIED'),true);const id=m.current;assert.ok(m.receipt().reply);m.switchActor('U-OTHER');assert.equal(m.list().length,0);assert.equal(m.receipt(id),null);assert.equal(m.open(id),false);m.switchActor('U-REPORTER');assert.equal(m.list().length,1);m.switchActor(null);assert.equal(m.start(),false);""")
 def test_dom_submit_and_track_real_simulated_reply(self):
  self.node("""import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {JSDOM} from 'jsdom';const dom=new JSDOM(readFileSync('./demo/journeys/j07/index.html','utf8'),{runScripts:'dangerously',url:'file:///p/index.html'});const d=dom.window.document,c=s=>{assert.ok(d.querySelector(s),s);d.querySelector(s).click()},set=(id,v,type='change')=>{const x=d.getElementById(id);x.value=v;x.dispatchEvent(new dom.window.Event(type,{bubbles:true}))};c('[data-act="start"]');set('reason','safety');set('details','I would like help with this incident.','input');set('next','unknown');d.getElementById('report').querySelector('button.primary').click();assert.match(d.querySelector('main').textContent,/Check your report/);c('[data-act="lookup"]');assert.match(d.querySelector('h1').textContent,/Received/);c('[data-act="list"]');c('[data-report="SYN-R1"]');c('[data-act="support-progress"]');assert.match(d.querySelector('h1').textContent,/In progress/);c('[data-act="support-reply"]');assert.match(d.querySelector('h1').textContent,/Reply available/);assert.match(d.querySelector('main').textContent,/We reviewed the information/);set('actor','U-OTHER');assert.match(d.querySelector('main').textContent,/have not submitted/);assert.doesNotMatch(d.querySelector('main').textContent,/I would like help/);assert.equal(dom.window.pm.requests,1);dom.window.close();""")
 def test_self_contained_manifest(self):
  html=(ROOT/'demo/journeys/j07/index.html').read_text();model=(ROOT/'demo/journeys/j07/model.mjs').read_text().split('\nexport { Model };')[0];self.assertIn(model,html);self.assertNotIn('<script src=',html);self.assertNotIn('fetch(',html)
  for p,h in json.loads((ROOT/'docs/product/journeys/j07/artifact-manifest.json').read_text())['files'].items():self.assertEqual(hashlib.sha256((ROOT/p).read_bytes()).hexdigest(),h,p)

 @unittest.skipUnless(os.environ.get('FANCY_PM_PLAYWRIGHT_MODULE'), 'Set FANCY_PM_PLAYWRIGHT_MODULE for isolated real-button regression')
 def test_real_browser_natural_submit_buttons_and_recovery(self):
  self.node(r"""
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.FANCY_PM_PLAYWRIGHT_MODULE);
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:390,height:844}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const review=async()=>{if(!await page.locator('details.review').evaluate(el=>el.open))await page.locator('details.review summary').click();};
try{
 await page.goto(pathToFileURL(process.cwd()+'/demo/journeys/j07/index.html').href);

 await page.locator('[data-act="start"]').click();
 await page.locator('#reason').selectOption('safety');
 await page.locator('#details').fill('Please review this synthetic incident.');
 await review();await page.locator('#next').selectOption('failure');
 await page.locator('#report button.primary').click();
 assert.match(await page.locator('[role="alert"]').textContent(),/not sent/);
 assert.equal(await page.locator('#details').inputValue(),'Please review this synthetic incident.');
 await review();await page.locator('#next').selectOption('unknown');
 await page.locator('#report button.primary').click();
 assert.match(await page.locator('h1').textContent(),/Check your report/);
 await page.locator('[data-act="lookup"]').click();
 assert.match(await page.locator('h1').textContent(),/Received/);
 await review();await page.locator('[data-act="support-progress"]').click();
 assert.match(await page.locator('h1').textContent(),/In progress/);
 await review();await page.locator('[data-act="support-reply"]').click();
 assert.match(await page.locator('h1').textContent(),/Reply available/);
 assert.match(await page.locator('main').textContent(),/We reviewed the information/);
 assert.equal(await page.evaluate(()=>pm.requests),1);
 await review();await page.locator('#actor').selectOption('U-OTHER');
 assert.doesNotMatch(await page.locator('main').textContent(),/Please review this synthetic/);

 assert.deepEqual(errors,[]);
 if(process.env.FANCY_PM_BROWSER_EVIDENCE_DIR)await page.screenshot({path:process.env.FANCY_PM_BROWSER_EVIDENCE_DIR+'/j07-fixed.png',fullPage:true});
}finally{await browser.close();}
""")
