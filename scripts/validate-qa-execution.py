"""Validate case-level claims independently of aggregate runner success."""
import collections
import hashlib
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def validate(data=None):
    data=data or json.loads((ROOT/'docs/qa/execution-2026-10-21.json').read_text())
    raw=(ROOT/'docs/qa/test-cases.json').read_bytes()
    assert data['planSha256']==hashlib.sha256(raw).hexdigest(), 'plan changed; reassess execution mapping'
    plan={c['id']:c for c in json.loads(raw)['cases']}
    rows=data['cases']; ids=[c['id'] for c in rows]
    assert len(ids)==len(set(ids)) and set(ids)==set(plan), 'missing or duplicate case'
    bundle=json.loads((ROOT/'docs/qa/evidence/2026-10-21/automated-runs.json').read_text())
    runs=bundle['runs']
    for path,digest in bundle['qaProbeSourceSha256'].items():
        assert hashlib.sha256((ROOT/path).read_bytes()).hexdigest()==digest, 'QA probe changed after run'
    assertions={t['id']:t for r in runs for t in r.get('assertions',[])}
    for r in runs:
        assert r['exitCode'] in (0,1)
        if 'assertions' in r:
            assert r['total']==len(r['assertions'])
            assert r['passed']==sum(t['status']=='passed' for t in r['assertions'])
            failed=sum(t['status']=='failed' for t in r['assertions'])
            assert r.get('failed',0)==failed
            assert (r['exitCode']==0)==(failed==0), 'runner outcome does not match preserved assertions'
            for t in r['assertions']:
                assert not Path(t['path']).is_absolute() and '..' not in Path(t['path']).parts
                assert (ROOT/t['path']).is_file(), t['path']
    browser_path=data.get('evidenceCatalog',{}).get('browserObservations')
    if browser_path:
        browser=json.loads((ROOT/'docs/qa'/browser_path).read_text())
        for item in browser['observations']:
            assert item['id'] not in assertions and item['status'] in ('passed','failed')
            assert item['steps'] and len(item['testedCommit'])==40
            for artifact in item['artifacts']:
                assert not Path(artifact).is_absolute() and '..' not in Path(artifact).parts
                assert (ROOT/'docs/qa'/artifact).is_file()
            assertions[item['id']]=item
    for c in rows:
        assert c['status'] in ('PASS','FAIL','BLOCKED','NOT_RUN','N/A') and c['actual']
        assert c['title']==plan[c['id']]['title']
        assert all(e in assertions or e in ('B1','B2') for e in c['evidence'])
        assert all(e in assertions for e in c['relatedAutomatedAssertions'])
        if c['status']=='PASS':
            assert c['evidence'] and all(assertions[e]['status']=='passed' for e in c['evidence'])
            assert c['coveredExpectedIndexes']==list(range(len(plan[c['id']]['expected'])))
            assert not c['remainingExpected']
        else:
            assert c['remainingExpected'], 'partial case must retain unproven expectations'
            assert not c['coveredExpectedIndexes'], 'do not infer assertion coverage from related suites'
        if c['status']=='FAIL':assert c.get('defectIds')
    assert data['counts']==dict(collections.Counter(c['status'] for c in rows))
    assert data['status']=='partial_execution_not_release_acceptance'
    for path in ['docs/qa/evidence/2026-10-21/browser-journey.zh-CN.md','docs/qa/defects-2026-10-21.zh-CN.md']:
        assert (ROOT/path).is_file()
    return data['counts']
if __name__=='__main__':print(json.dumps(validate(),ensure_ascii=False))
