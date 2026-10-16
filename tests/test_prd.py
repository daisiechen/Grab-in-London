"""PRD traceability checks; does not replace product review or interaction tests."""
from pathlib import Path
import re
import unittest

class ProductSpecTest(unittest.TestCase):
    def test_requirement_acceptance_and_page_references_resolve(self):
        text = (Path(__file__).resolve().parents[1] / 'docs/PRD.zh-CN.md').read_text()
        defined_requirements = set(re.findall(r'^### (FR-\d+)', text, re.M))
        references = set(re.findall(r'FR-\d+', text))
        self.assertTrue(defined_requirements)
        self.assertEqual(references, defined_requirements)
        defined_pages = set(re.findall(r'^\| (P-\d+) \|', text, re.M))
        self.assertEqual(set(re.findall(r'P-\d+', text)), defined_pages)
        self.assertIn('本轮不开发真实后端', text)
        self.assertIn('金额以英镑最小单位整数', text)
        self.assertIn('APPROVED_PAYMENT_PENDING', text)
