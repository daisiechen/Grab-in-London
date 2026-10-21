"""Third synthetic actor privacy check on the owned cross-client fixture only.
Authentication cookies and CSRF remain in RAM; output contains status/assertions only.
Run after the native single-sided choice, before the other participant selects.
"""
import hashlib
import http.cookies
import json
import os
from pathlib import Path
import subprocess
import sys
import urllib.error
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[1]
if os.environ.get('FANCY_QA_LOCAL_FIXTURE') != '1':
    raise SystemExit('Requires explicit local fixture flag')
if len(sys.argv) != 2 or sys.argv[1] not in ('one-sided', 'mutual', 'withdrawn'):
    raise SystemExit('Pass one-sided, mutual, or withdrawn')
guard = subprocess.run([sys.executable, str(ROOT/'scripts/qa-inspect-clock-meal.py'), '63824', '57c7b03f-29d5-4a4f-8cc2-8d2db7fc91bb'], check=True, capture_output=True, text=True)
assert json.loads(guard.stdout)['ownedClockDatabaseVerified'] is True
base = 'http://127.0.0.1:61973/v1'
opener = urllib.request.build_opener()
cookies = {}
csrf = None

def request(method, path, body=None, version=None):
    headers = {'Origin': 'http://localhost:5177'}
    if cookies:
        headers['Cookie'] = '; '.join(k+'='+v for k,v in cookies.items())
    if body is not None:
        headers['Content-Type'] = 'application/json'
    if csrf and method != 'GET':
        headers['x-csrf-token'] = csrf
    if version is not None:
        headers.update({'if-match': '"'+version+'"', 'idempotency-key': str(uuid.uuid4())})
    req = urllib.request.Request(base+path, data=None if body is None else json.dumps(body).encode(), headers=headers, method=method)
    try:
        response = opener.open(req, timeout=15)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        for raw in response.headers.get_all('Set-Cookie', []):
            parsed = http.cookies.SimpleCookie(); parsed.load(raw)
            for name, morsel in parsed.items():
                if morsel.value:
                    cookies[name] = morsel.value
                else:
                    cookies.pop(name, None)
        return response.status, json.load(response)

status, start = request('POST', '/auth/email/start', {'clientRequestId': str(uuid.uuid4()), 'email': 'qa-cross-privacy-b@example.invalid', 'client': 'WEB'})
assert status == 201, ('start', status)
status, signed = request('POST', '/auth/email/verify', {'clientRequestId': str(uuid.uuid4()), 'challengeId': start['data']['challengeId'], 'code': '000000'})
assert status == 200, ('verify', status)
csrf = signed['data']['session']['csrfToken']
status, me = request('GET', '/me')
assert status == 200, ('me', status)
if not me['data']['profileGate']['profileComplete']:
    status, me = request('PATCH', '/me', {'displayName': 'QA Privacy Observer', 'bio': 'Synthetic third actor for isolated privacy assertions.', 'languages': ['en'], 'lifeStatus': 'NEW_TO_LONDON', 'interests': ['FOOD'], 'ageConfirmedVersion': '2026-10-21', 'communityAcceptedVersion': '2026-10-21'}, me['data']['version'])
    assert status == 200, ('profile', status)
assert me['data']['profileGate']['profileComplete']
checks = []
def check(name, method, path, expected):
    status, body = request(method, path)
    assert status == expected, (name, status, expected)
    checks.append({'name': name, 'status': status, 'expected': expected})
    return body
for actor in ['fc2e9e2a-20db-41db-936f-2c1493315583', 'd50902da-c74a-4f79-9e70-7e72c61d0c50']:
    body = check('public profile omits connection/consent fields', 'GET', '/profiles/'+actor, 200)
    def keys(value):
        if isinstance(value, dict):
            return set(value).union(*(keys(v) for v in value.values()))
        if isinstance(value, list):
            return set().union(*(keys(v) for v in value))
        return set()
    assert not keys(body).intersection({'pairId', 'selected', 'reconnect', 'connection', 'consentEpoch', 'experience', 'email'})
    checks[-1]['projectionSha256'] = hashlib.sha256(json.dumps(body['data'],sort_keys=True).encode()).hexdigest()
    check('third actor has no direct conversation with participant', 'GET', '/connections/'+actor+'/conversation', 404)
for meal in ['acfe9e54-d6d7-4c63-81b6-f6aae4e53610', '57c7b03f-29d5-4a4f-8cc2-8d2db7fc91bb']:
    check('third actor cannot read participant post-meal choices', 'GET', '/meals/'+meal+'/post-meal', 403)
body = check('third actor inbox contains no participant conversations', 'GET', '/inbox', 200)
assert '23616e6a-08d9-48a7-9dac-e335b0360257' not in json.dumps(body)
print(json.dumps({'phase': sys.argv[1], 'actorId': me['data']['id'], 'environment': 'owned API19d/same real isolatedPG; synthetic OTP/profile; credentials RAM only', 'checks': checks}, indent=2))
