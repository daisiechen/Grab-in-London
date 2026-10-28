import {useAssistantContext,useAssistantEditor} from '../assistant/hooks.ts';
import type {ApplicationDraft} from './application-drafts.ts';
import { SessionScope } from '../auth/SessionScope.tsx';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ApiError, type ResponseOf } from '@fancy/client';
import { LANGUAGES, LIFE_STATUSES } from '@fancy/contracts';
import { useServices, useSessionState } from '../../services.tsx';
import { loadErrorMessage, useQuery } from '../../api/useQuery.ts';
import { ActionPage, pageText } from '../../ui/ActionPage.tsx';
import { Avatar } from '../../ui/Avatar.tsx';
import { Notice } from '../../ui/Bits.tsx';
import { Primary, TextAction } from '../../ui/Button.tsx';
import { FormMessage } from '../../ui/FormMessage.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { RestaurantPhoto } from '../../ui/RestaurantPhoto.tsx';
import { createStyles } from '../../ui/styles.ts';
import { colors, radius } from '../../ui/tokens.ts';
import { rememberReturnTo } from '../auth/intent.ts';
import { mealKey } from './MealDetailScreen.tsx';
import { cardBudgetLabel, cardWhenLabel, seatsLabel, venueName, type Meal } from './format.ts';
import { mealActionMessage } from './messages.ts';

type Detail = ResponseOf<'getMeal'>['data'];

export const applyDraftKey = (mealId: string) => `apply:${mealId}`;
export const INTRO_MIN = 20;
export const INTRO_MAX = 300;

/** Application message (20–300). The draft survives sign-in/profile detours in memory; sending is always explicit. */
export function ApplyScreen() {
  return <SessionScope><ApplyScreenContent /></SessionScope>;
}

function ApplyScreenContent() {
  const { mealId } = useLocalSearchParams<{ mealId: string }>();
  const id = String(mealId);
  const { api, applicationDrafts, newId, cache, session } = useServices();
  const state = useSessionState();
  const router = useRouter();
  const userId=state.status==='signedIn'?state.session.user.id:null;
  const generation=session.generation;
  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const current=()=>{const latest=session.getState();return mounted.current&&session.generation===generation&&latest.status==='signedIn'&&latest.session.user.id===userId;};
  const q = useQuery<Detail>(mealKey(id), async () => (await api.call('getMeal', { params: { mealId: id } })).data);
  const [draft, setDraft] = useState<ApplicationDraft>(() => applicationDrafts.get(id,userId,generation) ?? { message: '', key: newId(), keyFor: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const editorVersion=useRef(0);
  useAssistantContext({sourcePage:'MEAL',explicitMealId:id});
  useAssistantEditor({key:`apply:${id}`,kind:'APPLICATION',targetId:id,current:()=>({text:draft.message,version:String(editorVersion.current)}),apply:d=>{if(d.text!==null){editorVersion.current++;setDraft({message:d.text,key:newId(),keyFor:''});}}});

  useEffect(() => {
    applicationDrafts.set(id,draft,userId,generation);
  }, [applicationDrafts, draft, id, userId, generation]);

  if (state.status !== 'signedIn') {
    return (
      <ActionPage testID="apply" footer={<Primary label="Sign in" onPress={() => { rememberReturnTo(`/meals/${id}/apply`); router.push('/sign-in'); }} />}>
        <Text accessibilityRole="header" style={pageText.h1}>Pull up a chair.</Text>
        <Text style={pageText.prose}>Sign in to send a request. Your message will be kept.</Text>
      </ActionPage>
    );
  }
  if (!q.data) {
    return (
      <ActionPage testID="apply">
        {q.error ? (
          <View style={styles.state}>
            <FormMessage message={loadErrorMessage(q.error)} />
            <Primary secondary label="Try again" onPress={() => void q.reload()} />
          </View>
        ) : <ActivityIndicator accessibilityLabel="Loading meal" />}
      </ActionPage>
    );
  }
  const { meal, myApplication } = q.data;
  const me = state.session.user;
  const length = draft.message.trim().length;
  const alreadyIn = myApplication?.state === 'PENDING' || myApplication?.state === 'CONFIRMED';

  const send = async () => {
    Keyboard.dismiss();
    const text = draft.message.trim();
    if (text.length < INTRO_MIN || text.length > INTRO_MAX) return setError('Write a short introduction of 20–300 characters.');
    if (!me.profileGate.profileComplete) {
      rememberReturnTo(`/meals/${id}/apply`);
      return router.push('/profile-setup');
    }
    // Same text = same intent (retry reuses the key); edited text = new intent.
    const key = draft.keyFor === text ? draft.key : newId();
    setDraft({ ...draft, key, keyFor: text });
    setBusy(true);
    setError(null);
    try {
      await api.call('applyMeal', { params: { mealId: id }, body: { message: text }, idempotencyKey: key });
      if(!current())return;
      applicationDrafts.delete(id,userId,generation);
      cache.delete(mealKey(id));
      router.replace(`/meals/${id}/status`);
    } catch (e) {
      if(!current())return;
      if (e instanceof ApiError && e.code === 'PROFILE_INCOMPLETE') {
        rememberReturnTo(`/meals/${id}/apply`);
        router.push('/profile-setup');
      } else setError(e instanceof ApiError ? mealActionMessage(e) : 'Something went wrong. Please try again.');
    } finally {
      if(current())setBusy(false);
    }
  };

  const about = [me.lifeStatus ? LIFE_STATUSES[me.lifeStatus] : null, me.languages.map((c) => (c === 'zh' ? 'Mandarin' : LANGUAGES[c])).join(' & ') || null].filter(Boolean).join(' · ');
  const footer = alreadyIn
    ? <Primary secondary label="View application" icon="ArrowRight" onPress={() => router.replace(`/meals/${id}/status`)} />
    : <Primary label="Send request" icon="ArrowRight" busy={busy} onPress={() => void send()} />;

  return (
    <ActionPage testID="apply" footer={footer}>
      <Text accessibilityRole="header" style={pageText.h1}>Pull up a chair.</Text>
      <Text style={pageText.prose}>{`Tell ${meal.host.displayName} a little about yourself and why you’d like to join.`}</Text>

      <MealSummary meal={meal} onPress={() => (router.canGoBack() ? router.back() : router.push(`/meals/${id}`))} />

      <View style={styles.field}>
        <Text style={styles.label}>Your introduction</Text>
        <TextInput
          accessibilityLabel="Your introduction"
          accessibilityHint="20 to 300 characters"
          value={draft.message}
          onChangeText={(message) => {editorVersion.current++;setDraft({ ...draft, message });
            // A length error clears as soon as the text becomes valid, not only on the next Send.
            const n = message.trim().length;if (error && n >= INTRO_MIN && n <= INTRO_MAX) setError(null);}}
          maxLength={INTRO_MAX}
          multiline
          placeholder="I’m new to London and would love to meet people over a relaxed meal."
          placeholderTextColor={colors.muted}
          style={[styles.input, error ? styles.invalid : null]}
        />
        <View style={styles.hintRow}>
          <Text style={styles.hint}>20–300 characters. Your host will see this with your profile.</Text>
          <Text testID="intro-counter" style={[styles.counter, length >= INTRO_MIN && styles.counterOk]}>{`${length}/${INTRO_MAX}`}</Text>
        </View>
      </View>

      <View style={styles.me}>
        <Avatar person={{ displayName: me.displayName ?? 'You', avatarUrl: null }} size={38} />
        <View style={styles.flex}>
          <Text style={styles.meName} numberOfLines={1}>{me.displayName ?? 'Your profile'}</Text>
          {about ? <Text style={styles.meAbout} numberOfLines={1}>{about}</Text> : null}
        </View>
        <TextAction label="Edit profile" onPress={() => router.push('/profile-edit')} />
      </View>

      {alreadyIn ? <Notice icon>You’ve already sent a request for this table.</Notice> : !me.profileGate.profileComplete ? <Notice icon>Complete your profile before applying.</Notice> : (
        <Notice icon>Applying doesn’t reserve a seat or charge you. Your host reviews each request; if you’re confirmed, everyone pays their own share at the restaurant.</Notice>
      )}
      <FormMessage message={error} />
    </ActionPage>
  );
}

/** One-row meal summary (demo .small-meal), a whole-row link back to the meal: fixed photo frame, title, time, budget and seats. */
export function MealSummary({ meal, onPress }: { meal: Meal; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`View ${meal.title}`} onPress={onPress} style={({ pressed }) => [styles.summary, pressed && styles.pressed]}>
      <View style={styles.thumb}>
        <RestaurantPhoto venueRef={meal.venue.venueRef} placeId={meal.venue.placeId} name={venueName(meal)} fill>{({ image }) => image}</RestaurantPhoto>
      </View>
      <View style={styles.flex}>
        <Text style={styles.summaryTitle} numberOfLines={1}>{meal.title}</Text>
        <Text style={styles.summaryLine} numberOfLines={1}>{`${cardWhenLabel(meal.startsAt)} · ${venueName(meal)}`}</Text>
        <Text style={styles.summaryLine} numberOfLines={1}>{`${cardBudgetLabel(meal)} per person · ${seatsLabel(meal)}`}</Text>
      </View>
      <Icon name="ChevronRight" size={16} color={colors.muted} />
    </Pressable>
  );
}

const styles = createStyles({
  state: { gap: 12 },
  flex: { flex: 1, minWidth: 0 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, marginTop: 14, marginBottom: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line },
  pressed: { opacity: 0.85 },
  thumb: { width: 56, height: 56, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.surface },
  summaryTitle: { fontSize: 13, fontWeight: '700', color: colors.ink },
  summaryLine: { fontSize: 11, lineHeight: 15, color: colors.muted, marginTop: 3 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '700', color: colors.ink },
  input: { minHeight: 104, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10, fontSize: 14, lineHeight: 20, color: colors.ink, backgroundColor: colors.white, textAlignVertical: 'top' },
  invalid: { borderColor: colors.danger },
  hintRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  hint: { flex: 1, fontSize: 11, lineHeight: 15, color: colors.muted },
  counter: { fontSize: 11, lineHeight: 15, color: colors.muted, fontVariant: ['tabular-nums'] },
  counterOk: { color: colors.forest, fontWeight: '700' },
  me: { flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 14 },
  meName: { fontSize: 14, fontWeight: '700', color: colors.ink },
  meAbout: { fontSize: 11, color: colors.muted, marginTop: 2 },
});
