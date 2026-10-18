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
        for contract in ('版本：0.6', '保留原餐厅预约状态', 'Cancelled 独立',
                         '按成员记录', '金额最多2位小数', '退款金额在取消时按饭局记录'):
            self.assertIn(contract, text)


    def test_meal_helper_contract_preserves_user_confirmation_and_scope(self):
        text = (Path(__file__).resolve().parents[1] / 'docs/product/PRD.zh-CN.md').read_text()
        for contract in ('### FR-12', '不占底部导航', '本地规则驱动',
                         'Confirm and remember', '不自动读取群聊/私聊正文',
                         '不自动发送', '不后台录音', 'AC-AI08'):
            self.assertIn(contract, text)


    def test_helper_feedback_has_distinct_home_memory_and_idle_rules(self):
        text = (Path(__file__).resolve().parents[1] / 'docs/product/PRD.zh-CN.md').read_text()
        for contract in ('v0.6', 'New conversation', 'Continue conversation',
                         'Larger view / Compact view', '44px',
                         '30分钟无活动', '保留已确认偏好和未发送文字',
                         '不是饭局申请保留', 'AC-AI12'):
            self.assertIn(contract, text)

    def test_simulated_map_and_compact_helper_contract(self):
        text = (Path(__file__).resolve().parents[1] / 'docs/product/PRD.zh-CN.md').read_text()
        for contract in ('取消尺寸切换与关闭×', 'Search this area',
                         'Use this restaurant', '浏览候选不更改已选餐厅',
                         '不接入真实 Google Maps', 'AC-MAP02'):
            self.assertIn(contract, text)
