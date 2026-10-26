"""The review hub must pair each first-release journey with its own PM artifacts."""
from pathlib import Path
import importlib.util
import unittest

ROOT=Path(__file__).resolve().parents[1]


class PMReviewHubTest(unittest.TestCase):
    def test_hub_links_to_eleven_separate_prototypes_and_pinned_requirements(self):
        spec=importlib.util.spec_from_file_location('build_pm_review',ROOT/'scripts/build_pm_review.py')
        module=importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        sha='a'*40
        html=module.hub(sha)
        self.assertEqual(html.count('<article>'),11)
        for n in range(1,12):
            slug=f'j{n:02}'
            self.assertIn(f'href="{slug}/index.html"',html)
            self.assertIn(f'href="#prd-{slug}"',html)
            self.assertIn(f'id="doc-{slug}"',html)
            self.assertIn(f'/blob/{sha}/docs/product/journeys/{slug}/requirements.zh-CN.md',html)
        self.assertNotIn('j12/index.html',html)
        self.assertIn('未启动 UX、RD、QA',html)
        self.assertIn('彼此不共享模拟账号或状态',html)


    def test_prd_click_reads_full_document_and_returns_without_another_page(self):
        import subprocess
        import tempfile
        spec=importlib.util.spec_from_file_location('build_pm_review',ROOT/'scripts/build_pm_review.py')
        module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory() as directory:
            page=Path(directory)/'index.html';page.write_text(module.hub('a'*40))
            code=r"""
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {JSDOM,VirtualConsole} from 'jsdom';
const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const page=readFileSync(process.argv[1],'utf8');
const dom=new JSDOM(page,{runScripts:'dangerously',url:'https://review.invalid/',virtualConsole:vc});
const d=dom.window.document;
for(let n=1;n<=11;n++){
 const slug='j'+String(n).padStart(2,'0');
 const link=d.querySelector('[data-prd="'+slug+'"]');link.click();
 assert.equal(dom.window.location.pathname,'/');assert.equal(dom.window.location.hash,'#prd-'+slug);
 assert.equal(d.querySelector('#catalog').hidden,true);assert.equal(d.querySelector('#prd-reader').hidden,false);
 assert.equal(d.querySelector('#prd-content pre').textContent,readFileSync('docs/product/journeys/'+slug+'/requirements.zh-CN.md','utf8'));
 d.querySelector('#prd-back').click();assert.equal(d.querySelector('#catalog').hidden,false);
 assert.equal(d.querySelector('#prd-reader').hidden,true);assert.equal(d.activeElement,link);
}
assert.deepEqual(errors,[]);dom.window.close();
const deep=new JSDOM(page,{runScripts:'dangerously',url:'https://review.invalid/#prd-j08'});
assert.equal(deep.window.document.querySelector('#prd-reader').hidden,false);
assert.match(deep.window.document.querySelector('#prd-content').textContent,/删除/);deep.window.close();
"""
            result=subprocess.run([str(ROOT.parent/'runtime/node/bin/node'),'--input-type=module','-e',code,str(page)],cwd=ROOT,capture_output=True,text=True)
            self.assertEqual(result.returncode,0,result.stdout+result.stderr)


if __name__=='__main__':unittest.main()
