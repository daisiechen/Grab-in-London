import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router';
import { ApiError, type ResponseOf } from '@fancy/client';
import { useApi } from '../../api/ApiProvider.tsx';
import { useSession } from '../../api/session.tsx';
import { useQuery } from '../../api/useQuery.ts';
import { Intent } from '../../api/webApi.ts';
import { errorMessage } from '../../api/errors.ts';
import { signInPath } from '../../lib/returnTo.ts';
import { useDocumentMeta } from '../../seo/useDocumentMeta.ts';
import { ChoiceGroup, FormMessage, Loading, Primary, TextAction, TitleBar } from '../../ui/components.tsx';

type Survey = ResponseOf<'getSurvey'>['data'];
type Reason = Survey['reasons'][number];
const REASON_LABELS: Record<Reason, string> = { coordination: 'Organisation', expectations: 'Expectations', company: 'Company', conversation: 'Conversation', venue: 'Restaurant', cost: 'Cost', other: 'Other' };
const ORDER: Reason[] = ['coordination', 'expectations', 'company', 'conversation', 'venue', 'cost', 'other'];

/** Product survey (iOS SurveyScreen): about Fancy overall, separate from meal ratings and reconnect choices. */
export function SurveyPage() {
  const { state } = useSession();
  const { api } = useApi();
  useDocumentMeta({ title: 'Help shape Fancy · Fancy', robots: 'noindex, nofollow' });
  const query = useQuery<Survey>(state.status === 'signed-in' ? 'productSurvey' : null, async (c) => (await c.call('getSurvey', {})).data);
  const [again, setAgain] = useState<boolean | null>(null);
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [version, setVersion] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'info' } | null>(null);
  const intent = useMemo(() => new Intent(api.retry), [api]);
  useEffect(() => {
    if (query.data && !dirty) { setAgain(query.data.again); setReasons(query.data.reasons); setVersion(query.data.version); }
  }, [query.data, dirty]);
  if (state.status === 'loading') return <Loading />;
  if (state.status === 'guest') return <Navigate to={signInPath('/survey')} replace />;
  const edit = () => { setDirty(true); setMessage(null); };
  const save = async () => {
    if (again === null && reasons.length === 0) { setMessage({ text: 'Answer at least one question to save.', tone: 'error' }); return; }
    if (version === null) return;
    setBusy(true);
    setMessage(null);
    try {
      const body = { again, reasons: ORDER.filter((r) => reasons.includes(r)) };
      const res = await intent.run({ body, version }, (key) => api.client.call('putSurvey', { body, ifMatch: version, idempotencyKey: key }));
      query.setData(res.data);
      setVersion(res.data.version);
      setDirty(false);
      setMessage({ text: 'Thank you. Your product survey is saved.', tone: 'info' });
    } catch (e) {
      // Keep the answers, and require a deliberate retry against the current server revision.
      if (e instanceof ApiError && e.currentVersion) setVersion(e.currentVersion);
      setMessage({ text: e instanceof ApiError && e.kind === 'conflict' ? 'Your survey changed on another device. Review and save again.' : 'We couldn’t save your survey. Please try again.', tone: 'error' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="scroll">
      <TitleBar title="Help shape Fancy." back="/settings" />
      <p className="prose">An optional survey about Fancy. You can update your answers whenever you like.</p>
      <h2>Your experience of Fancy</h2>
      <p className="muted">This survey is about Fancy overall. It is separate from your private meal rating and your choice to reconnect with a person. Only authorised staff can see your answers.</p>
      {!query.data ? (query.error ? <><FormMessage message={errorMessage(query.error)} /><div className="mt8"><Primary secondary onClick={() => void query.reload()}>Try again</Primary></div></> : <Loading />) : (
        <div className="mt8">
          <ChoiceGroup<'yes' | 'no'> label="Would you join another Fancy meal?" options={[['yes', 'Yes'], ['no', 'No']]} value={again === null ? null : again ? 'yes' : 'no'}
            disabled={() => busy} onChange={(v) => { setAgain(v === 'yes'); edit(); }} />
          {again !== null ? <TextAction className="inline" onClick={() => { setAgain(null); edit(); }}>Clear answer</TextAction> : null}
          <ChoiceGroup<Reason> multiple label="What shapes your experience of Fancy? · optional" options={ORDER.map((r) => [r, REASON_LABELS[r]] as const)} value={reasons}
            disabled={() => busy} onChange={(r) => { setReasons((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r])); edit(); }} />
          <FormMessage message={message?.text ?? null} tone={message?.tone ?? 'error'} />
          <div className="mt8"><Primary busy={busy} disabled={version === null} onClick={() => void save()}>{query.data.submittedAt ? 'Update survey' : 'Save survey'}</Primary></div>
        </div>
      )}
    </div>
  );
}
