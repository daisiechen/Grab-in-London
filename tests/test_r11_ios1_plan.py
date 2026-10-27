"""Version-plan integrity; these checks are not business tests or product QA."""
import hashlib
import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
PLAN = ROOT / 'docs/engineering/r11/ios-0.1.0-dev.1'


class IOS1ExecutionPlanContract(unittest.TestCase):
    def test_exact_fixed_inputs_and_registered_operations(self):
        manifest = json.loads((PLAN / 'input-manifest.json').read_text())
        self.assertFalse(manifest['implementationStarted'])
        self.assertFalse(manifest['QAStarted'])
        for path, expected in manifest['inputSHA256'].items():
            self.assertEqual(hashlib.sha256((ROOT / path).read_bytes()).hexdigest(), expected, path)
        interfaces = json.loads((PLAN / 'interfaces.json').read_text())
        for op in interfaces['existingOperations']:
            self.assertEqual(hashlib.sha256((ROOT / op['source']).read_bytes()).hexdigest(), op['sourceSHA256'])
            source = (ROOT / op['source']).read_text()
            pattern = rf"operationId:\s*'{op['id']}'\s*,\s*method:\s*'{op['method']}'\s*,\s*path:\s*'{op['path'][3:]}'"
            self.assertRegex(source, pattern)
        proposal = interfaces['proposedContractDeltas'][0]
        self.assertEqual(proposal['id'], 'I1-C01')
        self.assertTrue(proposal['status'].startswith('proposed-not-registered'))
        self.assertNotIn('readAnalyticsChoice', {o['id'] for o in interfaces['existingOperations']})

    def test_owned_small_packages_are_acyclic_and_only_real_interface_point_blocks(self):
        data = json.loads((PLAN / 'work-packages.json').read_text())
        packages = {p['id']: p for p in data['packages']}
        self.assertEqual(data['businessJourneys'], ['J01', 'J05'])
        self.assertEqual(len(packages), 7)
        visited = set()

        def visit(key, stack):
            self.assertNotIn(key, stack)
            for parent in packages[key]['dependsOn']:
                self.assertIn(parent, packages)
                visit(parent, stack | {key})
            visited.add(key)

        for key, package in packages.items():
            visit(key, set())
            self.assertEqual(package['status'], 'planned-not-issued')
            self.assertIsNone(package['implementationOwner'])
            for group in package['groups']:
                self.assertLessEqual(len(group['candidateProductionFiles']), 4)
                self.assertTrue(group['noDirectoryWideLease'])
                self.assertEqual(group['leaseStatus'], 'not-issued')
                for path in group['candidateProductionFiles']:
                    self.assertTrue((ROOT / path).is_file(), path)
        self.assertEqual(len(visited), 7)
        self.assertEqual(packages['I1-P03']['interfaceGates'], ['I1-C01'])
        for key in ['I1-P01', 'I1-P02', 'I1-P04']:
            self.assertNotIn('I1-C01', packages[key].get('interfaceGates', []))
        self.assertNotIn('initialDesignSetReady', json.dumps(data))
        self.assertIn(['I1-P01', 'I1-P03'], data['parallelAllowedAfterContracts'])

    def test_all_12_acceptance_items_have_unexecuted_actor_specific_test_cases(self):
        matrix = json.loads((PLAN / 'test-matrix.json').read_text())
        self.assertFalse(matrix['productQAStarted'])
        self.assertEqual(len(matrix['cases']), 28)
        wanted = {f'J01-AC{i:02}' for i in range(1, 8)} | {f'J05-AC{i:02}' for i in range(1, 6)}
        self.assertEqual({a for t in matrix['cases'] for a in t['acceptanceIds']}, wanted)
        packages = {p['id'] for p in json.loads((PLAN / 'work-packages.json').read_text())['packages']}
        for case in matrix['cases']:
            self.assertIn(case['package'], packages)
            self.assertTrue(case['actor'])
            self.assertTrue(case['expected'])
            self.assertEqual(case['status'], 'NOT_RUN')
            self.assertIsNone(case['evidence'])
        for path in matrix['existingRegressionCandidates']:
            self.assertTrue((ROOT / path).is_file(), path)
        text = ' '.join(t['expected'] for t in matrix['cases'])
        for term in ['UNKNOWN', '409', 'CLEAR', 'explicit', 'Pending', 'guest']:
            self.assertIn(term.lower(), text.lower())

    def test_plan_links_stay_inside_owned_version_and_resolve(self):
        status = json.loads((ROOT / 'docs/delivery/versions/ios-0.1.0-dev.1/status.json').read_text())
        acceptance = status['developmentPlan']
        review = json.loads((ROOT / acceptance['reviewReport']).read_text())
        self.assertEqual(acceptance['status'], 'plan-approved-with-issuance-gates')
        self.assertEqual(acceptance['status'], review['status'])
        self.assertTrue(acceptance['independentlyApproved'])
        self.assertEqual(acceptance['independentReviewer'], review['reviewer'])
        self.assertTrue(all(issue['status'] == 'closed-by-independent-plan-retest' for issue in review['issues']))
        manifest = json.loads((PLAN / 'input-manifest.json').read_text())
        self.assertEqual(manifest['engineeringReviewSHA256'], acceptance['reviewEvidenceSHA256'])
        for path, expected in {**acceptance['reviewEvidenceSHA256'], **acceptance['currentPlanSHA256']}.items():
            self.assertEqual(hashlib.sha256((ROOT / path).read_bytes()).hexdigest(), expected, path)
        self.assertIsNone(acceptance['issuance']['actualRDOwner'])
        self.assertEqual(acceptance['issuance']['sharedFileLeases'], 'not-issued')
        self.assertEqual(acceptance['issuance']['environmentPreflight'], 'NOT_RUN')
        self.assertEqual(acceptance['issuance']['productQA'], 'not-issued')
        self.assertFalse(acceptance['implementationStarted'])
        self.assertFalse(review['implementationAuthorized'])
        self.assertFalse(review['QAStarted'])
        for file in [PLAN / 'plan.zh-CN.md', ROOT / 'docs/delivery/versions/ios-0.1.0-dev.1/README.zh-CN.md']:
            for target in re.findall(r'\]\(([^)]+)\)', file.read_text()):
                if '://' not in target:
                    self.assertTrue((file.parent / target.split('#')[0]).resolve().exists(), (file, target))


    def test_analytics_gap_does_not_transitively_block_preferences_or_ai(self):
        packages = {p['id']: p for p in json.loads((PLAN / 'work-packages.json').read_text())['packages']}
        # Propagate a real unmet interface through package edges instead of trusting a label
        # saying that the issue is local. The former P04->P03 edge failed this counterexample.
        blocked = {key for key, package in packages.items() if 'I1-C01' in package.get('interfaceGates', [])}
        while True:
            propagated = blocked | {key for key, package in packages.items() if set(package['dependsOn']) & blocked}
            if propagated == blocked:
                break
            blocked = propagated
        self.assertEqual(blocked, {'I1-P03', 'I1-P06'})
        self.assertNotIn('I1-P03', packages['I1-P04']['dependsOn'])
        self.assertTrue({'getSession', 'getMe', 'readAIPreferences', 'replaceAIPreferences', 'deleteAIPreferences'}.issubset(packages['I1-P04']['requiredExistingContracts']))

    def test_unknown_contract_freezes_original_precondition_and_separates_auth(self):
        data = json.loads((PLAN / 'interfaces.json').read_text())['unknownRecovery']
        ordinary = data['ordinaryWrites']
        self.assertEqual(set(ordinary['immutableIntentFields']), {'actorId', 'operationId', 'method', 'path', 'body', 'idempotencyKey', 'ifMatch'})
        self.assertTrue(ordinary['preserveOriginalIfMatch'])
        self.assertFalse(ordinary['resourceGetProvesOriginalIntent'])
        self.assertEqual(set(ordinary['operationIds']), {'updateMe', 'applyMeal', 'withdrawApplication'})
        # A success at version8 after an original If-Match7 cannot be recovered by
        # replacing the original precondition with the freshly fetched version8.
        self.assertTrue(any('If-Match 7' in s and 'If-Match8' in s for s in ordinary['counterexamples']))
        self.assertFalse(data['credentialAuth']['usesOrdinaryResponseIdempotencyStore'])
        self.assertFalse(data['credentialAuth']['startEmail']['credentialReplayAllowed'])
        for operation in ['verifyEmail', 'startOAuthAndCallback', 'exchangeHandoff', 'refreshSession', 'logout']:
            self.assertTrue(data['credentialAuth'][operation]['lostCredentialResponse'])
            self.assertNotIn(operation, ordinary['operationIds'])
        self.assertFalse(data['aiResourceKey']['usesOrdinaryPersistentResponseStore'])
        cases = {c['id']: c for c in json.loads((PLAN / 'test-matrix.json').read_text())['cases']}
        self.assertTrue(cases['I1-T09']['counterexamples'])
        self.assertIn('If-Match7 remains7', cases['I1-T09']['expected'])
        self.assertIn('clientRequestId', cases['I1-T05']['authUnknown'])


if __name__ == '__main__':
    unittest.main()
