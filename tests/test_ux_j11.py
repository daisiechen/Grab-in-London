"""Validate the frozen-input UX candidate and its actual Figma read-back evidence."""
import hashlib
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
JOURNEY = 'j11'


class J11UXCandidateTest(unittest.TestCase):
    def test_candidate_preserves_inputs_and_stage_boundary(self):
        folder = ROOT / 'docs/design/journeys' / JOURNEY
        manifest = json.loads((folder / 'artifact-manifest.json').read_text())
        self.assertEqual(manifest['revision'], 'UX-r01')
        self.assertEqual(manifest['status'], 'candidate-awaiting-owner-review')
        self.assertFalse(manifest['figma']['frozen'])
        self.assertIsNone(manifest['figma']['namedVersionId'])
        self.assertFalse(manifest['ownerApproved'])
        self.assertEqual(manifest['stagesStarted'], {'PM': True, 'UX': True, 'RD': False, 'QA': False})
        for field in ('inputHashes', 'files'):
            for path, digest in manifest[field].items():
                self.assertEqual(hashlib.sha256((ROOT / path).read_bytes()).hexdigest(), digest, path)
        pm = json.loads((ROOT / 'docs/product/journeys' / JOURNEY / 'artifact-manifest.json').read_text())
        for field in ('requirementsRevision', 'demoRevision'):
            self.assertEqual(manifest[field], pm.get(field, pm['revision']))

    def test_actual_design_graph_and_scope_mapping(self):
        folder = ROOT / 'docs/design/journeys' / JOURNEY
        graph = json.loads((folder / 'figma-readback.json').read_text())
        mapping = json.loads((folder / 'coverage.json').read_text())
        pm = json.loads((ROOT / 'docs/product/journeys' / JOURNEY / 'coverage.json').read_text())
        screen_ids = {s['nodeId'] for s in graph['screens']}
        self.assertEqual(graph['missingTargets'], [])
        self.assertEqual(graph['imageNodes'], [])
        self.assertGreater(graph['nodeTypes']['TEXT'], 0)
        self.assertGreater(graph['nodeTypes']['INSTANCE'], 0)
        self.assertEqual({s['scenarioId'] for s in mapping['scenarios']}, set(pm['demoScenarios']))
        self.assertEqual([s['sourceRequirements'] for s in mapping['sourceFamilies']],
                         [s['sourceRequirements'] for s in pm['requirements']])
        for scene in mapping['scenarios']:
            self.assertTrue(scene['figmaNodes'])
            self.assertTrue(set(scene['figmaNodes']) <= screen_ids)
        for link in graph['links']:
            self.assertIn(link['destination'], screen_ids)
        self.assertNotIn('https://www.figma.com/api/mcp/asset/', json.dumps(graph))
        screens = {s['key']: s for s in graph['screens']}
        texts = '\n'.join(t['text'] for t in screens['failed']['texts'])
        self.assertIn('分类已接受', texts)
        self.assertIn('统计快照不可用', texts)
        self.assertIn('仅重试统计', texts)
        self.assertNotIn('当前统计快照可用', texts)
        download = '\n'.join(t['text'] for t in screens['downloaded']['texts'])
        self.assertNotIn('实际下载行为以PM Demo', download)
        self.assertIn('无法远程撤回', download)
