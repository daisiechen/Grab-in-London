"""I1 journey coverage and actual Figma representative-route integrity; I2 is UX-2 owned."""
import hashlib
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / 'docs/design/r10/ios-0.1.0-dev.1'


def node_actions(actions):
    for action in actions:
        if action.get('type') == 'NODE':
            yield action
        elif action.get('type') == 'CONDITIONAL':
            for block in action['conditionalBlocks']:
                yield from node_actions(block['actions'])


def edges(data):
    return {(r['id'], a['destinationId']) for r in data['routes'] for re in r['reactions'] for a in node_actions(re.get('actions', []))}


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
        actual = edges(self.readback)
        self.assertEqual(actual, {(r['source'], r['target']) for r in self.routes})
        for source, target in [('5:95', '5:195'), ('5:332', '10:65'), ('27:254', '11:753'), ('12:468', '12:474'), ('12:529', '11:978'), ('11:1022', '11:2510'), ('11:2588', '11:1191'), ('12:803', '15:212'), ('15:269', '15:308'), ('15:361', '11:978'), ('11:2508', '15:410')]:
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


class IndependentReviewCounterexamples(unittest.TestCase):
    def setUp(self):
        self.evidence = json.loads((PACKAGE / 'evidence/r11-counterexample-readback.json').read_text())
        data = json.loads((PACKAGE / 'evidence/final-readback.json').read_text())
        self.edges = edges(data)
        self.controls = {n['id']: n for n in self.evidence['controls']}
        self.scenes = {n['id']: n for n in self.evidence['scenes']}

    def test_portrait_is_not_consent_and_no_application_before_explicit_agreement(self):
        self.assertIn(('10:272', '10:375'), self.edges)
        self.assertFalse(self.controls['10:501']['children'])
        self.assertFalse(self.controls['10:508']['reactions'])
        self.assertNotIn(('10:508', '11:753'), self.edges)
        self.assertIn(('10:500', '27:132'), self.edges)
        self.assertIn(('27:254', '11:753'), self.edges)
        self.assertIn(('27:246', '10:375'), self.edges)

    def test_privacy_changed_draft_can_cancel_or_save_then_reenter_confirmed_value(self):
        for edge in [('12:881', '28:672'), ('28:725', '28:778'), ('28:1083', '11:1753'), ('28:999', '28:778'), ('28:835', '28:884'), ('28:937', '12:882'), ('28:1087', '28:778')]:
            self.assertIn(edge, self.edges)
        # A draft/cancel never jumps into the opposite confirmed-success result.
        self.assertNotIn(('28:1083', '28:778'), self.edges)
        self.assertNotIn(('28:1087', '12:882'), self.edges)

    def test_placeholder_cannot_save_unstated_preferences(self):
        self.assertFalse(self.controls['11:1976']['reactions'])
        self.assertIn(('11:1974', '31:257'), self.edges)
        self.assertIn(('31:369', '11:1982'), self.edges)
        proposal = ' '.join(t['text'] for t in self.scenes['31:257']['texts'])
        for value in ['Soho', 'up to £35', 'table for 4', 'English', 'Easy conversation', 'Vegetarian options', 'Confirm and remember']:
            self.assertIn(value, proposal)

    def test_permission_and_allow_are_not_user_send_and_transfer_preserves_all_text(self):
        for node in ['12:313', '33:152', '33:285']:
            text = ' '.join(t['text'] for t in self.scenes[node]['texts'])
            self.assertNotIn('No available tables match', text)
            self.assertNotIn('You ·', text)
        self.assertIn(('12:451', '33:152'), self.edges)
        self.assertNotIn(('12:451', '12:97'), self.edges)
        self.assertIn(('33:400', '12:97'), self.edges)
        full = self.controls['12:295']['text']
        self.assertLessEqual(len(full), 300)
        self.assertTrue(full.endswith('Is there anything I should know before joining?'))
        for node in ['15:212', '15:308']:
            content = [t['text'] for t in self.scenes[node]['texts']]
            self.assertIn(full, content)
        self.assertNotIn(('12:803', '11:978'), self.edges)


    def test_guest_manual_fallback_and_ai_transfer_keep_identity_gate(self):
        graph = json.loads((PACKAGE / 'evidence/final-readback.json').read_text())
        reactions = {r['id']: r['reactions'][0]['actions'] for r in graph['routes']}
        state = {}

        def run(actions):
            destinations = []
            for action in actions:
                if action['type'] == 'SET_VARIABLE':
                    state[action['variableId']] = action['variableValue']['value']
                elif action['type'] == 'NODE':
                    destinations.append(action['destinationId'])
                elif action['type'] == 'CONDITIONAL':
                    for block in action['conditionalBlocks']:
                        condition = block.get('condition')
                        if condition is None or state.get(condition['value']['id'], False):
                            destinations.extend(run(block['actions']))
                            break
            return destinations

        self.assertEqual(run(reactions['12:453']), ['5:195'])
        self.assertFalse(any(state.values()))
        self.assertEqual(run(reactions['12:296']), ['10:65'])
        self.assertEqual(run(reactions['13:247']), ['12:574'])
        state.clear()
        self.assertEqual(run(reactions['5:332']), ['10:65'])
        self.assertEqual(run(reactions['27:254']), ['11:753'])
        self.assertEqual(run(reactions['32:284']), ['31:394'])


if __name__ == '__main__':
    unittest.main()
