import { SessionScope } from '../auth/SessionScope.tsx';
import { useEffect, useRef, useState } from 'react';
import { ApiError, type ResponseOf } from '@fancy/client';
import { SURVEY_REASONS } from '@fancy/contracts';
import { useServices } from '../../services.tsx';
import { useQuery, loadErrorMessage } from '../../api/useQuery.ts';
import { Primary, TextAction } from '../../ui/Button.tsx';
import { ChoiceGroup, MultiChoice } from '../../ui/ChoiceGroup.tsx';
import { FormMessage } from '../../ui/FormMessage.tsx';
import { Screen } from '../../ui/Screen.tsx';
import { Body, Heading } from '../../ui/Text.tsx';

type Survey = ResponseOf<'getSurvey'>['data'];
type Reason = (typeof SURVEY_REASONS)[number];
const REASON_LABELS: Record<Reason, string> = { coordination: 'Organisation', expectations: 'Expectations', company: 'Company', conversation: 'Conversation', venue: 'Restaurant', cost: 'Cost', other: 'Other' };
const ORDER: Reason[] = ['coordination', 'expectations', 'company', 'conversation', 'venue', 'cost', 'other'];

/** ProductSurvey is independent of any meal or rating. */
export function SurveyScreen() {
  return <SessionScope><SurveyScreenContent /></SessionScope>;
}

function SurveyScreenContent() {
  const { api, newId } = useServices();
  const q = useQuery<Survey>('survey', async () => (await api.call('getSurvey', {})).data);
  const [again, setAgain] = useState<boolean | null>(null);
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'info' } | null>(null);
  const [busy, setBusy] = useState(false);
  const intent = useRef<{ key: string; body: string } | null>(null);

  useEffect(() => {
    if (q.data) {
      setAgain(q.data.again);
      setReasons([...q.data.reasons]);
    }
  }, [q.data]);

  if (!q.data) return <Screen>{q.error ? <FormMessage message={loadErrorMessage(q.error)} /> : <Body muted>Loading…</Body>}</Screen>;
  const survey = q.data;

  const save = async () => {
    if (again === null && reasons.length === 0) return setMessage({ text: 'Answer at least one question to save.', tone: 'error' });
    const body = { again, reasons: ORDER.filter((r) => reasons.includes(r)) };
    const serialized = JSON.stringify(body);
    if (!intent.current || intent.current.body !== serialized) intent.current = { key: newId(), body: serialized };
    setBusy(true);
    try {
      await api.call('putSurvey', { body, idempotencyKey: intent.current.key, ifMatch: survey.version });
      intent.current = null;
      setMessage({ text: 'Thank you. Your product survey is saved.', tone: 'info' });
      await q.reload();
    } catch (e) {
      setMessage({ text: e instanceof ApiError && e.kind === 'conflict' ? 'Your survey changed on another device. Review and save again.' : 'We couldn’t save your survey. Please try again.', tone: 'error' });
      if (e instanceof ApiError && e.kind === 'conflict') {
        intent.current = null;
        await q.reload();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen testID="survey">
      <Heading>Help shape Fancy.</Heading>
      <Body>An optional survey about Fancy. You can update your answers whenever you like.</Body>
      <ChoiceGroup<'yes' | 'no'> label="Would you join another Fancy meal?" options={[['yes', 'Yes'], ['no', 'No']]} value={again === null ? null : again ? 'yes' : 'no'} onChange={(v) => setAgain(v === 'yes')} />
      {again !== null ? <TextAction label="Clear answer" onPress={() => setAgain(null)} /> : null}
      <MultiChoice<Reason> label="What shapes your experience of Fancy? · optional" options={ORDER.map((r) => [r, REASON_LABELS[r]] as const)} values={reasons} onToggle={(r) => setReasons((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]))} />
      <FormMessage message={message?.text ?? null} tone={message?.tone ?? 'error'} />
      <Primary label={survey.submittedAt ? 'Update survey' : 'Save survey'} busy={busy} onPress={() => void save()} />
    </Screen>
  );
}
