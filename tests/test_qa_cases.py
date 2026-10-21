"""Test case-pack traceability and prevent unearned execution claims."""
import copy
import importlib.util
import json
from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('qa_validation', ROOT/'scripts/validate-qa-cases.py')
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)

class QACasesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads((ROOT/'docs/qa/test-cases.json').read_text())

    def test_sources_cases_and_coverage_resolve(self):
        result = validator.validate(self.data)
        self.assertGreater(result['cases'], 100)
        self.assertEqual(result['scenarios'], 46)
        self.assertEqual(result['tasks'], 43)

    def test_unknown_trace_and_duplicate_id_are_rejected(self):
        for mutation in ('scenario', 'task', 'duplicate'):
            data = copy.deepcopy(self.data)
            if mutation == 'scenario': data['cases'][0]['scenarioIds'].append('S99')
            if mutation == 'task': data['cases'][0]['taskIds'].append('T99')
            if mutation == 'duplicate': data['cases'].append(data['cases'][0])
            with self.assertRaises(ValueError): validator.validate(data)

    def test_empty_assertion_and_false_pass_are_rejected(self):
        for mutation in ('assertion', 'pass', 'blocked', 'source'):
            data = copy.deepcopy(self.data)
            if mutation == 'assertion': data['cases'][0]['expected'] = []
            if mutation == 'pass': data['cases'][0]['status'] = 'PASS'
            if mutation == 'blocked':
                data['cases'][0]['status'] = 'BLOCKED'; data['cases'][0].pop('reason', None)
            if mutation == 'source': data['cases'][0]['sources'][0]['path'] = '../../secret'
            with self.assertRaises(ValueError): validator.validate(data)

    def test_confirmed_reauth_boundary_is_exclusive_and_unblocked(self):
        case = next(c for c in self.data['cases'] if c['id'] == 'QA-API-008')
        boundary = case['reauthBoundary']
        self.assertEqual(case['status'], 'NOT_RUN')
        self.assertNotIn('reason', case)
        self.assertEqual(boundary['maxAgeMs'], 5 * 60 * 1000)
        self.assertTrue(boundary['exclusive'])
        self.assertEqual({v['ageMs'] for v in boundary['variants']}, {299999, 300000, 300001})
        for variant in boundary['variants']:
            self.assertEqual(variant['valid'], 0 <= variant['ageMs'] < boundary['maxAgeMs'])
        self.assertTrue(case['decision']['text'])

    def test_catalog_renders_reproducibly(self):
        catalog = ROOT/'docs/qa/test-cases.zh-CN.md'
        before = catalog.read_bytes()
        subprocess.run(['python3', str(ROOT/'scripts/render-qa-cases.py')], cwd=ROOT, check=True)
        self.assertEqual(before, catalog.read_bytes())

    def test_planned_pack_does_not_claim_business_results(self):
        self.assertEqual(self.data['status'], 'planned_not_executed')
        for case in self.data['cases']:
            self.assertIn(case['status'], ('NOT_RUN', 'BLOCKED'))
            self.assertEqual(case['evidence'], [])

if __name__ == '__main__':
    unittest.main()
