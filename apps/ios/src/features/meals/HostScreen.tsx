import { SessionScope } from '../auth/SessionScope.tsx';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ApiError, type ResponseOf } from '@fancy/client';
import { HOST_CANCEL_REASONS } from '@fancy/contracts';
import { allPages } from '../../api/pages.ts';
import { useServices } from '../../services.tsx';
import { loadErrorMessage, useQuery } from '../../api/useQuery.ts';
import { Primary, TextAction } from '../../ui/Button.tsx';
import { ChoiceGroup } from '../../ui/ChoiceGroup.tsx';
import { FormMessage } from '../../ui/FormMessage.tsx';
import { Screen } from '../../ui/Screen.tsx';
import { Sheet } from '../../ui/Sheet.tsx';
import { Body, Heading, SectionTitle } from '../../ui/Text.tsx';
import { mealKey } from './MealDetailScreen.tsx';
import { bookingLabel, seatsLabel, whenLabel, type Application } from './format.ts';
import { mealActionMessage } from './messages.ts';

type Detail = ResponseOf<'getMeal'>['data'];
type CancelReason = (typeof HOST_CANCEL_REASONS)[number];
type BookingStatus = 'REPORTED_CONFIRMED' | 'NEEDS_UPDATE' | 'FAILED' | 'CANCELLED';

const CANCEL_LABELS: Record<CancelReason, string> = { host: 'I can’t make it', booking: 'The restaurant booking fell through', other: 'Something else' };
const BOOKING_LABELS: ReadonlyArray<readonly [BookingStatus, string]> = [
  ['REPORTED_CONFIRMED', 'Booked'],
  ['NEEDS_UPDATE', 'Needs an update'],
  ['FAILED', 'Booking failed'],
  ['CANCELLED', 'Booking cancelled'],
];

/** Host view: atomic approve/decline (If-Match), external booking self-report, whole-meal cancellation. */
export function HostScreen() {
  return <SessionScope><HostScreenContent /></SessionScope>;
}

function HostScreenContent() {
  const { mealId } = useLocalSearchParams<{ mealId: string }>();
  const id = String(mealId);
  const { api, newId, cache } = useServices();
  const router = useRouter();
  const detail = useQuery<Detail>(mealKey(id), async () => (await api.call('getMeal', { params: { mealId: id } })).data);
  const apps = useQuery<Application[]>(`applications:${id}`, () => allPages((cursor) => api.call('listApplications', { params: { mealId: id }, query: { limit: 100, ...(cursor ? { cursor } : {}) } })));
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'info' } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'' | 'cancel' | 'booking'>('');
  const [reason, setReason] = useState<CancelReason | null>(null);
  const [booking, setBooking] = useState<BookingStatus | null>(null);
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

  if (!detail.data) return <Screen>{detail.error ? <FormMessage message={loadErrorMessage(detail.error)} /> : <Body muted>Loading…</Body>}</Screen>;
  const { meal } = detail.data;
  const pending = (apps.data ?? []).filter((a) => a.state === 'PENDING');
  const decided = (apps.data ?? []).filter((a) => a.state !== 'PENDING');

  const decide = (a: Application, decision: 'APPROVE' | 'DECLINE') =>
    run(`${decision}:${a.id}:${a.version}`, () => api.call('decideApplication', { params: { applicationId: a.id }, body: { decision }, idempotencyKey: keyFor(`${decision}:${a.id}:${a.version}`), ifMatch: a.version }), decision === 'APPROVE' ? `${a.applicant?.displayName ?? 'Guest'} has a seat.` : 'Request declined.');

  return (
    <Screen testID="host">
      <Heading>{meal.title}</Heading>
      <Body>{`${whenLabel(meal.startsAt)} · ${seatsLabel(meal)}`}</Body>
      <FormMessage message={message?.text ?? null} tone={message?.tone ?? 'error'} />
      <SectionTitle>{`Requests · ${pending.length}`}</SectionTitle>
      {apps.error ? <FormMessage message={loadErrorMessage(apps.error)} /> : null}
      {pending.length === 0 && !apps.error ? <Body muted>No requests waiting.</Body> : null}
      {pending.map((a) => (
        <View key={a.id} style={{ gap: 6 }} accessibilityLabel={`Request from ${a.applicant?.displayName ?? 'a member'}`}>
          <Body>{a.applicant?.displayName ?? 'Member'}</Body>
          {a.message ? <Body muted>{a.message}</Body> : null}
          {a.applicant ? <TextAction label={`View ${a.applicant.displayName}’s profile`} onPress={() => router.push(`/profiles/${a.applicant!.id}`)} /> : null}
          <Primary label={`Approve ${a.applicant?.displayName ?? 'request'}`} busy={busy === `APPROVE:${a.id}:${a.version}`} disabled={busy !== null || meal.status !== 'OPEN'} onPress={() => void decide(a, 'APPROVE')} />
          <TextAction destructive label={`Decline ${a.applicant?.displayName ?? 'request'}`} disabled={busy !== null} onPress={() => void decide(a, 'DECLINE')} />
        </View>
      ))}
      {decided.length ? <SectionTitle>Earlier requests</SectionTitle> : null}
      {decided.map((a) => <Body key={a.id} muted>{`${a.applicant?.displayName ?? 'Member'} · ${a.state.toLowerCase()}`}</Body>)}

      <SectionTitle>Restaurant reservation</SectionTitle>
      <Body>{bookingLabel(meal)}</Body>
      <Body muted>You book with the restaurant yourself. Guests pay the restaurant directly.</Body>
      {meal.allowedActions.includes('DECLARE_BOOKING') ? <Primary secondary label="Update reservation" onPress={() => setSheet('booking')} /> : null}
      {meal.allowedActions.includes('CANCEL') ? <TextAction destructive label="Cancel meal for everyone" onPress={() => setSheet('cancel')} /> : null}

      <Sheet visible={sheet === 'booking'} title="Update reservation" onClose={() => setSheet('')}>
        <ChoiceGroup<BookingStatus> label="Reservation status" options={BOOKING_LABELS} value={booking} onChange={setBooking} />
        <Primary
          label="Save reservation status"
          disabled={!booking || busy !== null}
          onPress={() =>
            booking &&
            void run(`booking:${booking}:${meal.version}`, () => api.call('declareBooking', { params: { mealId: id }, body: { status: booking, count: meal.capacity }, idempotencyKey: keyFor(`booking:${booking}:${meal.version}`), ifMatch: meal.version }), 'Reservation status updated.').then((ok) => ok && setSheet(''))
          }
        />
      </Sheet>
      <Sheet visible={sheet === 'cancel'} title="Cancel this meal?" onClose={() => setSheet('')}>
        <Body>Everyone’s place is cancelled. The group chat stays open for existing members.</Body>
        <ChoiceGroup<CancelReason> label="Reason" options={HOST_CANCEL_REASONS.map((r) => [r, CANCEL_LABELS[r]] as const)} value={reason} onChange={setReason} />
        <Primary secondary label="Keep the meal" onPress={() => setSheet('')} />
        <TextAction
          destructive
          label="Cancel meal for everyone"
          disabled={!reason || busy !== null}
          onPress={() =>
            reason &&
            void run(`cancel:${meal.version}`, () => api.call('cancelMeal', { params: { mealId: id }, body: { reason }, idempotencyKey: keyFor(`cancel:${meal.version}`), ifMatch: meal.version }), 'Meal cancelled.').then((ok) => ok && setSheet(''))
          }
        />
      </Sheet>
    </Screen>
  );
}
