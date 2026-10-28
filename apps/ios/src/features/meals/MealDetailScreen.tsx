import {useAssistantContext} from '../assistant/hooks.ts';
import { useAnalyticsPresentation } from '../../analytics/hooks.ts';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ApiError, type ResponseOf } from '@fancy/client';
import { useServices, useSessionState } from '../../services.tsx';
import { loadErrorMessage, useQuery } from '../../api/useQuery.ts';
import { Primary, TextAction } from '../../ui/Button.tsx';
import { FormMessage } from '../../ui/FormMessage.tsx';
import { Screen } from '../../ui/Screen.tsx';
import { Sheet } from '../../ui/Sheet.tsx';
import { Body } from '../../ui/Text.tsx';
import { colors } from '../../ui/tokens.ts';
import { useAuthGate } from '../auth/useAuthGate.ts';
import {
  applicationLabel, bookingLabel, cardBudgetLabel, closesLabel, cuisineLabel, dietaryLabel, languagesLabel, mealPeople, moodLabel, seatsLabel, venueName,
} from './format.ts';
import { areaName } from '../discover/areas.ts';
import { longDate } from '../../lib/london.ts';
import { Avatar } from '../../ui/Avatar.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { Notice, Pill, Tag } from '../../ui/Bits.tsx';
import { createStyles } from '../../ui/styles.ts';
import {RestaurantPhoto} from '../../ui/RestaurantPhoto.tsx';
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

  const people = mealPeople(meal);
  const open = meal.status === 'OPEN' && Date.parse(meal.closesAt.instant) > requestNow && Date.parse(meal.startsAt.instant) > requestNow;
  const full = meal.confirmedCount >= meal.capacity;
  const confirmed = myApplication?.state === 'CONFIRMED';
  const openPerson = (userId: string) => router.push(`/profiles/${userId}`);
  const booking = bookingLabel(meal);
  const isHost = can('REVIEW_APPLICATIONS') || can('CANCEL') || can('DECLARE_BOOKING');

  const statusAction = () => {
    if (meal.status === 'CANCELLED') return <Notice>This meal was cancelled. Existing members can still chat in Inbox.</Notice>;
    if (isHost) return <Primary label="Manage applications" icon="ArrowRight" onPress={() => router.push(`/meals/${meal.id}/host`)} />;
    if (confirmed && can('OPEN_GROUP') && conversationId) return <Primary label="Open group chat" icon="ArrowRight" onPress={() => router.push(`/chat/${conversationId}`)} />;
    if (myApplication?.state === 'PENDING') return <Primary secondary label="View application" icon="ArrowRight" onPress={() => router.push(`/meals/${meal.id}/status`)} />;
    if (myApplication && (myApplication.state === 'DECLINED' || myApplication.state === 'EXPIRED') && !can('APPLY')) return <Primary secondary label="Find another table" onPress={() => router.navigate('/')} />;
    if (can('APPLY') || guestCanRequest) return <Primary label="Apply to join" icon="ArrowRight" onPress={() => gate(`/meals/${meal.id}/apply`) && router.push(`/meals/${meal.id}/apply`)} />;
    if (!open && !confirmed) return <Notice>Applications have closed.</Notice>;
    if (full && !confirmed) return <Primary label="This table is full" icon="ArrowRight" disabled onPress={() => undefined} />;
    return null;
  };

  return (
    <View style={styles.page} testID="meal-detail">
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <RestaurantPhoto venueRef={meal.venue.venueRef} placeId={meal.venue.placeId} name={venueName(meal)} fill>{({ image }) => image}</RestaurantPhoto>
        </View>
        <View style={styles.body}>
          <Text style={styles.eyebrow}>{`${areaName(meal.areaCode).toUpperCase()} · ${meal.capacity === 2 ? 'A TABLE FOR TWO' : 'A SMALL TABLE'}`}</Text>
          <Text accessibilityRole="header" style={styles.h1}>{meal.title}</Text>
          <View style={styles.facts}>
            <View style={styles.fact}>
              <Icon name="Calendar" color={colors.forest} />
              <Text style={styles.factStrong}>{longDate(meal.startsAt.localDate)}</Text>
              <Text style={styles.factSpan}>{`${meal.startsAt.localTime} · London time`}</Text>
            </View>
            <View style={styles.fact}>
              <Icon name="Person" color={colors.forest} />
              <Text style={styles.factStrong}>{seatsLabel(meal)}</Text>
              <Text style={styles.factSpan}>Including the host</Text>
            </View>
          </View>
          {myApplication && !isHost ? <Text style={styles.progress}>{applicationLabel(myApplication)}</Text> : null}
          <View style={styles.hostLine}>
            <Pressable style={styles.hostPress} accessibilityRole="button" accessibilityLabel={`Your host, ${meal.host.displayName}`} onPress={() => openPerson(meal.host.id)}>
              <Avatar person={meal.host} size={44} />
              <View style={styles.hostName}>
                <Text style={styles.small}>Your host</Text>
                <Text style={styles.hostText}>{meal.host.displayName}</Text>
              </View>
            </Pressable>
            <Pill>{languagesLabel(meal.languages)}</Pill>
          </View>

          <Text accessibilityRole="header" style={styles.h2}>A little about this meal</Text>
          <Text style={styles.prose}>{meal.description}</Text>
          <Text style={styles.muted}>{`Cuisine: ${cuisineLabel(meal)} · Dietary options: ${dietaryLabel(meal)}. Host-reported · not an allergy guarantee.`}</Text>
          <View style={styles.tags}>
            <Tag>{moodLabel(meal)}</Tag>
            <Tag>Friendship first</Tag>
          </View>

          <Text accessibilityRole="header" style={styles.h2}>Who’s coming</Text>
          <View style={styles.people}>
            {people.map((p) => (
              <Pressable key={p.id} style={styles.person} accessibilityRole="button" accessibilityLabel={`View ${p.displayName}’s profile`} onPress={() => openPerson(p.id)}>
                <Avatar person={p} size={49} />
                <Text style={styles.personName}>{p.displayName}</Text>
              </Pressable>
            ))}
            {!full ? (
              <View style={styles.person}>
                <View style={styles.openSeat}><Icon name="Person" size={20} color="#8b978c" /></View>
                <Text style={styles.personName}>{isHost || confirmed ? 'Open seat' : 'Your seat?'}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.muted}>{`${meal.minimum}–${meal.capacity} people including the host · Applications close ${closesLabel(meal.closesAt)}`}</Text>

          <Text accessibilityRole="header" style={styles.h2}>The restaurant</Text>
          <View style={styles.venue}>
            <Icon name="SewingPin" color={colors.forest} />
            <View style={styles.flex}>
              <Text style={styles.venueName}>{venueName(meal)}</Text>
              <Text style={styles.venueAddress}>{meal.venue.available && meal.venue.address ? meal.venue.address : `${areaName(meal.areaCode)}, London`}</Text>
              <View style={[styles.statusTag, booking === 'Restaurant booked' && styles.statusGood]}><Text style={styles.statusText}>{booking}</Text></View>
            </View>
          </View>
          {mapsUrl ? (
            <Pressable accessibilityRole="link" style={styles.mapsLink} onPress={() => void Linking.openURL(mapsUrl)}>
              <Text style={styles.mapsText}>{`Open ${venueName(meal)} in Google Maps`}</Text>
              <Icon name="ExternalLink" size={14} color={colors.forest} />
            </Pressable>
          ) : null}
          <Text style={styles.mapNote}>Reservation reported by the host; not verified by the app.</Text>
          {meal.venue.attributions.map((a, i) => <Text key={i} style={styles.mapNote}>{a.text}</Text>)}

          <Text accessibilityRole="header" style={styles.h2}>Keeping costs clear</Text>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Expected spend per person</Text>
            <Text style={styles.priceValue}>{cardBudgetLabel(meal)}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Pay at the restaurant</Text>
            <Text style={styles.priceValue}>Split the bill</Text>
          </View>
          <Text style={styles.muted}>No payment is due in the app. Everyone pays their own share at the restaurant.</Text>
          <Notice icon>No in-app payment to refund. Let the host know if your plans change.</Notice>

          <FormMessage message={message} />
          <View style={styles.actions}>
            {statusAction()}
            {isHost && conversationId ? <Primary secondary label="Open group chat" onPress={() => router.push(`/chat/${conversationId}`)} /> : null}
            {can('POST_MEAL') ? <Primary secondary label="After the meal" onPress={() => router.push(`/post-meal/${meal.id}`)} /> : null}
            {can('WITHDRAW') && myApplication ? <TextAction destructive label="Withdraw request" onPress={() => setConfirm('withdraw')} /> : null}
            {can('LEAVE') ? <TextAction destructive label="Cancel my place" onPress={() => setConfirm('leave')} /> : null}
            <TextAction label="Report this meal" onPress={() => router.push(`/report?targetType=MEAL&targetId=${meal.id}`)} />
          </View>
        </View>
      </ScrollView>
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
    </View>
  );
}

const styles = createStyles({
  page: { flex: 1, backgroundColor: colors.white },
  scroll: { paddingBottom: 30 },
  flex: { flex: 1 },
  hero: { width: '100%', height: 185, overflow: 'hidden' },
  body: { paddingTop: 25, paddingHorizontal: 21 },
  eyebrow: { fontSize: 9, letterSpacing: 1.3, color: '#647a6b', fontWeight: '700', marginBottom: 10 },
  h1: { fontSize: 29, lineHeight: 32, letterSpacing: -1.05, fontWeight: '700', color: colors.ink, marginBottom: 15 },
  facts: { flexDirection: 'row', gap: 13, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.line, marginBottom: 17 },
  fact: { flex: 1, gap: 4 },
  factStrong: { fontSize: 13, fontWeight: '700', color: colors.ink, marginTop: 4 },
  factSpan: { fontSize: 11, color: colors.muted },
  progress: { fontSize: 13, fontWeight: '700', color: colors.forest },
  hostLine: { flexDirection: 'row', alignItems: 'center', gap: 11, marginVertical: 19 },
  hostPress: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11, minWidth: 0 },
  hostName: { flex: 1, minWidth: 0 },
  small: { fontSize: 11, color: colors.muted, marginBottom: 2 },
  hostText: { fontSize: 14, fontWeight: '600', color: colors.ink },
  h2: { fontSize: 17, letterSpacing: -0.3, fontWeight: '700', color: colors.ink, marginTop: 27, marginBottom: 13 },
  prose: { color: '#65716a', fontSize: 14, lineHeight: 22, marginBottom: 20 },
  muted: { fontSize: 12, color: colors.muted, lineHeight: 18, marginBottom: 12 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  people: { flexDirection: 'row', gap: 19, marginBottom: 8 },
  person: { alignItems: 'center', gap: 6 },
  personName: { fontSize: 11, color: colors.ink },
  openSeat: { width: 49, height: 49, borderRadius: 25, backgroundColor: '#f3f5ef', alignItems: 'center', justifyContent: 'center' },
  venue: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  venueName: { fontSize: 14, fontWeight: '700', color: colors.ink },
  venueAddress: { fontSize: 12, color: colors.muted, marginTop: 3, marginBottom: 9 },
  statusTag: { alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 8, backgroundColor: '#f0f3ec', borderRadius: 7 },
  statusGood: { backgroundColor: '#e6f0e5' },
  statusText: { fontSize: 10, lineHeight: 14, color: '#536c5b' },
  mapsLink: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 15, alignSelf: 'flex-start' },
  mapsText: { color: colors.forest, fontSize: 12, lineHeight: 18, textDecorationLine: 'underline' },
  mapNote: { marginTop: 7, fontSize: 10, color: colors.muted },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginVertical: 12 },
  priceLabel: { fontSize: 12, color: colors.ink },
  priceValue: { fontSize: 14, fontWeight: '700', color: colors.ink },
  actions: { gap: 10, marginTop: 8 },
});
