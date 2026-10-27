"""Standalone ADMIN-0.1.0-dev.2 planning gate; no sibling version artifacts required."""
import hashlib
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
SLUG = 'admin-0.1.0-dev.2'
VERSION = 'ADMIN-0.1.0-dev.2'
JOURNEY = 'J11'
RISKS = ['409恢复', 'UNKNOWN', '受理与统计', '快照CSV', '撤销下载']


class IndependentVersionPlanTest(unittest.TestCase):
    def setUp(self):
        self.root = ROOT / 'docs/delivery/versions' / SLUG
        self.status = json.loads((self.root / 'status.json').read_text())

    def test_independent_design_signoff_and_engineering_boundary(self):
        status = self.status
        self.assertEqual(status['id'], VERSION)
        self.assertEqual(status['journeys'], [JOURNEY])
        self.assertEqual(status['pj'], 'PJ-ADMIN')
        self.assertEqual(status['designReview']['status'], 'passed')
        self.assertTrue(status['designReview']['actualPresentationClicks'])
        self.assertFalse(status['designReview']['authorSelfApproval'])
        self.assertNotEqual(status['designReview']['independentReviewer'], status['pj'])
        self.assertEqual(status['developmentPlan']['status'], 'plan-approved-with-issuance-gates')
        self.assertTrue(status['developmentPlan']['engineeringApproved'])
        self.assertTrue(status['developmentPlan']['independentReviewer'])
        self.assertFalse(status['developmentPlan']['signoffEvidence']['reviewer'] == status['pj'])
        self.assertTrue(status['issuanceGates'])
        self.assertTrue(all(gate['status'] == 'not-issued' for gate in status['issuanceGates']))
        self.assertFalse(status['developmentPlan']['implementationAuthorized'])
        for evidence in status['evidence']:
            self.assertTrue((ROOT / evidence).is_file(), evidence)

    def test_this_versions_test_matrix_covers_its_risks(self):
        text = (self.root / 'test-plan.zh-CN.md').read_text()
        for risk in RISKS:
            self.assertIn(risk, text)
        self.assertIn('候选SHA', text)
        self.assertIn('上游未实现只阻断对应联调', text)
        self.assertFalse(self.status['testing']['productQAStarted'])
        self.assertFalse(self.status['testing']['realServiceTested'])

    def test_bounded_unissued_single_writer_work_packages(self):
        plan = json.loads((ROOT / 'docs/engineering/r11' / SLUG / 'work-packages.json').read_text())
        self.assertEqual(plan['id'], VERSION)
        self.assertFalse(plan['globalDesignWait'])
        self.assertFalse(plan['implementationAuthorized'])
        self.assertFalse(plan['engineeringReview']['authorSelfApproval'])
        self.assertEqual(plan['engineeringReview']['status'], 'plan-approved-with-issuance-gates')
        self.assertTrue(plan['realIntegrationDependencies'])
        ids = set()
        for package in plan['workPackages']:
            self.assertNotIn(package['id'], ids)
            ids.add(package['id'])
            self.assertEqual(package['status'], 'not-issued')
            self.assertIsNone(package['assignedWriter'])
            self.assertEqual(package['exactWriteLease'], [])
            self.assertLessEqual(package['maxProductionFilesPerIssue'], 3)
            self.assertTrue((ROOT / package['candidateProductionPath']).is_file())
            self.assertTrue(package['interface'])
            self.assertTrue(package['acceptance'])
        for path, digest in plan['inputs'].items():
            self.assertEqual(hashlib.sha256((ROOT / path).read_bytes()).hexdigest(), digest)

    def test_classification_gaps_are_explicit_and_new_paths_not_pretended_existing(self):
        plan = json.loads((ROOT / 'docs/engineering/r11' / SLUG / 'work-packages.json').read_text())
        self.assertEqual(plan['workPackages'][0]['candidateProductionPath'], 'apps/api/src/admin/routes.ts')
        self.assertIn('identical actor/key/body/If-Match', plan['workPackages'][0]['interface'])
        self.assertTrue(plan['currentImplementationGaps'])
        self.assertIn('Different subject higher revision is never evidence', plan['subjectCoverageRule'])
        self.assertTrue(plan['oldReadBarrier']['serverPaths'])
        for path in plan['newPlannedPaths']:
            self.assertEqual(path['status'], 'not-created')
            self.assertFalse((ROOT / path['path']).exists())
        self.assertTrue(plan['migrationRequest']['logicalSchema'])
        self.assertEqual(len(plan['contractIncrement']['proposedOperations']), 2)

    def test_conflict_new_intent_requires_confirmation_and_cancel_keeps_staff_revision(self):
        graph = json.loads((ROOT / 'docs/design/r10' / SLUG / 'figma-readback.json').read_text())
        scenes = {scene['key']: scene for scene in graph['scenes']}
        destinations = lambda key: {link['destination'] for link in scenes[key]['links']}
        self.assertEqual(destinations('conflict'),
                         {scenes['conflictreconfirm']['nodeId'], scenes['conflictcancelled']['nodeId']})
        self.assertNotIn(scenes['conflictaccepted']['nodeId'], destinations('conflict'))
        confirmation = [link for link in scenes['conflictreconfirm']['links']
                        if link['label'] == 'Action / 本人确认新意图并保存']
        self.assertEqual([link['destination'] for link in confirmation],
                         [scenes['conflictaccepted']['nodeId']])
        cancelled = '\n'.join(scenes['conflictcancelled']['texts'])
        self.assertIn('staff / revision 2', cancelled)
        self.assertIn('保留本地test与原因', cancelled)
        accepted = '\n'.join(scenes['conflictaccepted']['texts'])
        self.assertIn('INTENT-2', accepted)
        self.assertIn('revision 3', accepted)
        self.assertIn('统计仍更新中', accepted)
        self.assertIn('导出不可读', accepted)
        self.assertNotIn('6 / 8', accepted)
        self.assertEqual(destinations('conflictaccepted'), set())

    def test_only_this_versions_design_evidence_is_required(self):
        folder = ROOT / 'docs/design/r10' / SLUG
        graph = json.loads((folder / 'figma-readback.json').read_text())
        self.assertEqual(graph['missingTargets'], [])
        ids = {scene['nodeId'] for scene in graph['scenes']}
        for scene in graph['scenes']:
            for link in scene['links']:
                self.assertIn(link['destination'], ids)
        self.assertFalse(self.status['candidateBinding']['build'])
        self.assertEqual(self.status['stages']['code'], 'not-started')
        self.assertEqual(self.status['stages']['deploy'], 'not-started')
