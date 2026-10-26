"""Preserve retired slice coverage; current journey workflow is checked separately."""
import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]


class DeliveryBatchesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads((ROOT / 'docs/delivery/delivery-batches.json').read_text())
        cls.catalog = json.loads((ROOT / 'docs/delivery/requirements-catalog.json').read_text())
        cls.batches = cls.data['batches']
        cls.by_id = {b['id']: b for b in cls.batches}
        cls.product = (ROOT / 'docs/product/mvp-batch-scope.zh-CN.md').read_text()
        cls.schedule = (ROOT / 'docs/delivery/delivery-batches.zh-CN.md').read_text()

    def test_every_module_version_and_acceptance_has_a_bounded_batch(self):
        modules = {m['id']: m for m in self.catalog['modules']}
        versions = {v['id']: v for m in modules.values() for v in m['versions']}
        self.assertEqual(len(self.by_id), len(self.batches), 'Duplicate batch ID')
        self.assertEqual({b['module'] for b in self.batches}, set(modules))
        covered = set()
        for batch in self.batches:
            with self.subTest(batch=batch['id']):
                self.assertRegex(batch['id'], r'^M\d{2}-(?:\d{2}|W\d{2})$')
                self.assertEqual(batch['module'], batch['id'][:3])
                self.assertIn(batch['version'], {v['id'] for v in modules[batch['module']]['versions']})
                self.assertTrue(batch['acceptanceIds'])
                self.assertTrue(set(batch['acceptanceIds']) <= set(versions[batch['version']]['acceptanceIds']))
                for field in ('title', 'inScope', 'outOfScope', 'doneWhen'):
                    self.assertTrue(batch[field].strip(), f'Missing {field}')
                covered.update(batch['acceptanceIds'])
        self.assertEqual(covered, {a for v in versions.values() for a in v['acceptanceIds']})

    def test_schedule_is_topological_and_current_scope_never_needs_web(self):
        self.assertEqual([b['order'] for b in self.batches], list(range(1, len(self.batches) + 1)))
        seen = set()
        for batch in self.batches:
            with self.subTest(batch=batch['id']):
                self.assertTrue(set(batch['dependsOn']) <= seen, 'Unknown, cyclic or later dependency')
                if batch['scopeStatus'] == 'current':
                    self.assertIn(batch['platform'], ('ios', 'admin-web'))
                    for dep in batch['dependsOn']:
                        self.assertEqual(self.by_id[dep]['scopeStatus'], 'current')
                else:
                    self.assertEqual(batch['platform'], 'mobile-web')
                seen.add(batch['id'])
        self.assertEqual(sum(b['scopeStatus'] == 'current' for b in self.batches), 60)
        self.assertEqual(sum(b['scopeStatus'] == 'deferred' for b in self.batches), 4)

    def test_old_slice_plan_is_readonly_and_cannot_dispatch_pm(self):
        self.assertEqual(self.data['planStatus'], 'superseded-readonly')
        self.assertIsNone(self.data['activeBatch'])
        self.assertFalse(self.data['pmStartAllowed'])
        self.assertEqual(self.data['authorization']['batchIds'], [])
        self.assertEqual(self.data['authorization']['allowedStages'], [])
        self.assertEqual(self.catalog['dispatchPolicy']['authorizedBatchIds'], [])
        self.assertEqual(self.catalog['activeExecutionPlan'], 'docs/delivery/journey-execution.json')
        decisions = {q['id'] for q in self.catalog['openProductQuestions']}
        for batch in self.batches:
            with self.subTest(batch=batch['id']):
                self.assertFalse(batch['pmStartAllowed'])
                self.assertEqual(batch['status'], 'superseded-candidate' if batch['id'] == 'M01-01' else 'not-issued')
                self.assertTrue(set(batch['productDecisions']) <= decisions)

    def test_product_scope_and_execution_table_reconcile_with_catalog(self):
        ids = re.findall(r'^### (M\d{2}-(?:\d{2}|W\d{2})) ', self.product, re.MULTILINE)
        self.assertEqual(set(ids), set(self.by_id))
        self.assertEqual(len(ids), len(self.by_id))
        for batch in self.batches:
            with self.subTest(batch=batch['id']):
                anchor = f'<a id="{batch["id"].lower()}"></a>'
                self.assertIn(anchor, self.product)
                body = self.product.split(anchor, 1)[1].split('<a id=', 1)[0]
                for field in ('inScope', 'outOfScope', 'doneWhen'):
                    self.assertIn(batch[field], body, f'Drift in {field}')
                deps = '、'.join(batch['dependsOn']) or '基础服务与访客/本人身份入口'
                self.assertIn('可用前提：' + deps + '。', body)
                row = next(line for line in self.schedule.splitlines()
                           if '| [' + batch['id'] + ' ' in line)
                self.assertTrue(row.startswith(f'| {batch["order"]:02d} |'))
                self.assertIn('、'.join(batch['dependsOn']) or '无批次前置', row)
                self.assertIn('#' + batch['id'].lower() + ')', row)

    def test_deletion_split_preserves_the_synchronous_202_barrier(self):
        barrier = self.by_id['M07-04']
        for effect in ('202之前', '取消', '退出', '快照', '旧导出'):
            self.assertIn(effect, barrier['inScope'])
        self.assertIn('全部成功才返回202', barrier['doneWhen'])
        self.assertIn('失败整体回滚', barrier['doneWhen'])
        followup = self.by_id['M07-05']
        self.assertIn('物理清理', followup['inScope'])
        self.assertIn('同步屏障后', followup['inScope'])
        self.assertIn('M07-04', followup['dependsOn'])

    def test_modules_link_only_to_their_batches_and_checkpoints_exist(self):
        for module in self.catalog['modules']:
            text = (ROOT / module['path']).read_text()
            ids = re.findall(r'\[(' + module['id'] + r'-(?:\d{2}|W\d{2})) ', text)
            expected = {b['id'] for b in self.batches if b['module'] == module['id']}
            self.assertEqual(set(ids), expected)
        self.assertEqual({q['id'] for q in self.data['integrationCheckpoints']}, {'I01', 'I02', 'I03', 'I04'})
        for check in self.data['integrationCheckpoints']:
            self.assertTrue(set(check['after']) <= set(self.by_id))
            self.assertTrue(all(self.by_id[b]['scopeStatus'] == 'current' for b in check['after']))
            self.assertIn(check['outcome'], self.schedule)


if __name__ == '__main__':
    unittest.main()
