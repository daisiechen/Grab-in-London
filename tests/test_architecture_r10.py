"""Validate the r10 planning contracts without starting runtime or product QA."""
from pathlib import Path
import hashlib
import json
import unittest

ROOT = Path(__file__).resolve().parents[1]
FOLDER = ROOT / 'docs/engineering/r10'


def read(name):
    return json.loads((FOLDER / name).read_text())


class ArchitectureR10Test(unittest.TestCase):
    def test_frozen_inputs_and_mutable_version_status_are_separated(self):
        manifest = read('input-manifest.json')
        plan = json.loads((ROOT / manifest['versionAuthority']).read_text())
        for path, digest in manifest['inputHashes'].items():
            self.assertEqual(hashlib.sha256((ROOT / path).read_bytes()).hexdigest(), digest, path)
        projection = {
            'scopeRevision': plan['scopeRevision'],
            'iterations': [{k: x[k] for k in ('id', 'productVersion', 'journeys', 'dependsOn')}
                           for x in plan['iterations']],
            'visualBaseline': {k: plan['visualBaseline'][k] for k in ('githubCommit', 'pathsSHA256')},
            'businessBaseline': plan['businessBaseline'],
        }
        self.assertEqual(manifest['planningProjection'], projection)
        digest = hashlib.sha256(json.dumps(projection, ensure_ascii=False,
                                          sort_keys=True, separators=(',', ':')).encode()).hexdigest()
        self.assertEqual(manifest['planningProjectionSHA256'], digest)
        self.assertNotIn('uxStatus', json.dumps(projection))
        self.assertNotIn('figmaFileKey', json.dumps(projection))

    def test_each_journey_is_bound_to_one_real_iteration_without_code_issuance(self):
        data = read('module-work-packages.json')
        plan = json.loads((ROOT / data['versionAuthority']).read_text())
        expected = {j: x for x in plan['iterations'] for j in x['journeys']}
        packages = data['workPackages']
        self.assertEqual({p['id'] for p in packages}, {'WP-FOUNDATION'} | {f'WP-J{i:02}' for i in range(1, 12)})
        for package in packages:
            self.assertEqual(package['status'], 'not-issued')
            self.assertIsNone(package['implementationOwner'])
            self.assertFalse(package['implementationStarted'])
            self.assertFalse(package['designReady'])
            self.assertFalse(package['codeStartGate']['allowed'])
            self.assertEqual(package['qaStatus'], 'not-started')
            for field in ('runtimeBuild', 'codeCommit', 'deployment'):
                self.assertIsNone(package[field])
            for path in package['existingPaths']:
                self.assertTrue((ROOT / path).exists(), path)
            for group in package['commitGroups']:
                self.assertLessEqual(len(group['candidatePaths']), 3)
                self.assertEqual(group['exactWriteAllowlist'], [])
                self.assertIsNone(group['implementationOwner'])
                self.assertEqual(group['maxFilesAtIssue'], 5)
            for jid in package['journeys']:
                self.assertEqual(package['iteration'], expected[jid]['id'])
                self.assertEqual(package['iterationDependencies'], expected[jid]['dependsOn'])
                self.assertGreaterEqual(len(package['acceptance']), 3)
                self.assertIn('verification', package)
        self.assertEqual(len([j for p in packages for j in p['journeys']]), 11)
        self.assertEqual(data['mode'], 'planning-only')
        self.assertFalse(data['qaStarted'])
        self.assertIsNone(data['runtimeBuild'])
        self.assertIsNone(data['deployment'])

    def test_shared_writer_leases_and_dependency_graph_are_explicit(self):
        data = read('module-work-packages.json')
        roles = {x['role'] for x in data['sharedWriterLeases']}
        self.assertEqual(roles, {'RD-CONTRACTS', 'RD-DATA', 'RD-SDK', 'RD-PLATFORM'})
        for lease in data['sharedWriterLeases']:
            self.assertIsNone(lease['assignedOwner'])
            self.assertTrue(lease['paths'])
        sdk = next(x for x in data['sharedWriterLeases'] if x['role'] == 'RD-SDK')
        self.assertIn('packages/client/src/generated/', sdk['excludes'])
        nodes = {p['id']: p for p in data['workPackages']}
        visiting, visited = set(), set()

        def visit(key):
            self.assertNotIn(key, visiting, f'cycle at {key}')
            if key in visited:
                return
            visiting.add(key)
            for dependency in nodes[key]['dependsOn']:
                self.assertIn(dependency, nodes)
                visit(dependency)
            visiting.remove(key)
            visited.add(key)

        for key in nodes:
            visit(key)
        self.assertEqual(data['environmentFailureBudget']['sameFailureAttempts'], 3)
        self.assertEqual(data['environmentFailureBudget']['minutes'], 15)

    def test_initial_full_design_set_blocks_every_package_including_foundation(self):
        data = read('module-work-packages.json')
        plan = json.loads((ROOT / data['versionAuthority']).read_text())
        gate = data['initialDesignSetGate']
        self.assertEqual(gate['requiredDesignSystem'], 'DS-0.1.0')
        self.assertEqual(gate['requiredIterations'], [x['id'] for x in plan['iterations']])
        self.assertEqual(len(gate['requiredIterations']), 7)
        self.assertFalse(gate['initialDesignSetReady'])
        self.assertTrue(gate['appliesToSharedFoundation'])
        self.assertTrue(gate['appliesBeforeAnyBusinessCode'])
        self.assertEqual(gate['futureJourneysRequired'], [])
        for package in data['workPackages']:
            self.assertFalse(package['codeStartGate']['initialDesignSetReady'])
            self.assertFalse(package['codeStartGate']['allowed'])
        for name in ('architecture.zh-CN.md', 'handoff.zh-CN.md'):
            self.assertIn('initialDesignSetReady', (FOLDER / name).read_text())

    def test_selection_preserves_ai_and_current_platform_scope(self):
        text = (FOLDER / 'technology-selection.zh-CN.md').read_text()
        self.assertIn('50,000,000', text)
        self.assertIn('microCNY', text)
        self.assertIn('SwiftUI', text)
        self.assertIn('未安装依赖', text)
        self.assertIn('https://docs.expo.dev/workflow/using-libraries/', text)
        self.assertIn('https://resend.com/docs/dashboard/emails/idempotency-keys', text)
        architecture = (FOLDER / 'architecture.zh-CN.md').read_text()
        self.assertIn('上一批被用户否定的UX-r01不满足', architecture)
        self.assertIn('不整枝合入P1.1', architecture)
        self.assertIn('不删库回滚', architecture)
        self.assertIn('RD-preparation', architecture)
