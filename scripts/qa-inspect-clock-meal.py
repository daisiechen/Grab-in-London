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
listeners = set(re.findall(r":(\d+)\s+\(LISTEN\)", connections))
if not listeners:
    raise SystemExit("Owned API listener not observed")
ports = collections.Counter()
for line in connections.splitlines():
    m = re.search(r'127\.0\.0\.1:(\d+)->127\.0\.0\.1:(\d+) \(ESTABLISHED\)', line)
    if m and m[1] not in listeners:
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
 'meal',(SELECT row_to_json(x) FROM (SELECT id,status,version,head,minimum,capacity,cancel_reason FROM meals WHERE id='{meal}'::uuid) x),
 'applications',(SELECT coalesce(json_agg(x ORDER BY x.id),'[]'::json) FROM (SELECT id,user_id,round,state,version FROM applications WHERE meal_id='{meal}'::uuid) x),
 'seats',(SELECT coalesce(json_agg(x ORDER BY x.seq),'[]'::json) FROM (SELECT seq,type,user_id FROM seat_events WHERE meal_id='{meal}'::uuid) x),
 'conversations',(SELECT coalesce(json_agg(x ORDER BY x.id),'[]'::json) FROM (SELECT id,kind,version,head,dissolved_at,dissolved_seq FROM conversations WHERE meal_id='{meal}'::uuid) x),
 'groupMemberships',(SELECT coalesce(json_agg(x ORDER BY x.user_id,x.join_seq),'[]'::json) FROM (SELECT m.user_id,m.join_seq,m.leave_seq FROM membership_intervals m JOIN conversations c ON c.id=m.conversation_id WHERE c.meal_id='{meal}'::uuid) x),
 'messageRefs',(SELECT coalesce(json_agg(x ORDER BY x.seq),'[]'::json) FROM (SELECT msg.id,msg.seq,msg.sender_id FROM messages msg JOIN conversations c ON c.id=msg.conversation_id WHERE c.meal_id='{meal}'::uuid) x),
 'notifications',(SELECT coalesce(json_agg(x ORDER BY x.id),'[]'::json) FROM (SELECT id,event_id,recipient_id,channel,template FROM notifications WHERE refs->>'mealId'='{meal}') x),
 'emailOutbox',(SELECT coalesce(json_agg(x ORDER BY x.id),'[]'::json) FROM (SELECT id,event_id,recipient_id,channel,template,status,attempts FROM outbox WHERE payload->>'mealId'='{meal}') x),
 'messageCount',(SELECT count(*) FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.meal_id='{meal}'::uuid),
 'marks',(SELECT coalesce(json_agg(x ORDER BY x.kind),'[]'::json) FROM (SELECT kind,due_at FROM lifecycle_marks WHERE meal_id='{meal}'::uuid) x),
 'startRoster',(SELECT coalesce(json_agg(x ORDER BY x.user_id),'[]'::json) FROM (SELECT user_id,starts_at FROM start_roster WHERE meal_id='{meal}'::uuid) x),
 'attendanceRevisions',(SELECT coalesce(json_agg(x ORDER BY x.subject_id,x.version),'[]'::json) FROM (SELECT id,subject_id,source,value,version,actor_id FROM attendance_revisions WHERE meal_id='{meal}'::uuid) x),
 'experienceRevisions',(SELECT coalesce(json_agg(x ORDER BY x.user_id,x.revision),'[]'::json) FROM (SELECT id,user_id,score,revision FROM experience_revisions WHERE meal_id='{meal}'::uuid) x),
 'publicReviewRefs',(SELECT coalesce(json_agg(x ORDER BY x.author_id,x.subject_id,x.revision),'[]'::json) FROM (SELECT id,author_id,subject_id,revision FROM public_review_revisions WHERE meal_id='{meal}'::uuid) x),
 'pairConsentRefs',(SELECT coalesce(json_agg(x ORDER BY x.user_id,x.epoch),'[]'::json) FROM (SELECT id,pair_id,user_id,epoch,revision,revoked_at FROM pair_consents WHERE basis_meal_id='{meal}'::uuid) x),
 'pairMetadata',(SELECT coalesce(json_agg(x ORDER BY x.id),'[]'::json) FROM (SELECT id,low_user,high_user,consent_epoch,version FROM user_pairs WHERE id IN (SELECT pair_id FROM pair_consents WHERE basis_meal_id='{meal}'::uuid)) x),
 'directConversations',(SELECT coalesce(json_agg(x ORDER BY x.id),'[]'::json) FROM (SELECT id,pair_id,version,head FROM conversations WHERE kind='DIRECT' AND pair_id IN (SELECT pair_id FROM pair_consents WHERE basis_meal_id='{meal}'::uuid)) x),
 'directMessageRefs',(SELECT coalesce(json_agg(x ORDER BY x.seq),'[]'::json) FROM (SELECT msg.id,msg.seq,msg.sender_id FROM messages msg JOIN conversations c ON c.id=msg.conversation_id WHERE c.kind='DIRECT' AND c.pair_id IN (SELECT pair_id FROM pair_consents WHERE basis_meal_id='{meal}'::uuid)) x),
 'jobs',(SELECT coalesce(json_agg(x ORDER BY x.kind),'[]'::json) FROM (SELECT kind,state,due_at,attempts FROM jobs WHERE resource_id='{meal}'::uuid AND kind IN ('meal.close','meal.start','meal.end')) x));
COMMIT;"""
print(json.dumps(json.loads(query(names[0], sql)), indent=2))
