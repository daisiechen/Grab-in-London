"""Validate independent version authority, handoffs and release isolation."""
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


class ParallelVersionExecutionTest(unittest.TestCase):
    def setUp(self):
        self.data = json.loads((ROOT / 'docs/delivery/execution-r11.json').read_text())
        self.scope = json.loads((ROOT / self.data['scopeSource']).read_text())

    def test_every_version_has_one_pj_and_an_independent_reviewer(self):
        versions = self.data['versions']
        self.assertEqual({v['id'] for v in versions},
                         {v['id'] for v in self.scope['iterations']})
        self.assertEqual(len(versions), 7)
        assigned = [v for p in self.data['pjAssignments'].values() for v in p['versions']]
        self.assertEqual(sorted(assigned), sorted(v['id'] for v in versions))
        for v in versions:
            self.assertNotEqual(v['pj'], v['independentReviewer'])
            self.assertIn(v['id'], self.data['pjAssignments'][v['pj']]['versions'])
            self.assertIn(v['id'].lower(), v['directory'])
            self.assertEqual(v['statusFile'], v['directory'] + 'status.json')
            self.assertTrue(v['coordinatorSnapshotOnly'])
            live = json.loads((ROOT / v['statusFile']).read_text())
            self.assertEqual(live['id'], v['id'])
            self.assertTrue(live['pj'].startswith(v['pj']))

    def test_latest_decision_removes_global_wait_without_issuing_code(self):
        gate = self.data['designGate']
        self.assertEqual(gate['mode'], 'per-version')
        self.assertFalse(gate['allSevenRequiredBeforeAnyProgress'])
        self.assertTrue(self.scope['initialImplementationGate']['historicalPolicyOnly'])
        self.assertIn('execution-r11.json', self.scope['initialImplementationGate']['supersededBy'])
        self.assertFalse(self.data['workflow']['businessImplementationIssued'])
        for v in self.data['versions']:
            self.assertEqual(v['implementationStatus'], 'not-started')
            self.assertEqual(v['dependencyScope'].split(';')[0], 'integration-only')

    def test_release_closure_and_main_deployment_do_not_follow_each_internal_batch(self):
        store = self.data['storeRelease']
        expected = self.scope['firstExternalRelease']['IOS-0.1.0']['requires']
        self.assertEqual(set(store['firstIncludes']), set(expected))
        self.assertTrue(store['internalIterationsMayCombine'])
        self.assertTrue(store['everyCompletedIOSIterationMustBeAccountedFor'])
        self.assertIsNone(store['fixedAppleMinimumIntervalDays'])
        self.assertFalse(store['phasedReleaseIsSubmissionFrequencyLimit'])
        flow = self.data['workflow']
        self.assertFalse(flow['directMainDevelopmentAllowed'])
        self.assertIn('required CI passed', flow['mergeRequires'])
        self.assertIn('main only', flow['deploySource'])


if __name__ == '__main__':
    unittest.main()
