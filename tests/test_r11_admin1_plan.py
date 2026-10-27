"""Standalone ADMIN-0.1.0-dev.1 planning gate; no sibling version artifacts required."""
import hashlib
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
SLUG = 'admin-0.1.0-dev.1'
VERSION = 'ADMIN-0.1.0-dev.1'
JOURNEY = 'J10'
RISKS = ['查询应用/取消', '指标语义', '对象追溯', '撤销恢复']


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

    def test_existing_read_operations_and_server_metadata_authority(self):
        plan = json.loads((ROOT / 'docs/engineering/r11' / SLUG / 'work-packages.json').read_text())
        ops = {row['operationId']: row for row in plan['operationMapping']}
        self.assertEqual(ops['adminPage']['path'], '/admin/{page}')
        self.assertEqual(ops['adminDrilldown']['path'], '/admin/drilldowns/{metric}')
        self.assertIn('response filterHash', ops['adminDrilldown']['query'])
        self.assertIn('never arbitrary client asOf', ops['adminPage']['responseAuthority'])
        self.assertIn('UUID', plan['identifierMapping']['wireParameters'])
        self.assertTrue(plan['candidateDAG'])
        for path in plan['targetedExistingTests'] + plan['sharedExistingPaths']:
            self.assertTrue((ROOT / path).is_file(), path)

    def test_query_selection_and_recovered_snapshot_never_revive_old_snapshot(self):
        graph = json.loads((ROOT / 'docs/design/r10' / SLUG / 'figma-readback.json').read_text())
        scenes = {scene['key']: scene for scene in graph['scenes']}
        destinations = lambda key: {link['destination'] for link in scenes[key]['links']}
        self.assertIn(scenes['querydraft']['nodeId'], destinations('overview'))
        self.assertIn(scenes['queryselected']['nodeId'], destinations('querydraft'))
        self.assertNotIn('Action / 应用所选查询',
                         {link['label'] for link in scenes['querydraft']['links']})
        applied = [link for link in scenes['queryselected']['links']
                   if link['label'] == 'Action / 应用所选查询']
        self.assertEqual([link['destination'] for link in applied], [scenes['overview']['nodeId']])
        for key in ('querydraft', 'queryselected'):
            cancel = [link for link in scenes[key]['links'] if link['label'] == 'Action / 取消筛选']
            self.assertEqual([link['destination'] for link in cancel], [scenes['overview']['nodeId']])
        self.assertEqual(destinations('recovered'), {scenes['definition02']['nodeId']})
        self.assertEqual(destinations('definition02'), {scenes['recovered']['nodeId']})
        old_targets = {scenes[key]['nodeId'] for key in ('overview', 'definition', 'supply')}
        for key in ('recovered', 'definition02'):
            self.assertTrue(destinations(key).isdisjoint(old_targets))
            text = '\n'.join(scenes[key]['texts'])
            self.assertIn('SYN-ADMIN-R10-02', text)
            self.assertNotIn('SYN-ADMIN-R10-01', text)

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
