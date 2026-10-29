"""Validate document navigation after moves, including relative image links."""
from pathlib import Path
import re
import json
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

    def test_project_guide_reaches_all_version_statuses_and_current_inputs(self):
        guide = ROOT / 'docs/project-guide.zh-CN.md'
        targets = {(guide.parent / unquote(urlsplit(link).path)).resolve()
                   for link in LINK.findall(guide.read_text())
                   if not urlsplit(link).scheme}
        statuses = list((ROOT / 'docs/delivery/versions').glob('*/status.json'))
        self.assertTrue(statuses, 'No version status files found')
        for status in statuses:
            with self.subTest(version=json.loads(status.read_text())['id']):
                self.assertIn(status.resolve(), targets,
                              'A development version is missing from the guide')
        for source in ('docs/product/PRD.zh-CN.md',
                       'docs/delivery/execution-r11.json',
                       'docs/reviews/r12/feedback-21-register.md',
                       'docs/product/r12/ios-feedback-requirements-2026-10-28.zh-CN.md',
                       'docs/delivery/mvp-freeze-2026-10-23.zh-CN.md'):
            with self.subTest(authoritative_input=source):
                self.assertIn((ROOT / source).resolve(), targets)
        root_targets = {(ROOT / unquote(urlsplit(link).path)).resolve()
                        for link in LINK.findall((ROOT / 'README.md').read_text())
                        if not urlsplit(link).scheme}
        self.assertIn(guide.resolve(), root_targets)

    def test_module_plan_retains_all_patch_sources(self):
        source = (ROOT / 'docs/product/mvp-patch-PRD.zh-CN.md').read_text()
        plan = (ROOT / 'docs/product/module-version-plan-2026-10-26.zh-CN.md').read_text()
        source_ids = set(re.findall(r'PATCH-00[1-8]', source))
        mapped_ids = set(re.findall(r'^\| (PATCH-00[1-8]) \|', plan, re.MULTILINE))
        self.assertEqual(source_ids, mapped_ids, 'Approved patch scope lost during decomposition')
        management = (ROOT / 'docs/delivery/project-management-plan.zh-CN.md').read_text()
        for case_id in ('J005', 'J008', 'J009', 'J011', 'AI-050', 'AI-052'):
            with self.subTest(inherited_case=case_id):
                self.assertIn(case_id, management)

    def test_root_points_to_index_and_candidates_are_not_skills(self):
        self.assertIn('docs/README.md', LINK.findall((ROOT / 'README.md').read_text()))
        self.assertIn('.agents/candidates/', (ROOT / 'AGENTS.md').read_text())
        self.assertFalse((ROOT / 'docs/skill-candidates').exists())
        for candidate in (ROOT / '.agents/candidates').glob('*.md'):
            self.assertFalse(candidate.name == 'SKILL.md')
