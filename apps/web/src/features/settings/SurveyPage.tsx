import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router';
import { ApiError, type ResponseOf } from '@fancy/client';
import { SURVEY_REASONS } from '@fancy/contracts';
import { useApi } from '../../api/ApiProvider.tsx';
import { useSession } from '../../api/session.tsx';
import { useQuery } from '../../api/useQuery.ts';
import { Intent } from '../../api/webApi.ts';
import { errorMessage } from '../../api/errors.ts';
import { signInPath } from '../../lib/returnTo.ts';
import { ChoiceGroup, FormError, Loading, Notice, PageHeader, Primary } from '../../ui/components.tsx';

type Survey = ResponseOf<'getSurvey'>['data'];
type Reason = Survey['reasons'][number];
const labels: Record<Reason, string> = { company: 'The company', conversation: 'The conversation', coordination: 'Making plans', expectations: 'What I expected', venue: 'The venue', cost: 'The cost', other: 'Something else' };

export function SurveyPage() {
  const { state } = useSession();
  const { api } = useApi();
  const query = useQuery<Survey>(state.status === 'signed-in' ? 'productSurvey' : null, async c => (await c.call('getSurvey', {})).data);
  const [again, setAgain] = useState<boolean | null>(null);
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [version, setVersion] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const intent = useMemo(() => new Intent(api.retry), [api]);
  useEffect(() => {
    if (query.data && !dirty) {
      setAgain(query.data.again); setReasons(query.data.reasons); setVersion(query.data.version);
    }
  }, [query.data, dirty]);
  if (state.status === 'loading') return <Loading />;
  if (state.status === 'guest') return <Navigate to={signInPath('/settings/survey')} replace />;
  const save = async () => {
    if (again === null && reasons.length === 0) { setError('Choose an answer or at least one factor.'); return; }
    if (version === null) return;
    setBusy(true); setError(''); setSaved(false);
    try {
      const body = { again, reasons };
      const res = await intent.run({ body, version }, key => api.client.call('putSurvey', { body, ifMatch: version, idempotencyKey: key }));
      query.setData(res.data); setVersion(res.data.version); setDirty(false); setSaved(true);
    } catch (e) {
      setError(errorMessage(e));
      // Preserve edits, but require a deliberate retry against the current server revision.
      if (e instanceof ApiError && e.currentVersion) setVersion(e.currentVersion);
    } finally { setBusy(false); }
  };
  return <><PageHeader title="Your Fancy experience" backTo="/settings" /><div className="body-pad">
    <h1>Help shape the next table.</h1><p className="prose">Optional feedback about Fancy as a whole. You can update your latest answer here.</p>
    {!query.data ? query.error ? <FormError>{errorMessage(query.error)}</FormError> : <Loading /> : <>
      <fieldset disabled={busy}>
        <ChoiceGroup<string> label="Would you use Fancy again?" value={again === null ? null : String(again)} options={[[ 'true', 'Yes' ], [ 'false', 'No' ]]} onChange={v => { setAgain(v === 'true'); setDirty(true); setSaved(false); }} />
        <button type="button" className="text-action" onClick={() => { setAgain(null); setDirty(true); setSaved(false); }}>Clear answer</button>
        <h2>What influenced your answer?</h2>
        {SURVEY_REASONS.map(reason => <label className="check-row" key={reason}><input type="checkbox" checked={reasons.includes(reason)} onChange={e => { setReasons(old => e.target.checked ? [...old, reason] : old.filter(r => r !== reason)); setDirty(true); setSaved(false); }} />{labels[reason]}</label>)}
      </fieldset>
      <FormError>{error}</FormError>{saved && <Notice role="status">Your feedback is saved.</Notice>}
      <Primary disabled={busy || version === null} onClick={() => void save()}>Save feedback</Primary>
    </>}
  </div></>;
}
