import os,stat,json,time,re,subprocess
from pathlib import Path
root=Path('/private/tmp/fancy-ai034-transport-sm0pd116');fifo=root/'commands.fifo';log=root/'finite-events.jsonl';owner='bbf009d0-a909-4898-8339-9f21af4967e6'
assert stat.S_IMODE(root.stat().st_mode)==0o700 and stat.S_ISFIFO(fifo.lstat().st_mode) and stat.S_IMODE(fifo.stat().st_mode)==0o600
cmd=subprocess.check_output(['ps','-p','34705','-o','command='],text=True);assert 'standing.mjs' in cmd and '--run-owned' in cmd
limit=time.time()+50;ready=None
while time.time()<limit:
 s=Path('/private/tmp/fancy-native91.log').read_text();m=re.search(r'QA034_READY91=([^\r\n]+)',s)
 if m:ready=Path(m.group(1));break
 time.sleep(.3)
assert ready,'READY_NOT_YET: no mutation performed'
expected='/Users/daisie.chen/Library/Developer/CoreSimulator/Devices/D92E76C4-9333-4FC7-8B53-E681DA73C055/data/Containers/Data/Application/'
assert str(ready).startswith(expected) and ready.name=='qa034-91-ready.json' and ready.parent.name=='tmp';assert json.loads(ready.read_text())=={'run':91,'ready':True}
def rows():return [json.loads(x) for x in log.read_text().splitlines()]
def send(d):
 b=(json.dumps(d)+'\n').encode();assert len(b)<1024
 fd=os.open(fifo,os.O_WRONLY|os.O_NONBLOCK)
 try:os.write(fd,b)
 finally:os.close(fd)
def next_event(n):
 limit=time.time()+12
 while time.time()<limit:
  r=rows()
  if len(r)>n:return r[-1]
  time.sleep(.1)
 raise AssertionError('NO_EVENT; client gate not released')
n=len(rows());send({'command':'inspect'});before=next_event(n);assert before['event']=='inspect' and before['owner']==owner and before['pending']==0 and before['inflight']==0
counts={x['table']:int(x['count']) for x in before['tables']};assert counts['ai_requests']>=1 and counts['ai_session_meta']>=1
n=len(rows());send({'command':'crash-and-restart','owner':owner,'checkpoint':before['checkpoint'],'completedCheckpoint':True});after=next_event(n);assert after['event']=='restarted' and after['oldPid']==before['childPid'] and after['newPid']!=before['childPid'];assert all(after[k] is True for k in ['sameDatabase','businessUnchanged','authUnchanged','clockUnchanged'])
Path('/private/tmp/fancy-qa034-native91-restart-proof.json').write_text(json.dumps({'before':before,'restart':after},indent=2)+'\n');go=ready.with_name('qa034-91-continue.json');go.write_text('{"restartVerified":true}\n');print(json.dumps({'readyRun':91,'restart':after,'sameUITestGateReleased':True}))
