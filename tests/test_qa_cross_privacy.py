"""QA privacy probe must reject unintended invocations before any fixture access."""
import os
from pathlib import Path
import subprocess
import sys
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts/qa-cross-privacy.py'

class PrivacyProbeGuards(unittest.TestCase):
    def test_missing_explicit_fixture_flag_rejects(self):
        env = dict(os.environ)
        env.pop('FANCY_QA_LOCAL_FIXTURE', None)
        result = subprocess.run([sys.executable, str(SCRIPT), 'one-sided'], env=env, capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Requires explicit local fixture flag', result.stderr)

    def test_invalid_phase_rejects_before_owned_database_guard(self):
        env = dict(os.environ, FANCY_QA_LOCAL_FIXTURE='1')
        result = subprocess.run([sys.executable, str(SCRIPT), 'unknown'], env=env, capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Pass one-sided, mutual, or withdrawn', result.stderr)
        self.assertNotIn('Traceback', result.stderr)

class NativeSafetyProbeGuards(unittest.TestCase):
    def test_requires_explicit_fixture_flag_before_metadata_or_pg_access(self):
        env = dict(os.environ)
        env.pop('FANCY_QA_LOCAL_FIXTURE', None)
        script = SCRIPT.with_name('qa-inspect-native-safety.py')
        result = subprocess.run([sys.executable, str(script)], env=env, capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Requires explicit local fixture flag', result.stderr)
        self.assertNotIn('Traceback', result.stderr)

if __name__ == '__main__':
    unittest.main()
