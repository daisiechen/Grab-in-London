"""Keep the PJ's published evidence complete and its stage boundary explicit."""
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


class PJReviewEvidenceTest(unittest.TestCase):
    def test_all_journeys_have_two_successful_browser_walks(self):
        folder = ROOT / 'docs/reviews/evidence/pm-journeys-2026-10-27'
        evidence = json.loads((folder / 'flows.json').read_text())
        rows = evidence['rows']
        self.assertEqual(len(rows), 22)
        self.assertEqual({(r['journey'], r['viewport']) for r in rows},
                         {(f'J{i:02}', width) for i in range(1, 12) for width in (1440, 390)})
        for row in rows:
            with self.subTest(journey=row['journey'], viewport=row['viewport']):
                self.assertEqual(row['status'], 'flow-passed')
                self.assertEqual(row['prd'], 'visible-full-text-matches-source')
                self.assertEqual(row['prdPresentation'], 'formatted')
                for field in ('pageErrors', 'consoleMessages', 'requestFailures', 'geometryViolations'):
                    self.assertEqual(row[field], [])
                self.assertGreater(len(row['steps']), 5)
                screenshot = folder / f"{row['journey'].lower()}-{row['viewport']}-flow-complete.png"
                self.assertEqual(screenshot.read_bytes()[:8], b'\x89PNG\r\n\x1a\n')
                if row['journey'] in ('J01', 'J05', 'J06'):
                    self.assertEqual(row['demoToPRD'], 'clicked-and-read-matching-PRD')

    def test_review_does_not_dispatch_downstream_stages(self):
        execution = json.loads((ROOT / 'docs/delivery/journey-execution.json').read_text())
        self.assertEqual(execution['reviewStatus'], 'ux-r02-candidates-delivered-design-ready-pending')
        evidence = json.loads((ROOT / 'docs/reviews/evidence/pm-journeys-2026-10-27/flows.json').read_text())
        self.assertEqual(evidence['stagesNotStarted'], ['UX', 'RD', 'QA'])
        for row in execution['journeys']:
            if row['id'] in {f'J{i:02}' for i in range(1, 12)}:
                self.assertFalse(row['acceptedForNextStage'])
                for stage in ('RD', 'QA'):
                    self.assertEqual(row['stages'][stage], 'not-started')
