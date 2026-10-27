"""J10 PM author self-checks: synthetic scope, not independent QA."""
from pathlib import Path
import hashlib
import json
import subprocess
import os
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
        self.node("""import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {JSDOM} from 'jsdom';const dom=new JSDOM(readFileSync('./demo/journeys/j10/index.html','utf8'),{runScripts:'dangerously',url:'file:///preview/index.html'});const d=dom.window.document,click=s=>{assert.ok(d.querySelector(s),s);d.querySelector(s).click()};d.querySelector('#from').value='2026-09-01';d.querySelector('#to').value='2026-10-26';d.getElementById('query').querySelector('button.primary').click();click('[data-metric="coverage"]');assert.match(d.querySelector('.drawer').textContent,/本人优先/);click('.drawer [data-act="sources"]');click('.drawer [data-meal="M-101"]');assert.match(d.querySelector('.drawer').textContent,/self present.*host absent/);click('.drawer [data-person="U-101"]');assert.match(d.querySelector('.drawer').textContent,/M-102/);click('.drawer [data-act="back"]');click('.drawer [data-act="close"]');assert.equal(d.querySelector('.drawer'),null);click('[data-act="locale"]');assert.equal(d.querySelector('#from').value,'2026-09-01');click('[data-fail="410"]');assert.match(d.querySelector('main').textContent,/410/);assert.equal(d.querySelector('[data-metric="coverage"]'),null);click('[data-act="recover"]');assert.ok(d.querySelector('[data-metric="coverage"]'));dom.window.close();""")
    def test_self_contained_and_manifest(self):
        html=(ROOT/'demo/journeys/j10/index.html').read_text();model=(ROOT/'demo/journeys/j10/model.mjs').read_text().split('\nexport { Model };')[0]
        self.assertIn(model,html);self.assertNotIn('<script src=',html);self.assertNotIn('fetch(',html)
        manifest=json.loads((ROOT/'docs/product/journeys/j10/artifact-manifest.json').read_text())
        for path,sha in manifest['files'].items():self.assertEqual(hashlib.sha256((ROOT/path).read_bytes()).hexdigest(),sha,path)
        self.assertEqual(manifest['stagesStarted'],{'PM':True,'UX':False,'RD':False,'QA':False})

    @unittest.skipUnless(os.environ.get('FANCY_PM_PLAYWRIGHT_MODULE'), 'Set FANCY_PM_PLAYWRIGHT_MODULE for the isolated real-browser layout check')
    def test_real_browser_responsive_containment_and_controls(self):
        self.node(r"""
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.FANCY_PM_PLAYWRIGHT_MODULE);
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const url=pathToFileURL(process.cwd()+'/demo/journeys/j10/index.html').href;
const check=async label=>{
 const size=await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth}));
 assert.ok(size.width<=size.viewport,label+': '+JSON.stringify(size));
};
try{
 for(const width of [390,864,1024,1440]){
  await page.setViewportSize({width,height:1000});await page.goto(url);
  await check(width+' initial');
  for(const name of ['overview','journey','supply','definitions']){
   await page.locator('nav [data-page="'+name+'"]').click();await check(width+' '+name);
  }
  await page.locator('[data-act="locale"]').click();await check(width+' English');
 }
 await page.setViewportSize({width:390,height:844});await page.goto(url);
 await page.locator('#from').fill('2026-09-01');
 await page.locator('#to').fill('2026-10-26');
 await page.locator('#query button').click();
 await page.locator('#areas').selectOption(['Soho']);await check('390 filtered');
 assert.equal(await page.locator('#areas').inputValue(),'Soho');
 const horizontal=await page.locator('.table-wrap').evaluate(el=>{
  const before=el.scrollLeft;el.scrollLeft=el.scrollWidth;
  return {before,after:el.scrollLeft,client:el.clientWidth,content:el.scrollWidth};
 });
 assert.ok(horizontal.content>horizontal.client,'Long table must retain content');
 assert.ok(horizontal.after>horizontal.before,'Long table must scroll inside its own container');
 await page.locator('[data-metric="coverage"]').click();await check('390 metric drawer');
 await page.locator('.drawer [data-act="sources"]').click();await check('390 source drawer');
 await page.locator('.drawer [data-meal="M-101"]').click();await check('390 meal drawer');
 await page.locator('.drawer [data-person="U-101"]').click();await check('390 person drawer');
 await page.locator('.drawer [data-act="back"]').click();
 await page.locator('.drawer [data-act="close"]').click();await check('390 drawer closed');
 await page.locator('nav [data-page="definitions"]').click();await check('390 horizontally scrolled navigation');
 assert.equal(await page.locator('nav [data-page="definitions"]').getAttribute('aria-current'),'page');
 await page.locator('nav [data-page="overview"]').click();
 if(process.env.FANCY_PM_J10_SCREENSHOT)await page.screenshot({path:process.env.FANCY_PM_J10_SCREENSHOT,fullPage:true});
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
""")
