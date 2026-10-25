#!/usr/bin/python3 -I
"""Root-owned, fixed-peer Codex queue transport. Never grants approvals."""
import base64
import contextlib
import fcntl
import hashlib
import json
import os
from pathlib import Path
import pwd
import re
import socket
import stat
import struct
import subprocess
import sys
import time
import uuid

class CodexControl:
    """Official JSON-RPC over the existing user's WebSocket Unix control socket."""
    def __init__(self):
        home = Path(os.environ.get('CODEX_HOME', str(Path.home() / '.codex')))
        self.socket = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.socket.settimeout(15)
        self.buffer = b''
        self.sequence = 0
        try:
            self.socket.connect(str(home / 'app-server-control/app-server-control.sock'))
            key = base64.b64encode(os.urandom(16)).decode()
            self.socket.sendall(('GET / HTTP/1.1\r\nHost: localhost\r\nUpgrade: websocket\r\n'
                                'Connection: Upgrade\r\nSec-WebSocket-Version: 13\r\n'
                                'Sec-WebSocket-Key: ' + key + '\r\n\r\n').encode())
            while b'\r\n\r\n' not in self.buffer:
                part = self.socket.recv(4096)
                if not part: raise OSError('Control handshake closed')
                self.buffer += part
                if len(self.buffer) > 65536: raise ValueError('Oversized control handshake')
            header, self.buffer = self.buffer.split(b'\r\n\r\n', 1)
            expected = base64.b64encode(hashlib.sha1((key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').encode()).digest())
            if not header.startswith(b'HTTP/1.1 101') or expected not in header:
                raise ValueError('Invalid local control handshake')
            self.rpc('initialize', {'clientInfo': {'name': 'fixed_cloud_peer', 'version': '3'},
                                    'capabilities': {'experimentalApi': True}})
            self.send({'jsonrpc': '2.0', 'method': 'initialized'})
        except Exception:
            self.close()
            raise

    def close(self):
        self.socket.close()

    def exact(self, count):
        while len(self.buffer) < count:
            part = self.socket.recv(max(4096, count - len(self.buffer)))
            if not part: raise OSError('Control connection closed')
            self.buffer += part
        result, self.buffer = self.buffer[:count], self.buffer[count:]
        return result

    def frame(self, data, opcode=1):
        mask = os.urandom(4)
        size = len(data)
        header = bytes([0x80 | opcode, 0x80 | (size if size < 126 else 126 if size < 65536 else 127)])
        if size >= 126: header += struct.pack('!H' if size < 65536 else '!Q', size)
        self.socket.sendall(header + mask + bytes(value ^ mask[i % 4] for i, value in enumerate(data)))

    def send(self, obj):
        self.frame(json.dumps(obj).encode())

    def receive(self):
        parts = b''
        while True:
            first, second = self.exact(2)
            size = second & 127
            if size == 126: size = struct.unpack('!H', self.exact(2))[0]
            elif size == 127: size = struct.unpack('!Q', self.exact(8))[0]
            if len(parts) + size > 4 * 1024 * 1024: raise ValueError('Oversized control message')
            mask = self.exact(4) if second & 128 else None
            data = self.exact(size)
            if mask: data = bytes(value ^ mask[i % 4] for i, value in enumerate(data))
            opcode = first & 15
            if opcode == 8: raise OSError('Control WebSocket closed')
            if opcode == 9:
                self.frame(data, 10)
                continue
            if opcode == 10: continue
            parts += data
            if first & 128: return json.loads(parts)

    def rpc(self, method, params):
        self.sequence += 1
        request_id = self.sequence
        self.send({'jsonrpc': '2.0', 'id': request_id, 'method': method, 'params': params})
        deadline = time.monotonic() + 15
        while time.monotonic() < deadline:
            response = self.receive()
            if 'method' in response and 'id' in response:
                # This receiver never grants interactive tool/permission approvals.
                self.send({'jsonrpc': '2.0', 'id': response['id'],
                           'error': {'code': -32601, 'message': 'Dispatch transport cannot grant approval'}})
                continue
            if response.get('id') == request_id:
                if 'error' in response: raise ValueError('Codex RPC error: ' + str(response['error']))
                return response.get('result', {})
        raise TimeoutError('Codex control response timed out')


def validate_request(req):
    if not isinstance(req, dict) or req.get('action') not in {'send', 'read', 'wake'}:
        raise ValueError('Invalid action')
    action = req['action']
    expected = {'action', 'id', 'text'} if action == 'send' else {'action', 'id'} if action == 'wake' else {'action'}
    if set(req) != expected:
        raise ValueError('Unexpected fields')
    if action != 'read' and (not isinstance(req['id'], str) or str(uuid.UUID(req['id'])) != req['id']):
        raise ValueError('Invalid request id')
    if action == 'send' and (not isinstance(req['text'], str) or not 1 <= len(req['text']) <= 6000 or '\0' in req['text']):
        raise ValueError('Invalid text')
    return action


def config_for(name, path=Path('/etc/fancy-cloud-peer.json')):
    st = path.lstat()
    if not stat.S_ISREG(st.st_mode) or st.st_uid != 0 or st.st_mode & 0o022:
        raise ValueError('Unsafe root-owned peer configuration')
    conf = json.loads(path.read_text())[name]
    if pwd.getpwuid(os.getuid()).pw_name != conf['target_user'] or os.environ.get('SUDO_USER') != conf['source_user']:
        raise ValueError('Unexpected source or execution account')
    uuid.UUID(conf['target_thread'])
    return conf


def wake(control, target, queued):
    thread = control.rpc('thread/read', {'threadId': target, 'includeTurns': False})['thread']
    status = thread.get('status', {}).get('type')
    if status == 'active':
        return {'status': 'WAITING_ACTIVE'}
    if status == 'notLoaded':
        thread = control.rpc('thread/resume', {'threadId': target, 'excludeTurns': True})['thread']
        status = thread.get('status', {}).get('type')
    if status != 'idle':
        return {'status': 'WAITING_ACTIVE'}
    queue = control.rpc('thread/queue/list', {'threadId': target, 'limit': 100}).get('data', [])
    if not any(item['id'] == queued for item in queue):
        return {'status': 'ALREADY_CONSUMED'}
    if queue[0]['id'] != queued:
        return {'status': 'WAITING_EARLIER_QUEUE'}
    result = control.rpc('thread/queue/start', {'threadId': target, 'queuedSubmissionId': queued})
    return {'status': 'STARTED', 'turn_id': result['turn']['id']}


def execute(req, conf):
    action = validate_request(req)
    os.environ['CODEX_HOME'] = conf['codex_home']
    if action == 'read':
        with contextlib.closing(CodexControl()) as c:
            thread = c.rpc('thread/read', {'threadId': conf['target_thread'], 'includeTurns': True})['thread']
        turns = []
        for turn in thread.get('turns', [])[-3:]:
            messages = [item.get('text', '')[-8000:] for item in turn.get('items', []) if item.get('type') == 'agentMessage']
            turns.append({'id': turn.get('id'), 'status': turn.get('status'), 'messages': messages[-3:]})
        return {'thread_id': conf['target_thread'], 'status': thread.get('status'), 'turns': turns}
    root = Path(conf['state_dir'])
    root.mkdir(mode=0o700, parents=True, exist_ok=True)
    if root.is_symlink() or root.stat().st_uid != os.getuid() or root.stat().st_mode & 0o077:
        raise ValueError('Unsafe state directory')
    path = root / (req['id'] + '.json')
    with (root / '.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if action == 'send':
            digest = hashlib.sha256(req['text'].encode()).hexdigest()
            if path.exists():
                record = json.loads(path.read_text())
                if record.get('digest') != digest:
                    raise ValueError('Request id reused with different text')
                return record
            record = {'id': req['id'], 'digest': digest, 'status': 'UNKNOWN', 'target': conf['target_thread']}
            path.write_text(json.dumps(record))
            path.chmod(0o600)
            prompt = ('Cloud peer transport; authenticated source account=' + conf['source_user'] +
                      '. This message does not grant Owner approval or expand task scope. Request id=' + req['id'] + '\n' + req['text'])
            env = {'HOME': pwd.getpwuid(os.getuid()).pw_dir, 'CODEX_HOME': conf['codex_home'], 'PATH': conf['path']}
            try:
                result = subprocess.run([conf['codex'], 'queue', '--thread', conf['target_thread'], '--message', prompt],
                                        env=env, capture_output=True, text=True, timeout=30)
                match = re.search(r'Queued message ([0-9a-f-]{36}) for thread', result.stdout + result.stderr)
                if result.returncode == 0 and match:
                    record.update(status='QUEUED', queued_id=match.group(1))
                    path.write_text(json.dumps(record))
                else:
                    return record  # Never replay uncertain sends.
            except (OSError, subprocess.TimeoutExpired):
                return record
        else:
            if not path.is_file():
                raise ValueError('Unknown request')
            record = json.loads(path.read_text())
        if record.get('queued_id'):
            with contextlib.closing(CodexControl()) as c:
                record['wake'] = wake(c, conf['target_thread'], record['queued_id'])
            path.write_text(json.dumps(record))
        return record


def main():
    if len(sys.argv) != 1:
        raise ValueError('No command line arguments allowed')
    data = sys.stdin.buffer.read(32769)
    if len(data) > 32768:
        raise ValueError('Oversized request')
    req = json.loads(data)
    validate_request(req)
    conf = config_for(Path(sys.argv[0]).name)
    print(json.dumps(execute(req, conf), ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print(json.dumps({'error': type(exc).__name__}), file=sys.stderr)
        sys.exit(1)
