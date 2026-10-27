"""Keep complete user goals, original scope and no-dispatch state aligned."""
from pathlib import Path
import json
import unittest

ROOT = Path(__file__).resolve().parents[1]


class JourneyPlanTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.product = json.loads((ROOT / 'docs/product/journey-modules.json').read_text())
        cls.execution = json.loads((ROOT / 'docs/delivery/journey-execution.json').read_text())
        cls.old = json.loads((ROOT / 'docs/delivery/delivery-batches.json').read_text())
        cls.journeys = {j['id']: j for j in cls.product['journeys']}

    def test_every_prior_capability_is_retained_without_slice_dispatch(self):
        old_current = {b['id'] for b in self.old['batches'] if b['scopeStatus'] == 'current'}
        mapped = {s for j in self.journeys.values() for s in j['legacySlices']}
        self.assertEqual(mapped, old_current)
        old_web = {b['id'] for b in self.old['batches'] if b['scopeStatus'] == 'deferred'}
        self.assertEqual(set(self.product['historicalWebSlices']), old_web)
        self.assertEqual(self.old['planStatus'], 'superseded-readonly')
        self.assertFalse(self.old['pmStartAllowed'])

    def test_first_journey_is_application_with_complete_auth_and_profile(self):
        first = self.journeys['J01']
        steps = ''.join(first['steps'])
        for action in ('注册', '登录', '公开资料', '回到同一饭局', '主动提交', '待发起人审核'):
            self.assertIn(action, steps)
        self.assertTrue({'M01-01', 'M01-02', 'M01-03', 'M01-04', 'M04-01'} <= set(first['legacySlices']))
        self.assertIn('不能只交付这些步骤', first['end'])
        self.assertIn('不重复填资料', steps)

    def test_each_journey_has_user_start_end_and_recovery(self):
        text = (ROOT / 'docs/product/journey-modules.zh-CN.md').read_text()
        self.assertEqual(set(self.journeys), {f'J{i:02d}' for i in range(1, 16)})
        for journey in self.journeys.values():
            with self.subTest(journey=journey['id']):
                for field in ('actor', 'trigger', 'end', 'recovery', 'outOfScope'):
                    self.assertTrue(journey[field])
                    self.assertIn(journey[field], text)
                self.assertGreaterEqual(len(journey['steps']), 3)
                for step in journey['steps']:
                    self.assertIn(step, text)
                self.assertIn(f'<a id="{journey["id"].lower()}"></a>', text)
                self.assertNotIn(journey['id'], journey['integrationWith'])
                self.assertTrue(set(journey['integrationWith']) <= set(self.journeys))

    def test_contracts_are_inputs_not_cyclic_whole_journey_gates(self):
        contracts = {c['id']: c for c in self.execution['sharedContracts']}
        for journey in self.execution['journeys']:
            self.assertNotIn('dependsOn', journey)
            self.assertTrue(set(journey['requiredContracts']) <= set(contracts))
            self.assertNotIn('contractInputs', self.journeys[journey['id']])
            self.assertTrue(journey['requiredContracts'])
            for cid in journey['requiredContracts']:
                self.assertIn(journey['id'], contracts[cid]['consumers'])
        self.assertIn('J02', self.journeys['J01']['integrationWith'])
        self.assertIn('J01', self.journeys['J02']['integrationWith'])

    def test_only_authorized_first_release_pm_and_ux_stages_are_issued(self):
        self.assertTrue(self.execution['pmStartAllowed'])
        self.assertEqual(self.execution['activeJourneys'], [])
        self.assertEqual(set(self.execution['issuedJourneys']), {f'J{i:02d}' for i in range(1, 12)})
        self.assertEqual(self.execution['oldPMCandidate']['status'], 'historical-incomplete-candidate')
        self.assertFalse(self.execution['oldPMCandidate']['acceptedAsJourney'])
        for j in self.execution['journeys']:
            for stage in ('RD', 'QA'):
                self.assertEqual(j['stages'][stage], 'not-started')
            if j['id'] in self.execution['issuedJourneys']:
                self.assertEqual(j['currentStage'], 'UX')
                self.assertEqual(j['stages']['UX'], 'candidate-delivered')
                self.assertIn(j['pmOwner'], ('PM-1', 'PM-2', 'PM-3'))
            else:
                self.assertEqual(j['status'], 'not-issued')
                self.assertIsNone(j['currentStage'])

    def test_first_release_preserves_prior_minimum_capabilities(self):
        profiles = self.execution['releaseProfiles']
        chosen = {j for p in profiles for j in p['featureJourneys'] + p['requiredSupportJourneys']}
        self.assertEqual(chosen, {f'J{i:02d}' for i in range(1, 12)})
        mapped = {s for j in chosen for s in self.journeys[j]['legacySlices']}
        old_release = json.loads((ROOT / 'docs/delivery/release-sets.json').read_text())
        self.assertEqual(mapped, set(old_release['firstReleaseUnion']))
        self.assertTrue(all(not p['releaseApproved'] for p in profiles))
        for group in self.execution['jointGroups']:
            self.assertTrue(set(group['journeys']) <= set(self.journeys))


if __name__ == '__main__':
    unittest.main()
