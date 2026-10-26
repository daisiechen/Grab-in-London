"""Scope regression: source changes and unassigned requirements must fail loudly."""
import hashlib
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


def script(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / f'{name}.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class RequirementsTraceabilityTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ledger = json.loads((ROOT / 'docs/product/requirements-traceability.json').read_text())
        cls.product = json.loads((ROOT / 'docs/product/journey-modules.json').read_text())
        cls.execution = json.loads((ROOT / 'docs/delivery/journey-execution.json').read_text())
        cls.inventory = script('requirements_inventory')

    def test_all_original_source_units_match_exact_content_and_location(self):
        actual = []
        for path in self.inventory.SOURCES:
            actual.extend(self.inventory.inventory(path))
        expected = [{k: r[k] for k in ('source', 'line', 'section', 'text', 'sha256', 'kind')}
                    for r in self.ledger['units']]
        self.assertEqual(actual, expected, 'Source changed: review scope delta before updating ledger')
        self.assertEqual(set(self.inventory.SOURCES), {s['path'] for s in self.ledger['sources']})
        for source in self.ledger['sources']:
            self.assertEqual(source['sha256'], hashlib.sha256((ROOT / source['path']).read_bytes()).hexdigest())
            self.assertEqual(source['units'], sum(u['source'] == source['path'] for u in actual))
        self.assertEqual(len({u['id'] for u in self.ledger['units']}), len(actual))

    def test_every_unit_has_real_journey_version_and_disposition(self):
        journeys = {j['id']: j for j in self.product['journeys']}
        future = {'WEB-FUTURE', 'FUTURE-TRANSACTIONS', 'FUTURE-EXPLORATION'}
        for row in self.ledger['units'] + self.ledger['legacySlices'] + self.ledger['legacyAcceptance']:
            with self.subTest(requirement=row['id']):
                self.assertTrue(row['targets'])
                self.assertEqual(set(row['journeys']), {t['journey'] for t in row['targets']})
                for target in row['targets']:
                    self.assertIn(target['journey'], journeys)
                    self.assertIn(target['version'], future | {journeys[target['journey']]['plannedVersion']})
        for row in self.ledger['units']:
            self.assertTrue(row['disposition'])
            self.assertTrue(row['effectiveRule'])

    def test_all_old_slices_and_acceptance_ids_retained(self):
        old = json.loads((ROOT / 'docs/delivery/delivery-batches.json').read_text())
        self.assertEqual({r['id'] for r in self.ledger['legacySlices']}, {b['id'] for b in old['batches']})
        catalog = json.loads((ROOT / 'docs/delivery/requirements-catalog.json').read_text())
        expected = {a for m in catalog['modules'] for v in m['versions'] for a in v['acceptanceIds']}
        self.assertEqual({r['id'] for r in self.ledger['legacyAcceptance']}, expected)
        for row in self.ledger['legacySlices']:
            if row['scopeStatus'] == 'deferred':
                self.assertEqual({t['version'] for t in row['targets']}, {'WEB-FUTURE'})

    def test_ai_all_fifteen_acceptance_rows_remain_assigned_to_first_release(self):
        for number in range(1, 16):
            matches = [u for u in self.ledger['units'] if f'| AC-AI{number:02} |' in u['text']]
            self.assertEqual(len(matches), 1)
            self.assertEqual({t['version'] for t in matches[0]['targets']}, {'IOS-0.1.0'})
        contracts = {c['id']: c for c in self.execution['sharedContracts']}
        self.assertTrue({'J01', 'J02', 'J03', 'J05', 'J08'} <= set(contracts['C-AI']['consumers']))

    def test_ordinary_notifications_overview_metrics_and_open_share_not_hidden(self):
        rows = self.ledger['units']
        coverage = [u for u in rows if '未知、冲突不计入分子' in u['text']]
        self.assertEqual(len(coverage), 1)
        self.assertEqual(coverage[0]['disposition'], 'superseded-clause')
        overview = [u for u in rows if '| retention |' in u['text']]
        self.assertTrue(overview)
        self.assertIn({'journey': 'J10', 'version': 'ADMIN-0.1.0'}, overview[0]['targets'])
        self.assertIn('普通群消息', next(j['title'] for j in self.product['journeys'] if j['id'] == 'J14'))
        self.assertEqual(next(f for f in self.ledger['findings'] if f['id'] == 'Q-SHARE-01')['status'], 'unresolved')
        self.assertTrue(any(u['disposition'] == 'open-conflict' for u in rows))
        notify = next(c for c in self.execution['sharedContracts'] if c['id'] == 'C-NOTIFY')
        self.assertTrue({'J02', 'J03', 'J14', 'J15'} <= set(notify['consumers']))

    def test_versions_are_consistent_and_no_professional_work_is_issued(self):
        assignments = self.ledger['versionAssignments']
        for plan in (self.product, self.execution):
            for j in plan['journeys']:
                self.assertEqual(j['plannedVersion'], assignments[j['id']])
        self.assertFalse(self.ledger['pmStartAllowed'])
        self.assertFalse(self.execution['pmStartAllowed'])
        self.assertEqual(self.execution['activeJourneys'], [])
        for j in self.execution['journeys']:
            self.assertEqual(j['status'], 'not-issued')
            self.assertEqual(set(j['stages'].values()), {'not-started'})

    def test_readable_table_is_current_and_both_authorities_reference_it(self):
        rendered = script('render_requirements_traceability').render()
        self.assertEqual(rendered, (ROOT / 'docs/product/requirements-traceability.zh-CN.md').read_text())
        for path in ('docs/product/fancy-requirements-baseline.zh-CN.md',
                     'docs/delivery/project-management-plan.zh-CN.md'):
            text = (ROOT / path).read_text()
            self.assertIn('requirements-traceability.json', text)
            self.assertIn('requirements-audit.zh-CN.md', text)


if __name__ == '__main__':
    unittest.main()
