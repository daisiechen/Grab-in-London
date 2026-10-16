"""Research reference integrity, not a test of external claims or live URLs."""
from pathlib import Path
import re
import unittest
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
RESEARCH = ROOT / 'docs' / 'research'
LINK = re.compile(r'\[[^\]\n]+\]\(([^)\s]+)\)')


class ResearchReferenceTest(unittest.TestCase):
    def test_core_cases_reconcile_with_candidate_register_and_summary(self):
        evidence = (RESEARCH / 'competitor-evidence.zh-CN.md').read_text()
        summary = (RESEARCH / 'competitive-landscape.zh-CN.md').read_text()
        cases = re.findall(r'^## (C\d{2}) (.+)$', evidence, re.M)
        registered = re.findall(r'^\| ([CR]\d{2}) \|', evidence, re.M)
        self.assertEqual(len(registered), len(set(registered)), 'Duplicate candidates')
        self.assertEqual(len(registered), 24)
        core = {key for key in registered if key.startswith('C')}
        self.assertEqual(len(core), 12)
        self.assertEqual({key for key, _ in cases}, core)
        self.assertEqual(len(cases), len(core), 'Duplicate case dossiers')
        summary_cases = re.findall(r'^\| (C\d{2}) ', summary, re.M)
        self.assertEqual(set(summary_cases), core)
        self.assertEqual(len(summary_cases), len(core), 'Duplicate summary cases')

    def test_each_core_dossier_has_external_evidence(self):
        evidence = (RESEARCH / 'competitor-evidence.zh-CN.md').read_text()
        sections = re.split(r'^## C\d{2} .+$', evidence, flags=re.M)[1:]
        for index, section in enumerate(sections, start=1):
            # Exclude supplemental material appended after the last core case.
            section = section.split('\n## ', 1)[0]
            urls = {url for url in LINK.findall(section) if url.startswith('https://')}
            self.assertGreaterEqual(len(urls), 2, f'C{index:02d} needs evidence')

    def test_delivery_links_resolve_and_sources_are_public_https(self):
        documents = list(RESEARCH.glob('*.md'))
        self.assertEqual(len(documents), 2)
        # Check the new README entry, without asserting unrelated demo links.
        readme_links = [url for url in LINK.findall((ROOT / 'README.md').read_text())
                        if url.startswith('docs/research/')]
        self.assertEqual(len(readme_links), 2)
        for url in readme_links:
            self.assertTrue((ROOT / url).is_file(), url)
        for path in documents:
            text = path.read_text()
            for url in LINK.findall(text):
                parsed = urlsplit(url)
                if parsed.scheme:
                    self.assertEqual(parsed.scheme, 'https', url)
                    self.assertTrue(parsed.hostname, url)
                    self.assertIsNone(parsed.username, url)
                    self.assertIsNone(parsed.password, url)
                else:
                    target = (path.parent / unquote(parsed.path)).resolve()
                    self.assertTrue(target.is_relative_to(ROOT), url)
                    self.assertTrue(target.is_file(), url)


if __name__ == '__main__':
    unittest.main()
