"""r12 I1 candidate evidence contracts; native assertions are never click passes."""
import hashlib
import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / 'docs/design/r12/ios-0.1.0-dev.1'


class IOS1OwnerFeedback(unittest.TestCase):
    def setUp(self):
        self.manifest = json.loads((PACKAGE / 'artifact-manifest.json').read_text())
        self.j01 = json.loads((PACKAGE / 'evidence/j01-readback.json').read_text())
        self.j05 = json.loads((PACKAGE / 'evidence/j05-readback.json').read_text())
        self.nodes = {n['id']: n for n in self.j01['nodes']}

    def targets(self, node):
        return {a['destinationId'] for group in node.get('actions', []) for a in group if a['type'] == 'NODE'}

    def test_all_thirteen_feedback_items_have_honest_evidence_and_hashes(self):
        for rel, expected in self.manifest['filesSHA256'].items():
            self.assertEqual(hashlib.sha256((PACKAGE / rel).read_bytes()).hexdigest(), expected, rel)
        report_path = ROOT / self.manifest['report']
        self.assertEqual(hashlib.sha256(report_path.read_bytes()).hexdigest(), self.manifest['reportSHA256'])
        report = json.loads(report_path.read_text())
        self.assertEqual([c['id'] for c in report['cases']], [f'C{i:02}' for i in range(1, 14)])
        self.assertFalse(report['browserFailure']['runCreated'])
        for case in report['cases']:
            self.assertEqual(case['actualClick']['status'], 'BLOCKED')
            self.assertEqual(case['visualInspection']['status'], 'INSPECTED')
            for path in case['visualInspection']['evidence']:
                self.assertTrue((ROOT / path).is_file())
        self.assertFalse(self.manifest['independentlyApproved'])
        status = json.loads((ROOT / 'docs/delivery/versions/ios-0.1.0-dev.1/status.json').read_text())['designFeedbackR12']
        self.assertEqual(status['reportSHA256'], hashlib.sha256(report_path.read_bytes()).hexdigest())
        self.assertEqual(status['manifestSHA256'], hashlib.sha256((PACKAGE / 'artifact-manifest.json').read_bytes()).hexdigest())

    def test_discover_avatar_hits_are_not_the_meal_and_back_recovers_card(self):
        self.assertAlmostEqual(self.nodes['5:32']['y'], self.nodes['5:36']['y'])
        self.assertGreater(self.nodes['5:32']['x'], 270)
        self.assertEqual(len(self.nodes['5:114']['children']), 3)
        self.assertEqual(self.nodes['5:94']['children'][0], '5:95')
        for avatar, profile, back in [('5:126', '77:175', '77:273'), ('5:128', '77:277', '77:375'), ('5:130', '77:379', '77:477')]:
            self.assertEqual(self.targets(self.nodes[avatar]), {profile})
            self.assertNotIn('5:195', self.targets(self.nodes[avatar]))
            self.assertEqual(self.targets(self.nodes[back]), {'5:17'})
        self.assertEqual(self.targets(self.nodes['5:95']), {'5:195'})

    def test_all_derived_details_remove_duplicate_counts_and_keep_costs_in_bounds(self):
        details = [b for f in self.j01['frames'] for b in f['details'] if any(c['name'] == 'img / detail-hero' for c in b['children'])]
        self.assertEqual(len(details), 7)
        for body in details:
            self.assertEqual(body['duplicateCount'], 0)
            sections = {c['name']: c for c in body['children']}
            self.assertLess(sections['div / host-line']['y'], sections['img / detail-hero']['y'])
            self.assertLess(sections['div / notice']['y'], sections['img / detail-hero']['y'])
            self.assertLessEqual(sections['img / detail-hero']['h'], 110)
            self.assertIn('p / Application deadline', sections)
            for badge in body['badges']:
                self.assertEqual(badge['h'], 16)
                self.assertGreaterEqual(badge['parentW'], 178)
        for id in ['5:318', '5:323']:
            right = self.nodes[id]
            self.assertLessEqual(right['x'] + right['w'], 351)

    def test_auth_selection_and_withdrawn_are_not_stale_or_redundant(self):
        self.assertEqual(self.nodes['10:103']['font']['style'], 'Bold')
        self.assertEqual(self.nodes['10:109']['font']['style'], 'Regular')
        self.assertEqual(self.nodes['13:135']['font']['style'], 'Regular')
        self.assertEqual(self.nodes['13:140']['font']['style'], 'Bold')
        self.assertEqual(self.targets(self.nodes['10:107']), {'13:107'})
        self.assertEqual(self.targets(self.nodes['13:133']), {'10:65'})
        for frame in self.j01['frames']:
            if 'withdrawn' in frame['name']:
                self.assertEqual(frame['withdrawTrack'], 0)
            self.assertEqual(frame['identityEdits'], 0)
            for ornaments in frame['ornaments']:
                self.assertNotIn('i / source', ornaments)
        self.assertTrue(any(f['required'] for f in self.j01['frames']))

    def test_english_launch_and_language_draft_save_cancel_are_distinct(self):
        self.assertEqual(self.j05['optionalRemaining'], [])
        frames = {f['id']: f for f in self.j05['frames']}
        info = frames['78:297']
        self.assertTrue(any('available in English at launch' in t['text'] for t in info['texts']))
        self.assertTrue(any(self.targets(n) == {'11:1611'} for n in info['routes']))
        selector = frames['78:1174']
        self.assertTrue(any(self.targets(n) == {'11:1611'} for n in selector['routes']))
        self.assertTrue(any(self.targets(n) == {'78:807'} for n in selector['routes']))
        draft = frames['78:807']
        self.assertTrue(any(self.targets(n) == {'11:1513'} for n in draft['routes']))
        self.assertTrue(any(self.targets(n) == {'78:944'} for n in draft['routes']))
        self.assertTrue(any(t['text'] == 'English, Spanish' for t in frames['78:944']['texts']))
        self.assertTrue(any(self.targets(n) == {'78:1037'} for n in frames['78:944']['routes']))

    def test_language_selector_keeps_profile_origin_and_cancel_draft(self):
        context = self.j05['contextRepair']
        self.assertEqual(context['sourceProfile'], '11:1611')
        self.assertEqual(context['sourceViewport'], '11:1622')
        self.assertEqual(context['selectorViewport'], '88:342')
        self.assertIn('Edit profile', context['underlayTexts'])
        self.assertIn('Conversation language *', context['underlayTexts'])
        self.assertIn('English', context['underlayTexts'])
        self.assertNotIn('Privacy & safety', context['underlayTexts'])
        self.assertNotIn('Settings', context['underlayTexts'])
        self.assertLess(context['selectorScrollOffset'], 0)
        self.assertEqual(context['draftScrollOffset'], context['selectorScrollOffset'])
        self.assertEqual(context['savedEditScrollOffset'], context['selectorScrollOffset'])
        cancel = context['cancel'][0][0]
        self.assertEqual(cancel['destinationId'], '11:1611')
        self.assertFalse(cancel['resetScrollPosition'])
        choose = context['choose'][0][0]
        self.assertEqual(choose['destinationId'], '78:807')
        self.assertFalse(choose['resetScrollPosition'])

    def test_unique_minimum_and_budget_are_in_each_prephoto_summary(self):
        data = json.loads((PACKAGE / 'evidence/detail-summary-readback.json').read_text())
        self.assertEqual(len(data['frames']), 7)
        for frame in data['frames']:
            texts = {t['text'] for t in frame['texts']}
            self.assertIn('£25–35 / person', texts)
            self.assertIn('Minimum 3 · incl. host', texts)
            self.assertEqual(len(frame['budgetRows']), 1)
            icon = frame['budgetRows'][0]['children'][0]
            self.assertEqual((icon['w'], icon['h']), (14, 14))
            for text in frame['texts']:
                self.assertLess(text['bounds']['y'] + text['bounds']['height'], frame['photoBounds']['y'])
            self.assertEqual(frame['deadline'], ['Applications close 23 Oct, 18:00'])

    def test_owned_markdown_links_resolve(self):
        paths = [PACKAGE / 'handoff.zh-CN.md', ROOT / 'docs/reviews/r12/ios1-user-feedback-2026-10-28.md']
        for file in paths:
            for target in re.findall(r'\]\(([^)]+)\)', file.read_text()):
                if '://' not in target:
                    self.assertTrue((file.parent / target.split('#')[0]).resolve().exists(), (file, target))


if __name__ == '__main__':
    unittest.main()
