"""Author checks for J03 design inputs, coverage and actual Figma readback."""
from pathlib import Path
import hashlib
import json
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
SLUG = "j03"
PACKAGE = ROOT / "docs/design/journeys" / SLUG


class UXJ03DeliveryTest(unittest.TestCase):
    def setUp(self):
        self.manifest = json.loads((PACKAGE / "artifact-manifest.json").read_text())
        self.readback = json.loads((PACKAGE / "figma-readback.json").read_text())
        self.screens = {row["key"]: row for row in self.readback["screens"]}

    def test_inputs_are_exact_frozen_prd_demo_and_design_rules(self):
        for path, digest in self.manifest["inputHashes"].items():
            frozen = subprocess.run(["git", "show", self.manifest["inputCommit"] + ":" + path], cwd=ROOT, capture_output=True, check=True).stdout
            self.assertEqual(hashlib.sha256(frozen).hexdigest(), digest, path)
            self.assertEqual(hashlib.sha256((ROOT / path).read_bytes()).hexdigest(), digest, path)
        for path, digest in self.manifest["files"].items():
            self.assertEqual(hashlib.sha256((ROOT / path).read_bytes()).hexdigest(), digest, path)

    def test_every_journey_requirement_has_real_design_nodes_and_pm_scene(self):
        coverage = json.loads((PACKAGE / "coverage.json").read_text())
        original = json.loads((ROOT / coverage["pmCoverage"]).read_text())
        self.assertEqual({row["scenarioId"] for row in coverage["scenarios"]}, {row["id"] for row in original["requirements"]})
        valid = {row["id"] for row in self.readback["screens"]}
        for row in coverage["scenarios"]:
            self.assertTrue(row["demoScenes"])
            self.assertTrue(row["figmaNodes"])
            self.assertTrue(set(row["figmaNodes"]).issubset(valid))
        self.assertEqual(coverage["sourceUnitInheritance"]["unitCount"], len(original["sourceUnits"]))

    def test_editability_native_routes_and_stage_boundary(self):
        valid = {row["id"] for row in self.readback["screens"]}
        self.assertTrue(self.readback["counts"]["INSTANCE"])
        self.assertEqual(self.readback["wrongFonts"], [])
        self.assertEqual(self.readback["narrowLabels"], [])
        self.assertEqual(self.readback["imageFilledNodes"], [])
        for row in self.readback["screens"]:
            self.assertEqual((row["width"], row["height"]), (393, 852))
            for link in row["links"]:
                for action in link["actions"]:
                    if action["type"] == "NODE":
                        self.assertIn(action["destinationId"], valid)
        self.assertEqual(self.manifest["stagesStarted"], {"PM": True, "UX": True, "RD": False, "QA": False})
        self.assertFalse(self.manifest["ownerApproved"])
        self.assertFalse(self.manifest["figma"]["frozen"])
        self.assertIsNone(self.manifest["figma"]["namedVersionId"])
        for image in (PACKAGE / "evidence").glob("*.png"):
            self.assertEqual(image.read_bytes()[:8], b"\x89PNG\r\n\x1a\n")

    def test_journey_critical_state_contract(self):
        left = "\n".join(self.screens["leftsettings"]["text"])
        self.assertIn("Current members are not shown", left)
        self.assertNotIn("Current members · 2", left)
        self.assertFalse(any("Send" in row["name"] for row in self.screens["history"]["links"]))
        self.assertIn("does not release your seat", "\n".join(self.screens["settings"]["text"]))
        self.assertIn("Messages sent while you were away are not shown", "\n".join(self.screens["reentered"]["text"]))
        self.assertIn("not sent automatically", "\n".join(self.screens["replace"]["text"]))


if __name__ == "__main__":
    unittest.main()
