"""The QA bundle verifier must reject ESM fallback and stale application sources."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts' / 'qa-verify-native-bundle.py'

class NativeBundleProbeTests(unittest.TestCase):
    def run_probe(self, *, esm=False, stale=False):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            tree, output = root / 'tree', root / 'bundle'
            source = '/apps/ios/src/features/discover/DiscoverScreen.tsx'
            local = tree / source.lstrip('/')
            local.parent.mkdir(parents=True)
            local.write_text('fixed public fixture source')
            output.mkdir()
            (output / 'entry.hbc').write_bytes(b'synthetic-hermes-test-fixture')
            sources = ['/node_modules/@sinclair/typebox/build/cjs/index.js', source,
                       '/apps/ios/app?ctx=generated-virtual-module']
            contents = ['synthetic module', 'stale' if stale else local.read_text(), 'virtual module']
            if esm:
                sources.append('/node_modules/@sinclair/typebox/build/esm/index.mjs')
                contents.append('synthetic wrong module')
            (output / 'entry.hbc.map').write_text(json.dumps({'sources': sources, 'sourcesContent': contents}))
            return subprocess.run([sys.executable, str(SCRIPT), str(tree), str(output)], capture_output=True, text=True)

    def test_fixed_source_and_cjs_only_with_virtual_context_pass(self):
        result = self.run_probe()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)['fixedAppSourceFilesVerified'], 1)

    def test_esm_fallback_fails(self):
        result = self.run_probe(esm=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('TypeBox must resolve only official CJS exports', result.stderr)

    def test_stale_application_source_fails(self):
        result = self.run_probe(stale=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Bundled source differs from fixed tree', result.stderr)
