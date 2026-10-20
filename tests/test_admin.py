import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class AdminDeliveryTests(unittest.TestCase):
    def test_mobile_preview_listens_on_lan(self):
        package = json.loads((ROOT / 'admin/package.json').read_text())
        self.assertIn('--host 0.0.0.0', package['scripts']['dev'])
        self.assertIn('host: "0.0.0.0"', (ROOT / 'admin/vite.config.ts').read_text())
        self.assertIn('同一 Wi-Fi', (ROOT / 'admin/README.md').read_text())

    def test_independent_entrypoint_and_scripts(self):
        package = json.loads((ROOT / 'admin/package.json').read_text())
        self.assertIn('build', package['scripts'])
        self.assertIn('test:e2e', package['scripts'])
        self.assertTrue((ROOT / 'admin/pnpm-lock.yaml').is_file())
        self.assertIn('/src/main.tsx', (ROOT / 'admin/index.html').read_text())

    def test_prd_records_real_data_boundary_and_metric_contracts(self):
        prd = (ROOT / 'docs/product/admin/PRD.zh-CN.md').read_text()
        for required in ['真实采集及生产服务待建设', '30天', '14天', '零分母',
                         'receivedAt', 'Europe/London', 'expectedVersion',
                         'historyCoverageStart', 'AC-12', '未成熟不算流失']:
            self.assertIn(required, prd)

    def test_usability_revision_records_ownership_and_review_boundaries(self):
        prd = (ROOT / 'docs/product/admin/PRD.zh-CN.md').read_text()
        for phrase in ['当前数据检查', '没有经营分析Agent', '?review=1', '该组全部用户', 'AC-13']:
            self.assertIn(phrase, prd)
        self.assertTrue((ROOT / 'admin/tests/browser-scenarios.mjs').is_file())

    def test_measurement_v3_defines_sources_windows_and_app_gaps(self):
        spec = (ROOT / 'docs/product/admin/measurement-contract.zh-CN.md').read_text()
        for phrase in ['scheduledEndAt', 'resultCount', '50%', '1000ms', 'applicationId',
                       '14天', '30天', 'reasons', 'sourceStatus', 'data-admin', '7天',
                       '[0,20]', '(20,30]', '公开', '单方互选']:
            self.assertIn(phrase, spec)
        report = (ROOT / 'docs/delivery/fancy-admin-measurement-review.zh-CN.md').read_text()
        for index in range(1, 20):
            self.assertIn(f'| {index:02d} ', report)
        self.assertTrue((ROOT / 'demo/src/postMeal.ts').is_file())

    def test_readiness_alignment_uses_current_authority(self):
        spec = (ROOT / 'docs/product/admin/measurement-contract.zh-CN.md').read_text()
        for phrase in ['主PRD v0.5 §0', 'closesAt', 'scheduledEndAt+24小时',
                       'applicationId', 'SupportCorrection', 'caseId', 'company/conversation',
                       '本人优先', '最迟T−30', '跌破也取消', '首位获准']:
            self.assertIn(phrase, spec)
        app = (ROOT / 'admin/src/App.tsx').read_text()
        self.assertNotIn('保存核实', app)
        self.assertNotIn('核实出席', app)
        self.assertIn('本人报告优先', app)

    def test_delivery_links_point_to_existing_files(self):
        for target in ['admin/src/analytics.ts', 'admin/src/fixtures.ts',
                       'admin/DESIGN.md', 'admin/UX-CONTRACT.md',
                       'admin/tests/analytics.test.ts', 'admin/tests/dashboard.spec.ts',
                       'docs/product/admin/PRD.zh-CN.md']:
            self.assertTrue((ROOT / target).is_file(), target)


if __name__ == '__main__':
    unittest.main()
