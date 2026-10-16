"""验证项目协作规则的必需约定。运行：python3 -m unittest discover -s tests"""
from pathlib import Path
import unittest


class AgentRulesTest(unittest.TestCase):
    def test_required_workflow_rules(self):
        text = (Path(__file__).resolve().parents[1] / "AGENTS.md").read_text()
        for rule in (
            "https://github.com/daisiechen/Grab-in-London",
            "每次改动完成后，都必须创建一个对应的 git commit",
            "每次改动后，都必须编写或更新相关测试",
            "确保所有测试和验证全部通过",
            "每次提交 git commit 后，都同步更新 GitHub",
            "确保 GitHub 文件和项目版本与本地最新版本一致",
            "排除密钥、凭据、个人资料",
        ):
            with self.subTest(rule=rule):
                self.assertIn(rule, text)
