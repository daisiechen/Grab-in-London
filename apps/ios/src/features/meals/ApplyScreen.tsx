import {useAssistantContext,useAssistantEditor} from '../assistant/hooks.ts';
import { SessionScope } from '../auth/SessionScope.tsx';
import { useEffect, useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ApiError, type ResponseOf } from '@fancy/client';
import { useServices, useSessionState } from '../../services.tsx';
import { loadErrorMessage, useQuery } from '../../api/useQuery.ts';
import { Primary, TextAction } from '../../ui/Button.tsx';
import { Field } from '../../ui/Field.tsx';
import { FormMessage } from '../../ui/FormMessage.tsx';
import { Screen } from '../../ui/Screen.tsx';
import { Body, Heading } from '../../ui/Text.tsx';
import { rememberReturnTo } from '../auth/intent.ts';
import { mealKey } from './MealDetailScreen.tsx';
import { seatsLabel, whenLabel } from './format.ts';
import { mealActionMessage } from './messages.ts';

type Detail = ResponseOf<'getMeal'>['data'];
interface ApplyDraft { message: string; key: string; keyFor: string }

export const applyDraftKey = (mealId: string) => `apply:${mealId}`;

/** Application message (20–300). The draft survives sign-in/profile detours in memory; sending is always explicit. */
export function ApplyScreen() {
  return <SessionScope><ApplyScreenContent /></SessionScope>;
}

function ApplyScreenContent() {
  const { mealId } = useLocalSearchParams<{ mealId: string }>();
  const id = String(mealId);
  const { api, drafts, newId, cache } = useServices();
  const state = useSessionState();
  const router = useRouter();
  const q = useQuery<Detail>(mealKey(id), async () => (await api.call('getMeal', { params: { mealId: id } })).data);
  const [draft, setDraft] = useState<ApplyDraft>(() => drafts.get<ApplyDraft>(applyDraftKey(id)) ?? { message: '', key: newId(), keyFor: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const editorVersion=useRef(0);
  useAssistantContext({sourcePage:'MEAL',explicitMealId:id});
  useAssistantEditor({key:`apply:${id}`,kind:'APPLICATION',targetId:id,current:()=>({text:draft.message,version:String(editorVersion.current)}),apply:d=>{if(d.text!==null){editorVersion.current++;setDraft({message:d.text,key:newId(),keyFor:''});}}});

  useEffect(() => {
    drafts.set(applyDraftKey(id), draft);
  }, [drafts, draft, id]);

  if (state.status !== 'signedIn') {
    return (
      <Screen>
        <Body>Sign in to send a request. Your message will be kept.</Body>
        <Primary label="Sign in" onPress={() => { rememberReturnTo(`/meals/${id}/apply`); router.push('/sign-in'); }} />
      </Screen>
    );
  }
  if (!q.data) return <Screen>{q.error ? <FormMessage message={loadErrorMessage(q.error)} /> : <Body muted>Loading…</Body>}</Screen>;
  const { meal } = q.data;
  const me = state.session.user;

  const send = async () => {
    Keyboard.dismiss();
    const text = draft.message.trim();
    if (text.length < 20 || text.length > 300) return setError('Write a short introduction of 20–300 characters.');
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
      drafts.delete(applyDraftKey(id));
      cache.delete(mealKey(id));
      router.replace(`/meals/${id}`);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'PROFILE_INCOMPLETE') {
        rememberReturnTo(`/meals/${id}/apply`);
        router.push('/profile-setup');
      } else setError(e instanceof ApiError ? mealActionMessage(e) : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen testID="apply">
      <Heading>Pull up a chair.</Heading>
      <Body>{`Tell ${meal.host.displayName} a little about yourself and why you’d like to join.`}</Body>
      <Body>{`${meal.title} · ${whenLabel(meal.startsAt)} · ${seatsLabel(meal)}`}</Body>
      <Field label="Your introduction" hint="20–300 characters. Your host will see this with your profile." value={draft.message} onChangeText={(message) => {editorVersion.current++;setDraft({ ...draft, message });}} maxLength={300} multiline />
      <Body>{`${me.displayName ?? 'Your profile'}`}</Body>
      <TextAction label="Edit profile" onPress={() => router.push('/profile-edit')} />
      {!me.profileGate.profileComplete ? <Body muted>Complete your profile before applying.</Body> : null}
      <Body muted>Applying doesn’t reserve a seat or charge you. Your host reviews each request.</Body>
      <FormMessage message={error} />
      <Primary label="Send request" busy={busy} onPress={() => void send()} />
    </Screen>
  );
}
