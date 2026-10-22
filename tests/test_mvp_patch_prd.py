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
        for boundary in ('未达到开发准入', '尚未收到具体 UX 问题',
                         '不得复用并覆盖当前 MVP Demo',
                         'Figma 文件/节点/版本', '可观察的验收条件',
                         '共享组件改动、配置、构建输出及本地服务均须隔离'):
            with self.subTest(boundary=boundary):
                self.assertIn(boundary, text)
