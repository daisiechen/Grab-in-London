"""PRD traceability checks; does not replace product review or interaction tests."""
from pathlib import Path
import re
import unittest

class ProductSpecTest(unittest.TestCase):
    def test_requirement_acceptance_and_page_references_resolve(self):
        text = (Path(__file__).resolve().parents[1] / 'docs/product/PRD.zh-CN.md').read_text()
        defined_requirements = set(re.findall(r'^### (FR-\d+)', text, re.M))
        references = set(re.findall(r'FR-\d+', text))
        self.assertTrue(defined_requirements)
        self.assertEqual(references, defined_requirements)
        defined_pages = set(re.findall(r'^\| (P-\d+) \|', text, re.M))
        self.assertEqual(set(re.findall(r'P-\d+', text)), defined_pages)
        self.assertIn('本轮不开发真实后端', text)
        self.assertIn('金额以英镑最小单位整数', text)
        self.assertIn('APPROVED_PAYMENT_PENDING', text)

    def test_confirmed_welcome_headline_and_slogan(self):
        text = (Path(__file__).resolve().parents[1] / 'docs/product/PRD.zh-CN.md').read_text()
        self.assertIn('There’s a seat for you here.', text)
        self.assertIn('Meet new people over a meal.', text)

    def test_brand_copy_consistent_across_current_documents(self):
        root = Path(__file__).resolve().parents[1]
        for name in ('README.md', 'docs/product/PRD.zh-CN.md', 'docs/product/product-brief.md'):
            with self.subTest(document=name):
                text = (root / name).read_text()
                for copy in ('Fancy', 'Meet new people over a meal.',
                             '吃个饭，认识一下。', 'Fancy a bite?', '一起吃点？'):
                    self.assertIn(copy, text)
                self.assertNotIn('一起吃顿饭，认识新朋友。', text)

    def test_strategy_preserves_validation_and_demo_boundaries(self):
        text = (Path(__file__).resolve().parents[1] / 'docs/product/PRD.zh-CN.md').read_text()
        for boundary in ('收入假设待验证', '有重复购买后再考虑会员',
                         '订金不是平台收入', '付费身份不代表人更优质',
                         '不设置资产展示或考核', 'Demo 品牌已迁移至 Fancy',
                         '非已实现需求', '不得视作真实 R1 已承诺范围',
                         '商标、域名与账号可用性尚未完成核查'):
            self.assertIn(boundary, text)

    def test_audit_revision_records_independent_states_and_clean_ui(self):
        text = (Path(__file__).resolve().parents[1] / 'docs/product/PRD.zh-CN.md').read_text()
        for contract in ('版本：0.4', '保留原餐厅预约状态', 'Cancelled 独立',
                         '按成员记录', '金额最多2位小数', '退款金额在取消时按饭局记录'):
            self.assertIn(contract, text)
