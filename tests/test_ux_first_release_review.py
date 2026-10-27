"""Check eleven independent UX deliveries against their pinned PM and PJ evidence."""
import hashlib
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


class UXFirstReleaseReviewTest(unittest.TestCase):
    def test_all_deliveries_have_exact_inputs_and_independent_figma_files(self):
        record = json.loads((ROOT / 'docs/delivery/ux-first-release-review.json').read_text())
        dispatch = json.loads((ROOT / 'docs/delivery/ux-parallel-dispatch.json').read_text())
        rows = record['journeys']
        self.assertEqual([r['id'] for r in rows], [f'J{i:02}' for i in range(1, 12)])
        self.assertEqual(len({r['fileKey'] for r in rows}), 11)
        self.assertEqual(record['professionalStagesNotStarted'], ['RD', 'QA'])
        self.assertFalse(record['ownerApproved'])
        self.assertFalse(record['nativeFigmaVersionsFrozen'])
        for row in rows:
            with self.subTest(journey=row['id']):
                manifest = json.loads((ROOT / row['manifest']).read_text())
                self.assertEqual(row['fileKey'], manifest['figma']['fileKey'])
                self.assertEqual(row['entryNodeId'], manifest['figma']['entryNodeId'])
                self.assertEqual(row['owner'], dispatch['inputs'][row['id']]['owner'])
                for field in ('requirementsRevision', 'demoRevision'):
                    self.assertEqual(row[field], dispatch['inputs'][row['id']][field])
                for path, digest in dispatch['inputs'][row['id']]['sha256'].items():
                    self.assertEqual(manifest['inputHashes'][path], digest)
                for field in ('manifest', 'pjReadback', 'pjScreenshot'):
                    self.assertEqual(hashlib.sha256((ROOT / row[field]).read_bytes()).hexdigest(),
                                     row[field + 'SHA256'])
                self.assertFalse(row['rdStartAllowed'])
                self.assertFalse(row['qaStartAllowed'])

    def test_pj_observations_are_complete_without_claiming_presentation_or_qa(self):
        record = json.loads((ROOT / 'docs/delivery/ux-first-release-review.json').read_text())
        self.assertEqual(record['presentationClickThrough'], 'not-run')
        for row in record['journeys']:
            graph_path = ROOT / row['pjReadback']
            graph = json.loads(graph_path.read_text())
            self.assertEqual(graph['reviewRole'], 'PJ')
            self.assertFalse(graph['professionalQA'])
            self.assertEqual(graph['fileKey'], row['fileKey'])
            self.assertEqual(graph['missingTargets'], [])
            self.assertEqual(graph['images'], [])
            self.assertIn(row['entryNodeId'], {s['nodeId'] for s in graph['starts']})
            self.assertGreater(graph['types']['TEXT'], 0)
            self.assertGreater(graph['types']['INSTANCE'], 0)
            self.assertEqual((ROOT / row['pjScreenshot']).read_bytes()[:8], b'\x89PNG\r\n\x1a\n')
            self.assertNotIn('/api/mcp/asset/', graph_path.read_text())
            if row['id'] == 'J04':
                waiting = next(s for s in graph['screens'] if '/ waiting /' in s['name'])
                self.assertIn('Edit my reconnect choice', waiting['text'])
                self.assertNotIn('Withdraw connection', waiting['text'])
                self.assertNotIn('Open private chat', waiting['text'])
