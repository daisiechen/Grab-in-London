"""Read only the named disposable AI rig's write-observer facts; never reads credentials or bodies."""
import collections
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import uuid

if os.environ.get('FANCY_QA_LOCAL_FIXTURE') != '1':
    raise SystemExit('FANCY_QA_LOCAL_FIXTURE=1 is required')
if len(sys.argv) != 3 or not sys.argv[1].isdigit():
    raise SystemExit('Expected owned API PID and synthetic meal UUID')
pid, meal = sys.argv[1], str(uuid.UUID(sys.argv[2]))
command = subprocess.check_output(['/bin/ps', '-p', pid, '-o', 'command='], text=True).strip()
if 'scripts/qa-ai-browser-fixture.ts' not in command:
    raise SystemExit('Not the disposable local acceptance API')
connections = subprocess.check_output(['/usr/sbin/lsof', '-a', '-p', pid, '-nP', '-iTCP'], text=True)
ports = collections.Counter()
for line in connections.splitlines():
    m = re.search(r'127\.0\.0\.1:(\d+)->127\.0\.0\.1:(\d+) \(ESTABLISHED\)', line)
    if m and m[1] != '3102':
        ports[m[2]] += 1
if len(ports) != 1:
    raise SystemExit('Cannot uniquely identify the owned loopback PG connection')
port = next(iter(ports))
psql = Path(os.environ['FANCY_PG_BIN']) / 'psql'
env = {'PATH': os.environ['PATH'], 'LC_ALL': 'C', 'PGPASSFILE': '/dev/null',
       'PGOPTIONS': '-c default_transaction_read_only=on', 'PGAPPNAME': 'qa-readonly-ai-evidence'}
def query(database, sql):
    result = subprocess.run([str(psql), '-X', '-qAt', '--no-password', '-h', '127.0.0.1', '-p', port, '-U', 'fancy', '-d', database, '-c', sql], env=env, text=True, capture_output=True, check=False)
    if result.returncode:
        raise SystemExit('Read-only fixture query failed: ' + result.stderr.strip().splitlines()[0])
    return result.stdout.strip()
names = query('postgres', "SELECT DISTINCT datname FROM pg_stat_activity WHERE client_addr IN ('127.0.0.1'::inet,'::1'::inet) AND datname LIKE 'fancy_test_%'").splitlines()
if len(names) != 1 or not re.fullmatch(r'fancy_test_[a-z0-9_]+', names[0]):
    raise SystemExit('No unique owned disposable clock database')
# Read only the explicitly installed QA marker and aggregate write observer; no private row data.
if query(names[0], "SELECT to_regclass('public.qa_business_probe') IS NOT NULL") != 't':
    raise SystemExit('Missing owned QA marker')
sql = f"""BEGIN READ ONLY;
SELECT json_build_object('ownedDisposableFixtureVerified',true,'mealId','{meal}',
 'targetExists',(SELECT count(*)=1 FROM meals WHERE id='{meal}'::uuid),
 'writes',(SELECT coalesce(json_agg(x ORDER BY x.table_name,x.operation),'[]'::json) FROM (SELECT table_name,operation,count(*)::int n FROM qa_business_probe GROUP BY table_name,operation) x),
 'targetApplications',(SELECT count(*) FROM applications WHERE meal_id='{meal}'::uuid),
 'targetSeats',(SELECT count(*) FROM seat_events WHERE meal_id='{meal}'::uuid),
 'meals',(SELECT count(*) FROM meals), 'messages',(SELECT count(*) FROM messages));
COMMIT;"""
print(json.dumps(json.loads(query(names[0], sql)), indent=2))
