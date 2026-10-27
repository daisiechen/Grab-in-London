"""DS source integrity and editable-library handoff contract (not functional QA)."""
import hashlib
import json
from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / 'docs/design/r10/system'


class DesignSystemContract(unittest.TestCase):
    def test_visual_inputs_are_exact_frozen_source(self):
        m = json.loads((PACKAGE / 'artifact-manifest.json').read_text())
        v = m['visualBaseline']
        self.assertEqual(v['release'], 'v13')
        for path, expected in v['sourceHashes'].items():
            original = subprocess.check_output(['git', 'show', f"{v['commit']}:{path}"], cwd=ROOT)
            self.assertEqual(hashlib.sha256(original).hexdigest(), expected, path)
        for path, expected in m['sourceContentAssets'].items():
            self.assertEqual(hashlib.sha256((ROOT / path).read_bytes()).hexdigest(), expected)

    def test_semantic_variables_and_real_component_families_exist(self):
        d = json.loads((PACKAGE / 'evidence/final-readback.json').read_text())
        names = {v['name'] for v in d['variables']}
        for name in ['color/action/primary', 'color/text/primary', 'color/separator/default', 'color/border/active']:
            self.assertIn(name, names)
        component_ids = {c['id'] for c in d['components']}
        coverage = json.loads((PACKAGE / 'coverage.json').read_text())
        for family, ids in coverage['families'].items():
            if family != 'tokens':
                self.assertTrue(set(ids).issubset(component_ids), family)
        tokens = json.loads((PACKAGE / 'tokens.json').read_text())
        self.assertEqual(tokens['layout']['mapPreviewImageHeight'], 150)
        self.assertEqual(tokens['controls']['createDiameter'], 53)
        self.assertFalse(tokens['brandAssetVersion']['currentUIChangeApproved'])

    def test_candidate_boundary_and_evidence(self):
        m = json.loads((PACKAGE / 'artifact-manifest.json').read_text())
        self.assertFalse(m['publishedLibrary'])
        self.assertFalse(m['ownerApproved'])
        self.assertIsNone(m['nativeNamedVersionId'])
        self.assertEqual(m['stages']['RD'], 'not-started')
        self.assertEqual(m['stages']['QA'], 'not-started')
        self.assertEqual(hashlib.sha256((PACKAGE / 'evidence/final-readback.json').read_bytes()).hexdigest(), m['readbackSHA256'])
        for path, expected in m['evidenceHashes'].items():
            self.assertEqual(hashlib.sha256((PACKAGE / path).read_bytes()).hexdigest(), expected)


if __name__ == '__main__':
    unittest.main()
