"""Exercise the CI runtime compatibility step with an isolated runner layout."""
from pathlib import Path
import os
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


class CIPMRuntimeTest(unittest.TestCase):
    def test_clean_runner_provides_legacy_node_path_without_installing_or_skipping_tests(self):
        source = (ROOT / '.github/workflows/core.yml').read_text()
        section = source.split('- name: Documentation and immutable design checks', 1)[1]
        section = section.split('- name: Web and admin production builds', 1)[0]
        self.assertIn('python3 -m unittest discover -s tests', section)
        command = section.split('run: |', 1)[1].split('python3 -m unittest', 1)[0]
        with tempfile.TemporaryDirectory() as temp:
            parent = Path(temp)
            checkout = parent / 'repo'
            checkout.mkdir()
            binaries = parent / 'bin'
            binaries.mkdir()
            node = binaries / 'node'
            node.write_text('#!/bin/sh\nprintf "v24-test\\n"\n')
            node.chmod(0o755)
            environment = dict(os.environ, PATH=str(binaries) + ':' + os.environ['PATH'])
            for _ in range(2):
                result = subprocess.run(['sh', '-eu', '-c', command], cwd=checkout,
                                        env=environment, capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn('v24-test', result.stdout)
            self.assertEqual((parent / 'runtime/node/bin/node').resolve(), node)


if __name__ == '__main__':
    unittest.main()
