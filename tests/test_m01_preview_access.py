"""Transport checks for the private PM preview; no product-stage acceptance."""
import hashlib
import json
from pathlib import Path
import subprocess
import unittest
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]


class M01PreviewAccessTest(unittest.TestCase):
    def test_published_preview_keeps_source_revision_and_private_scope(self):
        record = json.loads((ROOT / 'docs/delivery/m01-01-preview-access.json').read_text())
        demo = ROOT / record['sourceDemo']
        self.assertEqual(hashlib.sha256(demo.read_bytes()).hexdigest(), record['sourceSha256'])
        self.assertEqual(record['deploymentStatus'], 'succeeded')
        self.assertEqual(record['audience'], 'owner-private')
        self.assertEqual(urlsplit(record['url']).scheme, 'https')
        self.assertNotIn('localhost', record['url'])
        self.assertEqual(record['requirementsUrl'], record['url'] + '/requirements.html')
        self.assertFalse(record['realAuthentication'])
        self.assertEqual(record['newProfessionalStagesStarted'], [])
        replacement = record['transportChange']
        self.assertEqual(demo.read_text().count(replacement['from']), 1)
        hosted = demo.read_text().replace(replacement['from'], replacement['to'])
        self.assertEqual(hashlib.sha256(hosted.encode()).hexdigest(), record['hostedHtmlSha256'])
        ignored = subprocess.run(['git', 'check-ignore', '.preview-sites/m01-01/pm-demo.html'],
                                 cwd=ROOT, text=True, capture_output=True)
        self.assertEqual(ignored.returncode, 0, 'Hosting checkout must not enter main project commits')


if __name__ == '__main__':
    unittest.main()
