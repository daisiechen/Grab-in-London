"""Prevent unsupported full-pass, missing cases, and invalid execution references."""
import copy
import importlib.util
import json
from pathlib import Path
import subprocess
import unittest
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('qa_execution',ROOT/'scripts/validate-qa-execution.py')
validator=importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)
class QAExecutionTest(unittest.TestCase):
    def setUp(self):self.data=json.loads((ROOT/'docs/qa/execution-2026-10-21.json').read_text())
    def test_all_planned_cases_have_honest_dispositions(self):
        counts=validator.validate(self.data)
        self.assertEqual(sum(counts.values()),217)
        self.assertGreater(counts['NOT_RUN'],0)
        self.assertGreater(counts['BLOCKED'],0)
    def test_suite_load_failure_preserves_nonzero_exit_without_invented_test_failures(self):
        run={'exitCode':1,'suiteLoadFailures':[{'path':'apps/ios/src/app-root-safe-area.test.tsx','message':'Synthetic dependency load failure'}]}
        validator.validate_run_outcome(run,0)
    def test_suite_load_failure_cannot_be_reported_as_success(self):
        run={'exitCode':0,'suiteLoadFailures':[{'path':'apps/ios/src/app-root-safe-area.test.tsx','message':'Synthetic dependency load failure'}]}
        with self.assertRaises(AssertionError):validator.validate_run_outcome(run,0)
    def test_nonzero_runner_requires_preserved_failure_evidence(self):
        with self.assertRaises(AssertionError):validator.validate_run_outcome({'exitCode':1},0)
    def test_related_passed_suite_cannot_earn_case_pass(self):
        c=next(c for c in self.data['cases'] if c['status']=='NOT_RUN' and c['relatedAutomatedAssertions'])
        c['status']='PASS';c['evidence']=[]
        with self.assertRaises(AssertionError):validator.validate(self.data)
    def test_missing_case_unknown_evidence_changed_plan_rejected(self):
        for mutation in ('missing','evidence','plan'):
            data=copy.deepcopy(self.data)
            if mutation=='missing':data['cases'].pop()
            if mutation=='evidence':data['cases'][0]['evidence']=['nonexistent']
            if mutation=='plan':data['planSha256']='0'*64
            with self.assertRaises(AssertionError):validator.validate(data)
    def test_false_complete_partial_case_rejected(self):
        c=next(c for c in self.data['cases'] if c['status']=='PASS')
        c['coveredExpectedIndexes']=[]
        with self.assertRaises(AssertionError):validator.validate(self.data)
    def test_preserved_failed_run_cannot_be_presented_as_a_case_pass(self):
        bundle=json.loads((ROOT/'docs/qa/evidence/2026-10-21/automated-runs.json').read_text())
        failed=[a for r in bundle['runs'] for a in r.get('assertions',[]) if a['status']=='failed']
        self.assertGreaterEqual(len(failed),2)
        c=next(c for c in self.data['cases'] if c['id']=='QA-API-008')
        plan=json.loads((ROOT/'docs/qa/test-cases.json').read_text())
        expected=next(c for c in plan['cases'] if c['id']=='QA-API-008')['expected']
        c.update(status='PASS',evidence=[failed[0]['id']],remainingExpected=[],coveredExpectedIndexes=list(range(len(expected))))
        with self.assertRaises(AssertionError):validator.validate(self.data)

    def test_failed_browser_observation_cannot_earn_case_pass(self):
        c=next(c for c in self.data['cases'] if c['id']=='QA-CREATE-001')
        plan=json.loads((ROOT/'docs/qa/test-cases.json').read_text())
        expected=next(p for p in plan['cases'] if p['id']==c['id'])['expected']
        c.update(status='PASS',evidence=['B3-T002'],remainingExpected=[],coveredExpectedIndexes=list(range(len(expected))))
        with self.assertRaises(AssertionError):validator.validate(self.data)

    def test_support_correction_plan_preserves_overdue_boundary_contract(self):
        plan=(ROOT/'docs/qa/remaining-plan-2026-10-22.zh-CN.md').read_text()
        active=plan.split('## J011 窗口更正记录')[0]
        self.assertNotIn('结束后 7 日内',active)
        self.assertIn('结束满 7 日起',active)
        contract=(ROOT/'docs/engineering/data-and-command-contract.zh-CN.md').read_text()
        self.assertIn('support仅t≥end+7d',contract)
        self.assertIn('end+7d−1ms',plan)
        self.assertIn('409 CORRECTION_WINDOW_OPEN',plan)
        for ref in ('../product/PRD.zh-CN.md','../engineering/data-and-command-contract.zh-CN.md','../engineering/acceptance-scenarios.json'):
            self.assertTrue((ROOT/'docs/qa'/ref).is_file())

    def test_report_is_reproducible(self):
        p=ROOT/'docs/qa/execution-2026-10-21.zh-CN.md';before=p.read_bytes()
        subprocess.run(['python3',str(ROOT/'scripts/render-qa-execution.py')],check=True,cwd=ROOT)
        self.assertEqual(before,p.read_bytes())
if __name__=='__main__':unittest.main()
