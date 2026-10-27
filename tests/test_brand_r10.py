"""Check native Logo candidate exports and scope without changing product UI."""
from pathlib import Path
import hashlib
import json
import struct
import unittest
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
FOLDER = ROOT / 'docs/design/r10/brand'


class BrandR10Test(unittest.TestCase):
    def test_candidate_has_two_directions_and_no_owner_or_ui_approval(self):
        manifest = json.loads((FOLDER / 'artifact-manifest.json').read_text())
        self.assertEqual(manifest['revision'], 'BRAND-0.1.0')
        self.assertEqual(set(manifest['directions']), {'A', 'B'})
        self.assertEqual(manifest['recommendedDirection'], 'A')
        self.assertIsNone(manifest['ownerSelectedDirection'])
        self.assertFalse(manifest['ownerApproved'])
        self.assertFalse(manifest['uiReplacementStarted'])
        self.assertFalse(manifest['trademarkChecked'])
        self.assertIsNone(manifest['figma']['namedVersionId'])
        for group in ('inputHashes', 'files'):
            for path, digest in manifest[group].items():
                self.assertEqual(hashlib.sha256((ROOT / path).read_bytes()).hexdigest(), digest, path)

    def test_svg_assets_are_editable_vectors_without_external_dependencies(self):
        allowed = {'#123f35', '#f5f2e8', '#d7ee79', '#e96943', 'none'}
        assets = list((FOLDER / 'assets').glob('*.svg'))
        self.assertEqual(len(assets), 11)
        for path in assets:
            with self.subTest(asset=path.name):
                root = ET.fromstring(path.read_text())
                self.assertTrue(root.tag.endswith('svg'))
                self.assertIn('viewBox', root.attrib)
                for node in root.iter():
                    tag = node.tag.rsplit('}', 1)[-1]
                    self.assertNotIn(tag, {'image', 'script', 'foreignObject', 'text'})
                    for attr in ('fill', 'stroke'):
                        if attr in node.attrib:
                            self.assertIn(node.attrib[attr].lower(), allowed)
                    for key, value in node.attrib.items():
                        if key.endswith('href'):
                            self.assertTrue(value.startswith('#'))
                if 'app-icon' in path.name:
                    self.assertEqual(root.attrib['width'], '1024')
                    self.assertEqual(root.attrib['height'], '1024')
                    rectangles = [n for n in root.iter() if n.tag.endswith('rect')]
                    self.assertTrue(any(n.attrib.get('width') == '1024' and
                                        n.attrib.get('height') == '1024' and
                                        n.attrib.get('fill', '').lower() == '#123f35' and
                                        float(n.attrib.get('rx', 0)) == 0 for n in rectangles))

    def test_png_dimensions_and_verified_backgrounds_match_the_intended_use(self):
        rows = json.loads((FOLDER / 'png-verification.json').read_text())
        self.assertEqual(len(rows), 6)
        for row in rows:
            data = (ROOT / row['path']).read_bytes()
            self.assertEqual(data[:8], b'\x89PNG\r\n\x1a\n')
            width, height = struct.unpack('>II', data[16:24])
            self.assertEqual((width, height), (row['width'], row['height']))
            if 'app-icon' in row['path']:
                self.assertEqual((width, height), (1024, 1024))
                self.assertEqual((row['alphaMin'], row['alphaMax']), (255, 255))
                self.assertEqual(row['cornerRGBA'], [18, 63, 53, 255])
            else:
                size = 24 if '-24.' in row['path'] else 32
                self.assertEqual((width, height), (size, size))
                self.assertEqual(row['alphaMin'], 0)
                self.assertEqual(row['cornerRGBA'][3], 0)

    def test_figma_source_retains_native_components_and_live_wordmark(self):
        graph = json.loads((FOLDER / 'figma-readback.json').read_text())
        self.assertEqual(graph['imageNodes'], [])
        self.assertEqual(graph['fonts'], ['Arial'])
        self.assertGreater(graph['types']['VECTOR'], 0)
        self.assertGreater(graph['types']['INSTANCE'], 0)
        words = [t['text'] for c in graph['components'] for t in c['texts']]
        self.assertIn('Fancy', words)
        for component in graph['components']:
            if 'App icon' in component['name']:
                self.assertEqual((component['width'], component['height']), (1024, 1024))
                self.assertEqual(component['cornerRadius'], 0)
        self.assertNotIn('/api/mcp/asset/', (FOLDER / 'figma-readback.json').read_text())
