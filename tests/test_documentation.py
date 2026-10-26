"""Validate document navigation after moves, including relative image links."""
from pathlib import Path
import re
import unittest
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
LINK = re.compile(r'\[[^\]\n]*\]\(([^)\s]+)\)')


class DocumentationTest(unittest.TestCase):
    def test_local_markdown_links_resolve_inside_repository(self):
        documents = [ROOT / 'README.md', ROOT / 'AGENTS.md']
        documents += list((ROOT / 'docs').rglob('*.md'))
        documents += [p for folder in ('demo', 'admin')
                      for p in (ROOT / folder).glob('*.md')]
        documents += list((ROOT / '.agents/skills').rglob('*.md'))
        for document in documents:
            for link in LINK.findall(document.read_text()):
                url = urlsplit(link)
                if url.scheme or not url.path:
                    continue
                with self.subTest(document=document.relative_to(ROOT), link=link):
                    target = (document.parent / unquote(url.path)).resolve()
                    self.assertTrue(target.is_relative_to(ROOT), 'Link escapes project')
                    self.assertTrue(target.exists(), 'Missing document or image')
                    if document.name.startswith(('project-status-', 'project-retrospective-')):
                        self.assertTrue(target.is_file(), 'Coordination evidence must point to a file')

    def test_index_covers_every_project_document(self):
        index = ROOT / 'docs/README.md'
        indexed = {(index.parent / unquote(urlsplit(link).path)).resolve()
                   for link in LINK.findall(index.read_text())
                   if not urlsplit(link).scheme}
        for document in (ROOT / 'docs').rglob('*.md'):
            if document == index or 'archive' in document.parts:
                continue
            with self.subTest(document=document.relative_to(ROOT)):
                self.assertIn(document.resolve(), indexed)

    def test_root_points_to_index_and_candidates_are_not_skills(self):
        self.assertIn('docs/README.md', LINK.findall((ROOT / 'README.md').read_text()))
        self.assertIn('.agents/candidates/', (ROOT / 'AGENTS.md').read_text())
        self.assertFalse((ROOT / 'docs/skill-candidates').exists())
        for candidate in (ROOT / '.agents/candidates').glob('*.md'):
            self.assertFalse(candidate.name == 'SKILL.md')
