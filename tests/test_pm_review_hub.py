"""The review hub must pair each first-release journey with its own PM artifacts."""
from pathlib import Path
import importlib.util
import unittest

ROOT=Path(__file__).resolve().parents[1]


class PMReviewHubTest(unittest.TestCase):
    def test_hub_links_to_eleven_separate_prototypes_and_pinned_requirements(self):
        spec=importlib.util.spec_from_file_location('build_pm_review',ROOT/'scripts/build_pm_review.py')
        module=importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        sha='a'*40
        html=module.hub(sha)
        self.assertEqual(html.count('<article>'),11)
        for n in range(1,12):
            slug=f'j{n:02}'
            self.assertIn(f'href="{slug}/index.html"',html)
            self.assertIn(f'href="requirements/{slug}.html"',html)
            self.assertIn(f'/blob/{sha}/docs/product/journeys/{slug}/requirements.zh-CN.md',html)
        self.assertNotIn('j12/index.html',html)
        self.assertIn('未启动 UX、RD、QA',html)
        self.assertIn('彼此不共享模拟账号或状态',html)


if __name__=='__main__':unittest.main()
