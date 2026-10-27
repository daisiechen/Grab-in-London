"""Check evidence declarations; these tests do not establish browser execution.

Actual click results must come from the linked browser walkthrough records.
"""
import hashlib
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


class IOSPrototypeEvidence(unittest.TestCase):
    def test_each_version_has_explicit_click_evidence_and_remaining_scope(self):
        for version in range(1, 5):
            with self.subTest(version=version):
                report = ROOT / f'docs/reviews/r11/ios{version}-prototype-retest-2026-10-27.json'
                data = json.loads(report.read_text())
                self.assertTrue(data['remainingUnverified'])
                self.assertTrue(data['cases'])
                for path, digest in data.get('postRepairInputSHA256', {}).items():
                    self.assertEqual(hashlib.sha256((ROOT / path).read_bytes()).hexdigest(), digest)
                ids = [case['id'] for case in data['cases']]
                self.assertEqual(len(ids), len(set(ids)))
                for case in data['cases']:
                    self.assertIn(case['status'], {'PASS', 'FAIL', 'BLOCKED', 'NOT_RUN'})
                    self.assertTrue(case['observed'])
                    self.assertTrue(case['entryUrl'].startswith('https://www.figma.com/proto/'))
                    if case['status'] == 'PASS':
                        self.assertEqual(case['method'], 'browser-click')
                        self.assertTrue(case['steps'], case['id'])
                status_path = ROOT / f'docs/delivery/versions/ios-0.1.0-dev.{version}/status.json'
                status = json.loads(status_path.read_text())
                if version == 1:
                    self.assertFalse(status['developmentPlan']['implementationStarted'])
                    self.assertEqual(status['singleVersionTests']['status'], 'NOT_RUN')
                else:
                    self.assertFalse(status['implementationStarted'])
                    self.assertFalse(status['QAStarted'])
                self.assertIn(report.relative_to(ROOT).as_posix(), json.dumps(status))


if __name__ == '__main__':
    unittest.main()
