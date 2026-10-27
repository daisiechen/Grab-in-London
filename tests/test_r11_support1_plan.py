"""Standalone SUPPORT-0.1.0-dev.1 planning gate; no sibling version artifacts required."""
import hashlib
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
SLUG = 'support-0.1.0-dev.1'
VERSION = 'SUPPORT-0.1.0-dev.1'
JOURNEY = 'J09'
RISKS = ['连续7天UTC', '409恢复', '仅回复', '权限与失效', '传播']


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

    def test_support_new_facts_cli_and_separate_versions_are_explicit(self):
        plan = json.loads((ROOT / 'docs/engineering/r11' / SLUG / 'work-packages.json').read_text())
        self.assertEqual(plan['workPackages'][2]['candidateProductionPath'], 'apps/api/src/support/routes.ts')
        self.assertIn('restricted CLI', plan['deliveryCarrier']['selected'])
        self.assertIn('attendanceVersion only', plan['versionSemantics']['attendance'])
        self.assertIn('caseVersion only', plan['versionSemantics']['case'])
        self.assertEqual(plan['contractIncrement']['status'], 'proposed-not-existing')
        self.assertIn('recordAttendanceRevision', plan['propagationReuse']['functions'])
        for row in plan['newPlannedPaths']:
            self.assertEqual(row['status'], 'not-created')
            self.assertFalse((ROOT / row['path']).exists())
        for path in plan['targetedExistingTests']:
            self.assertTrue((ROOT / path).is_file(), path)

    def test_conflict_support_append_requires_confirmation_and_retains_original_reports(self):
        graph = json.loads((ROOT / 'docs/design/r10' / SLUG / 'figma-readback.json').read_text())
        scenes = {scene['key']: scene for scene in graph['scenes']}
        destinations = lambda key: {link['destination'] for link in scenes[key]['links']}
        self.assertEqual(destinations('conflict'),
                         {scenes['conflictreconfirm']['nodeId'], scenes['conflictcancelled']['nodeId']})
        self.assertNotIn(scenes['conflictappended']['nodeId'], destinations('conflict'))
        confirmation = [link for link in scenes['conflictreconfirm']['links']
                        if link['label'] == 'Action / 本人确认并追加新修订']
        self.assertEqual([link['destination'] for link in confirmation],
                         [scenes['conflictappended']['nodeId']])
        cancelled = '\n'.join(scenes['conflictcancelled']['texts'])
        self.assertIn('revision 2/有效absent不变', cancelled)
        self.assertIn('未追加修订', cancelled)
        appended = '\n'.join(scenes['conflictappended']['texts'])
        for required in ('CORR-2', 'expectedVersion 2', 'revision 3',
                         'self absent / host present原报告保留', '有效仍absent', '回复尚未保存'):
            self.assertIn(required, appended)
        self.assertEqual(destinations('conflictappended'), set())

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
