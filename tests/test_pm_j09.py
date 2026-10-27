"""J09 author checks: case scope, time boundary and correction propagation."""
from pathlib import Path
import hashlib,json,subprocess,unittest,os
ROOT=Path(__file__).resolve().parents[1];NODE=ROOT.parent/'runtime/node/bin/node'
class J09PMTest(unittest.TestCase):
 def node(self,s):
  r=subprocess.run([str(NODE),'--input-type=module','-e',s],cwd=ROOT,text=True,capture_output=True);self.assertEqual(r.returncode,0,r.stdout+r.stderr)
 def test_case_authorization_precise_window_and_revision(self):
  self.node("""import assert from 'node:assert/strict';import {Model} from './demo/journeys/j09/model.mjs';const m=new Model();m.role='analyst';assert.equal(m.read(),null);assert.equal(m.correct('present','checked'),false);m.role='support';m.mfa=false;assert.equal(m.start(),false);m.mfa=true;m.caseAllowed=false;assert.equal(m.read(),null);m.caseAllowed=true;assert.equal(m.start(),true);m.now=m.end+7*864e5-1;assert.equal(m.correct('present','checked'),false);assert.equal(m.corrections.length,0);m.now++;m.next='conflict';assert.equal(m.correct('present','checked'),false);const v=m.version;assert.equal(m.correct('present','checked',v-1),false);assert.equal(m.correct('present','checked',v),true);assert.deepEqual(m.original,{self:'absent',host:'present'});const once=m.corrections.length;assert.equal(m.correct('present','checked'),true);assert.equal(m.corrections.length,once);assert.equal(m.effective(),'present');assert.equal(m.snapshotOld.present,1);assert.equal(m.snapshotNew.present,2);assert.equal(m.correct('absent','later lawful correction'),true);assert.equal(m.impact().publicReview,'hidden');assert.equal(m.impact().experience,'excluded');assert.equal(m.impact().connection,'PAUSED');m.otherBasis=true;assert.equal(m.impact().connection,'OPEN');assert.equal(m.resolve('Reviewed your attendance evidence.'),true);assert.equal(m.status,'REPLIED');assert.ok(m.audit.length>=3);""")
 def test_dom_review_correct_propagate_and_reply(self):
  self.node("""import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {JSDOM} from 'jsdom';const dom=new JSDOM(readFileSync('./demo/journeys/j09/index.html','utf8'),{runScripts:'dangerously',url:'file:///p/index.html'});const d=dom.window.document,c=s=>{assert.ok(d.querySelector(s),s);d.querySelector(s).click()},set=(id,v,type='change')=>{const x=d.getElementById(id);x.value=v;x.dispatchEvent(new dom.window.Event(type,{bubbles:true}))};c('[data-act="start"]');set('reason','Case evidence checked with the reporter.','input');c('[data-act="before7"]');d.getElementById('correct').querySelector('button.primary').click();assert.match(d.querySelector('[role="alert"]').textContent,/CORRECTION_WINDOW_OPEN/);c('[data-act="at7"]');set('value','absent');d.getElementById('correct').querySelector('button.primary').click();assert.match(d.querySelector('main').textContent,/PAUSED/);assert.match(d.querySelector('main').textContent,/SYN-AFTER/);assert.equal(dom.window.pm.original.host,'present');c('[data-act="other-basis"]');assert.match(d.querySelector('main').textContent,/OPEN/);set('outcome','Your report has been reviewed and a correction recorded.','input');d.getElementById('reply').querySelector('button.primary').click();assert.match(d.querySelector('.badge').textContent,/REPLIED/);set('role','analyst');assert.equal(d.getElementById('correct'),null);assert.doesNotMatch(d.querySelector('main').textContent,/本人原报告/);dom.window.close();""")
 def test_self_contained_manifest(self):
  html=(ROOT/'demo/journeys/j09/index.html').read_text();model=(ROOT/'demo/journeys/j09/model.mjs').read_text().split('\nexport { Model };')[0];self.assertIn(model,html);self.assertNotIn('<script src=',html);self.assertNotIn('fetch(',html)
  for p,h in json.loads((ROOT/'docs/product/journeys/j09/artifact-manifest.json').read_text())['files'].items():self.assertEqual(hashlib.sha256((ROOT/p).read_bytes()).hexdigest(),h,p)

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
 await page.goto(pathToFileURL(process.cwd()+'/demo/journeys/j09/index.html').href);

 await page.locator('[data-act="start"]').click();
 await page.locator('#reason').fill('Synthetic case evidence reviewed.');
 await review();await page.locator('[data-act="before7"]').click();
 await page.locator('#correct button.primary').click();
 assert.match(await page.locator('[role="alert"]').textContent(),/CORRECTION_WINDOW_OPEN/);
 assert.equal(await page.locator('#reason').inputValue(),'Synthetic case evidence reviewed.');
 await review();await page.locator('[data-act="at7"]').click();
 await page.locator('#value').selectOption('absent');
 await page.locator('#correct button.primary').click();
 assert.equal(await page.evaluate(()=>pm.corrections.length),1);
 assert.match(await page.locator('main').textContent(),/PAUSED/);
 await review();await page.locator('[data-act="other-basis"]').click();
 assert.match(await page.locator('main').textContent(),/OPEN/);
 await page.locator('#outcome').fill('We have reviewed the case and recorded the correction.');
 await page.locator('#reply button.primary').click();
 assert.match(await page.locator('.badge').textContent(),/REPLIED/);
 await review();await page.locator('#role').selectOption('analyst');
 assert.equal(await page.locator('#correct').count(),0);
 assert.doesNotMatch(await page.locator('main').textContent(),/本人原报告/);

 assert.deepEqual(errors,[]);
 if(process.env.FANCY_PM_BROWSER_EVIDENCE_DIR)await page.screenshot({path:process.env.FANCY_PM_BROWSER_EVIDENCE_DIR+'/j09-fixed.png',fullPage:true});
}finally{await browser.close();}
""")
