"""Design evidence checks, not QA of real services or Figma Presentation."""
import hashlib
import json
from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
D = ROOT / 'docs/design/r10/ios-0.1.0-dev.2'

def digest(data):
    return hashlib.sha256(data).hexdigest()

class HostJourneyDesignEvidence(unittest.TestCase):
    def test_frozen_inputs_and_package_integrity(self):
        m = json.loads((D / 'artifact-manifest.json').read_text())
        for path, expected in m['inputSHA256'].items():
            self.assertEqual(digest(subprocess.check_output(['git', 'show', m['businessCommit'] + ':' + path], cwd=ROOT)), expected)
            self.assertEqual(digest((ROOT / path).read_bytes()), expected)
        for path, expected in m['visualSource']['pathSHA256'].items():
            self.assertEqual(digest(subprocess.check_output(['git', 'show', m['visualSource']['commit'] + ':' + path], cwd=ROOT)), expected)
        for path, expected in m['filesSHA256'].items():
            self.assertEqual(digest((D / path).read_bytes()), expected, path)
        self.assertEqual(digest((D / 'planning-input.json').read_bytes()), m['planningProjectionSHA256'])
        self.assertFalse(m['ownerApproved'])
        self.assertFalse(m['implementationReady'])
        self.assertFalse(m['figma']['frozen'])
        self.assertIsNone(m['figma']['namedVersionId'])
        self.assertFalse(m['stages']['RDImplementation'])
        self.assertFalse(m['stages']['QA'])
        self.assertFalse(m['validation']['presentationEndToEnd'])
        self.assertFalse(m['validation']['crossFileIntegration'])

    def test_complete_prd_mapping_native_graph_and_confirmation_gates(self):
        coverage = json.loads((D / 'coverage.json').read_text())
        source = json.loads((ROOT / coverage['inheritedSourceUnits']['path']).read_text())
        self.assertEqual([r['pmRequirement'] for r in coverage['mapping']], source['requirements'])
        self.assertEqual(coverage['inheritedSourceUnits']['count'], len(source['sourceUnits']))
        self.assertEqual({a['id'] for a in coverage['acceptanceMapping']}, {f'J02-AC{i:02}' for i in range(1, 11)})
        roots = {r['id']: r for r in json.loads((D / 'figma-readback.json').read_text())['roots']}
        self.assertEqual(len(roots), 26)
        for row in coverage['mapping'] + coverage['acceptanceMapping']:
            for node in row['figmaNodes']:
                self.assertIn(node, roots)
        for root in roots.values():
            self.assertEqual((root['width'], root['height']), (393, 852))
            self.assertGreater(root['vectorCount'], 0)
            self.assertNotIn('0.00', [t['text'] for t in root['text']], 'No fragmented old zero charge')
            self.assertTrue(all('No in-app payment to refund' not in t['text'] for t in root['text']))
            for scroll in root['scroll']:
                self.assertEqual(scroll['height'], 750)
                self.assertEqual(scroll['overflow'], 'VERTICAL')
            for image in root['images']:
                self.assertTrue(all(h in {'37c690b68e4cf5cc2c67287eed096bee86439ec5', 'b8daa0c395427f6b36a7465a4fa4e1b1d7429f9e', '6016dcd9183cce8ee4f613e747e76e0a116669ad', '1b7c121c094c3130243c4d7918a6c34ff4d837d7'} for h in image['hashes']))
                self.assertFalse(image['width'] == 393 and image['height'] == 852, 'No full-screen raster UI')
            for action in root['actions']:
                for reaction in action['reactions']:
                    for a in reaction.get('actions') or []:
                        if a.get('type') == 'NODE' and a.get('destinationId'):
                            self.assertIn(a['destinationId'], roots)
                            self.assertNotEqual(a['destinationId'], root['id'])
        def targets(node):
            return {a.get('destinationId') for c in roots[node]['actions'] for r in c['reactions'] for a in r.get('actions', [])}
        self.assertNotIn('1:594', targets('1:449'), 'Unconfirmed host declaration cannot continue')
        self.assertIn('4:164', targets('1:449'))
        self.assertIn('1:594', targets('4:164'))
        self.assertNotIn('1:719', targets('1:594'), 'Unchecked final review cannot publish')
        self.assertIn('3:2365', targets('1:594'))
        self.assertIn('1:719', targets('3:2365'))
        self.assertNotIn('3:4021', targets('3:3907'), 'Booking update needs explicit confirmation')
        self.assertIn('5:188', targets('3:3907'))
        self.assertIn('3:4021', targets('5:188'))
        for node in ('1:449', '4:164'):
            text = '\n'.join(t['text'] for t in roots[node]['text'])
            self.assertNotIn('Deposit in the app', text)
            self.assertNotIn('Fixed menu in the app', text)
            self.assertNotIn('Book through the app', text)
            self.assertNotIn('Due in the app', text)
            self.assertNotIn('Collected when you publish', text)
            self.assertIn('Pay individually at the restaurant', text)
            self.assertIn('£25–35', text)
        approved = roots['3:3809']['text']
        self.assertIn('2', [t['text'] for t in approved])
        self.assertIn('Confirmed', [t['text'] for t in approved])
        for t in approved:
            if t['text'].startswith('Key arrangements are permanently locked'):
                self.assertGreaterEqual(t['height'], 38)
        for name in ('arrange', 'introduce', 'review', 'approved', 'cancel-confirm'):
            self.assertEqual((D / f'evidence/figma-{name}.png').read_bytes()[:8], b'\x89PNG\r\n\x1a\n')
        self.assertTrue((D / 'evidence/old-introduce-unfocused.png').exists())

if __name__ == '__main__':
    unittest.main()
