"""Check that the development handoff is navigable and its dependency graph is executable."""
import json
import hashlib
import re
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
# Commit in which Codex and Claude accepted the reviewed design snapshot.
ACCEPTED_SNAPSHOT = '4659fdb3b5e4779157ac45058cbf5134aea1b4d2'
# Execution-state files: status and completion records may evolve after acceptance.
EXECUTION_STATE_FILES = {'tasks/plan.md', 'tasks/todo.md'}


def git(*args):
    return subprocess.run(['git', *args], cwd=ROOT, capture_output=True, check=True).stdout


def task_blocks(text):
    return {block.split()[0]: block for block in re.split(r'^## ', text, flags=re.M)[1:]}


def design_fields(block):
    """Task definition without the mutable status value and completion record."""
    lines = []
    for line in block.split('\n'):
        if line.startswith('- 完成记录：'):
            break
        if line.startswith('- 状态：'):
            line = '- 状态：*；' + line.split('；', 1)[1]
        lines.append(line)
    return '\n'.join(lines).rstrip()


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
            record = block.split('完成记录：', 1)[1]
            if status == 'done':
                self.assertNotIn('未实施', record)
                commits = re.findall(r'commit ([0-9a-f]{7,40})', record)
                self.assertTrue(commits, 'done needs commit evidence')
                for commit in commits:
                    git('rev-parse', '--verify', '--quiet', commit + '^{commit}')
                for field in ('命令', '结果', '证据'):
                    self.assertIn(field, record)
            if status == 'blocked_external':
                self.assertRegex(record, r'G-[A-Z-]+', 'blocked_external must name its gate')

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
        self.assertEqual(manifest['status'], 'accepted')
        for relative, expected in manifest['reviewedFiles'].items():
            path = (ROOT / relative).resolve()
            self.assertTrue(path.is_relative_to(ROOT))
            self.assertRegex(expected, r'^[0-9a-f]{64}$')
            accepted = git('show', f'{ACCEPTED_SNAPSHOT}:{relative}')
            self.assertEqual(hashlib.sha256(accepted).hexdigest(), expected,
                             'Accepted snapshot does not match manifest: ' + relative)
            if relative not in EXECUTION_STATE_FILES:
                self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), expected,
                                 'Technical design changed after review: ' + relative)

    def test_execution_state_only_changes_status_and_records(self):
        accepted = task_blocks(git('show', f'{ACCEPTED_SNAPSHOT}:tasks/todo.md').decode())
        current = task_blocks((ROOT / 'tasks/todo.md').read_text())
        self.assertEqual(set(current), set(accepted))
        for task_id, block in accepted.items():
            self.assertEqual(design_fields(current[task_id]), design_fields(block),
                             'Task definition drifted from accepted design: ' + task_id)
        self.assertEqual((ROOT / 'tasks/plan.md').read_bytes(),
                         git('show', f'{ACCEPTED_SNAPSHOT}:tasks/plan.md'))

    def test_design_drift_detector_ignores_only_mutable_fields(self):
        block = 'T99 x\n\n- 状态：todo；依赖：T00。\n- 文件：a\n- 完成记录：未实施\n'
        changed_state = block.replace('todo', 'done').replace('未实施', 'commit abc1234')
        self.assertEqual(design_fields(block), design_fields(changed_state))
        self.assertNotEqual(design_fields(block), design_fields(block.replace('T00', 'T01')))
        self.assertNotEqual(design_fields(block), design_fields(block.replace('文件：a', '文件：b')))

    def test_task_entry_links_and_no_unresolved_encoding(self):
        for path in list((ROOT / 'docs/engineering').glob('*.md')) + list((ROOT / 'tasks').glob('*.md')):
            content = path.read_text(encoding='utf-8')
            self.assertNotIn('\ufffd', content, str(path))
            for link in re.findall(r'\[[^\]\n]*\]\(([^)\s]+)\)', content):
                if '://' not in link:
                    self.assertTrue((path.parent / link.split('#')[0]).resolve().exists(), link)
