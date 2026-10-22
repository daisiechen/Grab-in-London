"""Read-only finite facts for the explicitly owned F44 fixture; no credentials/bodies."""
import collections
import json
import os
from pathlib import Path
import re
import subprocess
import uuid
import urllib.request

if os.environ.get('FANCY_QA_LOCAL_FIXTURE') != '1':
    raise SystemExit('Requires explicit local fixture flag')
root = Path('/private/tmp/fancy-f44-rig-2005991')
meta = json.loads((root/'runtime/metadata.json').read_text())
assert meta['sourceSha'] == '2005991055a6462d1f7bcf027b518ac3d7b304e8'
assert meta['port'] == 62044 and meta['fixtureKind'] == 'SYNTHETIC_NEW_OWNED_DB'
assert meta['worker'] is False and meta['aiLifecycle'] is False and meta['realProviders'] is False
pid = str(int(meta['pid']))
command = subprocess.check_output(['/bin/ps', '-p', pid, '-o', 'command='], text=True)
assert str(root/'rig.ts') in command, 'Owned fixture process mismatch'
# The fresh fixture closes idle pool connections; this approved read-only health check opens one.
with urllib.request.urlopen('http://127.0.0.1:62044/health/ready', timeout=5) as response:
    assert response.status == 200, 'Owned fixture must be ready before inspection'
connections = subprocess.check_output(['/usr/sbin/lsof', '-a', '-p', pid, '-nP', '-iTCP'], text=True)
listeners = set(re.findall(r':(\d+)\s+\(LISTEN\)', connections))
assert listeners == {'62044'}, 'Expected sole owned loopback API listener'
ports = collections.Counter()
for line in connections.splitlines():
    match = re.search(r'127\.0\.0\.1:(\d+)->127\.0\.0\.1:(\d+) \(ESTABLISHED\)', line)
    if match and match[1] not in listeners:
        ports[match[2]] += 1
assert len(ports) == 1, 'Expected unique owned loopback PG connection'
port = next(iter(ports))
psql = Path(os.environ['FANCY_PG_BIN'])/'psql'
env = {'PATH': os.environ['PATH'], 'LC_ALL': 'C', 'PGPASSFILE': '/dev/null', 'PGOPTIONS': '-c default_transaction_read_only=on', 'PGAPPNAME': 'qa-readonly-native-safety'}
def query(database, sql):
    result = subprocess.run([str(psql), '-X', '-qAt', '--no-password', '-h', '127.0.0.1', '-p', port, '-U', 'fancy', '-d', database, '-c', sql], env=env, capture_output=True, text=True)
    if result.returncode:
        raise SystemExit('Owned read-only fixture query failed')
    return result.stdout.strip()
names = query('postgres', "SELECT DISTINCT datname FROM pg_stat_activity WHERE application_name='fancy-local-fixed-clock' AND client_addr IN ('127.0.0.1'::inet,'::1'::inet) AND datname LIKE 'fancy_test_%'").splitlines()
assert len(names) == 1 and re.fullmatch(r'fancy_test_[a-z0-9_]+', names[0])
host, guest, meal, direct, group = [str(uuid.UUID(meta[k])) for k in ['hostId', 'guestId', 'mealId', 'directId', 'groupId']]
clock = query(names[0], "SELECT to_char(fancy_fixture_clock.clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')")
assert clock == meta['clock'], 'Fixture clock mismatch'
sql = f"""BEGIN READ ONLY;
SELECT json_build_object(
 'ownedFixtureVerified',true,'sourceCommit','{meta['sourceSha']}','clock','{clock}',
 'blocks',(SELECT coalesce(json_agg(t),'[]'::json) FROM (SELECT blocker,blocked FROM blocks WHERE blocker IN('{host}','{guest}') AND blocked IN('{host}','{guest}') ORDER BY blocker,blocked)t),
 'blockRevisions',(SELECT coalesce(json_agg(t),'[]'::json) FROM (SELECT blocker,blocked,active,version FROM block_revisions WHERE blocker IN('{host}','{guest}') AND blocked IN('{host}','{guest}') ORDER BY blocker,version)t),
 'pairs',(SELECT coalesce(json_agg(t),'[]'::json) FROM (SELECT id,low_user,high_user,consent_epoch,version FROM user_pairs WHERE low_user IN('{host}','{guest}') AND high_user IN('{host}','{guest}') ORDER BY id)t),
 'consents',(SELECT coalesce(json_agg(t),'[]'::json) FROM (SELECT user_id,epoch,revision,revoked_at FROM pair_consents WHERE basis_meal_id='{meal}' ORDER BY user_id,epoch)t),
 'conversations',(SELECT coalesce(json_agg(t),'[]'::json) FROM (SELECT id,kind,version,head,dissolved_at FROM conversations WHERE id IN('{direct}','{group}') ORDER BY id)t),
 'memberships',(SELECT coalesce(json_agg(t),'[]'::json) FROM (SELECT conversation_id,user_id,join_seq,leave_seq FROM membership_intervals WHERE conversation_id IN('{direct}','{group}') ORDER BY conversation_id,user_id,join_seq)t),
 'messageRefs',(SELECT coalesce(json_agg(t),'[]'::json) FROM (SELECT id,conversation_id,seq,sender_id FROM messages WHERE conversation_id IN('{direct}','{group}') ORDER BY conversation_id,seq)t),
 'notificationCount',(SELECT count(*) FROM notifications WHERE recipient_id IN('{host}','{guest}')));
COMMIT;"""
print(json.dumps(json.loads(query(names[0], sql)), indent=2))
