"""Current R1 specification structure and reference validation, not runtime proof."""
from pathlib import Path
import re
import unittest
ROOT = Path(__file__).resolve().parents[1]
PRD = ROOT / 'docs/product/PRD.zh-CN.md'

class ProductSpecTest(unittest.TestCase):
    def test_requirements_are_unique_and_references_resolve(self):
        text=PRD.read_text()
        defined=re.findall(r'^### (FR-\d+) ',text,re.M)
        self.assertEqual(len(defined),len(set(defined)))
        self.assertEqual(set(defined),{f'FR-{i:02}' for i in range(1,14)})
        self.assertEqual(set(re.findall(r'FR-\d+',text)),set(defined))
        for target in re.findall(r'\]\(([^)]+)\)',text):
            if not target.startswith(('https://','http://','#')):
                self.assertTrue((PRD.parent/target).resolve().is_file(),target)
    def test_brand_and_scope_are_consistent(self):
        for name in ('docs/product/PRD.zh-CN.md','docs/product/product-brief.md'):
            text=(ROOT/name).read_text()
            for copy in ('Fancy','Meet new people over a meal.','吃个饭，认识一下。','Fancy a bite?','There’s a seat for you here.'):
                self.assertIn(copy,text)
            self.assertIn('R1',text);self.assertIn('scope=future',text)
    def test_current_rules_replace_previous_payments_and_verification(self):
        text=PRD.read_text()
        for term in ('T−60','T−45','T−30','T−15','startsAt+24h','scheduledEndAt+7','没有后台人工核实出席','无默认值','原因可以为空','双方','新 applicationId','到店','自行','D1','iOS App','mobile Web','desktop Web'):
            self.assertIn(term,text)
        self.assertNotIn('APPROVED_PAYMENT_PENDING',text)
        self.assertNotRegex(text,r'### FR-\d+.*\n(?:[^\n]*\n){0,3}.*运营核实优先')
    def test_privacy_and_service_boundaries_are_explicit(self):
        text=PRD.read_text()
        for term in ('Facebook','18+','2–40','20–1000','20–300','90天','12个月','events=[]','intentKey','replacementFor','单方互选','删除','不是原生','未验证投递','不代表'):
            self.assertIn(term,text)
        contract=(ROOT/'shared/README.md').read_text()
        for term in ('r1-1','Idempotency-Key','If-Match','401','403','404','409','422','503','未知额外字段','白名单','ApplicationRound','Membership'):
            self.assertIn(term,contract)
