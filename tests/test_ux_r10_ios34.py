"""UX evidence checks only; does not claim product QA or real-service testing."""
import hashlib
import json
from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]

def digest(data):
    return hashlib.sha256(data).hexdigest()

class UXIterationEvidence(unittest.TestCase):
    def test_frozen_inputs_and_artifact_integrity(self):
        for number in (3, 4):
            directory = ROOT / f'docs/design/r10/ios-0.1.0-dev.{number}'
            manifest = json.loads((directory / 'artifact-manifest.json').read_text())
            for path, expected in manifest['inputSHA256'].items():
                frozen = subprocess.check_output(['git', 'show', manifest['businessCommit'] + ':' + path], cwd=ROOT)
                self.assertEqual(digest(frozen), expected, path)
                self.assertEqual(digest((ROOT / path).read_bytes()), expected, path)
            for path, expected in manifest['visualSource']['pathSHA256'].items():
                self.assertEqual(digest(subprocess.check_output(['git', 'show', manifest['visualSource']['commit'] + ':' + path], cwd=ROOT)), expected)
            for path, expected in manifest['filesSHA256'].items():
                self.assertEqual(digest((directory / path).read_bytes()), expected, path)
            self.assertEqual(digest((directory / 'planning-input.json').read_bytes()), manifest['planningProjectionSHA256'])
            self.assertFalse(manifest['ownerApproved'])
            self.assertFalse(manifest['implementationReady'])
            self.assertFalse(manifest['figma']['frozen'])
            self.assertIsNone(manifest['figma']['namedVersionId'])
            self.assertFalse(manifest['stages']['RDImplementation'])
            self.assertFalse(manifest['stages']['QA'])

    def test_requirement_mapping_and_real_native_graph(self):
        keys = []
        for number, journeys in ((3, ['J03', 'J04', 'J06']), (4, ['J07', 'J08'])):
            directory = ROOT / f'docs/design/r10/ios-0.1.0-dev.{number}'
            manifest = json.loads((directory / 'artifact-manifest.json').read_text())
            keys.append(manifest['figma']['fileKey'])
            coverage = json.loads((directory / 'coverage.json').read_text())
            readback = json.loads((directory / 'figma-readback.json').read_text())
            self.assertEqual(coverage['journeys'], journeys)
            all_roots = {r['id']: r for p in readback['pages'] for r in p['roots']}
            all_nodes = {n['id']: n for r in all_roots.values() for n in r['nodes']}
            self.assertGreater(len(all_roots), 15)
            for mapping in coverage['mapping']:
                self.assertTrue(mapping['figmaNodes'])
                for node in mapping['figmaNodes']:
                    self.assertIn(node, all_roots)
            for inherited in coverage['sourceUnitInheritance']:
                source = json.loads((ROOT / inherited['path']).read_text())
                self.assertEqual(inherited['sourceUnitCount'], len(source['sourceUnits']))
                self.assertGreater(inherited['sourceUnitCount'], 100)
            for page in readback['pages']:
                roots = {r['id'] for r in page['roots']}
                for root in page['roots']:
                    for node in root['nodes']:
                        for image in node.get('images') or []:
                            self.assertLessEqual(node['width'], 88, 'Only discrete source portraits, no full-screen raster UI')
                            self.assertLessEqual(node['height'], 88)
                        for reaction in node.get('reactions') or []:
                            for action in reaction.get('actions') or []:
                                if action.get('type') == 'NODE' and action.get('destinationId'):
                                    self.assertIn(action['destinationId'], roots)
                                    self.assertNotEqual(action['destinationId'], root['id'])
                                if action.get('type') == 'URL':
                                    self.assertEqual(action['url'], 'mailto:xcheniepaut26@gmail.com')
            def text(node):
                return '\n'.join(n.get('text', '') for n in all_roots[node]['nodes'])
            if number == 3:
                self.assertNotIn('Open private chat', text('7:440'))
                self.assertNotIn('Withdraw connection', text('7:440'))
                self.assertIn('Read-only', text('6:252'))
                self.assertNotIn('Send', text('7:907'))
                self.assertIn('Not sent', all_roots['6:500']['name'])
                self.assertIn('Reasons only', all_roots['8:203']['name'])
            else:
                self.assertIn('not', text('4:154').lower())
                self.assertIn('PENDING', text('5:182'))
                self.assertIn('do not need', text('5:307'))
                self.assertNotIn('123456', text('5:182'))
        self.assertEqual(len(set(keys)), 2)

if __name__ == '__main__':
    unittest.main()
