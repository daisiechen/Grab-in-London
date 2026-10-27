"""I1 journey coverage and actual Figma representative-route integrity; I2 is UX-2 owned."""
import hashlib
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / 'docs/design/r10/ios-0.1.0-dev.1'


class IOSFirstIterationContract(unittest.TestCase):
    def setUp(self):
        self.manifest = json.loads((PACKAGE / 'artifact-manifest.json').read_text())
        self.readback = json.loads((PACKAGE / 'evidence/final-readback.json').read_text())
        self.frames = {f['id']: p['id'] for p in self.readback['pages'] for f in p['frames']}
        self.routes = json.loads((PACKAGE / 'evidence/representative-routes.json').read_text())

    def test_business_inputs_and_all_acceptance_items_have_precise_boundaries(self):
        for path, expected in self.manifest['businessBaseline']['sourceHashes'].items():
            self.assertEqual(hashlib.sha256((ROOT / path).read_bytes()).hexdigest(), expected, path)
        cov = json.loads((PACKAGE / 'coverage.json').read_text())
        expected = {f'J01-AC{i:02}' for i in range(1, 8)} | {f'J05-AC{i:02}' for i in range(1, 6)}
        self.assertEqual({c['id'] for c in cov['coverage']}, expected)
        self.assertFalse(cov['allCombinationsInteractive'])
        for c in cov['coverage']:
            self.assertTrue(set(c['figmaNodes']).issubset(self.frames), c['id'])
            self.assertTrue((PACKAGE / c['spec']).is_file())

    def test_real_graph_preserves_explicit_consent_and_manual_submission(self):
        actual = {(r['id'], a['destinationId']) for r in self.readback['routes'] for re in r['reactions'] for a in re.get('actions', []) if a.get('type') == 'NODE'}
        self.assertEqual(actual, {(r['source'], r['target']) for r in self.routes})
        for source, target in [('5:95', '5:195'), ('5:332', '10:65'), ('10:508', '11:753'), ('12:468', '12:474'), ('12:529', '11:978'), ('11:1022', '11:2510'), ('11:2588', '11:1191'), ('12:803', '15:212'), ('15:269', '15:308'), ('15:361', '11:978'), ('11:2508', '15:410')]:
            self.assertIn((source, target), actual)
        for _, target in actual:
            self.assertIn(target, self.frames)
        self.assertNotIn(('12:803', '11:978'), actual)

    def test_content_images_allowed_but_no_screen_bitmap_or_false_stage_claim(self):
        allowed = {'37c690b68e4cf5cc2c67287eed096bee86439ec5', 'b8daa0c395427f6b36a7465a4fa4e1b1d7429f9e', 'addae062e371410786a3e2e8810f1c67bfb659ae', '6016dcd9183cce8ee4f613e747e76e0a116669ad', '1b7c121c094c3130243c4d7918a6c34ff4d837d7', 'af1c776d6730bf001f6f64a2900bfd3e4ccf34d2'}
        self.assertTrue(self.readback['imageHashes'])
        self.assertTrue(set(self.readback['imageHashes']).issubset(allowed))
        self.assertGreater(self.readback['textCount'], 200)
        self.assertFalse(self.manifest['ownerApproved'])
        self.assertIsNone(self.manifest['nativeNamedVersionId'])
        self.assertEqual(self.manifest['stages']['RD'], 'not-started')
        self.assertEqual(self.manifest['stages']['QA'], 'not-started')
        self.assertEqual(hashlib.sha256((PACKAGE / 'evidence/final-readback.json').read_bytes()).hexdigest(), self.manifest['readbackSHA256'])


if __name__ == '__main__':
    unittest.main()
