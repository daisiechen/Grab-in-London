"""Preserve historical release sets and ensure retired slices cannot run."""
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


class ReleaseWorkflowTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads((ROOT / 'docs/delivery/delivery-batches.json').read_text())
        cls.batches = {b['id']: b for b in cls.data['batches']}
        cls.releases = json.loads((ROOT / 'docs/delivery/release-sets.json').read_text())
        cls.profiles = {p['id']: p for p in cls.releases['profiles']}

    def closure(self, ids):
        result = set(ids)
        pending = list(ids)
        while pending:
            current = pending.pop()
            self.assertIn(current, self.batches)
            for dependency in self.batches[current]['dependsOn']:
                if dependency not in result:
                    result.add(dependency)
                    pending.append(dependency)
        return result

    def test_retired_slice_stages_preserve_history_without_active_work(self):
        self.assertEqual(self.data['planStatus'], 'superseded-readonly')
        self.assertEqual(self.releases['status'], 'superseded-slice-release-plan')
        for batch in self.batches.values():
            self.assertIsNone(batch['workflow']['currentStage'])
            self.assertFalse(batch['pmStartAllowed'])
            for name, stage in batch['workflow']['stages'].items():
                if batch['id'] == 'M01-01' and name == 'PM':
                    self.assertEqual(stage['status'], 'superseded')
                    self.assertEqual(stage['outputRevision'], 'PM-r01')
                else:
                    self.assertEqual(stage['status'], 'not-started')
                    self.assertEqual(stage['evidence'], [])

    def test_parallelism_requires_isolation_not_just_distinct_ids(self):
        policy = self.data['workflow']['parallelPolicy']
        self.assertTrue(policy['enabledForFutureDispatch'])
        self.assertEqual(policy['maxActivePMBatchesPerLane'], 1)
        self.assertEqual(policy['initialLanes'], ['ios', 'admin-web'])
        self.assertEqual(set(policy['requires']), {
            'dependency-contract-ready', 'disjoint-write-set',
            'isolated-runtime-and-data', 'fixed-input-revisions',
            'single-shared-contract-writer'})
        self.assertIn('different-module-id', policy['notSufficient'])
        self.assertEqual(self.data['authorization']['allowedStages'], [])
        self.assertFalse(self.data['authorization']['nextStagesAllowed'])

    def test_release_closures_are_exact_and_exclude_deferred_web(self):
        for profile in self.profiles.values():
            with self.subTest(profile=profile['id']):
                features = set(profile['featureBatches'])
                expected = self.closure(features)
                self.assertEqual(set(profile['dependencyClosure']), expected)
                self.assertEqual(set(profile['prerequisiteBatches']), expected - features)
                self.assertFalse(profile['releaseApproved'])
                self.assertEqual(profile['status'], 'planned-not-release-ready')
                self.assertEqual(profile['gateResults'], {})
                for batch_id in expected:
                    self.assertEqual(self.batches[batch_id]['scopeStatus'], 'current')
                    self.assertNotEqual(self.batches[batch_id]['platform'], 'mobile-web')
        self.assertEqual(len(self.profiles['IOS-MIN-01']['featureBatches']), 40)
        self.assertEqual(len(self.profiles['ADMIN-MIN-01']['featureBatches']), 8)
        self.assertEqual(len(self.profiles['IOS-MIN-01']['dependencyClosure']), 48)
        self.assertEqual(len(self.profiles['ADMIN-MIN-01']['dependencyClosure']), 24)

    def test_first_release_and_later_sets_partition_the_current_plan(self):
        first = set(self.releases['firstReleaseUnion'])
        later = set(self.releases['laterCurrentBatches'])
        current = {bid for bid, b in self.batches.items() if b['scopeStatus'] == 'current'}
        expected = set().union(*(set(p['dependencyClosure']) for p in self.profiles.values()))
        self.assertEqual(first, expected)
        self.assertFalse(first & later)
        self.assertEqual(first | later, current)
        self.assertEqual(len(first), 48)
        self.assertEqual(len(later), 12)
        self.assertTrue(all(not bid.startswith(('M10-', 'M11-', 'M12-')) for bid in first))
        self.assertTrue({f'M09-{i:02d}' for i in range(1, 6)} <= first, 'Do not silently drop approved AI')
        for bid, batch in self.batches.items():
            memberships = {p['id'] for p in self.profiles.values() if bid in p['featureBatches']}
            self.assertEqual(set(batch['releaseMembership']), memberships)
            stage = 'deferred-web' if batch['scopeStatus'] == 'deferred' else (
                'first-release' if bid in first else 'post-first-release')
            self.assertEqual(batch['releaseStage'], stage)

    def test_minimum_release_uses_scoped_integration_not_full_share_gate(self):
        groups = {g['id']: g for g in self.releases['integrationGroups']}
        for profile in self.profiles.values():
            for group_id in profile['requiredIntegration']:
                self.assertIn(group_id, groups)
                self.assertTrue(set(groups[group_id]['batches']) <= set(profile['dependencyClosure']),
                                'Required integration has hidden batch prerequisites')
        gaps = {g['id']: g for g in self.releases['storeReadinessGaps']}
        self.assertEqual(set(gaps), {'S-UGC', 'S-AI-CONSENT', 'S-STORE-PACKAGE'})
        for gap in gaps.values():
            self.assertTrue(gap['blocking'])
            self.assertEqual(gap['status'], 'not-verified')
            self.assertTrue(set(gap['relatedBatches']) <= set(self.releases['firstReleaseUnion']))
        self.assertEqual(self.releases['actualDeployments'], [])


if __name__ == '__main__':
    unittest.main()
