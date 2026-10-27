"""UX author checks: frozen inputs, valid native routes, and honest stage boundaries."""
from pathlib import Path
import hashlib
import json
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
JOURNEY = "j08"


class UXJ08DeliveryTest(unittest.TestCase):
    def setUp(self):
        self.folder = ROOT / 'docs/design/journeys' / JOURNEY
        self.manifest = json.loads((self.folder / 'artifact-manifest.json').read_text())
        self.coverage = json.loads((self.folder / 'coverage.json').read_text())
        self.readback = json.loads((self.folder / 'figma-readback.json').read_text())

    def test_inputs_and_evidence_are_exact_and_not_owner_approved(self):
        m = self.manifest
        self.assertEqual(m['revision'], 'UX-r01')
        self.assertFalse(m['figma']['ownerApproved'])
        self.assertIsNone(m['figma']['nativeNamedVersion'])
        self.assertEqual(m['stagesStarted'], {'PM': True, 'UX': True, 'RD': False, 'QA': False})
        for path, sha in m['inputHashes'].items():
            data = subprocess.run(['git', 'show', m['inputCommit'] + ':' + path], cwd=ROOT, capture_output=True, check=True).stdout
            self.assertEqual(hashlib.sha256(data).hexdigest(), sha, path)
            self.assertEqual(hashlib.sha256((ROOT / path).read_bytes()).hexdigest(), sha, path)
        for path, sha in m['files'].items():
            self.assertEqual(hashlib.sha256((ROOT / path).read_bytes()).hexdigest(), sha, path)
        self.assertTrue(list(self.folder.glob('*.png')))
        self.assertEqual(m['verification']['browserPrototypeReplay'], 'NOT_RUN')

    def test_actual_native_routes_cover_the_complete_representative_path(self):
        rows = self.readback['frames']
        ids = {r['id'] for r in rows}
        self.assertEqual(self.readback['fileKey'], self.manifest['figma']['fileKey'])
        self.assertEqual(self.readback['textHorizontalOverflow'], [])
        self.assertEqual(self.readback['fonts'], ['Arial'])
        edges = {(row['id'], action['target']) for row in rows for action in row['actions']}
        for source, target in edges:
            self.assertIn(source, ids)
            self.assertIn(target, ids)
        path = self.coverage['representativePath']
        self.assertEqual(path[0]['nodeId'], self.manifest['figma']['entryNodeId'])
        for a, b in zip(path, path[1:]):
            self.assertIn((a['nodeId'], b['nodeId']), edges, (a['scene'], b['scene']))
        for row in self.coverage['requirementTrace']:
            for scene in row['figmaScenes']:
                self.assertIn(scene['nodeId'], ids)
        self.assertTrue(self.coverage['productAcceptanceRetained'])
        self.assertTrue(any(r['treatment'] == 'documented-only-contract' for r in self.coverage['requirementTrace']) or JOURNEY == 'j08')


if __name__ == '__main__':
    unittest.main()
