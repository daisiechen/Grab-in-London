"""Explicit multi-PM authorization must keep ownership and stage boundaries."""
from pathlib import Path
import json
import unittest

ROOT = Path(__file__).resolve().parents[1]


class PMParallelDispatchTest(unittest.TestCase):
    def test_first_release_has_three_disjoint_pm_owners(self):
        data = json.loads((ROOT / 'docs/delivery/pm-parallel-dispatch.json').read_text())
        self.assertEqual(data['allowedStages'], ['PM'])
        self.assertEqual(data['forbiddenStages'], ['UX', 'RD', 'QA'])
        self.assertEqual(data['maxConcurrentPM'], 3)
        self.assertEqual(len(data['lanes']), 3)
        self.assertEqual(data['laterJourneysNotIssued'], ['J12', 'J13', 'J14', 'J15'])
        assigned = []
        files = set()
        for lane in data['lanes']:
            self.assertTrue(lane['journeys'])
            assigned.extend(lane['journeys'])
            for path in lane['writeAllowlist']:
                self.assertNotIn(path, files)
                self.assertTrue(path.startswith(('docs/product/journeys/', 'demo/journeys/', 'tests/test_pm_j')))
                files.add(path)
        self.assertEqual(sorted(assigned), [f'J{i:02}' for i in range(1, 12)])
        self.assertEqual(len(assigned), len(set(assigned)))
        execution = json.loads((ROOT / 'docs/delivery/journey-execution.json').read_text())
        for j in execution['journeys']:
            if j['id'] in assigned:
                self.assertEqual(j['pmOwner'], next(l['id'] for l in data['lanes'] if j['id'] in l['journeys']))
            for stage in ('UX', 'RD', 'QA'):
                self.assertEqual(j['stages'][stage], 'not-started')


if __name__ == '__main__':
    unittest.main()
