"""Check review traceability and the confirmed R1 boundary across both specs."""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / 'docs/reviews/development-readiness-2026-10-19.zh-CN.md'


class ReadinessReviewTest(unittest.TestCase):
    def test_open_findings_have_unique_ids_evidence_and_closure(self):
        rows = [line for line in REPORT.read_text().splitlines()
                if re.match(r'\| R-\d+ / P[012] \|', line)]
        ids = [re.match(r'\| (R-\d+)', row).group(1) for row in rows]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertEqual(set(ids), {f'R-{i:02}' for i in range(1, 23)})
        for row in rows:
            cells = row.split('|')[1:-1]
            self.assertEqual(len(cells), 4, row)
            self.assertTrue(all(cell.strip() for cell in cells))
            self.assertRegex(cells[1], r'PRD|src/|契约|DESIGN')
        self.assertIn('暂不通过开发前置依赖验收', REPORT.read_text())

    def test_confirmed_offline_scope_is_recorded_in_shared_specs(self):
        for path in ('docs/product/PRD.zh-CN.md',
                     'docs/product/admin/PRD.zh-CN.md',
                     'docs/product/admin/measurement-contract.zh-CN.md'):
            text = (ROOT / path).read_text()
            with self.subTest(path=path):
                self.assertIn('各自到店付款、发起人自行订位', text)
                self.assertIn('批准即确认席位', text)
                self.assertIn('development-readiness-2026-10-19.zh-CN.md', text)

    def test_confirmed_size_and_change_policy_align_across_specs(self):
        for path in ('docs/product/PRD.zh-CN.md',
                     'docs/product/admin/PRD.zh-CN.md',
                     'docs/product/admin/measurement-contract.zh-CN.md'):
            text = (ROOT / path).read_text()
            with self.subTest(path=path):
                self.assertIn('首期支持2–6人', text)
                self.assertIn('锁定', text)
                self.assertRegex(text, '重发|发布新mealId')

    def test_coordination_preserves_file_ownership_and_remote_checks(self):
        text = (ROOT / 'docs/agent-collaboration.md').read_text()
        for requirement in ('唯一文件负责人', '未提交清单', '仅暂存本轮',
                            '核对本地/远程SHA', 'Claude只读'):
            self.assertIn(requirement, text)
