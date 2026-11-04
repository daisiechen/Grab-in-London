"""Check feedback completeness and evidence declarations, not browser execution."""
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


class UserFeedbackTrace(unittest.TestCase):
    def setUp(self):
        self.registry = json.loads((ROOT / 'docs/reviews/r12/feedback-21-register.json').read_text())

    def test_all_user_comments_have_one_owned_version_and_evidence(self):
        cases = self.registry['cases']
        self.assertEqual([c['id'] for c in cases], [f'C{i:02}' for i in range(1, 22)])
        self.assertEqual([c['userComment'] for c in cases], list(range(1, 22)))
        for case in cases:
            with self.subTest(comment=case['id']):
                self.assertTrue(case['owner'])
                self.assertTrue(case['request'])
                self.assertTrue(case['entryUrl'].startswith('https://www.figma.com/proto/'))
                self.assertTrue((ROOT / case['evidenceReport']).is_file())

    def test_resolution_needs_visual_evidence_and_separate_interaction_evidence(self):
        for case in self.registry['cases']:
            with self.subTest(comment=case['id']):
                self.assertEqual(case['resolutionStatus'], 'RESOLVED')
                self.assertEqual(case['visualStatus'], 'PASS')
                self.assertTrue(case['visualEvidence'])
                for path in case['visualEvidence']:
                    self.assertTrue((ROOT / path).is_file(), path)
                if case.get('additionalAffectedVersions'):
                    self.assertEqual(case['additionalResolutionStatus'], 'RESOLVED')
                    self.assertTrue((ROOT / case['additionalEvidence']).is_file())
                if case['interactionRequired']:
                    self.assertEqual(case['interactionStatus'], 'PASS')
                    self.assertEqual(case['interactionMethod'], 'local-browser-click')
                    source = ROOT / case['interactionEvidence']
                    self.assertTrue(source.is_file())
                    evidence = json.loads(source.read_text())
                    if evidence.get('comment') == case['id']:
                        self.assertEqual(evidence['status'], 'PASS')
                        self.assertIn('mouse', evidence['method'].lower())
                        self.assertTrue(all(s['steps'] for s in evidence['scenarios']))
                    else:
                        match = next(c for c in evidence['cases'] if c['id'] == case['id'])
                        self.assertEqual(match['interaction']['status'], 'PASS')
                        self.assertIn('mouse', match['interaction']['method'].lower())
                        self.assertTrue(match['interaction']['steps'])
                else:
                    self.assertEqual(case['interactionStatus'], 'NOT_APPLICABLE')


if __name__ == '__main__':
    unittest.main()
