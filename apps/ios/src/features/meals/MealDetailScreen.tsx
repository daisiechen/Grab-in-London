import {useAssistantContext} from '../assistant/hooks.ts';
import { useAnalyticsPresentation } from '../../analytics/hooks.ts';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError, type ResponseOf } from '@fancy/client';
import { useServices, useSessionState } from '../../services.tsx';
import { loadErrorMessage, useQuery } from '../../api/useQuery.ts';
import { Primary, TextAction } from '../../ui/Button.tsx';
import { FormMessage } from '../../ui/FormMessage.tsx';
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
import { Icon, type IconName } from '../../ui/Icon.tsx';
import { Notice, Tag } from '../../ui/Bits.tsx';
import { FloatingBack, FLOATING_BACK_SIZE } from '../../ui/FloatingBack.tsx';
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
  const insets = useSafeAreaInsets();
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
      <View style={styles.page}>
        <FloatingBack />
        <View style={[styles.state, { paddingTop: insets.top + FLOATING_BACK_SIZE + 16 }]}>
          {q.error ? (
            <>
              <FormMessage message={loadErrorMessage(q.error)} />
              <Primary secondary label="Try again" onPress={() => void q.reload()} />
            </>
          ) : (
            <ActivityIndicator accessibilityLabel="Loading meal" />
          )}
        </View>
      </View>
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

  const action = statusAction();
  return (
    <View style={styles.page} testID="meal-detail">
      <FloatingBack />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 4 }]}>
        <Text style={styles.eyebrow}>{`${areaName(meal.areaCode).toUpperCase()} · ${meal.capacity === 2 ? 'A TABLE FOR TWO' : 'A SMALL TABLE'}`}</Text>
        <Text accessibilityRole="header" style={styles.h1}>{meal.title}</Text>
        {myApplication && !isHost ? <Text style={styles.progress}>{applicationLabel(myApplication)}</Text> : null}

        <View style={styles.facts}>
          <Fact icon="Calendar" strong={longDate(meal.startsAt.localDate)} small={`${meal.startsAt.localTime} · London time`} />
          <Fact icon="Person" strong={seatsLabel(meal)} small={`${meal.minimum}–${meal.capacity} people incl. host`} />
          <Fact glyph="£" strong={cardBudgetLabel(meal)} small="Per person · pay at the restaurant" />
          <Fact icon="Clock" strong={`Closes ${closesLabel(meal.closesAt)}`} small="Applications" />
        </View>

        <Text accessibilityRole="header" style={styles.h2}>Who’s coming</Text>
        <View style={styles.people}>
          {people.map((p) => (
            <Pressable key={p.id} style={styles.person} accessibilityRole="button" accessibilityLabel={p.id === meal.host.id ? `Your host, ${p.displayName}` : `View ${p.displayName}’s profile`} onPress={() => openPerson(p.id)}>
              <Avatar person={p} size={46} />
              <Text style={styles.personName} numberOfLines={1}>{p.displayName}</Text>
              {p.id === meal.host.id ? <Text style={styles.hostBadge}>Host</Text> : null}
            </Pressable>
          ))}
          {!full ? (
            <View style={styles.person}>
              <View style={styles.openSeat}><Icon name="Person" size={18} color="#8b978c" /></View>
              <Text style={styles.personName}>{isHost || confirmed ? 'Open seat' : 'Your seat?'}</Text>
            </View>
          ) : null}
        </View>

        <Text accessibilityRole="header" style={styles.h2}>A little about this meal</Text>
        <Text style={styles.prose}>{meal.description}</Text>
        <View style={styles.tags}>
          <Tag>{moodLabel(meal)}</Tag>
          <Tag>{languagesLabel(meal.languages)}</Tag>
          <Tag>Friendship first</Tag>
        </View>
        <Text style={styles.muted}>{`Cuisine: ${cuisineLabel(meal)} · Dietary options: ${dietaryLabel(meal)}. Host-reported · not an allergy guarantee.`}</Text>

        <Text accessibilityRole="header" style={styles.h2}>The restaurant</Text>
        <View style={styles.venue}>
          <View style={styles.thumb}>
            <RestaurantPhoto venueRef={meal.venue.venueRef} placeId={meal.venue.placeId} name={venueName(meal)} fill>{({ image }) => image}</RestaurantPhoto>
          </View>
          <View style={styles.flex}>
            <Text style={styles.venueName}>{venueName(meal)}</Text>
            <Text style={styles.venueAddress} numberOfLines={2}>{meal.venue.available && meal.venue.address ? meal.venue.address : `${areaName(meal.areaCode)}, London`}</Text>
            <View style={[styles.statusTag, booking === 'Restaurant booked' && styles.statusGood]}><Text style={styles.statusText}>{booking}</Text></View>
          </View>
        </View>
        {mapsUrl ? (
          <Pressable accessibilityRole="link" style={styles.mapsLink} onPress={() => void Linking.openURL(mapsUrl)}>
            <Text style={styles.mapsText}>Open in Google Maps</Text>
            <Icon name="ExternalLink" size={13} color={colors.forest} />
          </Pressable>
        ) : null}
        <Text style={styles.mapNote}>Reservation reported by the host; not verified by the app.</Text>
        {meal.venue.attributions.map((a, i) => <Text key={i} style={styles.mapNote}>{a.text}</Text>)}

        <Notice icon>No payment is due in the app. Everyone pays their own share at the restaurant.</Notice>

        <FormMessage message={message} />
        <View style={styles.actions}>
          {isHost && conversationId ? <Primary secondary label="Open group chat" onPress={() => router.push(`/chat/${conversationId}`)} /> : null}
          {can('POST_MEAL') ? <Primary secondary label="After the meal" onPress={() => router.push(`/post-meal/${meal.id}`)} /> : null}
          {can('WITHDRAW') && myApplication ? <TextAction destructive label="Withdraw request" onPress={() => setConfirm('withdraw')} /> : null}
          {can('LEAVE') ? <TextAction destructive label="Cancel my place" onPress={() => setConfirm('leave')} /> : null}
          <TextAction label="Report this meal" onPress={() => router.push(`/report?targetType=MEAL&targetId=${meal.id}`)} />
        </View>
      </ScrollView>
      {action ? <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>{action}</View> : null}
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

function Fact({ icon, glyph, strong, small }: { icon?: IconName; glyph?: string; strong: string; small: string }) {
  return (
    <View style={styles.fact}>
      <View style={styles.factIcon}>{icon ? <Icon name={icon} size={15} color={colors.forest} /> : <Text style={styles.factGlyph}>{glyph}</Text>}</View>
      <View style={styles.flex}>
        <Text style={styles.factStrong} numberOfLines={1}>{strong}</Text>
        <Text style={styles.factSmall} numberOfLines={2}>{small}</Text>
      </View>
    </View>
  );
}

const styles = createStyles({
  page: { flex: 1, backgroundColor: colors.white },
  state: { paddingHorizontal: 18, gap: 12 },
  scroll: { paddingHorizontal: 18, paddingBottom: 24 },
  flex: { flex: 1, minWidth: 0 },
  // Shares the first row with the floating back control.
  eyebrow: { fontSize: 9, letterSpacing: 1.3, color: '#647a6b', fontWeight: '700', marginLeft: FLOATING_BACK_SIZE + 10, lineHeight: FLOATING_BACK_SIZE, marginBottom: 4 },
  h1: { fontSize: 24, lineHeight: 28, letterSpacing: -0.8, fontWeight: '700', color: colors.ink, marginBottom: 8 },
  progress: { fontSize: 13, fontWeight: '700', color: colors.forest, marginBottom: 6 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line },
  fact: { width: '50%', flexDirection: 'row', gap: 8, paddingRight: 8 },
  factIcon: { width: 16, alignItems: 'center', paddingTop: 1 },
  factGlyph: { fontSize: 14, lineHeight: 16, fontWeight: '700', color: colors.forest },
  factStrong: { fontSize: 13, fontWeight: '700', color: colors.ink },
  factSmall: { fontSize: 11, lineHeight: 14, color: colors.muted, marginTop: 2 },
  h2: { fontSize: 16, letterSpacing: -0.3, fontWeight: '700', color: colors.ink, marginTop: 18, marginBottom: 10 },
  people: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  person: { alignItems: 'center', gap: 4, width: 56 },
  personName: { fontSize: 11, color: colors.ink },
  hostBadge: { fontSize: 9, fontWeight: '700', color: colors.forest, backgroundColor: colors.selectedSurface, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1, overflow: 'hidden' },
  openSeat: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#f3f5ef', alignItems: 'center', justifyContent: 'center' },
  prose: { color: '#55625a', fontSize: 14, lineHeight: 21, marginBottom: 10 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  muted: { fontSize: 11, color: colors.muted, lineHeight: 16 },
  venue: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  thumb: { width: 64, height: 64, borderRadius: 9, overflow: 'hidden', backgroundColor: colors.surface },
  venueName: { fontSize: 14, fontWeight: '700', color: colors.ink },
  venueAddress: { fontSize: 12, color: colors.muted, marginTop: 2, marginBottom: 6 },
  statusTag: { alignSelf: 'flex-start', paddingVertical: 3, paddingHorizontal: 8, backgroundColor: '#f0f3ec', borderRadius: 7 },
  statusGood: { backgroundColor: '#e6f0e5' },
  statusText: { fontSize: 10, lineHeight: 14, color: '#536c5b' },
  mapsLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, alignSelf: 'flex-start' },
  mapsText: { color: colors.forest, fontSize: 12, lineHeight: 18, textDecorationLine: 'underline' },
  mapNote: { marginTop: 4, fontSize: 10, color: colors.muted },
  actions: { gap: 4, marginTop: 4, alignItems: 'center' },
  footer: { paddingTop: 10, paddingHorizontal: 18, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.white },
});
