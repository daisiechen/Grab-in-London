import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ApiError, type ResponseOf } from '@fancy/client';
import { useServices } from '../../services.tsx';
import { loadErrorMessage, useQuery } from '../../api/useQuery.ts';
import { ActionPage, pageText } from '../../ui/ActionPage.tsx';
import { Notice } from '../../ui/Bits.tsx';
import { Primary, TextAction } from '../../ui/Button.tsx';
import { FormMessage } from '../../ui/FormMessage.tsx';
import { Icon, type IconName } from '../../ui/Icon.tsx';
import { Sheet } from '../../ui/Sheet.tsx';
import { Body } from '../../ui/Text.tsx';
import { createStyles } from '../../ui/styles.ts';
import { colors } from '../../ui/tokens.ts';
import { mealKey } from './MealDetailScreen.tsx';
import { applicationLabel, bookingLabel, cardBudgetLabel, cardWhenLabel, venueName, type Application, type Meal } from './format.ts';
import { mealActionMessage } from './messages.ts';

type Detail = ResponseOf<'getMeal'>['data'];
type State = Application['state'];
type Step = { label: string; tone: 'done' | 'current' | 'todo' | 'stopped'; icon: IconName };

/** Sent → Host reviewing → outcome. The last step names the outcome once there is one. */
export function applicationSteps(state: State): [Step, Step, Step] {
  const sent: Step = { label: 'Sent', tone: 'done', icon: 'Check' };
  if (state === 'PENDING') return [sent, { label: 'Host reviewing', tone: 'current', icon: 'Person' }, { label: 'Seat confirmed', tone: 'todo', icon: 'LockClosed' }];
  const reviewed: Step = { label: 'Host reviewing', tone: 'done', icon: 'Check' };
  switch (state) {
    case 'CONFIRMED':
      return [sent, reviewed, { label: 'Seat confirmed', tone: 'done', icon: 'Check' }];
    case 'DECLINED':
      return [sent, reviewed, { label: 'Declined', tone: 'stopped', icon: 'Cross2' }];
    case 'EXPIRED':
      return [sent, { label: 'Host reviewing', tone: 'todo', icon: 'Person' }, { label: 'Expired', tone: 'stopped', icon: 'Clock' }];
    case 'WITHDRAWN':
      return [sent, { label: 'Host reviewing', tone: 'todo', icon: 'Person' }, { label: 'Withdrawn', tone: 'stopped', icon: 'Cross2' }];
    default:
      return [sent, reviewed, { label: 'Cancelled', tone: 'stopped', icon: 'Cross2' }];
  }
}

const COPY: Record<State, { title: string; next: (host: string) => string }> = {
  PENDING: { title: 'Your hello is on its way.', next: (host) => `${host} will review your introduction with your profile. We’ll let you know when there’s an update. If there’s a seat for you, the group chat for this table opens.` },
  CONFIRMED: { title: 'You’re at the table.', next: () => 'Your seat is confirmed and the group chat is open. Say hello, and check the time and place before you go.' },
  DECLINED: { title: 'Another table awaits.', next: (host) => `${host} couldn’t offer you a seat this time. It isn’t personal — tables are small. There are other meals to discover.` },
  EXPIRED: { title: 'Applications have closed.', next: () => 'This request closed before the host replied. You can discover another meal.' },
  WITHDRAWN: { title: 'Your request is withdrawn.', next: () => 'Your host no longer sees this request. You can apply again while applications are open.' },
  CANCELLED: { title: 'Your participation is cancelled.', next: () => 'Your seat was released. You can discover another meal.' },
};

export const STATUS_POLL_MS = 15_000;

/** “Your application” (demo status page): progress, what happens next, withdraw with confirmation. */
export function ApplicationStatusScreen() {
  const { mealId } = useLocalSearchParams<{ mealId: string }>();
  const id = String(mealId);
  const { api, newId } = useServices();
  const router = useRouter();
  const q = useQuery<Detail>(mealKey(id), async () => (await api.call('getMeal', { params: { mealId: id } })).data);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // One key per withdraw intent: reused when the confirmation is retried, renewed after success.
  const [withdrawKey, setWithdrawKey] = useState(() => newId());
  // While the host is reviewing, check back periodically so a decision shows up without leaving the page.
  const pending = q.data?.myApplication?.state === 'PENDING';
  const { reload } = q;
  useEffect(() => {
    if (!pending) return undefined;
    const timer = setInterval(() => void reload(), STATUS_POLL_MS);
    return () => clearInterval(timer);
  }, [pending, reload]);

  if (!q.data) {
    return (
      <ActionPage testID="application-status">
        {q.error ? (
          <View style={styles.state}>
            <FormMessage message={loadErrorMessage(q.error)} />
            <Primary secondary label="Try again" onPress={() => void q.reload()} />
          </View>
        ) : <ActivityIndicator accessibilityLabel="Loading application" />}
      </ActionPage>
    );
  }
  const { meal, myApplication, conversationId } = q.data;
  const openMeal = () => (router.canGoBack() ? router.back() : router.replace(`/meals/${meal.id}`));

  if (!myApplication) {
    return (
      <ActionPage testID="application-status" footer={<Primary secondary label="View the table" onPress={openMeal} />}>
        <Text accessibilityRole="header" style={pageText.h1}>No application yet.</Text>
        <Text style={pageText.prose}>You haven’t asked to join this table. Open the meal to send a request.</Text>
        <SummaryCard meal={meal} status="Open table" onPress={openMeal} />
      </ActionPage>
    );
  }

  const app = myApplication;
  const can = (a: Meal['allowedActions'][number]) => meal.allowedActions.includes(a);
  const steps = applicationSteps(app.state);
  const copy = COPY[app.state];

  const withdraw = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await api.call('withdrawApplication', { params: { applicationId: app.id }, idempotencyKey: withdrawKey, ifMatch: app.version });
      setWithdrawKey(newId());
    } catch (e) {
      setMessage(e instanceof ApiError ? mealActionMessage(e) : 'Something went wrong. Please try again.');
    } finally {
      setConfirm(false);
      setBusy(false);
      await q.reload();
    }
  };

  const primary = () => {
    if (app.state === 'CONFIRMED' && conversationId) return <Primary label="Open group chat" icon="ArrowRight" onPress={() => router.push(`/chat/${conversationId}`)} />;
    if (app.state === 'PENDING') return <Primary secondary label="Track in Inbox" icon="ChatBubble" onPress={() => router.navigate('/inbox')} />;
    if (can('APPLY')) return <Primary label="Apply again" icon="ArrowRight" onPress={() => router.replace(`/meals/${meal.id}/apply`)} />;
    if (app.state === 'CONFIRMED') return <Primary secondary label="View the table" onPress={openMeal} />;
    return <Primary label="Find another table" icon="ArrowRight" onPress={() => router.navigate('/')} />;
  };

  return (
    <ActionPage
      testID="application-status"
      overlay={(
        <Sheet visible={confirm} title="Withdraw your request?" onClose={() => setConfirm(false)}>
          <Body>Your host won’t see this request any more. You can apply again while applications are open.</Body>
          <Primary secondary label="Keep my request" onPress={() => setConfirm(false)} />
          <TextAction destructive label="Withdraw request" disabled={busy} onPress={() => void withdraw()} />
        </Sheet>
      )}
      footer={(
        <>
          {primary()}
          {app.state === 'PENDING' && can('WITHDRAW') ? <TextAction destructive label="Withdraw request" onPress={() => setConfirm(true)} /> : null}
        </>
      )}
    >
      <Text accessibilityRole="header" style={pageText.h1}>{copy.title}</Text>
      <View style={styles.track} accessible accessibilityLabel={`Application progress: ${steps.map((s) => `${s.label}${s.tone === 'done' ? ', done' : s.tone === 'current' ? ', in progress' : ''}`).join('; ')}`}>
        {[1, 2].map((i) => <View key={`bar${i}`} style={[styles.bar, { left: `${(i * 2 - 1) * (100 / 6)}%` as `${number}%` }, steps[i]!.tone === 'done' || steps[i]!.tone === 'current' ? styles.barDone : null]} />)}
        {steps.map((s) => (
          <View key={s.label} style={styles.step}>
            <View style={[styles.dot, styles[s.tone]]}><Icon name={s.icon} size={12} color={s.tone === 'todo' ? colors.muted : s.tone === 'stopped' ? colors.danger : colors.white} /></View>
            <Text style={[styles.stepLabel, s.tone !== 'todo' && styles.stepLabelOn, s.tone === 'stopped' && styles.stepLabelStopped]} numberOfLines={1}>{s.label}</Text>
          </View>
        ))}
      </View>

      <SummaryCard meal={meal} status={applicationLabel(app)} good={app.state === 'CONFIRMED'} onPress={openMeal} />

      <Text accessibilityRole="header" style={pageText.h2}>What happens next</Text>
      <Text style={pageText.prose}>{copy.next(meal.host.displayName)}</Text>
      {app.message ? (
        <>
          <Text accessibilityRole="header" style={pageText.h2}>Your introduction</Text>
          <Text style={styles.quote}>{`“${app.message}”`}</Text>
        </>
      ) : null}
      {app.state === 'PENDING' || app.state === 'CONFIRMED' ? <Notice icon>No payment is due in the app. Everyone pays their own share at the restaurant.</Notice> : null}
      <FormMessage message={message} />

    </ActionPage>
  );
}

/** Whole-card link back to the meal: title, time, venue, budget and the host’s booking declaration. */
function SummaryCard({ meal, status, good = false, onPress }: { meal: Meal; status: string; good?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`View ${meal.title}`} onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle} numberOfLines={2}>{meal.title}</Text>
        <Icon name="ChevronRight" size={16} color={colors.muted} />
      </View>
      <Text style={styles.cardLine} numberOfLines={1}>{`${cardWhenLabel(meal.startsAt)} · ${venueName(meal)}`}</Text>
      <Text style={styles.cardLine} numberOfLines={1}>{`Expected ${cardBudgetLabel(meal)} per person`}</Text>
      <View style={styles.tags}>
        <View style={[styles.tag, good && styles.tagGood]}><Text style={styles.tagText}>{status}</Text></View>
        <View style={[styles.tag, bookingLabel(meal) === 'Restaurant booked' && styles.tagGood]}><Text style={styles.tagText}>{bookingLabel(meal)}</Text></View>
      </View>
    </Pressable>
  );
}

const styles = createStyles({
  state: { gap: 12 },
  track: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 10, marginBottom: 4 },
  step: { flex: 1, alignItems: 'center', gap: 5 },
  bar: { position: 'absolute', top: 11, width: '33.33%', height: 2, backgroundColor: colors.line },
  barDone: { backgroundColor: colors.forest },
  dot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  done: { backgroundColor: colors.forest, borderColor: colors.forest },
  current: { backgroundColor: '#5f8a6b', borderColor: '#5f8a6b' },
  todo: { backgroundColor: colors.white, borderColor: colors.line },
  stopped: { backgroundColor: '#fbeeec', borderColor: '#e9c5c0' },
  stepLabel: { fontSize: 11, color: colors.muted },
  stepLabelOn: { color: colors.forest, fontWeight: '700' },
  stepLabelStopped: { color: colors.danger },
  card: { marginTop: 14, padding: 14, backgroundColor: '#f6f7f3', borderWidth: 1, borderColor: colors.line, borderRadius: 12, gap: 4 },
  pressed: { opacity: 0.85 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.ink },
  cardLine: { fontSize: 12, lineHeight: 17, color: colors.muted },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  tag: { paddingVertical: 3, paddingHorizontal: 8, backgroundColor: '#eceee7', borderRadius: 7 },
  tagGood: { backgroundColor: '#e6f0e5' },
  tagText: { fontSize: 10, lineHeight: 14, color: '#536c5b' },
  quote: { fontSize: 13, lineHeight: 20, color: colors.ink, fontStyle: 'italic' },
});
