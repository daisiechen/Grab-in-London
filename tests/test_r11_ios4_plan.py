"""I4-only design correction and development-plan checks; no other version gate."""
import json
from pathlib import Path
import unittest
ROOT = Path(__file__).resolve().parents[1]

class IOS4VersionPlan(unittest.TestCase):
    def test_local_plan_and_implementation_boundaries(self):
        p = ROOT / 'docs/engineering/r11/ios-0.1.0-dev.4'
        plan = json.loads((p / 'work-packages.json').read_text())
        status = json.loads((ROOT / 'docs/delivery/versions/ios-0.1.0-dev.4/status.json').read_text())
        matrix = json.loads((p / 'test-matrix.json').read_text())
        self.assertEqual(status['designReview'], 'independent-design-scope-passed')
        self.assertEqual(status['independentReviewer'], 'PJ-IOS1 / UX-1')
        self.assertFalse(plan['waitsForAllVersions'])
        self.assertFalse(plan['implementationAuthorized'])
        self.assertGreaterEqual(len(matrix['cases']), 14)
        self.assertTrue(all(c['run'] == 'NOT_RUN' for c in matrix['cases']))
        for w in plan['workPackages']:
            self.assertFalse(w['implementationStarted'])
            self.assertEqual(w['exactWriteLease'], [])
            self.assertIsNone(w['assignedPerson'])
            self.assertTrue(w['PRRequired'])
            self.assertTrue(w['independentCodeReviewRequired'])
        report = plan['workPackages'][0]
        self.assertIn('apps/ios/src/features/settings/ReportScreen.tsx', report['candidatePaths'])
        self.assertEqual(len(report['contractDeltas']), 2)
        self.assertTrue(all(d['owner'] == 'RD-CONTRACTS' for d in report['contractDeltas']))
        self.assertIn('Repeat original createReport POST', report['unknownRecovery']['existingMechanism'])
        self.assertIn('No invented GET /commands', report['unknownRecovery']['forbidden'])
        self.assertIn('policyApproved', plan['workPackages'][3]['completionGate'])

    def test_report_cancel_and_support_source_states(self):
        d = ROOT / 'docs/design/r10/ios-0.1.0-dev.4'
        native = json.loads((d / 'figma-readback.json').read_text())
        roots = {r['id']: r for p in native['pages'] for r in p['roots']}
        nodes = {n['id']: n for r in roots.values() for n in r['nodes']}
        def targets(node):
            return {a.get('destinationId') for r in node.get('reactions', []) for a in r.get('actions', []) if a.get('type') == 'NODE'}
        self.assertEqual(targets(nodes['4:151']), {'15:72'})
        contacts=[n for n in roots['5:348']['nodes'] if n.get('text')=='Contact support']
        self.assertEqual(len(contacts),1)
        self.assertNotIn('5:377',nodes)
        self.assertEqual(targets(nodes['14:178']),{'14:138'})
        self.assertEqual(targets(nodes['15:113']), {'4:78'})
        for support, expected in [('5:307', '5:182'), ('14:97', '5:275'), ('14:138', '5:348')]:
            all_targets = set().union(*(targets(n) for n in roots[support]['nodes']))
            self.assertEqual(all_targets, {expected})
            if expected != '5:182':
                self.assertNotIn('5:182', all_targets)

if __name__ == '__main__':
    unittest.main()
