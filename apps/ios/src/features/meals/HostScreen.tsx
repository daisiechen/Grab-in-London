import { SessionScope } from '../auth/SessionScope.tsx';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError, type ResponseOf } from '@fancy/client';
import { HOST_CANCEL_REASONS } from '@fancy/contracts';
import { allPages } from '../../api/pages.ts';
import { useServices } from '../../services.tsx';
import { loadErrorMessage, useQuery } from '../../api/useQuery.ts';
import { Avatar } from '../../ui/Avatar.tsx';
import { Notice } from '../../ui/Bits.tsx';
import { Primary, TextAction } from '../../ui/Button.tsx';
import { ChoiceGroup } from '../../ui/ChoiceGroup.tsx';
import { FormMessage } from '../../ui/FormMessage.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { Sheet } from '../../ui/Sheet.tsx';
import { Body } from '../../ui/Text.tsx';
import { createStyles } from '../../ui/styles.ts';
import { colors } from '../../ui/tokens.ts';
import { longDate } from '../../lib/london.ts';
import { mealKey } from './MealDetailScreen.tsx';
import { bookingLabel, cardWhenLabel, closesLabel, venueName, type Application, type Meal } from './format.ts';
import { Reveal, RevealScope, useRevealScroll } from '../create/reveal.tsx';
import { startMealEdit } from '../create/CreateStepScreen.tsx';
import { editBlockedReason } from '../create/model.ts';
import { mealActionMessage } from './messages.ts';

type Detail = ResponseOf<'getMeal'>['data'];
type Person = Meal['members'][number];
type CancelReason = (typeof HOST_CANCEL_REASONS)[number];
type BookingStatus = 'REPORTED_CONFIRMED' | 'NEEDS_UPDATE' | 'FAILED' | 'CANCELLED';

const CANCEL_LABELS: Record<CancelReason, string> = { host: 'I can’t make it', booking: 'The restaurant booking fell through', other: 'Something else' };
const BOOKING_LABELS: ReadonlyArray<readonly [BookingStatus, string]> = [
  ['REPORTED_CONFIRMED', 'Booked'],
  ['NEEDS_UPDATE', 'Needs an update'],
  ['FAILED', 'Booking failed'],
  ['CANCELLED', 'Booking cancelled'],
];
const STATE_LABELS: Record<Application['state'], string> = { PENDING: 'Pending', CONFIRMED: 'Confirmed', DECLINED: 'Declined', WITHDRAWN: 'Withdrawn', EXPIRED: 'Expired', CANCELLED: 'Cancelled' };

/** One-line context under an applicant's name: work and hometown when shared, else the bio. */
const personLine = (p: Person) => [p.background?.work, p.background?.hometown ? `From ${p.background.hometown}` : null].filter(Boolean).join(' · ') || p.bio || '';

/**
 * “Your guest list” (demo page `host`): requests with atomic approve/decline (If-Match), the people
 * holding seats, the host's external booking self-report, the arrangement lock and cancellation.
 */
export function HostScreen() {
  return <SessionScope><HostScreenContent /></SessionScope>;
}

function HostScreenContent() {
  const { mealId } = useLocalSearchParams<{ mealId: string }>();
  const id = String(mealId);
  const { api, newId, cache, drafts, now } = useServices();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const detail = useQuery<Detail>(mealKey(id), async () => (await api.call('getMeal', { params: { mealId: id } })).data);
  const apps = useQuery<Application[]>(`applications:${id}`, () => allPages((cursor) => api.call('listApplications', { params: { mealId: id }, query: { limit: 100, ...(cursor ? { cursor } : {}) } })));
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'info' } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [reason, setReason] = useState<CancelReason | null>(null);
  const [booking, setBooking] = useState<BookingStatus | null>(null);
  const [count, setCount] = useState<number | null>(null);
  // “Update reservation” opens in place; its form scrolls above the pinned chat button.
  const { scrollProps, reveal } = useRevealScroll();
  const keys = useRef(new Map<string, string>());
  const keyFor = (intent: string) => {
    if (!keys.current.has(intent)) keys.current.set(intent, newId());
    return keys.current.get(intent)!;
  };

  const refresh = async () => {
    await Promise.all([detail.reload(), apps.reload()]);
  };

  const run = async (intent: string, op: () => Promise<unknown>, success: string) => {
    setBusy(intent);
    setMessage(null);
    try {
      await op();
      keys.current.delete(intent);
      setMessage({ text: success, tone: 'info' });
      return true;
    } catch (e) {
      // Business rejections (full, deadline, stale version) are final for this intent: refresh state instead of replaying.
      if (e instanceof ApiError && e.kind !== 'network' && !e.retryable) keys.current.delete(intent);
      setMessage({ text: e instanceof ApiError ? mealActionMessage(e) : 'Something went wrong. Please try again.', tone: 'error' });
      return false;
    } finally {
      setBusy(null);
      cache.invalidate('myMeals:');
      await refresh();
    }
  };

  if (!detail.data) {
    return (
      <View style={[styles.page, styles.state]} testID="host">
        {detail.error ? (
          <>
            <FormMessage message={loadErrorMessage(detail.error)} />
            <Primary secondary label="Try again" onPress={() => void detail.reload()} />
          </>
        ) : <ActivityIndicator accessibilityLabel="Loading your guest list" />}
      </View>
    );
  }
  const { meal, conversationId } = detail.data;
  const t = now();
  const cancelled = meal.status === 'CANCELLED';
  const recruiting = meal.status === 'OPEN' && Date.parse(meal.closesAt.instant) > t;
  const full = meal.confirmedCount >= meal.capacity;
  const pending = (apps.data ?? []).filter((a) => a.state === 'PENDING');
  // Confirmed guests already appear under “At the table”; only other outcomes are listed again.
  const earlier = (apps.data ?? []).filter((a) => a.state !== 'PENDING' && a.state !== 'CONFIRMED');
  const members = meal.members.length ? meal.members : [meal.host];
  const declaration = meal.bookingDeclaration;
  const openProfile = (userId: string) => router.push(`/profiles/${userId}`);
  // r07: editable only while OPEN, before the deadline and before the first approval.
  const editable = editBlockedReason(meal, t) === null;
  const editMeal = () => { startMealEdit(drafts, meal); router.push(`/meals/${id}/edit`); };

  const decide = (a: Application, decision: 'APPROVE' | 'DECLINE') =>
    run(`${decision}:${a.id}:${a.version}`, () => api.call('decideApplication', { params: { applicationId: a.id }, body: { decision }, idempotencyKey: keyFor(`${decision}:${a.id}:${a.version}`), ifMatch: a.version }), decision === 'APPROVE' ? `${a.applicant?.displayName ?? 'Guest'} has a seat.` : 'Request declined.');

  const bookingCount = count ?? Math.max(1, meal.confirmedCount);
  const saveBooking = () =>
    booking &&
    void run(`booking:${booking}:${bookingCount}:${meal.version}`, () => api.call('declareBooking', { params: { mealId: id }, body: { status: booking, count: bookingCount }, idempotencyKey: keyFor(`booking:${booking}:${bookingCount}:${meal.version}`), ifMatch: meal.version }), 'Reservation status updated.').then((ok) => {
      if (ok) { setBookingOpen(false); setBooking(null); setCount(null); }
    });

  return (
    <View style={styles.page} testID="host">
      <ScrollView {...scrollProps} testID="host-scroll" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.scroll}>
        <RevealScope value={reveal}>
          <Text accessibilityRole="header" style={styles.h1}>{meal.title}</Text>
          <Text style={styles.meta}>{`${cardWhenLabel(meal.startsAt)} · London time · ${venueName(meal)}`}</Text>
          <Seats meal={meal} />
          {cancelled ? <Notice icon>This meal is cancelled. Please cancel or adjust the restaurant reservation yourself. Your group chat stays open.</Notice> : null}
          <FormMessage message={message?.text ?? null} tone={message?.tone ?? 'error'} />

          <Text accessibilityRole="header" style={styles.h2}>{`Requests · ${pending.length}`}</Text>
          {apps.error ? (
            <View style={styles.inline}>
              <FormMessage message={loadErrorMessage(apps.error)} />
              <TextAction label="Try again" onPress={() => void apps.reload()} />
            </View>
          ) : null}
          {!apps.data && !apps.error ? <ActivityIndicator accessibilityLabel="Loading requests" /> : null}
          {apps.data && pending.length === 0 ? <Text style={styles.muted}>{recruiting ? 'No requests waiting. New requests appear here.' : 'No requests waiting.'}</Text> : null}
          {pending.map((a) => {
            const name = a.applicant?.displayName ?? 'Member';
            const approving = busy === `APPROVE:${a.id}:${a.version}`;
            const declining = busy === `DECLINE:${a.id}:${a.version}`;
            return (
              <Pressable
                key={a.id}
                style={styles.request}
                accessibilityLabel={`Request from ${name}`}
                disabled={!a.applicant}
                onPress={() => a.applicant && openProfile(a.applicant.id)}
              >
                <View style={styles.personRow}>
                  {a.applicant ? <Avatar person={a.applicant} size={44} onPress={() => openProfile(a.applicant!.id)} /> : null}
                  <View style={styles.flex}>
                    <Text style={styles.name}>{name}</Text>
                    {a.applicant ? <Text style={styles.small} numberOfLines={1}>{personLine(a.applicant)}</Text> : null}
                  </View>
                  <Icon name="ChevronRight" size={14} color={colors.muted} />
                </View>
                {a.message ? <Text style={styles.quote}>{`“${a.message}”`}</Text> : null}
                <View style={styles.twoActions}>
                  <CardButton label="Decline" accessibilityLabel={`Decline ${name}`} busy={declining} disabled={busy !== null || !recruiting} onPress={() => void decide(a, 'DECLINE')} />
                  <CardButton primary label="Approve" accessibilityLabel={`Approve ${name}`} busy={approving} disabled={busy !== null || !recruiting || full} onPress={() => void decide(a, 'APPROVE')} />
                </View>
              </Pressable>
            );
          })}
          {pending.length ? <Text style={styles.small}>{full ? 'Your table is full, so new approvals aren’t possible.' : 'Pending requests don’t take a seat. Approving confirms a seat straight away.'}</Text> : null}
          {!recruiting && !cancelled && pending.length ? <Text style={styles.small}>Applications have closed, so requests can’t be decided any more.</Text> : null}

          <Text accessibilityRole="header" style={styles.h2}>At the table</Text>
          {members.map((p) => (
            <Pressable key={p.id} style={styles.memberRow} accessibilityRole="button" accessibilityLabel={p.id === meal.host.id ? `You, the host, ${p.displayName}` : `View ${p.displayName}’s profile`} onPress={() => openProfile(p.id)}>
              <Avatar person={p} size={34} />
              <Text style={[styles.name, styles.flex]} numberOfLines={1}>{p.displayName}</Text>
              {p.id === meal.host.id ? <Text style={styles.badge}>Host</Text> : null}
            </Pressable>
          ))}
          {earlier.length ? (
            <View style={styles.earlier}>
              <Text style={styles.small}>Earlier requests</Text>
              {earlier.map((a) => <Text key={a.id} style={styles.muted}>{`${a.applicant?.displayName ?? 'Member'} · ${STATE_LABELS[a.state]}`}</Text>)}
            </View>
          ) : null}

          <Text accessibilityRole="header" style={styles.h2}>Restaurant reservation</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusTag, declaration?.status === 'REPORTED_CONFIRMED' && !declaration.stale && styles.statusGood]}><Text style={styles.statusText}>{bookingLabel(meal)}</Text></View>
            {declaration ? <Text style={styles.small}>{`For ${declaration.declaredCount} ${declaration.declaredCount === 1 ? 'person' : 'people'} · reported ${longDate(declaration.reportedAt.slice(0, 10))}`}</Text> : null}
          </View>
          {declaration?.stale && !cancelled ? (
            <Text style={styles.small}>{`${meal.confirmedCount} ${meal.confirmedCount === 1 ? 'person is' : 'people are'} confirmed now. Check with the restaurant and update your reservation.`}</Text>
          ) : null}
          <Text style={styles.small}>You book with the restaurant yourself; guests see this as reported by you. Everyone pays their own share at the restaurant.</Text>
          {meal.allowedActions.includes('DECLARE_BOOKING') ? (
            <>
              <Pressable accessibilityRole="button" accessibilityLabel="Update reservation" accessibilityState={{ expanded: bookingOpen }} onPress={() => setBookingOpen(!bookingOpen)} style={[styles.expander, bookingOpen && styles.expanderOpen]}>
                <Icon name="Pencil1" size={14} color={colors.forest} />
                <Text style={styles.expanderText}>Update reservation</Text>
                <Icon name={bookingOpen ? 'ChevronUp' : 'ChevronDown'} size={11} color={colors.ink} />
              </Pressable>
              {bookingOpen ? (
                <Reveal style={styles.panel} testID="reservation-form">
                  <ChoiceGroup<BookingStatus> label="Reservation status" options={BOOKING_LABELS} value={booking} onChange={setBooking} />
                  <ChoiceGroup<string> label="People booked, including you" options={Array.from({ length: meal.capacity }, (_, i) => [String(i + 1), String(i + 1)] as const)} value={String(bookingCount)} onChange={(v) => setCount(Number(v))} />
                  <Primary label="Save reservation status" busy={busy?.startsWith('booking:') ?? false} disabled={!booking || busy !== null} onPress={saveBooking} />
                </Reveal>
              ) : null}
            </>
          ) : null}

          <Text accessibilityRole="header" style={styles.h2}>Meal arrangements</Text>
          <Text style={styles.small}>
            {meal.arrangementLocked
              ? 'The restaurant, time, budget and group size are locked after the first approval. To change them, cancel and create a new meal.'
              : 'Nobody is approved yet. Once you approve the first guest, the restaurant, time, budget and group size are locked.'}
          </Text>
          <Text style={styles.small}>{`Applications close ${closesLabel(meal.closesAt)} London time. Minimum ${meal.minimum} people, including you.`}</Text>
          {editable ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Edit meal" onPress={editMeal} style={styles.expander}>
              <Icon name="Pencil1" size={14} color={colors.forest} />
              <Text style={styles.expanderText}>Edit meal</Text>
              <Icon name="ChevronRight" size={11} color={colors.ink} />
            </Pressable>
          ) : null}
          {meal.allowedActions.includes('CANCEL') ? <View style={styles.cancel}><TextAction destructive label="Cancel meal for everyone" onPress={() => setCancelOpen(true)} /></View> : null}
        </RevealScope>
      </ScrollView>
      {conversationId ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Primary label="Open group chat" icon="ChatBubble" onPress={() => router.push(`/chat/${conversationId}`)} />
        </View>
      ) : null}

      <Sheet visible={cancelOpen} title="Cancel this meal?" onClose={() => setCancelOpen(false)}>
        <Body>{`Cancel ${meal.title} for everyone. Pending requests close and members are notified. Your group chat stays open. You must cancel the restaurant reservation yourself.`}</Body>
        <ChoiceGroup<CancelReason> label="Reason for cancelling" options={HOST_CANCEL_REASONS.map((r) => [r, CANCEL_LABELS[r]] as const)} value={reason} onChange={setReason} />
        <Primary secondary label="Keep the meal" onPress={() => setCancelOpen(false)} />
        <TextAction
          destructive
          label="Cancel meal for everyone"
          disabled={!reason || busy !== null}
          onPress={() =>
            reason &&
            void run(`cancel:${meal.version}`, () => api.call('cancelMeal', { params: { mealId: id }, body: { reason }, idempotencyKey: keyFor(`cancel:${meal.version}`), ifMatch: meal.version }), 'Meal cancelled.').then((ok) => ok && setCancelOpen(false))
          }
        />
      </Sheet>
    </View>
  );
}

/** Seats progress: confirmed of capacity, with the minimum shown as a tick on the bar. */
function Seats({ meal }: { meal: Meal }) {
  const pct = (n: number) => `${Math.min(100, (n / meal.capacity) * 100)}%` as const;
  return (
    <View style={styles.seats} accessibilityLabel={`${meal.confirmedCount} of ${meal.capacity} seats confirmed, minimum ${meal.minimum}`}>
      <View style={styles.seatsHead}>
        <Text style={styles.seatsStrong}>{`${meal.confirmedCount} of ${meal.capacity} confirmed`}</Text>
        <Text style={styles.small}>{`You’re hosting · minimum ${meal.minimum}`}</Text>
      </View>
      <View style={styles.bar}>
        <View style={[styles.barFill, { width: pct(meal.confirmedCount) }]} />
        <View style={[styles.barMin, { left: pct(meal.minimum) }]} />
      </View>
    </View>
  );
}

function CardButton({ label, accessibilityLabel, onPress, primary = false, busy = false, disabled = false }: { label: string; accessibilityLabel: string; onPress: () => void; primary?: boolean; busy?: boolean; disabled?: boolean }) {
  const inactive = disabled || busy;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled: inactive, busy }} disabled={inactive} onPress={onPress} style={[styles.cardButton, primary ? styles.cardPrimary : styles.cardSecondary, inactive && styles.inactive]}>
      {busy ? <ActivityIndicator color={primary ? colors.white : colors.forest} /> : null}
      <Text style={[styles.cardLabel, primary && styles.cardLabelPrimary]}>{label}</Text>
      {primary && !busy ? <Icon name="Check" size={14} color={colors.white} /> : null}
    </Pressable>
  );
}

const styles = createStyles({
  page: { flex: 1, backgroundColor: colors.white },
  state: { padding: 18, gap: 12 },
  scroll: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 20 },
  flex: { flex: 1, minWidth: 0 },
  inline: { gap: 2 },
  h1: { fontSize: 22, lineHeight: 26, letterSpacing: -0.6, fontWeight: '700', color: colors.ink },
  meta: { fontSize: 12, lineHeight: 17, color: colors.muted, marginTop: 3 },
  h2: { fontSize: 16, letterSpacing: -0.3, fontWeight: '700', color: colors.ink, marginTop: 18, marginBottom: 8 },
  muted: { fontSize: 13, lineHeight: 19, color: colors.muted },
  small: { fontSize: 11, lineHeight: 16, color: colors.muted },
  seats: { marginTop: 10, marginBottom: 4, gap: 6, padding: 12, borderRadius: 11, backgroundColor: '#f2f5ee' },
  seatsHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  seatsStrong: { fontSize: 14, fontWeight: '700', color: colors.ink },
  bar: { height: 6, borderRadius: 3, backgroundColor: '#dde5da', overflow: 'visible' },
  barFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 3, backgroundColor: colors.forest },
  barMin: { position: 'absolute', top: -3, width: 2, height: 12, marginLeft: -1, backgroundColor: colors.ink },
  request: { borderWidth: 1, borderColor: colors.line, borderRadius: 13, padding: 12, gap: 10, marginBottom: 10 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontSize: 14, fontWeight: '700', color: colors.ink },
  quote: { fontSize: 13, lineHeight: 19, color: '#55625a' },
  twoActions: { flexDirection: 'row', gap: 10 },
  cardButton: { flex: 1, height: 40, borderRadius: 11, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  cardPrimary: { backgroundColor: colors.forest, borderColor: colors.forest },
  cardSecondary: { backgroundColor: colors.white, borderColor: colors.secondaryBorder },
  inactive: { opacity: 0.5 },
  cardLabel: { fontSize: 13, fontWeight: '600', color: colors.forest },
  cardLabelPrimary: { color: colors.white },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  badge: { fontSize: 10, fontWeight: '700', color: colors.forest, backgroundColor: colors.selectedSurface, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
  earlier: { marginTop: 6, gap: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 },
  statusTag: { paddingVertical: 3, paddingHorizontal: 8, backgroundColor: '#f0f3ec', borderRadius: 7 },
  statusGood: { backgroundColor: '#e6f0e5' },
  statusText: { fontSize: 11, lineHeight: 15, color: '#536c5b', fontWeight: '700' },
  expander: { marginTop: 10, height: 40, borderWidth: 1, borderColor: colors.secondaryBorder, borderRadius: 11, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  expanderOpen: { borderColor: colors.forest, backgroundColor: colors.selectedSurface },
  expanderText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.forest },
  panel: { marginTop: 8, borderWidth: 1, borderColor: colors.line, borderRadius: 11, padding: 12, gap: 12 },
  cancel: { marginTop: 8, alignItems: 'flex-start' },
  footer: { paddingTop: 10, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.white },
});
