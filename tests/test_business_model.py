import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('business_model', ROOT/'scripts/business_model.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class BusinessModelTest(unittest.TestCase):
    def setUp(self):
        self.data = json.loads((ROOT/'docs/business/model-inputs.json').read_text())

    def test_base_reconciliation(self):
        r = m.calculate(self.data['cases'][1])
        self.assertEqual(r['attendance'], 8640)
        self.assertEqual(r['revenue'], 34560)
        self.assertAlmostEqual(r['operating'], -27624)
        self.assertAlmostEqual(r['per_event'], 15.8)

    def test_nonviable_unit_does_not_report_break_even(self):
        c = dict(self.data['cases'][1], fee=0)
        self.assertIsNone(m.calculate(c)['break_even_events'])

    def test_zero_supply_has_no_transaction_revenue(self):
        self.assertEqual(m.calculate(dict(self.data['cases'][1], merchants=0))['revenue'], 0)

    def test_paid_and_free_costs_are_both_included(self):
        self.assertAlmostEqual(m.personal(self.data['personal']), 16)
        self.assertLess(m.personal(dict(self.data['personal'], paid_cost=6)), 0)

    def test_report_uses_same_model_outputs(self):
        report = (ROOT/'docs/business/business-assessment.zh-CN.md').read_text()
        for value in ('34,560', '27,624', '1,440,000', '378,000'):
            self.assertIn(value, report)

if __name__ == '__main__':
    unittest.main()
