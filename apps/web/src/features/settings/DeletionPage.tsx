import { useMemo, useState } from 'react';
import { ApiError, newIntentKey, type ResponseOf } from '@fancy/client';
import { useApi } from '../../api/ApiProvider.tsx';
import { useSession } from '../../api/session.tsx';
import { Intent } from '../../api/webApi.ts';
import { errorMessage } from '../../api/errors.ts';
import { browser } from '../../lib/browser.ts';
import { Field, FormError, Loading, Notice, PageHeader, Primary, PrimaryLink } from '../../ui/components.tsx';
import { ensureDeletionReceipt, readDeletionReceipt } from './deletionReceipt.ts';

type Status = ResponseOf<'deletionStatus'>['data'];
const descriptions: Record<Status['status'], string> = {
  PENDING: 'Your account is blocked from further activity. Removal is queued.',
  PROCESSING: 'Your account is blocked from further activity. Removal is in progress.',
  COMPLETED: 'Your account removal is complete.',
  NEEDS_SUPPORT: 'Your account is blocked from further activity. Support needs to finish removal.',
};

export function DeletionPage() {
  const { api } = useApi();
  const { state, clearLocal, refresh } = useSession();
  const intent = useMemo(() => new Intent(api.retry), [api]);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<Status | null>(null);
  const [receipt, setReceipt] = useState(readDeletionReceipt);
  const [reauth, setReauth] = useState(false);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState('');
  if (state.status === 'loading') return <Loading />;
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await action(); } catch (e) {
      setError(errorMessage(e));
      if (e instanceof ApiError && e.code === 'REAUTH_REQUIRED') setReauth(true);
    } finally { setBusy(false); }
  };
  const remove = () => run(async () => {
    if (state.status !== 'signed-in' || !checked) return;
    let token: string;
    try { token = ensureDeletionReceipt(); }
    catch { setError('Allow session storage before deleting your account so your removal receipt can be saved.'); return; }
    setReceipt(token);
    const version = state.session.user.version;
    const body = { confirm: true as const, receiptToken: token };
    const response = await intent.run({ body, version }, key => api.client.call('requestDeletion', { body, ifMatch: version, idempotencyKey: key }));
    setStatus(response.data); clearLocal();
  });
  const startProof = (method: 'EMAIL' | 'GOOGLE' | 'APPLE') => run(async () => {
    const result = await api.client.call('startReauth', { body: { clientRequestId: newIntentKey(), method, returnTarget: '/settings/deletion' } });
    if (result.data.authorizationUrl) browser.assign(result.data.authorizationUrl);
    else if (result.data.challengeId) setChallenge(result.data.challengeId);
    else setError('Verification could not start. Try your existing sign-in method again.');
  });
  return <><PageHeader title="Account removal" backTo="/settings" /><div className="body-pad">
    {status ? <><h1>Account removal</h1><Notice role="status">{descriptions[status.status]}</Notice><p>Keep this tab available to check your receipt. Closing the tab clears the receipt saved on this device.</p></> : <>
      <h1>Delete your account?</h1><p className="prose">This permanently removes your account. You will lose access to your profile, meals and conversations. Some records may be retained where required for safety or legal obligations.</p>
      {state.status === 'signed-in' && <><label className="check-row"><input type="checkbox" checked={checked} disabled={busy} onChange={e => setChecked(e.target.checked)} />I understand and want to delete my account.</label><Primary disabled={busy || !checked} onClick={() => void remove()}>Delete my account</Primary></>}
      {state.status === 'guest' && !receipt && <PrimaryLink to="/sign-in?returnTo=%2Fsettings%2Fdeletion">Sign in to continue</PrimaryLink>}
    </>}
    {reauth && state.status === 'signed-in' && <section><h2>Verify it’s you</h2><p>Use an existing sign-in method. Verification expires after five minutes; deletion still requires your confirmation.</p>
      <Primary secondary disabled={busy} onClick={() => void startProof('EMAIL')}>Email me a verification code</Primary>
      <Primary secondary disabled={busy} onClick={() => void startProof('GOOGLE')}>Verify with Google</Primary>
      <Primary secondary disabled={busy} onClick={() => void startProof('APPLE')}>Verify with Apple</Primary>
      {challenge && <><Field label="Verification code">{p => <input {...p} inputMode="numeric" autoComplete="one-time-code" value={code} maxLength={10} onChange={e => setCode(e.target.value)} />}</Field><Primary disabled={busy || !code.trim()} onClick={() => void run(async () => {
        await api.client.call('verifyEmail', { body: { clientRequestId: newIntentKey(), challengeId: challenge, code: code.trim() } });
        await refresh(); setReauth(false); setChallenge(null); setCode(''); setChecked(false);
      })}>Verify code</Primary></>}
    </section>}
    {receipt && <Primary secondary disabled={busy} onClick={() => void run(async () => { const result = await api.client.call('deletionStatus', { body: { receiptToken: receipt } }); setStatus(result.data); })}>Check removal status</Primary>}
    <FormError>{error}</FormError>
  </div></>;
}
