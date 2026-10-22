"""Keep the next-version requirements separate from the active MVP contract."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


class MvpPatchPrdTest(unittest.TestCase):
    def test_patch_is_indexed_and_has_an_explicit_mvp_baseline(self):
        index = (ROOT / 'docs/README.md').read_text()
        text = (ROOT / 'docs/product/mvp-patch-PRD.zh-CN.md').read_text()
        self.assertIn('product/mvp-patch-PRD.zh-CN.md', index)
        self.assertIn('[主 PRD](PRD.zh-CN.md)', text)
        self.assertIn('92c5e0d77fa546a3e6759b45ceaf0c113fe5bc78', text)
        self.assertIn('本文件不修改其范围、验收预期或缺陷关闭标准', text)

    def test_unresolved_design_cannot_silently_become_mvp_scope(self):
        text = (ROOT / 'docs/product/mvp-patch-PRD.zh-CN.md').read_text()
        for boundary in ('未达到开发准入', '后续统一在本会话答复',
                         '不得复用并覆盖当前 MVP Demo',
                         'Figma 文件/节点/版本', '可观察的验收条件',
                         '共享组件改动、配置、构建输出及本地服务均须隔离'):
            with self.subTest(boundary=boundary):
                self.assertIn(boundary, text)

    def test_consolidation_preserves_provenance_and_uncommitted_boundaries(self):
        text = (ROOT / 'docs/product/mvp-patch-PRD.zh-CN.md').read_text()
        for item in ('92c5e0d77fa546a3e6759b45ceaf0c113fe5bc78',
                     'IN-007', '本轮不暂存、不提交该差异',
                     '不把Git主分支更新等同线上或QA环境更新'):
            self.assertIn(item, text)

    def test_development_gate_requires_scope_design_and_isolated_implementation(self):
        text = (ROOT / 'docs/product/mvp-patch-PRD.zh-CN.md').read_text()
        for gate in ('B01', 'B02', 'B03', 'B04',
                     'IN归集清单不直接充当开发清单',
                     '不得替换现行MVP环境'):
            self.assertIn(gate, text)

    def test_new_share_and_mentions_require_real_paths_and_authorization(self):
        text = (ROOT / 'docs/product/mvp-patch-PRD.zh-CN.md').read_text()
        for requirement in ('PATCH-007', 'PATCH-008', 'AC-007g', 'AC-008h',
                            '链接不是免审核邀请券', 'Mentions still notify you',
                            '仅发起人可@所有人', '普通成员不可操作，服务端同样拒绝越权',
                            '不能以模拟横幅代替系统证据'):
            self.assertIn(requirement, text)

    def test_mention_rules_are_confirmed(self):
        text = (ROOT / 'docs/product/mvp-patch-PRD.zh-CN.md').read_text()
        self.assertIn('开启免打扰后，@本人和@所有人仍提醒', text)
        self.assertNotIn('PATCH-008默认细则仍待用户逐项确认', text)

    def test_delivery_rules_separate_read_states_and_conflict_authority(self):
        text = (ROOT / 'docs/product/mvp-patch-PRD.zh-CN.md').read_text()
        for boundary in ('AC-008m', 'push有效期默认消息创建后1小时',
                         '409冲突则刷新并展示服务端最新值',
                         '通知读取与聊天读取是两种独立状态',
                         '不承诺全端零重复', '不新增群消息邮件'):
            self.assertIn(boundary, text)

    def test_left_group_settings_do_not_expose_current_roster(self):
        text = (ROOT / 'docs/product/mvp-patch-PRD.zh-CN.md').read_text()
        for rule in ('AC-008n', '隐藏整个成员名单、当前人数、成员搜索和@候选',
                     '不新增“离群时历史成员名单快照”能力',
                     '退群不改变meal participation'):
            self.assertIn(rule, text)
