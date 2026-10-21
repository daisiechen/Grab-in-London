"""Validate QA traceability and evidence integrity; never infer product pass status."""
from pathlib import Path
import json
import re
import subprocess
import hashlib

ROOT = Path(__file__).resolve().parents[1]

def validate(data, root=ROOT):
    if data.get('status') != 'planned_not_executed':
        raise ValueError('Case-design artifact must remain distinct from execution reports')
    baseline = data['baselineCommit']
    if not re.fullmatch(r'[0-9a-f]{40}', baseline):
        raise ValueError('Invalid baseline commit')
    for path, digest in data['sourceSha256'].items():
        if not (root / path).resolve().is_relative_to(root.resolve()):
            raise ValueError('Escaped source path')
        blob = subprocess.check_output(['git', 'show', f'{baseline}:{path}'], cwd=root)
        if hashlib.sha256(blob).hexdigest() != digest:
            raise ValueError('Source differs from recorded baseline: ' + path)
    pinned = set(data['sourceSha256'])
    for override in data.get('decisionOverrides', []):
        path = override['path']
        if not (root / path).resolve().is_relative_to(root.resolve()):
            raise ValueError('Escaped override source')
        blob = subprocess.check_output(['git', 'show', f"{override['commit']}:{path}"], cwd=root)
        if hashlib.sha256(blob).hexdigest() != override['sha256']:
            raise ValueError('Decision override hash mismatch')
        pinned.add(path)
    scenarios = set()
    for name in ('acceptance-scenarios.json', 'ai-acceptance-scenarios.json'):
        blob = subprocess.check_output(['git', 'show', f'{baseline}:docs/engineering/{name}'], cwd=root)
        scenarios.update(s['id'] for s in json.loads(blob)['scenarios'])
    tasks = set(re.findall(r'^## ([TA]\d{2})\b', subprocess.check_output(
        ['git', 'show', f'{baseline}:tasks/todo.md'], cwd=root, text=True), re.M))
    seen, covered_s, covered_t = set(), set(), set()
    for case in data['cases']:
        cid = case['id']
        if cid in seen or not re.fullmatch(r'QA-[A-Z]+-\d{3}', cid):
            raise ValueError('Duplicate or invalid case ID: ' + cid)
        seen.add(cid)
        if case['stage'] not in {'demo', 'implementation', 'external', 'review'}:
            raise ValueError('Unknown execution stage: ' + cid)
        if case['priority'] not in {'P0', 'P1', 'P2'}:
            raise ValueError('Invalid priority: ' + cid)
        for field in ('title', 'method'):
            if not isinstance(case[field], str) or not case[field].strip():
                raise ValueError('Missing ' + field + ': ' + cid)
        for field in ('preconditions', 'steps', 'expected', 'sources', 'requirements', 'taskIds'):
            if not isinstance(case[field], list) or not case[field] or any(not v for v in case[field]):
                raise ValueError('Empty ' + field + ': ' + cid)
        if not set(case['scenarioIds']) <= scenarios or not set(case['taskIds']) <= tasks:
            raise ValueError('Unknown scenario/task: ' + cid)
        for source in case['sources']:
            if source['path'] not in pinned or not source['section'].strip():
                raise ValueError('Unpinned source: ' + cid)
        status = case['status']
        if status not in {'NOT_RUN', 'BLOCKED', 'PASS', 'FAIL', 'N/A'}:
            raise ValueError('Invalid execution state: ' + cid)
        if status in {'PASS', 'FAIL'}:
            if not case['evidence']:
                raise ValueError('Executed status without evidence: ' + cid)
            for evidence in case['evidence']:
                for field in ('testedCommit', 'environment', 'executedAt', 'actual', 'artifact'):
                    if not evidence.get(field):
                        raise ValueError('Incomplete evidence: ' + cid)
        if status in {'BLOCKED', 'N/A'} and not case.get('reason'):
            raise ValueError('Missing state explanation: ' + cid)
        covered_s.update(case['scenarioIds']); covered_t.update(case['taskIds'])
    if covered_s != scenarios or covered_t != tasks:
        raise ValueError('Missing scenario/task coverage')
    return {'cases': len(seen), 'scenarios': len(covered_s), 'tasks': len(covered_t)}

if __name__ == '__main__':
    print(json.dumps(validate(json.loads((ROOT/'docs/qa/test-cases.json').read_text())), ensure_ascii=False))
