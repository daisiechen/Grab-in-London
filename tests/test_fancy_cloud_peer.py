"""Boundary tests for the fixed-peer cloud queue transport."""
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('peer', Path(__file__).resolve().parents[1] / 'scripts/fancy_cloud_peer.py')
peer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(peer)
ID = '00000000-0000-4000-8000-000000000001'

class PeerTest(unittest.TestCase):
    def test_fixed_actions_and_no_target_or_command_override(self):
        for req in [{'action': 'shell'}, {'action': 'read', 'thread': ID},
                    {'action': 'send', 'id': ID, 'text': 'hi', 'command': 'id'},
                    {'action': 'send', 'id': '../../etc/passwd', 'text': 'hi'},
                    {'action': 'send', 'id': ID, 'text': 'x' * 6001},
                    {'action': 'send', 'id': ID, 'text': '\0'}]:
            with self.subTest(req=str(req)[:100]), self.assertRaises((ValueError, TypeError)):
                peer.validate_request(req)
        self.assertEqual(peer.validate_request({'action': 'send', 'id': ID, 'text': 'hello'}), 'send')

    def test_wake_never_interrupts_or_overtakes_earlier_queue(self):
        class Control:
            def __init__(self, status, queue): self.status, self.queue, self.calls = status, queue, []
            def rpc(self, method, params):
                self.calls.append(method)
                if method == 'thread/read': return {'thread': {'status': {'type': self.status}}}
                if method == 'thread/queue/list': return {'data': self.queue}
                raise AssertionError('Unexpected mutation')
        c = Control('active', [])
        self.assertEqual(peer.wake(c, ID, ID)['status'], 'WAITING_ACTIVE')
        self.assertEqual(c.calls, ['thread/read'])
        c = Control('idle', [{'id': 'earlier'}, {'id': ID}])
        self.assertEqual(peer.wake(c, ID, ID)['status'], 'WAITING_EARLIER_QUEUE')
        c = Control('idle', [])
        self.assertEqual(peer.wake(c, ID, ID)['status'], 'ALREADY_CONSUMED')

    def test_uncertain_send_is_not_replayed_and_conflicting_id_is_rejected(self):
        import tempfile
        from unittest.mock import patch
        import subprocess
        import os
        with tempfile.TemporaryDirectory() as root:
            conf = {'codex_home': root, 'state_dir': root, 'source_user': 'peer',
                    'target_thread': ID, 'codex': '/fixed/codex', 'path': '/usr/bin:/bin'}
            req = {'action': 'send', 'id': ID, 'text': 'hello'}
            with patch.dict(os.environ), patch.object(peer.subprocess, 'run', side_effect=subprocess.TimeoutExpired('codex', 30)) as run:
                self.assertEqual(peer.execute(req, conf)['status'], 'UNKNOWN')
                self.assertEqual(peer.execute(req, conf)['status'], 'UNKNOWN')
                self.assertEqual(run.call_count, 1)
                with self.assertRaises(ValueError):
                    peer.execute({**req, 'text': 'different'}, conf)

    def test_read_uses_bounded_recent_turns_instead_of_full_history(self):
        from unittest.mock import patch
        import os
        class Control:
            def __init__(self): self.calls = []
            def close(self): pass
            def rpc(self, method, params):
                self.calls.append((method, params))
                if method == 'thread/read':
                    assert params['includeTurns'] is False
                    return {'thread': {'status': {'type': 'idle'}}}
                assert params == {'threadId': ID, 'limit': 3, 'sortDirection': 'desc', 'itemsView': 'summary'}
                return {'data': [{'id': ID, 'status': 'completed', 'items': [
                    {'type': 'agentMessage', 'text': 'receipt'},
                    {'type': 'commandExecution', 'output': 'private tool output'}]}]}
        control = Control()
        with patch.dict(os.environ), patch.object(peer, 'CodexControl', return_value=control):
            result = peer.execute({'action': 'read'}, {'codex_home': '/unused', 'target_thread': ID})
        self.assertEqual(result['turns'][0]['messages'], ['receipt'])
        self.assertNotIn('private tool output', str(result))
        self.assertEqual(len(control.calls), 2)
