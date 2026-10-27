"""J08 PM author checks, synthetic deletion only; no real-service QA claim."""
from pathlib import Path
import hashlib,json,subprocess,unittest,os
ROOT=Path(__file__).resolve().parents[1];NODE=ROOT.parent/'runtime/node/bin/node'
class J08PMTest(unittest.TestCase):
 def node(self,s):
  r=subprocess.run([str(NODE),'--input-type=module','-e',s],cwd=ROOT,text=True,capture_output=True);self.assertEqual(r.returncode,0,r.stdout+r.stderr)
 def test_atomic_barrier_reauthentication_and_receipt_recovery(self):
  self.node("""import assert from 'node:assert/strict';import {Model} from './demo/journeys/j08/model.mjs';const ready=()=>{let m=new Model();m.review();m.screen='reauth';assert.equal(m.reauth('000000'),false);assert.equal(m.reauth('123456'),true);m.confirmed=true;return m};let m=ready();m.cancel();assert.equal(m.accepted,0);assert.equal(m.effects.publicVisible,true);m=ready();m.now+=300001;assert.equal(m.request(),false);assert.equal(m.screen,'reauth');for(const component of ['sessions','membership','public-hide','privacy-revoke','ai-clear']){m=ready();const before=JSON.stringify(m.effects);m.failBarrier=component;assert.equal(m.request(),false);assert.equal(JSON.stringify(m.effects),before);assert.equal(m.accepted,0);assert.equal(m.authenticated,true);assert.equal(m.events.some(x=>x.status===202),false);}m=ready();m.next='lost-response';assert.equal(m.request(),true);assert.equal(m.screen,'unknown');assert.equal(m.savedReceipt,m.serverReceipt);assert.equal(m.authenticated,false);assert.equal(m.effects.hostUpcoming,'CANCELLED');assert.equal(m.effects.guestUpcoming,'LEFT');assert.equal(m.effects.pendingApplication,'WITHDRAWN');assert.equal(m.effects.startedOtherRosterPreserved,true);assert.equal(m.readOldExport(),false);assert.equal(m.acceptLateAI(1),false);assert.equal(m.effects.aiPreferences,false);assert.equal(m.effects.aiConversation,false);m.query();assert.equal(m.status,'PENDING');assert.equal(m.accepted,1);m.request();assert.equal(m.accepted,1);assert.equal(m.reauth('123456'),false);assert.ok(!JSON.stringify(m.events).includes(m.savedReceipt));""")
 def test_async_steps_policy_and_unavailable_receipt(self):
  self.node("""import assert from 'node:assert/strict';import {Model} from './demo/journeys/j08/model.mjs';const m=new Model();m.reauth('123456');m.confirmed=true;m.request();m.worker();assert.equal(m.status,'PROCESSING');assert.equal(m.workerSteps[0].done,true);m.stepFailure=true;m.worker();assert.equal(m.status,'NEEDS_SUPPORT');assert.equal(m.currentStep,1);m.worker();m.worker();m.policyApproved=false;assert.equal(m.worker(),false);assert.equal(m.status,'NEEDS_SUPPORT');assert.equal(m.currentStep,3);m.policyApproved=true;m.worker();assert.equal(m.status,'COMPLETED');assert.equal(m.currentStep,4);m.loseReceipt();assert.equal(m.query(),false);assert.equal(m.screen,'support');assert.equal(m.authenticated,false);m.contact();assert.match(m.notice,/not sending/);assert.equal(m.accepted,1);""")
 def test_dom_complete_request_recovery_status_and_safe_support(self):
  self.node("""import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {JSDOM} from 'jsdom';const dom=new JSDOM(readFileSync('./demo/journeys/j08/index.html','utf8'),{runScripts:'dangerously',url:'file:///p/index.html'});const d=dom.window.document,c=s=>{assert.ok(d.querySelector(s),s);d.querySelector(s).click()},set=(id,v)=>{const x=d.getElementById(id);x.value=v;x.dispatchEvent(new dom.window.Event('change',{bubbles:true}))};c('[data-act="review"]');assert.match(d.querySelector('h1').textContent,/Before you leave/);c('[data-act="cancel"]');assert.equal(dom.window.pm.accepted,0);c('[data-act="review"]');c('[data-act="verify"]');d.getElementById('code').value='123456';d.getElementById('reauth').querySelector('button.primary').click();c('#confirm');set('next','lost-response');c('[data-act="delete"]');assert.match(d.querySelector('h1').textContent,/saved receipt/);c('[data-act="query"]');assert.match(d.querySelector('h1').textContent,/Request accepted/);c('[data-act="worker"]');assert.match(d.querySelector('h1').textContent,/progress/);c('[data-act="worker-fail"]');assert.match(d.querySelector('h1').textContent,/Support needed/);c('[data-act="support"]');assert.equal(d.getElementById('support-link').getAttribute('href'),'mailto:xcheniepaut26@gmail.com');assert.ok(!d.querySelector('main').textContent.includes(dom.window.pm.savedReceipt));c('[data-act="copy"]');assert.match(d.getElementById('copy-status').textContent,/selected|copied/);c('[data-act="back-status"]');assert.match(d.querySelector('main').textContent,/No message has been marked as sent/);c('[data-act="lose-receipt"]');assert.equal(d.getElementById('support-link').getAttribute('href'),'mailto:xcheniepaut26@gmail.com');assert.equal(dom.window.pm.authenticated,false);assert.equal(dom.window.pm.accepted,1);dom.window.close();""")
 def test_self_contained_manifest(self):
  html=(ROOT/'demo/journeys/j08/index.html').read_text();model=(ROOT/'demo/journeys/j08/model.mjs').read_text().split('\nexport { Model };')[0];self.assertIn(model,html);self.assertNotIn('<script src=',html);self.assertNotIn('fetch(',html)
  for p,h in json.loads((ROOT/'docs/product/journeys/j08/artifact-manifest.json').read_text())['files'].items():self.assertEqual(hashlib.sha256((ROOT/p).read_bytes()).hexdigest(),h,p)

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
 await page.goto(pathToFileURL(process.cwd()+'/demo/journeys/j08/index.html').href);

 await page.locator('[data-act="review"]').click();
 await page.locator('[data-act="cancel"]').click();
 assert.equal(await page.evaluate(()=>pm.accepted),0);
 await page.locator('[data-act="review"]').click();
 await page.locator('[data-act="verify"]').click();
 await page.locator('#code').fill('000000');await page.locator('#reauth button.primary').click();
 assert.match(await page.locator('[role="alert"]').textContent(),/6-digit/);
 await page.locator('#code').fill('123456');await page.locator('#reauth button.primary').click();
 await page.locator('#confirm').check();
 await review();await page.locator('#barrier').selectOption('privacy-revoke');
 await page.locator('[data-act="delete"]').click();
 assert.equal(await page.evaluate(()=>pm.accepted),0);
 assert.match(await page.locator('[role="alert"]').textContent(),/not been changed/);
 await review();await page.locator('#next').selectOption('lost-response');
 await page.locator('[data-act="delete"]').click();
 assert.match(await page.locator('h1').textContent(),/saved receipt/);
 await page.locator('[data-act="query"]').click();
 assert.match(await page.locator('h1').textContent(),/Request accepted/);
 assert.equal(await page.evaluate(()=>pm.accepted),1);
 assert.equal(await page.evaluate(()=>pm.authenticated),false);
 await review();await page.locator('[data-act="worker-fail"]').click();
 assert.match(await page.locator('h1').textContent(),/Support needed/);
 await page.locator('[data-act="support"]').click();
 assert.equal(await page.locator('#support-link').getAttribute('href'),'mailto:xcheniepaut26@gmail.com');
 await page.locator('[data-act="back-status"]').click();
 assert.match(await page.locator('main').textContent(),/No message has been marked as sent/);

 assert.deepEqual(errors,[]);
 if(process.env.FANCY_PM_BROWSER_EVIDENCE_DIR)await page.screenshot({path:process.env.FANCY_PM_BROWSER_EVIDENCE_DIR+'/j08-fixed.png',fullPage:true});
}finally{await browser.close();}
""")
