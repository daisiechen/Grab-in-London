"""Check that the development handoff is navigable and its dependency graph is executable."""
import json
import hashlib
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def task_graph(text):
    graph = {}
    for block in re.split(r'^## ', text, flags=re.M)[1:]:
        task_id = block.split()[0]
        match = re.search(r'依赖：([^。]+)', block)
        if not match:
            raise ValueError('Missing dependencies: ' + task_id)
        graph[task_id] = re.findall(r'[TA]\d{2}', match.group(1))
    return graph


def check_graph(graph):
    visiting, done = set(), set()
    def visit(node):
        if node not in graph:
            raise ValueError('Missing dependency: ' + node)
        if node in visiting:
            raise ValueError('Dependency cycle: ' + node)
        if node in done:
            return
        visiting.add(node)
        for dependency in graph[node]:
            visit(dependency)
        visiting.remove(node)
        done.add(node)
    for node in graph:
        visit(node)


class CorePlanTest(unittest.TestCase):
    def test_tasks_have_valid_dependencies_and_completion_evidence(self):
        text = (ROOT / 'tasks/todo.md').read_text()
        graph = task_graph(text)
        self.assertEqual(set(graph), {f'T{i:02}' for i in range(33)} | {f'A{i:02}' for i in range(10)})
        check_graph(graph)
        for block in re.split(r'^## ', text, flags=re.M)[1:]:
            for field in ('状态：', '文件：', '验收：', '验证：', '外部依赖/证据：', '完成记录：'):
                self.assertIn(field, block)
            status = re.search(r'状态：([^；]+)', block).group(1)
            self.assertIn(status, ('todo', 'in_progress', 'blocked_external',
                                   'blocked_requirement', 'done'))
            if status == 'done':
                record = block.split('完成记录：', 1)[1]
                self.assertNotIn('未实施', record)
                self.assertRegex(record, r'\b[0-9a-f]{7,40}\b')

    def test_dependency_checker_rejects_cycles_and_unknown_tasks(self):
        for graph in ({'T00': ['T01'], 'T01': ['T00']}, {'T00': ['T99']}):
            with self.assertRaises(ValueError):
                check_graph(graph)

    def test_acceptance_matrix_is_planned_and_covers_every_task(self):
        data = json.loads((ROOT / 'docs/engineering/acceptance-scenarios.json').read_text())
        self.assertEqual(data['status'], 'planned_not_executed')
        scenes = data['scenarios']
        self.assertEqual({s['id'] for s in scenes}, {f'S{i:02}' for i in range(1, 32)})
        self.assertEqual(len(scenes), 31)
        graph = task_graph((ROOT / 'tasks/todo.md').read_text())
        covered = set()
        for scene in scenes:
            for field in ('precondition', 'action', 'assertion'):
                self.assertTrue(scene[field].strip())
            self.assertTrue(scene['taskIds'])
            self.assertLessEqual(set(scene['taskIds']), set(graph))
            covered.update(scene['taskIds'])
        # Foundation/schema/transaction harnesses have no business-scenario prerequisite.
        self.assertEqual({t for t in graph if t.startswith('T')} - covered, {'T00', 'T01', 'T02'})
        ai = json.loads((ROOT / 'docs/engineering/ai-acceptance-scenarios.json').read_text())
        self.assertEqual(ai['status'], 'planned_not_executed')
        self.assertGreaterEqual(ai['evaluationSampleMinimum'], 60)
        self.assertEqual(len(ai['scenarios']), 15)
        ai_covered = {t for scene in ai['scenarios'] for t in scene['taskIds']}
        self.assertLessEqual(ai_covered, set(graph))
        self.assertEqual({t for t in graph if t.startswith('A')} - ai_covered, set())
        acceptance_ids = {value for scene in ai['scenarios']
                          for value in scene['prdAcceptanceIds']}
        self.assertLessEqual({f'AC-AI{i:02}' for i in range(1, 16)}, acceptance_ids)

    def test_review_manifest_pins_the_actual_handoff_files(self):
        manifest = json.loads((ROOT / 'docs/engineering/review-manifest.json').read_text())
        self.assertIn(manifest['status'], ('candidate', 'accepted'))
        self.assertEqual(len(manifest['reviewedFiles']), 10)
        for relative, expected in manifest['reviewedFiles'].items():
            path = (ROOT / relative).resolve()
            self.assertTrue(path.is_relative_to(ROOT))
            self.assertRegex(expected, r'^[0-9a-f]{64}$')
            self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), expected,
                             'Handoff changed after review: ' + relative)

    def test_task_entry_links_and_no_unresolved_encoding(self):
        for path in list((ROOT / 'docs/engineering').glob('*.md')) + list((ROOT / 'tasks').glob('*.md')):
            content = path.read_text(encoding='utf-8')
            self.assertNotIn('\ufffd', content, str(path))
            for link in re.findall(r'\[[^\]\n]*\]\(([^)\s]+)\)', content):
                if '://' not in link:
                    self.assertTrue((path.parent / link.split('#')[0]).resolve().exists(), link)
