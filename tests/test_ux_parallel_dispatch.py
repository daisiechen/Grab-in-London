"""UX authorization binds each independent design to unchanged PM inputs."""
from pathlib import Path
import hashlib
import json
import unittest

ROOT = Path(__file__).resolve().parents[1]


class UXParallelDispatchTest(unittest.TestCase):
    def test_unique_owners_exact_inputs_and_design_only_scope(self):
        data = json.loads((ROOT / 'docs/delivery/ux-parallel-dispatch.json').read_text())
        self.assertEqual(data['allowedStages'], ['UX'])
        self.assertEqual(data['forbiddenStages'], ['RD', 'QA'])
        self.assertEqual(data['maxConcurrentUX'], 3)
        self.assertTrue(data['sourceArtifactsReadOnly'])
        self.assertTrue(data['oldFigmaReadOnly'])
        assigned = [j for lane in data['lanes'] for j in lane['journeys']]
        self.assertEqual(sorted(assigned), [f'J{i:02}' for i in range(1, 12)])
        self.assertEqual(len(assigned), len(set(assigned)))
        paths = [p for lane in data['lanes'] for p in lane['writeAllowlist']]
        self.assertEqual(len(paths), len(set(paths)))
        execution = json.loads((ROOT / 'docs/delivery/journey-execution.json').read_text())
        historical = json.loads((ROOT / 'docs/delivery/ux-first-release-review.json').read_text())
        for journey, record in data['inputs'].items():
            for path, sha in record['sha256'].items():
                self.assertEqual(hashlib.sha256((ROOT / path).read_bytes()).hexdigest(), sha, path)
            lane = next(l for l in data['lanes'] if journey in l['journeys'])
            self.assertEqual(record['owner'], lane['id'])
            self.assertEqual(record['figmaFilePolicy'], 'one-independent-editable-design-file-per-journey')
            current = next(j for j in execution['journeys'] if j['id'] == journey)
            old = next(j for j in historical['journeys'] if j['id'] == journey)
            self.assertEqual(old['owner'], lane['id'])
            self.assertTrue(current['pmAcceptedForUX'])
            self.assertFalse(current['acceptedForNextStage'])
            for stage in ('RD', 'QA'):
                self.assertEqual(current['stages'][stage], 'not-started')
        self.assertFalse(execution['rdStartAllowed'])
        self.assertFalse(execution['qaStartAllowed'])
