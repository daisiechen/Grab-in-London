"""Keep development iterations, product versions and preparation authorization distinct."""
import hashlib
import json
from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]


class DevelopmentVersionsR10Test(unittest.TestCase):
    def setUp(self):
        self.data = json.loads((ROOT / 'docs/delivery/development-versions-r10.json').read_text())

    def test_every_first_release_journey_is_in_one_complete_development_iteration(self):
        iterations = self.data['iterations']
        assigned = [j for x in iterations for j in x['journeys']]
        self.assertEqual(sorted(assigned), [f'J{i:02}' for i in range(1, 12)])
        self.assertEqual(len(assigned), len(set(assigned)))
        self.assertEqual(len({x['id'] for x in iterations}), 7)
        self.assertEqual({x['productVersion'] for x in iterations},
                         {'IOS-0.1.0', 'ADMIN-0.1.0', 'SUPPORT-0.1.0'})
        by_id = {x['id']: x for x in iterations}
        visiting, visited = set(), set()
        def visit(ident):
            self.assertNotIn(ident, visiting, 'Iteration dependency cycle')
            if ident in visited:
                return
            visiting.add(ident)
            for dependency in by_id[ident]['dependsOn']:
                self.assertIn(dependency, by_id)
                visit(dependency)
            visiting.remove(ident)
            visited.add(ident)
        for ident in by_id:
            visit(ident)
        first = by_id['IOS-0.1.0-dev.1']
        self.assertIn('J01', first['journeys'])
        self.assertIn('J05', first['journeys'])
        minimum = self.data['firstExternalRelease']['IOS-0.1.0']['requires']
        self.assertEqual(set(minimum), {x['id'] for x in iterations
                                      if x['productVersion'] in ('IOS-0.1.0', 'SUPPORT-0.1.0')})
        self.assertEqual({j for x in self.data['plannedLater'] for j in x['journeys']},
                         {'J12', 'J13', 'J14', 'J15'})
        self.assertTrue(all(not x['issued'] for x in self.data['plannedLater']))

    def test_visual_source_and_business_inputs_are_exact_without_restoring_legacy_transactions(self):
        baseline = self.data['visualBaseline']
        release = json.loads((ROOT / baseline['releaseEvidence']).read_text())
        self.assertEqual(baseline['githubCommit'], release['githubAppCommit'])
        self.assertEqual(baseline['siteVersion'], 13)
        for path, digest in baseline['pathsSHA256'].items():
            blob = subprocess.check_output(['git', 'show', baseline['githubCommit'] + ':' + path], cwd=ROOT)
            self.assertEqual(hashlib.sha256(blob).hexdigest(), digest)
        for item in self.data['iterations']:
            for journey, source in item['inputs'].items():
                for path, digest in source['sha256'].items():
                    self.assertEqual(hashlib.sha256((ROOT / path).read_bytes()).hexdigest(), digest)
                pm = json.loads((ROOT / f'docs/product/journeys/{journey.lower()}/artifact-manifest.json').read_text())
                for field in ('requirementsRevision', 'demoRevision'):
                    self.assertEqual(source[field], pm.get(field, pm['revision']))
        self.assertFalse(self.data['historicalDesign']['usableForDevelopment'])
        brand = self.data['brandDesign']
        self.assertTrue(brand['requestedByOwner'])
        self.assertEqual(brand['id'], 'BRAND-0.1.0')
        self.assertFalse(brand['interfaceRedesignAuthorized'])
        self.assertEqual(brand['adoptionStatus'], 'candidate-only-not-applied')
        self.assertIn('移动Web及平台交易/订位后置', self.data['authorization']['businessScope'])

    def test_preparation_does_not_issue_implementation_or_qa(self):
        self.assertEqual(self.data['authorization']['allowedNow'],
                         ['version-planning', 'UX-design-specification', 'RD-technology-and-architecture-planning'])
        self.assertFalse(self.data['authorization']['implementationStarted'])
        self.assertFalse(self.data['authorization']['qaStarted'])
        gate = self.data['initialImplementationGate']
        self.assertEqual(gate['designSystem'], 'DS-0.1.0')
        self.assertEqual(set(gate['requiredDesignIterations']), {v['id'] for v in self.data['iterations']})
        self.assertTrue(gate['includesSharedFoundation'])
        self.assertFalse(gate['initialDesignSetReady'])
        self.assertFalse(gate['futureUnissuedJourneysRequired'])
        for item in self.data['iterations']:
            self.assertEqual(item['implementationStatus'], 'not-started')
            self.assertEqual(item['qaStatus'], 'not-started')
            self.assertIsNone(item['codeOwner'])
            self.assertIsNone(item['runtimeBuild'])
            self.assertFalse(item['releaseApproved'])
        execution = json.loads((ROOT / 'docs/delivery/journey-execution.json').read_text())
        self.assertTrue(execution['rdPreparationAllowed'])
        self.assertFalse(execution['rdStartAllowed'])
        self.assertFalse(execution['qaStartAllowed'])
