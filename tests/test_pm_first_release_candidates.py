"""PJ artifact checks for PM candidates; these are not independent product QA."""
from pathlib import Path
import hashlib
import json
import subprocess
import unittest

ROOT=Path(__file__).resolve().parents[1]


class PMFirstReleaseCandidatesTest(unittest.TestCase):
    def test_each_journey_has_paired_artifacts_and_complete_source_inventory(self):
        ledger=json.loads((ROOT/'docs/product/requirements-traceability.json').read_text())
        versions=ledger['versionAssignments']
        for number in range(1,12):
            jid=f'J{number:02}';slug=jid.lower()
            with self.subTest(journey=jid):
                directory=ROOT/'docs/product/journeys'/slug
                for name in ('requirements.zh-CN.md','coverage.json','author-verification.zh-CN.md','artifact-manifest.json'):
                    self.assertTrue((directory/name).is_file(),str(directory/name))
                self.assertTrue((ROOT/'demo/journeys'/slug/'index.html').is_file())
                self.assertTrue((ROOT/f'tests/test_pm_{slug}.py').is_file())
                coverage=json.loads((directory/'coverage.json').read_text())
                actual={r if isinstance(r,str) else r['sourceUnitId'] for r in coverage['sourceUnits']}
                expected={u['id'] for u in ledger['units'] if any(t['journey']==jid and t['version']==versions[jid] for t in u['targets'])}
                self.assertEqual(actual,expected,'PM must disposition every applicable original unit, including shared constraints')
                manifest=json.loads((directory/'artifact-manifest.json').read_text())
                records=manifest['files']
                if isinstance(records,list):
                    records={r['path']:r['sha256'] for r in records}
                for path,sha in records.items():
                    self.assertEqual(hashlib.sha256((ROOT/path).read_bytes()).hexdigest(),sha,path)

    def test_all_eleven_direct_file_entries_execute_without_script_errors(self):
        code=r'''
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {JSDOM,VirtualConsole} from 'jsdom';
for(let n=1;n<=11;n++){
 const id='j'+String(n).padStart(2,'0'),errors=[];
 const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const html=readFileSync('demo/journeys/'+id+'/index.html','utf8');
 assert.ok(!/<script\b[^>]*\bsrc\s*=/i.test(html),id+' must be self contained');
 const dom=new JSDOM(html,{runScripts:'dangerously',url:'file:///preview/'+id+'/index.html',virtualConsole:vc});
 assert.deepEqual(errors,[],id+' boot errors');
 assert.ok(dom.window.document.querySelectorAll('button').length>0,id+' needs real actions');
 assert.ok(dom.window.document.title.includes('Fancy'),id+' title');
 dom.window.close();
}
console.log('eleven file entries loaded; jsdom only, no visual/native QA');
'''
        result=subprocess.run([str(ROOT.parent/'runtime/node/bin/node'),'--input-type=module','-e',code],cwd=ROOT,capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)


if __name__=='__main__':unittest.main()
