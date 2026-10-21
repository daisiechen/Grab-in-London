import { SessionScope } from '../auth/SessionScope.tsx';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ApiError, type ResponseOf } from '@fancy/client';
import { useServices, useSessionState } from '../../services.tsx';
import { loadErrorMessage, useQuery } from '../../api/useQuery.ts';
import { Primary, TextAction } from '../../ui/Button.tsx';
import { ChoiceGroup } from '../../ui/ChoiceGroup.tsx';
import { Field } from '../../ui/Field.tsx';
import { FormMessage } from '../../ui/FormMessage.tsx';
import { Screen } from '../../ui/Screen.tsx';
import { Body, Heading, SectionTitle } from '../../ui/Text.tsx';

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
  const { api, newId } = useServices();
  const session = useSessionState();
  const router = useRouter();
  const q = useQuery<State>(`postMeal:${id}`, async () => (await api.call('postMealState', { params: { mealId: id } })).data);
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'info' } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [score, setScore] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Record<string, string>>({});
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
        text: e instanceof ApiError && e.kind === 'conflict' ? 'This changed a moment ago or the feedback window has closed. We’ve refreshed it.' : e instanceof ApiError && e.kind === 'network' ? 'We couldn’t confirm this with Fancy. Check your connection and try again.' : 'Something went wrong. Please try again.',
        tone: 'error',
      });
      if (e instanceof ApiError && e.kind === 'conflict') await q.reload();
    } finally {
      setBusy(null);
    }
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

          <SectionTitle>Public references</SectionTitle>
          <Body muted>References appear on profiles once both of you have written one, or after 7 days.</Body>
          {s.eligibleMembers.filter((m) => m.id !== meId).map((m) => {
            const existing = s.reviews.find((r) => r.subjectId === m.id);
            const body = reviews[m.id] ?? '';
            return (
              <View key={m.id} style={{ gap: 6 }}>
                <Field label={`Reference for ${m.displayName}`} value={body} onChangeText={(v) => setReviews({ ...reviews, [m.id]: v })} maxLength={500} multiline hint={existing ? `Status: ${existing.visibility.toLowerCase()}` : 'Up to 500 characters.'} />
                <Primary
                  secondary
                  label={`Save reference for ${m.displayName}`}
                  disabled={!body.trim() || busy !== null}
                  onPress={() => void run(`rev:${m.id}:${existing?.version ?? NEW_RECORD_VERSION}:${body.trim()}`, (k) => api.call('reviewPerson', { params: { mealId: id, subjectId: m.id }, body: { body: body.trim() }, idempotencyKey: k, ifMatch: existing?.version ?? NEW_RECORD_VERSION }), 'Reference saved.')}
                />
              </View>
            );
          })}

          <SectionTitle>Meet again? (private)</SectionTitle>
          <Body muted>Only a mutual choice opens a private conversation. The other person never sees a one-sided choice.</Body>
          {s.reconnect.map((r) => (
            <View key={r.subjectId} style={{ gap: 4 }}>
              <Body>{`${nameOf(r.subjectId)} · ${r.connection === 'OPEN' ? 'Connected' : r.selected ? 'You chose to meet again' : 'Not chosen'}`}</Body>
              <TextAction
                label={r.selected ? `Undo choice for ${nameOf(r.subjectId)}` : `I’d meet ${nameOf(r.subjectId)} again`}
                disabled={busy !== null}
                onPress={() => void run(`rc:${r.subjectId}:${!r.selected}:${r.version}`, (k) => api.call('selectReconnect', { params: { mealId: id, subjectId: r.subjectId }, body: { selected: !r.selected }, idempotencyKey: k, ifMatch: r.version }), 'Choice saved privately.')}
              />
            </View>
          ))}
        </>
      ) : s.windowOpen ? (
        <Body muted>Ratings, references and meet-again choices open once your attendance is recorded as present.</Body>
      ) : null}

      <SectionTitle>Help shape Fancy</SectionTitle>
      <TextAction label="Product survey" onPress={() => router.push('/survey')} />
    </Screen>
  );
}
