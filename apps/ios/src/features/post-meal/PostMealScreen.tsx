import { SessionScope } from '../auth/SessionScope.tsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ApiError, type ResponseOf } from '@fancy/client';
import { useServices, useSessionState } from '../../services.tsx';
import { loadErrorMessage, useQuery } from '../../api/useQuery.ts';
import { Primary, TextAction } from '../../ui/Button.tsx';
import { ChoiceGroup } from '../../ui/ChoiceGroup.tsx';
import { Field } from '../../ui/Field.tsx';
import { FormMessage } from '../../ui/FormMessage.tsx';
import {Sheet} from '../../ui/Sheet.tsx';
import { Body } from '../../ui/Text.tsx';
import { AccountPage, SummaryBox, accountText } from '../../ui/AccountPage.tsx';
import { Avatar } from '../../ui/Avatar.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { colors, radius } from '../../ui/tokens.ts';
import { createStyles } from '../../ui/styles.ts';
import { longDate } from '../../lib/london.ts';

type State = ResponseOf<'postMealState'>['data'];
type Attendance = State['attendance'][number];

/**
 * Version to send for a record that may not exist yet. CONTRACT GAP: the PUT operations require
 * If-Match but PostMealState has no version for a not-yet-created experience/review row; "0" is
 * assumed to mean “create”.
 */
export const NEW_RECORD_VERSION = '0';

/** UNKNOWN (nobody reported) is distinct from absent; SELF beats HOST and the screen says so. */
export function attendanceText(a: Attendance, self = false): string {
  if (a.value === 'unknown') return 'Not reported yet';
  const who = a.source === 'SELF' ? (self ? 'you reported' : 'they reported') : a.source === 'HOST' ? 'host reported' : 'support corrected';
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
  const [reviews, setReviews] = useState<Record<string, string>>({});
  const scope=useMemo(()=>({active:true}),[id,manager.generation]);
  const scopeRef=useRef(scope);scopeRef.current=scope;
  useEffect(()=>{scope.active=true;return()=>{scope.active=false;};},[scope]);
  const [host,setHost]=useState<{mealId:string;id:string;title:string;localDate:string}|null>(null);
  const [mateId,setMateId]=useState<string|null>(null);
  const [revoking,setRevoking]=useState<{subjectId:string;version:string}|null>(null);
  const [hostChoices,setHostChoices]=useState<Record<string,'present'|'absent'>>({});
  const [pendingHost,setPendingHost]=useState<{subjectId:string;value:'present'|'absent';version:string}|null>(null);
  const [hostError,setHostError]=useState<string|null>(null);
  const [hostBlocked,setHostBlocked]=useState(false);
  const [hostReloading,setHostReloading]=useState(false);
  const readingHost=useRef(false),writingHost=useRef(false);
  useEffect(()=>{let active=true;setHost(null);setPendingHost(null);setHostChoices({});setHostBlocked(false);
    if(session.status!=='signedIn')return()=>{active=false;};
    void api.call('getMeal',{params:{mealId:id}}).then(res=>{if(active&&scope.active&&scopeRef.current===scope)setHost({mealId:res.data.meal.id,id:res.data.meal.host.id,title:res.data.meal.title,localDate:res.data.meal.startsAt.localDate});}).catch(()=>{if(active&&scope.active&&scopeRef.current===scope)setHost(null);});
    return()=>{active=false;};
  },[api,id,scope,session.status]);
  const keys = useRef(new Map<string, string>());
  const key = (intent: string) => {
    if (!keys.current.has(intent)) keys.current.set(intent, newId());
    return keys.current.get(intent)!;
  };

  if (!q.data) return <AccountPage>{q.error ? <View style={{ gap: 8 }}><FormMessage message={loadErrorMessage(q.error)} /><Primary secondary label="Try again" onPress={() => void q.reload()} /></View> : <Text style={accountText.muted}>Loading…</Text>}</AccountPage>;
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

  const others = s.eligibleMembers.filter((m) => m.id !== meId);
  const mate = others.find((m) => m.id === mateId) ?? others[0] ?? null;
  const selfReport = (value: 'present' | 'absent', a: Attendance) => void run(`att:${a.subjectId}:${value}:${a.version}`, (k) => api.call('reportAttendance', { params: { mealId: id, subjectId: a.subjectId }, body: { value }, idempotencyKey: k, ifMatch: a.version }), 'Thanks — attendance saved.');
  const openDirect = async (subjectId: string) => {
    setBusy(`direct:${subjectId}`);
    try {
      const conversation = (await api.call('getDirect', { params: { subjectId } })).data;
      if (current()) router.push(`/chat/${conversation.id}`);
    } catch {
      if (current()) setMessage({ text: 'This conversation isn’t available right now.', tone: 'error' });
    } finally {
      if (current()) setBusy(null);
    }
  };
  const revoke = async () => {
    if (!revoking) return;
    const target = revoking;
    await run(`revoke:${target.subjectId}:${target.version}`, (k) => api.call('revokeConnection', { params: { subjectId: target.subjectId }, idempotencyKey: k, ifMatch: target.version }), 'Connection withdrawn. Private messages are now read-only.');
    setRevoking(null);
  };

  return (
    <AccountPage testID="post-meal">
      <Text accessibilityRole="header" style={accountText.h1}>How was your table?</Text>
      <Text style={accountText.prose}>A little feedback helps the next person feel welcome.</Text>
      {host?.mealId === id ? <Text style={[accountText.muted, styles.mealLine]}>{`${host.title} · ${longDate(host.localDate)}`}</Text> : null}
      {!s.windowOpen ? <Note>The feedback window for this meal has closed.</Note> : null}
      <FormMessage message={message?.text ?? null} tone={message?.tone ?? 'error'} />

      <Text accessibilityRole="header" style={accountText.h2}>Your attendance</Text>
      <Text style={[accountText.muted, styles.below]}>Your own report takes priority. If you haven’t reported, we use your host’s report. No report means unknown.</Text>
      {s.windowOpen && myAttendance ? (
        <View accessibilityRole="radiogroup" accessibilityLabel="Your attendance" style={styles.chips}>
          <Chip label="I attended" selected={myAttendance.selfValue === 'present'} disabled={busy !== null} onPress={() => selfReport('present', myAttendance)} />
          <Chip label="I didn’t attend" selected={myAttendance.selfValue === 'absent'} disabled={busy !== null} onPress={() => selfReport('absent', myAttendance)} />
        </View>
      ) : null}
      <Text style={[accountText.muted, styles.closes]}>{`Reporting closes ${closesLabel(s.windowClosesAt)}`}</Text>

      <Text accessibilityRole="header" style={accountText.h2}>At the table</Text>
      {s.attendance.map((a) => {
        const member = s.eligibleMembers.find((m) => m.id === a.subjectId);
        const line = (
          <>
            <Avatar person={{ displayName: member?.displayName ?? nameOf(a.subjectId), avatarUrl: member?.avatarUrl ?? null }} size={34} />
            <Text style={styles.memberText}><Text style={styles.memberName}>{nameOf(a.subjectId)}</Text>{` · ${attendanceText(a, a.subjectId === meId)}`}</Text>
          </>
        );
        return member && a.subjectId !== meId ? (
          <Pressable key={a.subjectId} accessibilityRole="button" accessibilityLabel={`View ${member.displayName}’s profile`} onPress={() => { if (current()) router.push(`/profiles/${member.id}`); }} style={({ pressed }) => [styles.memberRow, pressed && styles.pressed]}>
            {line}
            <Icon name="ChevronRight" size={15} color={colors.muted} />
          </Pressable>
        ) : <View key={a.subjectId} style={styles.memberRow}>{line}</View>;
      })}
      {others.filter((m) => !s.attendance.some((a) => a.subjectId === m.id)).map((member) => (
        <Pressable key={member.id} accessibilityRole="button" accessibilityLabel={`View ${member.displayName}’s profile`} onPress={() => { if (current()) router.push(`/profiles/${member.id}`); }} style={({ pressed }) => [styles.memberRow, pressed && styles.pressed]}>
          <Avatar person={member} size={34} />
          <Text style={styles.memberText}><Text style={styles.memberName}>{member.displayName}</Text></Text>
          <Icon name="ChevronRight" size={15} color={colors.muted} />
        </Pressable>
      ))}

      {isHost&&s.windowOpen?<View>
        <Text accessibilityRole="header" style={accountText.h2}>Report your table’s attendance</Text>
        <Text style={[accountText.muted, styles.below]}>Report facts, not ratings. Each member’s own report takes priority over your host report. Unreported attendance stays unknown.</Text>
        {hostBlocked?<View style={styles.start}><TextAction label="Reload attendance" disabled={hostReloading||busy!==null} onPress={()=>void reloadHostAttendance()}/></View>:null}
        {others.map(member=>{const a=s.attendance.find(row=>row.subjectId===member.id);if(!a)return null;return <View key={member.id} style={styles.hostRow}>
          <Text style={styles.memberText}><Text style={styles.memberName}>{member.displayName}</Text>{` · Your host report: ${a.hostValue==='present'?'came':a.hostValue==='absent'?'didn’t come':'not reported'}`}</Text>
          <View style={styles.hostChoice}>
            <View style={styles.flex}><ChoiceGroup<'present'|'absent'> label={`Host report for ${member.displayName}`} value={hostChoices[member.id]??null} options={[["present",`${member.displayName} came`],["absent",`${member.displayName} didn’t come`]]} onChange={value=>setHostChoices(previous=>({...previous,[member.id]:value}))}/></View>
            <SmallButton label={`Review attendance for ${member.displayName}`} text="Review" disabled={!hostChoices[member.id]||busy!==null||hostBlocked||hostReloading} onPress={()=>{const value=hostChoices[member.id];if(value){setHostError(null);setPendingHost({subjectId:member.id,value,version:a.version});}}}/>
          </View>
        </View>;})}
      </View>:null}
      <Sheet visible={pendingHost!==null} title={`Report attendance for ${pendingHost?nameOf(pendingHost.subjectId):'member'}?`} onClose={()=>setPendingHost(null)}>
        <Body>{pendingHost?`${nameOf(pendingHost.subjectId)} ${pendingHost.value==='present'?'came':'didn’t come'}.`:'Review this fact.'}</Body>
        <Body>This saves your host report only. The member’s own report takes priority. This is separate from ratings.</Body>
        <FormMessage message={hostError}/>
        <Primary secondary label="Keep editing" onPress={()=>setPendingHost(null)}/>
        <Primary label="Confirm attendance report" disabled={busy!==null||hostBlocked||!s.windowOpen} onPress={()=>void reportGuest()}/>
      </Sheet>

      {s.windowOpen ? <>
        <Text accessibilityRole="header" style={accountText.h2}>Meal experience · private</Text>
        <Text style={[accountText.muted, styles.below]}>About the whole meal, separate from your thoughts about any one person. Only authorised staff can see it.</Text>
        {attended ? <View style={styles.experience}>
          <View style={styles.flex}><ChoiceGroup<string> label="How was the meal?" options={['1', '2', '3', '4', '5'].map((n) => [n, n] as const)} value={score ?? (s.experience ? String(s.experience.score) : null)} onChange={setScore} /></View>
          <SmallButton
            label={s.experience ? 'Update meal experience' : 'Save meal experience'}
            text={s.experience ? 'Update' : 'Save'}
            disabled={!score || busy !== null}
            onPress={() => score && void run(`exp:${score}:${s.experience?.version ?? NEW_RECORD_VERSION}`, (k) => api.call('rateExperience', { params: { mealId: id }, body: { score: Number(score) }, idempotencyKey: k, ifMatch: s.experience?.version ?? NEW_RECORD_VERSION }), 'Thank you. Your private meal experience is saved.')}
          />
        </View> : <Note>Confirm that you attended within the reporting window to share your meal experience.</Note>}
      </> : null}

      {attended && s.windowOpen && mate ? (() => {
        const existing = s.reviews.find((r) => r.subjectId === mate.id);
        const body = reviews[mate.id] ?? '';
        const r = s.reconnect.find((row) => row.subjectId === mate.id);
        return <>
          <Text accessibilityRole="header" style={accountText.h2}>{`Sharing a table with ${mate.displayName}`}</Text>
          {others.length > 1 ? <View style={styles.below}><ChoiceGroup<string> label="Choose a tablemate" value={mate.id} options={others.map((m) => [m.id, m.displayName] as const)} onChange={setMateId} /></View> : null}
          <Field
            label="A public reference · optional"
            accessibilityLabel={`Reference for ${mate.displayName}`}
            value={body}
            onChangeText={(v) => setReviews({ ...reviews, [mate.id]: v })}
            maxLength={500}
            multiline
            placeholder="What was it like sharing a table?"
            hint={existing ? referenceStatus(existing.visibility) : 'Describe the shared experience, rather than rating a person.'}
          />
          <View style={styles.saveRef}>
            <Primary
              secondary
              label={`Save reference for ${mate.displayName}`}
              disabled={!body.trim() || busy !== null}
              onPress={() => void run(`rev:${mate.id}:${existing?.version ?? NEW_RECORD_VERSION}:${body.trim()}`, (k) => api.call('reviewPerson', { params: { mealId: id, subjectId: mate.id }, body: { body: body.trim() }, idempotencyKey: k, ifMatch: existing?.version ?? NEW_RECORD_VERSION }), 'Reference saved.')}
            />
          </View>
          <Text style={[accountText.muted, styles.below]}>References appear after both people submit, or after 7 days. Private feedback is separate.</Text>
          {r ? <>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel={`I’d like to share a table again with ${mate.displayName}`}
              accessibilityState={{ checked: r.selected, disabled: busy !== null }}
              disabled={busy !== null}
              onPress={() => {
                if (r.selected && r.connection === 'OPEN') setRevoking({ subjectId: r.subjectId, version: r.version });
                else void run(`rc:${r.subjectId}:${!r.selected}:${r.version}`, (k) => api.call('selectReconnect', { params: { mealId: id, subjectId: r.subjectId }, body: { selected: !r.selected }, idempotencyKey: k, ifMatch: r.version }), 'Choice saved privately.');
              }}
              style={[styles.reconnect, r.selected && styles.reconnectOn]}
            >
              <View style={[styles.box, r.selected && styles.boxOn]}>{r.selected ? <Icon name="Check" size={13} color={colors.white} /> : null}</View>
              <View style={styles.flex}>
                <Text style={styles.reconnectTitle}>I’d like to share a table again</Text>
                <Text style={accountText.muted}>Private unless you both choose this.</Text>
              </View>
              <Icon name={r.selected ? 'HeartFilled' : 'Heart'} size={17} color={colors.forest} />
            </Pressable>
            {r.connection === 'OPEN' ? <>
              <SummaryBox testID="reconnect-mutual">
                <Text style={accountText.strong}>{`You and ${mate.displayName} both want to meet again.`}</Text>
                <Text style={accountText.muted}>A private conversation is open between you.</Text>
              </SummaryBox>
              <Primary label={`Say hello to ${mate.displayName}`} icon="ChatBubble" disabled={busy !== null} onPress={() => void openDirect(mate.id)} />
            </> : <Text style={[accountText.muted, styles.privacy]}>{r.selected ? `Your choice is private. ${mate.displayName} is never told unless they choose you too.` : 'Only a mutual choice opens a private conversation. A one-sided choice is never shown to anyone.'}</Text>}
          </> : null}
          <View style={styles.start}>
            <TextAction label="Share private feedback or report a concern" onPress={() => router.push(`/report?targetType=USER&targetId=${mate.id}`)} />
          </View>
        </>;
      })() : null}

      <View style={styles.start}><TextAction label="Help shape Fancy: product survey" onPress={() => router.push('/survey')} /></View>

      <Sheet visible={revoking !== null} title="Withdraw your connection?" onClose={() => setRevoking(null)}>
        <Body>Private messages will stop. Your earlier messages remain available. You will both need to choose again to reconnect.</Body>
        <Primary secondary label="Keep things as they are" onPress={() => setRevoking(null)} />
        <TextAction destructive label="Withdraw connection" disabled={busy !== null} onPress={() => void revoke()} />
      </Sheet>
    </AccountPage>
  );
}

const referenceStatus = (visibility: 'PENDING' | 'PUBLISHED' | 'WITHDRAWN') =>
  visibility === 'PUBLISHED' ? 'Your reference is published on their profile.' : visibility === 'PENDING' ? 'Your reference is waiting to be published.' : 'Your reference was withdrawn and isn’t shown.';

const CLOSES = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
const closesLabel = (instant: string) => CLOSES.format(new Date(instant));

/** Compact read-only note (the shared Notice carries 18pt margins that are too loose here). */
function Note({ children }: { children: string }) {
  return <View style={styles.note} accessibilityRole="text"><Icon name="InfoCircled" size={14} color="#607160" /><Text style={styles.noteText}>{children}</Text></View>;
}

function Chip({ label, selected, disabled, onPress }: { label: string; selected: boolean; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} style={[styles.chip, selected && styles.chipOn, disabled && styles.dim]}>
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{selected ? `✓ ${label}` : label}</Text>
    </Pressable>
  );
}

/** Compact outlined action that sits beside a chip row; the accessible name stays explicit. */
function SmallButton({ label, text, disabled, onPress }: { label: string; text: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.small, disabled && styles.dim]}>
      <Text style={styles.smallText}>{text}</Text>
    </Pressable>
  );
}

const styles = createStyles({
  flex: { flex: 1, minWidth: 0 },
  start: { alignItems: 'flex-start' },
  mealLine: { marginTop: 6 },
  below: { marginBottom: 10 },
  closes: { marginTop: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { minHeight: 34, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.selectedSurface, borderColor: colors.forest },
  chipText: { fontSize: 12, color: colors.ink },
  chipTextOn: { color: colors.forest, fontWeight: '700' },
  dim: { opacity: 0.5 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  pressed: { opacity: 0.6 },
  memberText: { flex: 1, fontSize: 13, lineHeight: 18, color: colors.muted },
  memberName: { fontWeight: '700', color: colors.ink },
  hostRow: { gap: 6, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line },
  hostChoice: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  experience: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  small: { minHeight: 32, paddingHorizontal: 12, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.secondaryBorder, justifyContent: 'center' },
  smallText: { fontSize: 12, fontWeight: '700', color: colors.forest },
  saveRef: { marginTop: 8, marginBottom: 8 },
  reconnect: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line },
  reconnectOn: { borderColor: colors.forest, backgroundColor: colors.selectedSurface },
  box: { width: 20, height: 20, borderRadius: 5, borderWidth: 1, borderColor: colors.forest, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.forest },
  reconnectTitle: { fontSize: 13, fontWeight: '700', color: colors.ink, marginBottom: 2 },
  privacy: { marginTop: 8 },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 11, borderRadius: 9, backgroundColor: '#f2f5ee', marginTop: 8 },
  noteText: { flex: 1, fontSize: 11, lineHeight: 16, color: '#607160' },
});
