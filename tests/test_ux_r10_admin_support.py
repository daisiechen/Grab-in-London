"""Validate exact UX inputs, native source reuse, and critical journey boundaries."""
import hashlib
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
PACKS = {
    'ADMIN-0.1.0-dev.1': ('admin-0.1.0-dev.1', 'J10'),
    'ADMIN-0.1.0-dev.2': ('admin-0.1.0-dev.2', 'J11'),
    'SUPPORT-0.1.0-dev.1': ('support-0.1.0-dev.1', 'J09'),
}


def read(path):
    return json.loads(path.read_text())


def folder(slug):
    return ROOT / 'docs/design/r10' / slug


class AdminSupportR10UXTest(unittest.TestCase):
    def test_input_hashes_and_candidate_stage_boundary(self):
        keys = set()
        for version, (slug, journey) in PACKS.items():
            with self.subTest(version=version):
                root = folder(slug)
                manifest = read(root / 'manifest.json')
                self.assertEqual(manifest['iteration'], version)
                self.assertEqual(manifest['journeys'], [journey])
                self.assertEqual(manifest['uxRevision'], 'UX-r02')
                self.assertFalse(manifest['visualSource']['rejectedUXr01Used'])
                self.assertFalse(manifest['ownerApproved'])
                self.assertFalse(manifest['designReady'])
                self.assertFalse(manifest['implementationStarted'])
                self.assertFalse(manifest['qaStarted'])
                self.assertFalse(manifest['figma']['frozen'])
                self.assertIsNone(manifest['figma']['namedVersionId'])
                self.assertNotIn(manifest['figma']['fileKey'], keys)
                keys.add(manifest['figma']['fileKey'])
                for category in ('inputHashes', 'files'):
                    for path, digest in manifest[category].items():
                        self.assertEqual(hashlib.sha256((ROOT / path).read_bytes()).hexdigest(), digest, path)
                self.assertEqual(hashlib.sha256((root / 'planning-input-projection.json').read_bytes()).hexdigest(),
                                 manifest['planningProjectionSHA256'])
                self.assertNotIn('docs/delivery/development-versions-r10.json', manifest['inputHashes'])

    def test_planning_projection_ignores_mutable_status_and_links(self):
        current = read(ROOT / 'docs/delivery/development-versions-r10.json')
        for version, (slug, _) in PACKS.items():
            projection = read(folder(slug) / 'planning-input-projection.json')
            selected = next(row for row in current['iterations'] if row['id'] == version)
            self.assertEqual(projection['iteration'], {key: selected[key] for key in
                             ('id', 'productVersion', 'name', 'journeys', 'dependsOn', 'inputs')})
            self.assertEqual(projection['businessBaseline'], current['businessBaseline'])
            self.assertEqual(projection['visualBaseline'], current['visualBaseline'])

    def test_all_pm_scenarios_and_source_families_are_mapped(self):
        for _, (slug, journey) in PACKS.items():
            root = folder(slug)
            mapping = read(root / 'coverage.json')
            source = read(ROOT / f'docs/product/journeys/{journey.lower()}/coverage.json')
            graph = read(root / 'figma-readback.json')
            nodes = {s['nodeId'] for s in graph['scenes']}
            self.assertEqual({s['scenarioId'] for s in mapping['scenarios']}, set(source['demoScenarios']))
            self.assertEqual([s['sourceRequirements'] for s in mapping['sourceFamilies']],
                             [s['sourceRequirements'] for s in source['requirements']])
            for scene in mapping['scenarios']:
                self.assertTrue(scene['figmaNodes'])
                self.assertTrue(set(scene['figmaNodes']) <= nodes)
            for row in mapping['sourceFamilies']:
                if 'documented-only' in row['pmMode']:
                    self.assertEqual(row['mode'], 'documented-only-preserved')

    def test_native_graphs_retain_source_roles_and_valid_destinations(self):
        for _, (slug, _) in PACKS.items():
            graph = read(folder(slug) / 'figma-readback.json')
            self.assertEqual(graph['missingTargets'], [])
            ids = {s['nodeId'] for s in graph['scenes']}
            for scene in graph['scenes']:
                self.assertGreater(scene['counts']['TEXT'], 0)
                self.assertGreater(scene['counts']['INSTANCE'], 0)
                self.assertGreater(scene['counts']['VECTOR'], 0)
                self.assertTrue(set(scene['fonts']) <= {'Arial', 'Georgia', 'Noto Sans SC'})
                for link in scene['links']:
                    self.assertIn(link['destination'], ids)
            self.assertNotIn('/api/mcp/asset/', json.dumps(graph))
            self.assertTrue(list((folder(slug) / 'evidence').glob('*.png')))

    def test_j10_source_object_trace_and_revoked_recovery(self):
        graph = read(folder('admin-0.1.0-dev.1') / 'figma-readback.json')
        scenes = {s['key']: s for s in graph['scenes']}
        for first, second in [('overview', 'definition'), ('definition', 'supply'),
                              ('supply', 'meal'), ('meal', 'user'), ('user', 'meal')]:
            self.assertIn(scenes[second]['nodeId'], [l['destination'] for l in scenes[first]['links']])
        text = '\n'.join(scenes['overview']['texts'])
        self.assertIn('每周确认出席用户数', text)
        self.assertIn('首次申请后 14 天内出席率', text)
        self.assertIn('首次出席后 30 天内再赴约率', text)
        self.assertIn('asOf 2026-10-18T12:00Z', text)
        self.assertIn('M-062', '\n'.join(scenes['meal']['texts']))
        self.assertIn('U-002', '\n'.join(scenes['user']['texts']))
        self.assertNotIn('18.3%', scenes['revoked']['texts'])
        self.assertEqual({l['destination'] for l in scenes['revoked']['links']}, {scenes['recovered']['nodeId']})
        self.assertIn('SYN-ADMIN-R10-02', '\n'.join(scenes['recovered']['texts']))
        self.assertEqual({l['destination'] for l in scenes['recovered']['links']},
                         {scenes['definition02']['nodeId']})
        self.assertEqual({l['destination'] for l in scenes['definition02']['links']},
                         {scenes['recovered']['nodeId']})
        self.assertIn(scenes['querydraft']['nodeId'],
                      [l['destination'] for l in scenes['overview']['links']])
        self.assertIn(scenes['overview']['nodeId'],
                      [l['destination'] for l in scenes['querydraft']['links']])

    def test_j11_unknown_and_failed_cannot_expose_old_statistics_or_export(self):
        scenes = {s['key']: s for s in read(folder('admin-0.1.0-dev.2') / 'figma-readback.json')['scenes']}
        for key in ('unknown', 'pending', 'failed', 'revoked'):
            text = '\n'.join(scenes[key]['texts'])
            self.assertNotIn('8 / 10', text)
            self.assertNotIn('6 / 8', text)
            for export in scenes[key]['disabledExports']:
                self.assertLess(export['opacity'], 0.5)
                self.assertEqual(export['reactions'], 0)
        self.assertIn('INTENT-1', '\n'.join(scenes['unknown']['texts']))
        self.assertIn('分类已接受，统计暂不可用', scenes['failed']['texts'])
        self.assertIn('仅重试统计', scenes['failed']['texts'])
        self.assertIn('SYN-C2', '\n'.join(scenes['ready']['texts']))
        self.assertIn('生成票据不等于下载成功', '\n'.join(scenes['export']['texts']))
        self.assertIn('无法远程撤回', '\n'.join(scenes['download']['texts']))
        self.assertEqual({l['destination'] for l in scenes['privacyready']['links']}, {scenes['revoked']['nodeId']})

    def test_support_case_window_original_reports_and_reply_only(self):
        scenes = {s['key']: s for s in read(folder('support-0.1.0-dev.1') / 'figma-readback.json')['scenes']}
        window = '\n'.join(scenes['window']['texts'])
        self.assertIn('2026-10-17T19:59:59.999Z', window)
        self.assertIn('2026-10-17T20:00:00.000Z', window)
        self.assertIn('继续不适用', '\n'.join(scenes['impact']['texts']))
        self.assertIn('不制造出席纠错', '\n'.join(scenes['replyonlydone']['texts']))
        denied = '\n'.join(scenes['denied']['texts'])
        self.assertNotIn('U-203', denied)
        self.assertNotIn('self absent', denied)

    def test_r11_conflicts_require_new_explicit_confirmation_and_preserve_cancelled_facts(self):
        for slug, final, intent in [('admin-0.1.0-dev.2', 'conflictaccepted', 'INTENT-2'),
                                     ('support-0.1.0-dev.1', 'conflictappended', 'CORR-2')]:
            scenes = {s['key']: s for s in read(folder(slug) / 'figma-readback.json')['scenes']}
            self.assertEqual({l['destination'] for l in scenes['conflict']['links']},
                             {scenes['conflictreconfirm']['nodeId'], scenes['conflictcancelled']['nodeId']})
            self.assertNotIn(scenes[final]['nodeId'],
                             {l['destination'] for l in scenes['conflict']['links']})
            self.assertIn(scenes[final]['nodeId'],
                          {l['destination'] for l in scenes['conflictreconfirm']['links']})
            self.assertIn(intent, '\n'.join(scenes[final]['texts']))
            self.assertIn('revision 3', '\n'.join(scenes[final]['texts']))
            self.assertIn('revision 2', '\n'.join(scenes['conflictcancelled']['texts']))
            self.assertEqual(scenes[final]['links'], [])

    def test_source_browser_check_is_bounded_to_original_demo(self):
        evidence = read(folder('admin-0.1.0-dev.1') / 'source-interaction-check.json')
        self.assertTrue(evidence['sourceOnly'])
        self.assertFalse(evidence['implementationStarted'])
        self.assertFalse(evidence['qaStarted'])
        self.assertTrue(evidence['localeRetainsQuery'])
        self.assertEqual({row['width'] for row in evidence['viewports']}, {1440, 1024, 864, 390})
        self.assertTrue(all(row['documentWidth'] == row['width'] for row in evidence['viewports']))
