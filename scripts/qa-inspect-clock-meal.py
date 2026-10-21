"""Read only the named disposable clock rig's lifecycle facts; never reads credentials or bodies."""
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
if 'infra/local-acceptance.ts' not in command:
    raise SystemExit('Not the disposable local acceptance API')
connections = subprocess.check_output(['/usr/sbin/lsof', '-a', '-p', pid, '-nP', '-iTCP'], text=True)
ports = collections.Counter()
for line in connections.splitlines():
    m = re.search(r'127\.0\.0\.1:(\d+)->127\.0\.0\.1:(\d+) \(ESTABLISHED\)', line)
    if m and m[1] != '3000':
        ports[m[2]] += 1
if len(ports) != 1:
    raise SystemExit('Cannot uniquely identify the owned loopback PG connection')
port = next(iter(ports))
psql = Path(os.environ['FANCY_PG_BIN']) / 'psql'
env = {'PATH': os.environ['PATH'], 'LC_ALL': 'C', 'PGPASSFILE': '/dev/null',
       'PGOPTIONS': '-c default_transaction_read_only=on', 'PGAPPNAME': 'qa-readonly-clock-evidence'}
def query(database, sql):
    result = subprocess.run([str(psql), '-X', '-qAt', '--no-password', '-h', '127.0.0.1', '-p', port, '-U', 'fancy', '-d', database, '-c', sql], env=env, text=True, capture_output=True, check=False)
    if result.returncode:
        raise SystemExit('Read-only fixture query failed: ' + result.stderr.strip().splitlines()[0])
    return result.stdout.strip()
names = query('postgres', "SELECT DISTINCT datname FROM pg_stat_activity WHERE application_name='fancy-local-fixed-clock' AND client_addr IN ('127.0.0.1'::inet,'::1'::inet) AND datname LIKE 'fancy_test_%'").splitlines()
if len(names) != 1 or not re.fullmatch(r'fancy_test_[a-z0-9_]+', names[0]):
    raise SystemExit('No unique owned disposable clock database')
# Only the explicitly named meal's sealed marks/roster/jobs. No session, email, text or query columns.
sql = f"""BEGIN READ ONLY;
SELECT json_build_object('ownedClockDatabaseVerified',true,'mealId','{meal}',
 'marks',(SELECT coalesce(json_agg(x ORDER BY x.kind),'[]'::json) FROM (SELECT kind,due_at FROM lifecycle_marks WHERE meal_id='{meal}'::uuid) x),
 'startRoster',(SELECT coalesce(json_agg(x ORDER BY x.user_id),'[]'::json) FROM (SELECT user_id,starts_at FROM start_roster WHERE meal_id='{meal}'::uuid) x),
 'jobs',(SELECT coalesce(json_agg(x ORDER BY x.kind),'[]'::json) FROM (SELECT kind,state,due_at,attempts FROM jobs WHERE resource_id='{meal}'::uuid AND kind IN ('meal.close','meal.start','meal.end')) x));
COMMIT;"""
print(json.dumps(json.loads(query(names[0], sql)), indent=2))
