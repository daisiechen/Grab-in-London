"""Validate shared agent entrypoints without invoking either agent."""
from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]

class ClaudeConfigurationTests(unittest.TestCase):
    def test_rules_import_and_shared_documentation(self):
        self.assertIn('@AGENTS.md', (ROOT / 'CLAUDE.md').read_text())
        self.assertIn('docs/agent-collaboration.md', (ROOT / 'AGENTS.md').read_text())
        self.assertTrue((ROOT / 'docs/agent-collaboration.md').is_file())

    def test_skills_resolve_to_canonical_sources(self):
        sources = {p.name for p in (ROOT / '.agents/skills').iterdir() if (p / 'SKILL.md').is_file()}
        links = ROOT / '.claude/skills'
        self.assertEqual(sources, {p.name for p in links.iterdir()})
        for name in sources:
            with self.subTest(skill=name):
                link = links / name
                self.assertTrue(link.is_symlink())
                self.assertEqual(link.resolve(), (ROOT / '.agents/skills' / name).resolve())

    def test_private_runtime_paths_are_ignored(self):
        for path in ['.claude/settings.local.json', '.claude/worktrees/session/file',
                     '.claude/projects/session.json', 'CLAUDE.local.md']:
            result = subprocess.run(['git', 'check-ignore', '-q', path], cwd=ROOT)
            self.assertEqual(result.returncode, 0, path)
        self.assertEqual(subprocess.run(['git', 'check-ignore', '-q', 'CLAUDE.md'], cwd=ROOT).returncode, 1)
