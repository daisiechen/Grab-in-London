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
        self.assert_current_conclusion(REPORT.read_text())

    def assert_current_conclusion(self, text):
        # Read only the current conclusion section; historical conclusions cannot
        # satisfy this gate or turn an incomplete final review into a pass.
        current = re.search(
            r'^## 结论与适用版本\s*\n(.*?)(?=^## |\Z)', text, re.M | re.S)
        self.assertIsNotNone(current, 'Missing current conclusion section')
        conclusion = re.search(r'结论[：:]([^。\n*]+)', current.group(1))
        self.assertIsNotNone(conclusion, 'Missing explicit current conclusion')
        status = conclusion.group(1).strip()
        self.assertIn(status, {
            '暂不通过开发前置依赖验收', '待最终复核', '通过开发前置依赖验收'})
        if status != '通过开发前置依赖验收':
            return

        matrix = re.search(
            r'^#{2,3} (?:最终)?关闭矩阵[^\n]*\n(.*?)(?=^#{1,3} |\Z)',
            text, re.M | re.S)
        self.assertIsNotNone(matrix, 'Passing requires a final closure matrix')
        rows = [line for line in matrix.group(1).splitlines()
                if re.match(r'\|\s*R-\d{2}\s*\|', line)]
        ids = [re.match(r'\|\s*(R-\d{2})', row).group(1) for row in rows]
        self.assertEqual(len(ids), len(set(ids)), 'Duplicate final finding')
        self.assertEqual(set(ids), {f'R-{i:02}' for i in range(1, 23)})
        for row in rows:
            cells = [cell.strip().strip('*`') for cell in row.split('|')[1:-1]]
            self.assertGreaterEqual(len(cells), 3, row)
            self.assertTrue(all(cells), row)
            self.assertTrue(any(cell in {'已关闭', '通过', '已通过'}
                                for cell in cells[1:]), row)
            evidence = ' '.join(cell for cell in cells[1:]
                                if cell not in {'已关闭', '通过', '已通过'})
            self.assertRegex(evidence, r'PRD|shared/|demo/|admin/|契约', row)
            self.assertRegex(evidence, r'测试|验证|回归|验收|[Tt]est', row)

        baseline = re.search(
            r'^#{2,3} (?:最终)?验收基线[^\n]*\n(.*?)(?=^#{1,3} |\Z)',
            text, re.M | re.S)
        self.assertIsNotNone(baseline, 'Passing requires an acceptance baseline')
        self.assertRegex(baseline.group(1), r'`[0-9a-f]{7,40}`',
                         'Baseline must identify the reviewed Git SHA')
        self.assertRegex(baseline.group(1), r'测试|验证|回归|验收|[Tt]est')

    def test_passing_review_cannot_reuse_history_or_omit_final_evidence(self):
        pending = '## 结论与适用版本\n**结论：待最终复核。**\n'
        self.assert_current_conclusion(pending +
            '## 历史记录\n结论：通过开发前置依赖验收。\n')
        passing = pending.replace('待最终复核', '通过开发前置依赖验收')
        with self.assertRaises(AssertionError):
            self.assert_current_conclusion(passing +
                '## 历史记录\n暂不通过开发前置依赖验收\n')

    def test_final_matrix_requires_every_closed_finding_and_fixed_baseline(self):
        current = '## 结论与适用版本\n**结论：通过开发前置依赖验收。**\n'
        rows = [f'| R-{i:02} | 已关闭 | shared/pilot.ts；对应测试通过 |'
                for i in range(1, 23)]
        matrix = '## 最终关闭矩阵\n' + '\n'.join(rows) + '\n'
        baseline = '## 最终验收基线\nSHA `abcdef1234567890`；对应回归通过。\n'
        self.assert_current_conclusion(current + matrix + baseline)
        for invalid in (
                current + matrix,
                current + matrix.replace(rows[-1], '' ) + baseline,
                current + matrix.replace(rows[-1], rows[0]) + baseline,
                current + matrix.replace('| R-22 | 已关闭 |', '| R-22 | 待关闭 |') + baseline,
                current + matrix.replace('对应测试通过', '已处理') + baseline):
            with self.subTest(report=invalid[-160:]):
                with self.assertRaises(AssertionError):
                    self.assert_current_conclusion(invalid)

    def test_current_authority_and_contract_are_linked(self):
        for path in ('docs/product/PRD.zh-CN.md','docs/product/admin/PRD.zh-CN.md','docs/product/admin/measurement-contract.zh-CN.md'):
            text=(ROOT/path).read_text()
            with self.subTest(path=path):
                self.assertRegex(text,r'各自到店(?:付款|支付)|线下付款')
                self.assertRegex(text,r'外订|外部订位|自行订位')
        admin=(ROOT/'docs/product/admin/PRD.zh-CN.md').read_text()
        self.assertIn('measurement-contract.zh-CN.md',admin)
        self.assertIn('../PRD.zh-CN.md',admin)

    def test_shared_deadlines_and_eligibility_are_current(self):
        for path in ('docs/product/PRD.zh-CN.md','docs/product/admin/measurement-contract.zh-CN.md'):
            text=(ROOT/path).read_text()
            with self.subTest(path=path):
                for minutes in ('60','45','30','15'):
                    self.assertRegex(text,rf'T[−-]{minutes}')
                self.assertRegex(text,r'2–6')
                self.assertRegex(text,r'不补员|不补位')
                self.assertRegex(text,r'决定继续[/或]取消')
                self.assertRegex(text,r'7.*天|7d')
        self.assertIn('不等于实现关闭',REPORT.read_text())

    def test_coordination_preserves_file_ownership_and_remote_checks(self):
        text = (ROOT / 'docs/agent-collaboration.md').read_text()
        for requirement in ('唯一文件负责人', '未提交清单', '仅暂存本轮',
                            '核对本地/远程SHA', 'Claude只读'):
            self.assertIn(requirement, text)
