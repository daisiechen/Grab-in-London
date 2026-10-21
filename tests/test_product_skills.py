"""Check reusable skill discovery, reference integrity and context isolation."""
from pathlib import Path
import re
import unittest
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
NAMES = ("product-management", "product-design", "qa-acceptance")
LINK = re.compile(r"\[[^\]]+\]\(([^)]+)\)")


class ProductSkillsTest(unittest.TestCase):
    def test_agents_routes_to_both_entrypoints(self):
        agents = (ROOT / "AGENTS.md").read_text()
        targets = LINK.findall(agents)
        for name in NAMES:
            with self.subTest(skill=name):
                target = f".agents/skills/{name}/SKILL.md"
                self.assertEqual(targets.count(target), 1)
                self.assertTrue((ROOT / target).is_file())

    def test_reference_graph_has_no_broken_escaped_or_unreachable_files(self):
        for name in NAMES:
            skill = (ROOT / ".agents/skills" / name).resolve()
            pending = [skill / "SKILL.md"]
            visited = set()
            while pending:
                file = pending.pop().resolve()
                if file in visited:
                    continue
                visited.add(file)
                with self.subTest(skill=name, file=file.name):
                    for target in LINK.findall(file.read_text()):
                        parsed = urlparse(target)
                        if parsed.scheme:
                            self.assertEqual(parsed.scheme, "https", target)
                            self.assertTrue(parsed.netloc, target)
                            continue
                        self.assertTrue(parsed.path, target)
                        local = (file.parent / parsed.path).resolve()
                        self.assertTrue(local.is_relative_to(skill), target)
                        self.assertTrue(local.is_file(), target)
                        pending.append(local)
            self.assertEqual(visited, {p.resolve() for p in skill.rglob("*.md")})

    def test_entry_metadata_matches_discoverable_directory(self):
        for name in NAMES:
            text = (ROOT / ".agents/skills" / name / "SKILL.md").read_text()
            with self.subTest(skill=name):
                metadata = re.match(r"\A---\n(.*?)\n---\n", text, re.S)
                self.assertIsNotNone(metadata)
                fields = dict(line.split(":", 1) for line in metadata.group(1).splitlines())
                self.assertEqual(fields["name"].strip(), name)
                self.assertTrue(fields["description"].strip())

    def test_skills_are_generic_and_have_no_host_or_project_dependency(self):
        for name in NAMES:
            for file in (ROOT / ".agents/skills" / name).rglob("*.md"):
                text = file.read_text()
                with self.subTest(skill=name, file=file.name):
                    for identifier in (ROOT.name, "Grab-in-London", "Fancy", "daisiechen",
                                       "chatgpt.site", "127.0.0.1", "2026-10-23"):
                        self.assertNotIn(identifier, text)
                    self.assertNotRegex(text, r"/Users/|/home/|/mnt/|[A-Za-z]:\\")
                    self.assertNotIn("../../docs/", text)


if __name__ == "__main__":
    unittest.main()
