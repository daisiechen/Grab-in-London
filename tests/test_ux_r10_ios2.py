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
        self.assertGreaterEqual(len(roots), 42)
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

    def test_costs_helper_never_covers_budget_on_downward_scroll(self):
        proof=json.loads((ROOT/'docs/design/r10/ios-0.1.0-dev.2/evidence/r11-costs-helper-readback.json').read_text())
        self.assertEqual({r['id'] for r in proof['roots']},{'1:449','4:164'})
        before=proof['originalCounterexample']
        self.assertLess(before['budgetY'][0],before['oldHelperY'][1])
        self.assertGreater(before['budgetY'][1],before['oldHelperY'][0])
        for root in proof['roots']:
            self.assertEqual(root['scrollOrigin'],0)
            full,hide,tucked=root['helpers']
            self.assertFalse(full['visible'])
            self.assertTrue(tucked['visible'])
            self.assertEqual((tucked['x'],tucked['y'],tucked['width'],tucked['height']),(349,678,64,64))
            for scroll in [0,120,420,451.5625]:
                self.assertTrue(all(a['y']+a['height']-scroll < full['y'] for a in root['amounts']))
            for control,values in [(tucked,[False,True]),(hide,[False,True])]:
                actions=control['reactions'][0]['actions']
                self.assertEqual([a['type'] for a in actions],['SET_VARIABLE','SET_VARIABLE'])
                self.assertEqual([a['variableValue']['value'] for a in actions],values)

    def test_published_edit_candidate_preserves_cancel_and_lock(self):
        proof=json.loads((D/'evidence/r11-published-edit-readback.json').read_text())
        roots={r['id']:r for r in proof['roots']}
        nodes={n['id']:n for r in roots.values() for n in r['actions']}
        def actions(n):
            return [a for rx in n.get('reactions',[]) for a in rx.get('actions',[])]
        self.assertEqual(actions(nodes[proof['entry']])[0]['destinationId'],'56:290')
        for rootid in proof['sourceMapping'].values():
            root=roots[rootid]
            self.assertTrue(any(t['text']=='Cancel' for t in root['text']))
            cancel=next(n for n in root['actions'] if n['name']=='button / Go back')
            self.assertEqual(actions(cancel)[0]['destinationId'],'1:719')
        self.assertTrue(any(t['text']=='Save changes' for t in roots['56:1111']['text']))
        save=actions(nodes[proof['save']])
        self.assertEqual(save[-1]['destinationId'],'1:719')
        self.assertEqual(save[0]['variableValue']['value'],'Your changes are saved.')
        for root in proof['lockedSources']:
            self.assertLess(root['opacity'],0.5)
            self.assertEqual(root['reactions'],[])
        timed=roots['1:719']['rootReactions'][0]
        self.assertEqual(timed['trigger'],{'type':'AFTER_TIMEOUT','timeout':2})
        self.assertFalse(timed['actions'][0]['variableValue']['value'])
        self.assertFalse(actions(nodes['1:873'])[0]['variableValue']['value'])

    def test_published_notice_lines_and_minimum_sample_are_consistent(self):
        proof=json.loads((D/'evidence/r11-published-layout-min3-readback.json').read_text())
        self.assertEqual(proof['scrollOrigin'],0)
        self.assertEqual(proof['history']['oldNoteY'],[-0.75,-0.75])
        self.assertEqual(proof['history']['oldPublishedMinimum'],2)
        self.assertTrue(proof['history']['businessMinimum2StillAllowed'])
        self.assertTrue(proof['history']['confirmedSeatCountsUnchanged'])
        for n in proof['notices']:
            first,second=n['text']
            self.assertLessEqual(first['y']+first['height'],second['y'])
            self.assertLessEqual(second['y']+second['height'],n['height'])
        self.assertEqual(proof['arrangeSample']['minimumValue'],3)
        self.assertEqual(proof['arrangeSample']['capacityValue'],4)
        self.assertGreaterEqual(len(proof['minimumText']),14)
        for row in proof['minimumText']:
            self.assertTrue(row['text']=='3' or row['text'].startswith('Minimum 3 · Capacity 4'))

if __name__ == '__main__':
    unittest.main()
