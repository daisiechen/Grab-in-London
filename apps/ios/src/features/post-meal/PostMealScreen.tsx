import { SessionScope } from '../auth/SessionScope.tsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ApiError, type ResponseOf } from '@fancy/client';
import { useServices, useSessionState } from '../../services.tsx';
import { loadErrorMessage, useQuery } from '../../api/useQuery.ts';
import { Primary, TextAction } from '../../ui/Button.tsx';
import { ChoiceGroup } from '../../ui/ChoiceGroup.tsx';
import { FormMessage } from '../../ui/FormMessage.tsx';
import { Screen } from '../../ui/Screen.tsx';
import {Sheet} from '../../ui/Sheet.tsx';
import { Body, Heading, SectionTitle } from '../../ui/Text.tsx';
import { FeedbackBlock } from './FeedbackBlock.tsx';

type State = ResponseOf<'postMealState'>['data'];
type Attendance = State['attendance'][number];

/**
 * Version to send for a record that may not exist yet. CONTRACT GAP: the PUT operations require
 * If-Match but PostMealState has no version for a not-yet-created experience/review row; "0" is
 * assumed to mean “create”.
 */
export const NEW_RECORD_VERSION = '0';

/** UNKNOWN (nobody reported) is distinct from absent; SELF beats HOST and the screen says so. */
export function attendanceText(a: Attendance): string {
  if (a.value === 'unknown') return 'Not reported yet';
  const who = a.source === 'SELF' ? 'they reported' : a.source === 'HOST' ? 'host reported' : 'support corrected';
  return `${a.value === 'present' ? 'Came' : 'Didn’t come'} · ${who}`;
}

export function PostMealScreen() {
  return <SessionScope><PostMealScreenContent /></SessionScope>;
}

function PostMealScreenContent() {
  const { mealId } = useLocalSearchParams<{ mealId: string }>();
  const id = String(mealId);
  const { api, newId,cache,session:manager } = useServices();
  const session = useSessionState();
  const router = useRouter();
  const q = useQuery<State>(session.status==='signedIn'?`postMeal:${id}`:null, async () => {const generation=manager.generation;const result=await api.call('postMealState', { params: { mealId: id } });manager.assertGeneration(generation);return result.data;});
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'info' } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [score, setScore] = useState<string | null>(null);
  const scope=useMemo(()=>({active:true}),[id,manager.generation]);
  const scopeRef=useRef(scope);scopeRef.current=scope;
  useEffect(()=>{scope.active=true;return()=>{scope.active=false;};},[scope]);
  const [host,setHost]=useState<{mealId:string;id:string}|null>(null);
  const [hostChoices,setHostChoices]=useState<Record<string,'present'|'absent'>>({});
  const [pendingHost,setPendingHost]=useState<{subjectId:string;value:'present'|'absent';version:string}|null>(null);
  const [hostError,setHostError]=useState<string|null>(null);
  const [hostBlocked,setHostBlocked]=useState(false);
  const [hostReloading,setHostReloading]=useState(false);
  const readingHost=useRef(false),writingHost=useRef(false);
  useEffect(()=>{let active=true;setHost(null);setPendingHost(null);setHostChoices({});setHostBlocked(false);
    if(session.status!=='signedIn')return()=>{active=false;};
    void api.call('getMeal',{params:{mealId:id}}).then(res=>{if(active&&scope.active&&scopeRef.current===scope)setHost({mealId:res.data.meal.id,id:res.data.meal.host.id});}).catch(()=>{if(active&&scope.active&&scopeRef.current===scope)setHost(null);});
    return()=>{active=false;};
  },[api,id,scope,session.status]);
  const keys = useRef(new Map<string, string>());
  const key = (intent: string) => {
    if (!keys.current.has(intent)) keys.current.set(intent, newId());
    return keys.current.get(intent)!;
  };

  if (!q.data) return <Screen>{q.error ? <FormMessage message={loadErrorMessage(q.error)} /> : <Body muted>Loading…</Body>}</Screen>;
  const s = q.data;
  const meId = session.status === 'signedIn' ? session.session.user.id : null;
  const nameOf = (subjectId: string) => (subjectId === meId ? 'You' : s.eligibleMembers.find((m) => m.id === subjectId)?.displayName ?? 'Member');
  const myAttendance = s.attendance.find((a) => a.subjectId === meId);
  const attended = myAttendance?.value === 'present';
  const isHost=host?.mealId===id&&host.id===meId;
  const current=()=>scope.active&&scopeRef.current===scope;

  const run = async (intent: string, op: (k: string) => Promise<unknown>, success: string) => {
    setBusy(intent);
    setMessage(null);
    try {
      await op(key(intent));
      keys.current.delete(intent);
      setMessage({ text: success, tone: 'info' });
      await q.reload();
    } catch (e) {
      if (e instanceof ApiError && !e.retryable) keys.current.delete(intent);
      setMessage({
        text: e instanceof ApiError && e.kind === 'conflict' ? 'This changed a moment ago or the feedback window has closed. We’ve refreshed it.' : e instanceof ApiError && e.kind === 'forbidden' ? 'This action isn’t available to you right now.' : e instanceof ApiError && e.kind === 'network' ? 'We couldn’t confirm this with Fancy. Check your connection and try again.' : 'Something went wrong. Please try again.',
        tone: 'error',
      });
      if (e instanceof ApiError && e.kind === 'conflict') await q.reload();
    } finally {
      setBusy(null);
    }
  };


  const reloadHostAttendance=async(success='Attendance changed. Review the refreshed facts and confirm again.')=>{
    if(readingHost.current)return;readingHost.current=true;setHostReloading(true);
    const generation=manager.generation;
    try{const fresh=(await api.call('postMealState',{params:{mealId:id}})).data;
      if(!current()||manager.generation!==generation)return;
      if(fresh.mealId!==id)throw new Error('MEAL_CHANGED');
      cache.set(`postMeal:${id}`,fresh);setHostBlocked(false);setMessage({text:success,tone:'info'});
    }catch{if(current()&&manager.generation===generation){setHostBlocked(true);setMessage({text:'We couldn’t refresh attendance. Reload attendance before confirming another report.',tone:'error'});}}
    finally{readingHost.current=false;if(current()&&manager.generation===generation)setHostReloading(false);}
  };
  const reportGuest=async()=>{
    if(!pendingHost||!isHost||!s.windowOpen||hostBlocked||writingHost.current||busy!==null||pendingHost.subjectId===meId||!s.eligibleMembers.some(m=>m.id===pendingHost.subjectId))return;
    const pending=pendingHost,generation=manager.generation;const intent=`host-att:${pending.subjectId}:${pending.value}:${pending.version}`;
    writingHost.current=true;setBusy(intent);setHostError(null);
    try{const updated=(await api.call('reportAttendance',{params:{mealId:id,subjectId:pending.subjectId},body:{value:pending.value},ifMatch:pending.version,idempotencyKey:key(intent)})).data;
      if(!current()||manager.generation!==generation)return;
      keys.current.delete(intent);cache.set(`postMeal:${id}`,{...s,attendance:s.attendance.map(a=>a.subjectId===updated.subjectId?updated:a)});setPendingHost(null);
      await reloadHostAttendance('Host report saved. Each member’s own report takes priority.');
    }catch(error){if(!current()||manager.generation!==generation)return;
      if(error instanceof ApiError&&error.kind==='conflict'){keys.current.delete(intent);setPendingHost(null);setHostBlocked(true);await reloadHostAttendance();}
      else{if(error instanceof ApiError&&!error.retryable)keys.current.delete(intent);setHostError('We couldn’t save this host report. Your selection is kept.');}
    }finally{writingHost.current=false;if(current()&&manager.generation===generation)setBusy(null);}
  };

  return (
    <Screen testID="post-meal">
      <Heading>After the meal</Heading>
      {!s.windowOpen ? <FormMessage message="The feedback window for this meal has closed." tone="info" /> : null}
      <FormMessage message={message?.text ?? null} tone={message?.tone ?? 'error'} />

      <SectionTitle>Who came</SectionTitle>
      <Body muted>Your own answer about yourself takes priority over the host’s.</Body>
      {s.attendance.map((a) => (
        <View key={a.subjectId} style={{ gap: 4 }}>
          <Body>{`${nameOf(a.subjectId)} · ${attendanceText(a)}`}</Body>
          {s.windowOpen && a.subjectId === meId ? (
            (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Primary secondary label="I came" disabled={busy !== null} onPress={() => void run(`att:${a.subjectId}:present:${a.version}`, (k) => api.call('reportAttendance', { params: { mealId: id, subjectId: a.subjectId }, body: { value: 'present' }, idempotencyKey: k, ifMatch: a.version }), 'Thanks — attendance saved.')} />
                <Primary secondary label="I couldn’t make it" disabled={busy !== null} onPress={() => void run(`att:${a.subjectId}:absent:${a.version}`, (k) => api.call('reportAttendance', { params: { mealId: id, subjectId: a.subjectId }, body: { value: 'absent' }, idempotencyKey: k, ifMatch: a.version }), 'Thanks — attendance saved.')} />
              </View>
            )
          ) : null}
        </View>
      ))}

      {s.eligibleMembers.filter(member=>member.id!==meId).map(member=>(
        <TextAction key={`profile:${member.id}`} label={`View ${member.displayName}’s profile`} onPress={()=>{if(current())router.push(`/profiles/${member.id}`);}} />
      ))}

      {isHost&&s.windowOpen?<View style={{gap:8}}>
        <SectionTitle>Report your table’s attendance</SectionTitle>
        <Body muted>Report facts, not ratings. Each member’s own report takes priority over your host report. Unreported attendance stays unknown.</Body>
        {hostBlocked?<TextAction label="Reload attendance" disabled={hostReloading||busy!==null} onPress={()=>void reloadHostAttendance()}/>:null}
        {s.eligibleMembers.filter(m=>m.id!==meId).map(member=>{const a=s.attendance.find(row=>row.subjectId===member.id);if(!a)return null;return <View key={member.id} style={{gap:6}}>
          <Body>{`${member.displayName} · Your host report: ${a.hostValue==='present'?'came':a.hostValue==='absent'?'didn’t come':'not reported'}`}</Body>
          <ChoiceGroup<'present'|'absent'> label={`Host report for ${member.displayName}`} value={hostChoices[member.id]??null} options={[["present",`${member.displayName} came`],["absent",`${member.displayName} didn’t come`]]} onChange={value=>setHostChoices(previous=>({...previous,[member.id]:value}))}/>
          <Primary secondary label={`Review attendance for ${member.displayName}`} disabled={!hostChoices[member.id]||busy!==null||hostBlocked||hostReloading} onPress={()=>{const value=hostChoices[member.id];if(value){setHostError(null);setPendingHost({subjectId:member.id,value,version:a.version});}}}/>
        </View>;})}
      </View>:null}
      <Sheet visible={pendingHost!==null} title={`Report attendance for ${pendingHost?nameOf(pendingHost.subjectId):'member'}?`} onClose={()=>setPendingHost(null)}>
        <Body>{pendingHost?`${nameOf(pendingHost.subjectId)} ${pendingHost.value==='present'?'came':'didn’t come'}.`:'Review this fact.'}</Body>
        <Body>This saves your host report only. The member’s own report takes priority. This is separate from ratings.</Body>
        <FormMessage message={hostError}/>
        <Primary secondary label="Keep editing" onPress={()=>setPendingHost(null)}/>
        <Primary label="Confirm attendance report" disabled={busy!==null||hostBlocked||!s.windowOpen} onPress={()=>void reportGuest()}/>
      </Sheet>

      {attended && s.windowOpen ? (
        <>
          <SectionTitle>How was the meal? (private)</SectionTitle>
          <ChoiceGroup<string> label="Your meal experience" options={['1', '2', '3', '4', '5'].map((n) => [n, n] as const)} value={score ?? (s.experience ? String(s.experience.score) : null)} onChange={setScore} />
          <Primary
            secondary
            label="Save experience"
            disabled={!score || busy !== null}
            onPress={() => score && void run(`exp:${score}:${s.experience?.version ?? NEW_RECORD_VERSION}`, (k) => api.call('rateExperience', { params: { mealId: id }, body: { score: Number(score) }, idempotencyKey: k, ifMatch: s.experience?.version ?? NEW_RECORD_VERSION }), 'Saved privately.')}
          />

        </>
      ) : s.windowOpen ? (
        <Body muted>Ratings, references and meet-again choices open once your attendance is recorded as present.</Body>
      ) : null}

      {meId && ((attended && s.windowOpen) || s.reconnect.some((r) => r.connection === 'OPEN')) ? (
        <>
          <SectionTitle>Feedback for your tablemates</SectionTitle>
          <Body muted>References appear on profiles once both of you have written one, or after 7 days. Meeting again stays private unless you both choose it.</Body>
          {s.eligibleMembers.filter((m) => m.id !== meId).map((m) => {
            const existing = s.reviews.find((r) => r.subjectId === m.id);
            const rc = s.reconnect.find((r) => r.subjectId === m.id);
            if (!(attended && s.windowOpen) && rc?.connection !== 'OPEN') return null;
            return (
              <FeedbackBlock key={m.id} api={api} name={m.displayName} canWriteFeedback={attended} reload={q.reload}
                scope={{ accountId: meId, mealId: id, subjectId: m.id }}
                snapshot={{ windowOpen: s.windowOpen, review: existing ? { body: existing.body, version: existing.version } : null,
                  reconnect: { selected: rc?.selected ?? false, version: rc?.version ?? NEW_RECORD_VERSION, connection: rc?.connection ?? 'CLOSED' } }} />
            );
          })}
        </>
      ) : null}

      <SectionTitle>Help shape Fancy</SectionTitle>
      <TextAction label="Product survey" onPress={() => router.push('/survey')} />
    </Screen>
  );
}
