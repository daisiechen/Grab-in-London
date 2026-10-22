import {useAssistantContext} from '../assistant/hooks.ts';
import { useAnalyticsPresentation } from '../../analytics/hooks.ts';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ApiError, type ResponseOf } from '@fancy/client';
import { useServices, useSessionState } from '../../services.tsx';
import { loadErrorMessage, useQuery } from '../../api/useQuery.ts';
import { Primary, TextAction } from '../../ui/Button.tsx';
import { FormMessage } from '../../ui/FormMessage.tsx';
import { Screen } from '../../ui/Screen.tsx';
import { Sheet } from '../../ui/Sheet.tsx';
import { Body, Eyebrow, Heading, SectionTitle } from '../../ui/Text.tsx';
import { colors } from '../../ui/tokens.ts';
import { useAuthGate } from '../auth/useAuthGate.ts';
import {
  applicationLabel, areaLabel, bookingLabel, budgetLabel, cuisineLabel, dietaryLabel, languagesLabel, moodLabel, seatsLabel, venueName, whenLabel,
} from './format.ts';
import { mealActionMessage } from './messages.ts';

type Detail = ResponseOf<'getMeal'>['data'];
type Confirm = '' | 'withdraw' | 'leave';

export const mealKey = (id: string) => `meal:${id}`;

/** Public detail; signed-in members also see their own progress. allowedActions are display hints only. */
export function MealDetailScreen() {
  const { mealId } = useLocalSearchParams<{ mealId: string }>();
  const id = String(mealId);
  useAssistantContext({sourcePage:'MEAL',explicitMealId:id});
  const { api, newId, now } = useServices();
  const sessionState = useSessionState();
  const router = useRouter();
  const gate = useAuthGate();
  const q = useQuery<Detail>(mealKey(id), async () => (await api.call('getMeal', { params: { mealId: id } })).data);
  const [confirm, setConfirm] = useState<Confirm>('');
  const [busy, setBusy] = useState(false);
  useAnalyticsPresentation('detail_view',{mealId:id},!!q.data);
  const [message, setMessage] = useState<string | null>(null);
  // One key per user intent: reused when the same confirmation is retried, renewed after success.
  const [intentKey, setIntentKey] = useState(() => ({ withdraw: newId(), leave: newId() }));

  if (!q.data) {
    return (
      <Screen>
        {q.error ? (
          <>
            <FormMessage message={loadErrorMessage(q.error)} />
            <Primary secondary label="Try again" onPress={() => void q.reload()} />
          </>
        ) : (
          <ActivityIndicator accessibilityLabel="Loading meal" />
        )}
      </Screen>
    );
  }
  const { meal, myApplication, conversationId } = q.data;
  const requestNow = now();
  const guestCanRequest = sessionState.status === 'signedOut' && meal.status === 'OPEN'
    && Date.parse(meal.startsAt.instant) > requestNow && Date.parse(meal.closesAt.instant) > requestNow
    && meal.confirmedCount < meal.capacity;
  const can = (a: (typeof meal.allowedActions)[number]) => meal.allowedActions.includes(a);

  const act = async (kind: Exclude<Confirm, ''>) => {
    setBusy(true);
    setMessage(null);
    try {
      if (kind === 'withdraw' && myApplication) {
        await api.call('withdrawApplication', { params: { applicationId: myApplication.id }, idempotencyKey: intentKey.withdraw, ifMatch: myApplication.version });
      } else if (kind === 'leave') {
        await api.call('leaveMeal', { params: { mealId: meal.id }, idempotencyKey: intentKey.leave, ifMatch: meal.version });
      }
      setConfirm('');
      setIntentKey((k) => ({ ...k, [kind]: newId() }));
    } catch (e) {
      setMessage(e instanceof ApiError ? mealActionMessage(e) : 'Something went wrong. Please try again.');
      setConfirm('');
    } finally {
      setBusy(false);
      await q.reload();
    }
  };

  const mapsUrl = meal.venue.location ? `https://www.google.com/maps/search/?api=1&query=${meal.venue.location.lat},${meal.venue.location.lng}&query_place_id=${encodeURIComponent(meal.venue.placeId)}` : null;

  return (
    <Screen testID="meal-detail">
      <Eyebrow>{`${areaLabel(meal.areaCode).toUpperCase()} · ${meal.capacity === 2 ? 'A TABLE FOR TWO' : 'A SMALL TABLE'}`}</Eyebrow>
      <Heading>{meal.title}</Heading>
      <Body>{whenLabel(meal.startsAt)}</Body>
      <Body>{seatsLabel(meal)}</Body>
      {meal.status === 'CANCELLED' ? <FormMessage message="This meal was cancelled. Existing members can still chat in Inbox." tone="info" /> : null}
      {myApplication ? <Body>{applicationLabel(myApplication)}</Body> : null}

      <Pressable accessibilityRole="button" accessibilityLabel={`Your host, ${meal.host.displayName}`} onPress={() => router.push(`/profiles/${meal.host.id}`)}>
        <Text style={{ color: colors.muted, fontSize: 11 }}>Your host</Text>
        <Text style={{ color: colors.forest, fontWeight: '700' }}>{meal.host.displayName}</Text>
      </Pressable>

      <SectionTitle>A little about this meal</SectionTitle>
      <Body>{meal.description}</Body>
      <Body muted>{`${meal.minimum}–${meal.capacity} people including the host · Applications close ${whenLabel(meal.closesAt)}`}</Body>
      <Body>{`${moodLabel(meal)} · ${languagesLabel(meal.languages)}`}</Body>
      <Body>{`Cuisine: ${cuisineLabel(meal)} · Dietary: ${dietaryLabel(meal)}`}</Body>
      <Body muted>Cuisine and dietary details are declared by the host.</Body>

      <SectionTitle>The restaurant</SectionTitle>
      <Body>{venueName(meal)}</Body>
      {meal.venue.available && meal.venue.address ? <Body muted>{meal.venue.address}</Body> : null}
      {meal.venue.attributions.map((a, i) => <Body key={i} muted>{a.text}</Body>)}
      <Body>{bookingLabel(meal)}</Body>
      <Body muted>Reservation reported by the host; not verified by the app.</Body>
      {mapsUrl ? <TextAction label="Open in Google Maps" onPress={() => void Linking.openURL(mapsUrl)} /> : null}

      <SectionTitle>Keeping costs clear</SectionTitle>
      <Body>{`${budgetLabel(meal)} per person · Pay at the restaurant`}</Body>
      <Body muted>Fancy doesn’t take payments. Everyone pays the restaurant directly.</Body>

      <FormMessage message={message} />
      <View style={{ gap: 10 }}>
        {can('APPLY') || guestCanRequest ? <Primary label="Request to join" onPress={() => gate(`/meals/${meal.id}/apply`) && router.push(`/meals/${meal.id}/apply`)} /> : null}
        {can('REVIEW_APPLICATIONS') || can('CANCEL') || can('DECLARE_BOOKING') ? <Primary label="Manage your table" onPress={() => router.push(`/meals/${meal.id}/host`)} /> : null}
        {can('OPEN_GROUP') && conversationId ? <Primary secondary label="Open group chat" onPress={() => router.push(`/chat/${conversationId}`)} /> : null}
        {can('POST_MEAL') ? <Primary secondary label="After the meal" onPress={() => router.push(`/post-meal/${meal.id}`)} /> : null}
        {can('WITHDRAW') && myApplication ? <TextAction destructive label="Withdraw request" onPress={() => setConfirm('withdraw')} /> : null}
        {can('LEAVE') ? <TextAction destructive label="Cancel my place" onPress={() => setConfirm('leave')} /> : null}
        <TextAction label="Report this meal" onPress={() => router.push(`/report?targetType=MEAL&targetId=${meal.id}`)} />
      </View>

      <Sheet visible={confirm === 'withdraw'} title="Withdraw your request?" onClose={() => setConfirm('')}>
        <Body>Your host won’t see this request any more. You can apply again while applications are open.</Body>
        <Primary secondary label="Keep my request" onPress={() => setConfirm('')} />
        <TextAction destructive label="Withdraw request" disabled={busy} onPress={() => void act('withdraw')} />
      </Sheet>
      <Sheet visible={confirm === 'leave'} title="Cancel your place?" onClose={() => setConfirm('')}>
        <Body>Your seat is released for someone else. You stay in the group chat unless you leave it separately.</Body>
        <Primary secondary label="Keep my place" onPress={() => setConfirm('')} />
        <TextAction destructive label="Cancel my place" disabled={busy} onPress={() => void act('leave')} />
      </Sheet>
    </Screen>
  );
}
