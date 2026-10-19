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

    def test_prd_records_current_r1_scope_permissions_and_snapshot_boundary(self):
        prd = (ROOT / 'docs/product/admin/PRD.zh-CN.md').read_text()
        for required in ['r1-v3', '真实采集及生产服务待建设', '稳定userId', '服务端',
                         'expectedVersion', 'factVersion', 'snapshotId', '不可变快照',
                         '不建设', '员工账号管理', '不提供', '本人最新自报优先',
                         'startsAt+24h', '7天', 'D-09至D-15', '409', '410', 'AC-12', 'AC-18']:
            self.assertIn(required, prd)

    def test_usability_and_review_import_are_explicit_without_fake_integration(self):
        prd = (ROOT / 'docs/product/admin/PRD.zh-CN.md').read_text()
        for phrase in ['没有经营分析Agent', '?review=1', '该组全部用户', 'not_connected',
                       '失败', '不更新store', '旧快照', '不是真实生产数据']:
            self.assertIn(phrase, prd)
        source = (ROOT / 'admin/src/analytics.ts').read_text()
        self.assertNotIn('export function verifyAttendance', source)
        self.assertTrue((ROOT / 'admin/tests/readiness-scenarios.mjs').is_file())

    def test_measurement_r1_defines_sources_windows_privacy_and_real_roundtrip(self):
        spec = (ROOT / 'docs/product/admin/measurement-contract.zh-CN.md').read_text()
        for phrase in ['scheduledEndAt', 'resultCount', '1000ms', 'applicationId', '14天', '30天',
                       'reasons', 'sourceStatus', '7天', '[0,20]', '(20,30]', '单方互选',
                       'projectAnalytics', 'r1-1', '512KiB', 'scope', 'receivedAt', 'account-deleted映射other', 'unresolvedAtStart', 'users仅允许id与joinedAt',
                       '已由用户下载', '服务控制', '90天', '12个月']:
            self.assertIn(phrase, spec)
        test_source = (ROOT / 'admin/tests/handoff.test.ts').read_text()
        self.assertIn('projectAnalytics(pilotSeed())', test_source)
        self.assertIn('parseHandoff(JSON.stringify(exported))', test_source)

    def test_delivery_links_point_to_existing_files(self):
        for target in ['admin/src/analytics.ts', 'admin/src/fixtures.ts',
                       'admin/DESIGN.md', 'admin/UX-CONTRACT.md',
                       'admin/tests/analytics.test.ts', 'admin/tests/dashboard.spec.ts',
                       'docs/product/admin/PRD.zh-CN.md']:
            self.assertTrue((ROOT / target).is_file(), target)


if __name__ == '__main__':
    unittest.main()
