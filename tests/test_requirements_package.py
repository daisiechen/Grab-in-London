"""Check that modular requirements stay navigable and retain delivery coverage."""
import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]


class RequirementsPackageTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = json.loads((ROOT / 'docs/delivery/requirements-catalog.json').read_text())
        cls.modules = cls.catalog['modules']

    def test_catalog_points_to_modules_and_actual_acceptance(self):
        self.assertEqual([m['id'] for m in self.modules],
                         [f'M{i:02d}' for i in range(1, 13)])
        all_versions = []
        for module in self.modules:
            path = (ROOT / module['path']).resolve()
            self.assertTrue(path.is_relative_to(ROOT / 'docs/product/modules'))
            text = path.read_text()
            with self.subTest(module=module['id']):
                self.assertTrue(text.startswith(f"# {module['id']} "))
                actual_versions = re.findall(r'^### (D\d{2}) ', text, re.MULTILINE)
                self.assertEqual(actual_versions, [v['id'] for v in module['versions']])
                actual_acceptance = re.findall(r'^- (D\d{2}-AC\d{2})：', text, re.MULTILINE)
                expected = [a for v in module['versions'] for a in v['acceptanceIds']]
                self.assertEqual(actual_acceptance, expected)
                self.assertEqual(len(actual_acceptance), len(set(actual_acceptance)))
                all_versions.extend(actual_versions)
        self.assertEqual(sorted(all_versions), [f'D{i:02d}' for i in range(1, 20)])

    def test_each_module_has_readable_user_steps_and_recovery(self):
        for module in self.modules:
            text = (ROOT / module['path']).read_text()
            journey = text.split('## 用户从哪里进入、怎样完成\n', 1)[1]
            journey = journey.split('## 必须保持的业务规则', 1)[0]
            steps = re.findall(r'^\d+\. (.+)$', journey, re.MULTILINE)
            with self.subTest(module=module['id']):
                self.assertGreaterEqual(len(steps), 3)
                self.assertTrue(all(len(step) >= 12 for step in steps),
                                'User steps must be sentences, not file paths or characters')
                recovery = text.split('## 失败、返回与取消', 1)[1]
                recovery = recovery.split('## 版本范围与可观察验收', 1)[0]
                self.assertGreaterEqual(len(re.findall(r'^- ', recovery, re.MULTILINE)), 2)

    def test_dependencies_exist_and_do_not_form_a_delivery_cycle(self):
        versions = {v['id']: v for m in self.modules for v in m['versions']}
        complete = set()

        def visit(version_id, active):
            self.assertIn(version_id, versions)
            self.assertNotIn(version_id, active, 'Delivery dependency cycle')
            if version_id in complete:
                return
            for dependency in versions[version_id]['dependsOn']:
                visit(dependency, active | {version_id})
            complete.add(version_id)

        for version_id in versions:
            visit(version_id, set())

    def test_approved_patch_scope_is_preserved_across_modules(self):
        source = (ROOT / 'docs/product/mvp-patch-PRD.zh-CN.md').read_text()
        source_ids = set(re.findall(r'PATCH-00[1-8]', source))
        mapped = {patch for m in self.modules for patch in m['patches']}
        self.assertEqual(source_ids, mapped)
        for module in self.modules:
            text = (ROOT / module['path']).read_text()
            for patch in module['patches']:
                with self.subTest(module=module['id'], source=patch):
                    self.assertIn(patch, text)

    def test_all_nonpass_case_ids_have_delivery_mapping(self):
        execution = json.loads((ROOT / 'docs/qa/execution-2026-10-21.json').read_text())
        # Locate structured case rows without relying on summary counts or prose.
        found = set()

        def collect(value):
            if isinstance(value, dict):
                case_id = value.get('id') or value.get('caseId')
                if isinstance(case_id, str) and case_id.startswith('QA-'):
                    if value.get('status') in ('NOT_RUN', 'BLOCKED'):
                        found.add(case_id)
                for child in value.values():
                    collect(child)
            elif isinstance(value, list):
                for child in value:
                    collect(child)

        collect(execution)
        self.assertEqual(len(found), 15, 'Inherited nonpass baseline changed; review mappings')
        plan = (ROOT / 'docs/delivery/project-management-plan.zh-CN.md').read_text()
        for case_id in found:
            with self.subTest(inherited_case=case_id):
                self.assertIn(case_id, plan)

    def test_product_users_and_delivery_roles_are_separate(self):
        baseline = (ROOT / 'docs/product/fancy-requirements-baseline.zh-CN.md').read_text()
        roles = baseline.split('## 3. 产品使用者与权限', 1)[1].split('## 4.', 1)[0]
        for row in re.findall(r'^\|.+$', roles, re.MULTILINE):
            self.assertNotRegex(row, r'PJ|PM|QA|RD|UX|worker|项目协调|研发')
        management = (ROOT / 'docs/delivery/project-management-plan.zh-CN.md').read_text()
        for role in ('项目协调负责人（PJ）', '产品经理（PM）', '研发（RD）', '质量验证（QA）'):
            self.assertIn(role, management)
        for module in self.modules:
            text = (ROOT / module['path']).read_text()
            self.assertNotIn('worker', text)
            self.assertNotIn('最小测试前置', text)
            self.assertNotIn('允许文件', text)
            self.assertIn('### ' + module['id'], management)
            for version in module['versions']:
                for acceptance_id in version['acceptanceIds']:
                    self.assertIn(acceptance_id, management)

    def test_current_platforms_and_deferred_versions_are_explicit(self):
        self.assertEqual(self.catalog['platformScope']['current'], ['ios', 'admin-web'])
        self.assertEqual(self.catalog['platformScope']['deferred'], ['mobile-web'])
        versions = {v['id']: v for m in self.modules for v in m['versions']}
        deferred = {vid for vid, v in versions.items() if v['scopeStatus'] == 'deferred'}
        self.assertEqual(deferred, {'D15', 'D19'})
        for vid, version in versions.items():
            if version['scopeStatus'] == 'current':
                self.assertIn(version['platform'], ('ios', 'admin-web'))
                self.assertFalse(set(version['dependsOn']) & deferred,
                                 f'{vid} still requires a deferred Web delivery')
        self.assertEqual(versions['D16']['openQuestions'], ['Q-SHARE-01'])
        questions = {q['id']: q for q in self.catalog['openProductQuestions']}
        self.assertEqual(questions['Q-SHARE-01']['status'], 'unresolved')

    def test_requirement_draft_is_not_an_execution_approval(self):
        self.assertEqual(self.catalog['status'], 'owner-review-pending')
        self.assertFalse(self.catalog['implementationAuthorizedByThisPackage'])
        baseline = (ROOT / 'docs/product/fancy-requirements-baseline.zh-CN.md').read_text()
        for module in self.modules:
            self.assertIn(Path(module['path']).name, baseline)


if __name__ == '__main__':
    unittest.main()
