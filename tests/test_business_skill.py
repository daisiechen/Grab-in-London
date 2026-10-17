"""Keep the methodology self-contained and its AGENTS entry reachable."""
from pathlib import Path
import re
import unittest
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / ".agents/skills/business-model-design"
LINK = re.compile(r"\[[^\]]+\]\(([^)]+)\)")


class BusinessSkillTest(unittest.TestCase):
    def test_agents_entry_resolves_to_skill(self):
        agents = (ROOT / "AGENTS.md").read_text()
        targets = [ROOT / target for target in LINK.findall(agents)
                   if "business-model-design" in target]
        self.assertEqual(targets, [SKILL / "SKILL.md"])
        self.assertTrue(targets[0].is_file())

    def test_reference_graph_is_complete_and_portable(self):
        pending = [SKILL / "SKILL.md"]
        visited = set()
        while pending:
            file = pending.pop().resolve()
            if file in visited:
                continue
            visited.add(file)
            text = file.read_text()
            for target in LINK.findall(text):
                parsed = urlparse(target)
                if parsed.scheme:
                    self.assertEqual(parsed.scheme, "https", target)
                    self.assertTrue(parsed.netloc, target)
                    continue
                local = (file.parent / parsed.path).resolve()
                self.assertTrue(local.is_relative_to(SKILL.resolve()), target)
                self.assertTrue(local.is_file(), target)
                pending.append(local)
        self.assertEqual(visited, {p.resolve() for p in SKILL.rglob("*.md")})

    def test_skill_has_no_business_specific_or_host_dependency(self):
        for file in SKILL.rglob("*.md"):
            text = file.read_text()
            with self.subTest(file=file.name):
                for project_identifier in (ROOT.name, "Grab-in-London", "Fancy", "daisiechen"):
                    self.assertNotIn(project_identifier, text)
                self.assertNotRegex(text, r"/Users/|/home/|/mnt/|[A-Za-z]:\\")
                self.assertNotIn("../../docs/", text)


if __name__ == "__main__":
    unittest.main()
