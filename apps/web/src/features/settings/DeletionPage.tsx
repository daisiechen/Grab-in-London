import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ApiError, newIntentKey, type ResponseOf } from '@fancy/client';
import { useApi } from '../../api/ApiProvider.tsx';
import { useSession } from '../../api/session.tsx';
import { browser } from '../../lib/browser.ts';
import { signInPath } from '../../lib/returnTo.ts';
import { useDocumentMeta } from '../../seo/useDocumentMeta.ts';
import { Field, FormMessage, Loading, Notice, Primary, PrimaryLink, TextAction, TitleBar } from '../../ui/components.tsx';
import { ensureDeletionReceipt, forgetDeletionReceipt, readDeletionReceipt, readSavedDeletionStatus, rememberDeletionStatus } from './deletionReceipt.ts';

type Status = ResponseOf<'deletionStatus'>['data'];
type Stage = { kind: 'intro' } | { kind: 'reauthEmail'; challengeId: string } | { kind: 'done'; receipt: string; status: Status['status'] };
const LABELS: Record<Status['status'], string> = { PENDING: 'Requested', PROCESSING: 'In progress', COMPLETED: 'Completed', NEEDS_SUPPORT: 'Our support team is completing this' };

/**
 * Account deletion (iOS DeleteAccountScreen, API §4): a recent sign-in proof, then one deletion
 * request. The 256-bit receipt is saved in this tab before the request (only its hash is kept
 * server-side), so the status can be checked after the session and local data are gone.
 */
export function DeletionPage() {
  const { api } = useApi();
  const { state, clearLocal } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  useDocumentMeta({ title: 'Delete account · Fancy', robots: 'noindex, nofollow' });
  // One deletion intent: the same Idempotency-Key across re-authentication and network retries (as iOS).
  const deletionKey = useRef<string | null>(null);
  const [stage, setStage] = useState<Stage>({ kind: 'intro' });
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const keep = () => { if (location.key !== 'default') navigate(-1); else navigate('/settings', { replace: true }); };

  // Signing out remounts the private page tree, so the finished request is read back from this tab.
  const saved = readSavedDeletionStatus();
  const receiptInTab = readDeletionReceipt();
  const finished = stage.kind === 'done' ? stage : state.status === 'guest' && saved && receiptInTab ? { receipt: receiptInTab, status: saved.status } : null;
  if (finished) {
    return (
      <div className="scroll">
        <TitleBar title="Your account is being deleted" noBack />
        <p className="prose">{`Status: ${LABELS[finished.status].toLowerCase()}. You’ve been signed out in this browser and its saved data has been removed.`}</p>
        <div className="summary mt8">
          <p className="muted">Deletion reference</p>
          <code className="receipt">{finished.receipt}</code>
        </div>
        <p className="muted">Your reference is kept in this tab until you close it. Copy it to check the status later, from any device.</p>
        <div className="mt8">
          <Primary secondary onClick={() => { void navigator.clipboard?.writeText(finished.receipt).then(() => setError(null), () => setError('Copying didn’t work. Select the reference and copy it yourself.')); }}>Copy reference</Primary>
          <PrimaryLink secondary to="/deletion-status">Check deletion status</PrimaryLink>
          <FormMessage message={error} />
          <PrimaryLink to="/" replace>Done</PrimaryLink>
        </div>
      </div>
    );
  }
  if (state.status === 'loading') return <Loading />;
  if (state.status !== 'signed-in') {
    return (
      <div className="scroll">
        <TitleBar title="Delete your account?" back="/settings" />
        <p className="prose">Please sign in to delete your account.</p>
        <div className="mt8">
          <PrimaryLink to={signInPath('/delete-account')}>Sign in</PrimaryLink>
          <PrimaryLink secondary to="/deletion-status">Check deletion status</PrimaryLink>
        </div>
      </div>
    );
  }
  const amr = state.session.amr;
  const me = state.session.user;

  const requestDeletion = async (afterReauth = false) => {
    setBusy(true);
    setError(null);
    try {
      let receipt: string;
      try { receipt = ensureDeletionReceipt(); } catch {
        setError('We couldn’t securely save your removal reference in this tab. Allow site storage and try again before deleting your account.');
        return;
      }
      const version = me.version;
      const body = { confirm: true as const, receiptToken: receipt };
      deletionKey.current ??= newIntentKey();
      const res = await api.client.call('requestDeletion', { body, ifMatch: version, idempotencyKey: deletionKey.current });
      deletionKey.current = null;
      rememberDeletionStatus(res.data);
      setStage({ kind: 'done', receipt, status: res.data.status });
      clearLocal();
    } catch (e) {
      if (!(e instanceof ApiError) || (e.code !== 'REAUTH_REQUIRED' && !e.retryable)) deletionKey.current = null;
      if (e instanceof ApiError && e.code === 'REAUTH_REQUIRED' && !afterReauth) await startReauth();
      else setError(e instanceof ApiError && e.kind === 'network' ? 'We couldn’t confirm the request. Check your connection and try again.' : 'We couldn’t delete your account. Please try again or contact support.');
    } finally {
      setBusy(false);
    }
  };

  const startReauth = async () => {
    const method = amr.includes('google') ? 'GOOGLE' : amr.includes('apple') ? 'APPLE' : 'EMAIL';
    try {
      // `/settings/deletion` is the contract-allowed return address; it opens this page again.
      const res = await api.client.call('startReauth', { body: { clientRequestId: newIntentKey(), method, returnTarget: '/settings/deletion' } });
      if (method === 'EMAIL' && res.data.challengeId) {
        setStage({ kind: 'reauthEmail', challengeId: res.data.challengeId });
        setError('For your security, enter the code we just emailed you.');
        return;
      }
      if (res.data.authorizationUrl) { browser.assign(res.data.authorizationUrl); return; }
      setError('We couldn’t confirm it’s you. Please try again.');
    } catch {
      setError('We couldn’t confirm it’s you. Please try again.');
    }
  };

  const verifyCode = async () => {
    if (stage.kind !== 'reauthEmail') return;
    if (!/^\d{6}$/.test(code)) { setError('Enter the six-digit code.'); return; }
    setBusy(true);
    try {
      await api.client.call('verifyEmail', { body: { clientRequestId: newIntentKey(), challengeId: stage.challengeId, code } });
      setStage({ kind: 'intro' });
      setCode('');
      setBusy(false);
      await requestDeletion(true);
    } catch (e) {
      setError(e instanceof ApiError && (e.code === 'STATE_CONFLICT' || e.code === 'NOT_FOUND')
        ? 'This code has expired or has been tried too many times. Start again to get a new code.'
        : 'That code isn’t right. Check your inbox and try again.');
      setBusy(false);
    }
  };

  return (
    <div className="scroll">
      <TitleBar title="Delete your account?" back="/settings" />
      <p className="prose">Your profile is removed, you leave your groups, and upcoming places and hosted meals are cancelled. This can’t be undone.</p>
      <div className="mt8"><Notice>For your security we’ll ask you to confirm it’s you. You’ll get a deletion reference to check the status later, even when signed out.</Notice></div>
      {stage.kind === 'reauthEmail' ? (
        <div className="mt8">
          <Field label="6-digit code">
            {(p) => <input {...p} className="input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />}
          </Field>
        </div>
      ) : null}
      <div className="del-actions">
        <FormMessage message={error} />
        {stage.kind === 'reauthEmail'
          ? <Primary danger className="solid-danger" busy={busy} onClick={() => void verifyCode()}>Confirm and delete</Primary>
          : <Primary danger className="solid-danger" busy={busy} onClick={() => void requestDeletion()}>Delete my account</Primary>}
        <TextAction onClick={keep}>Keep my account</TextAction>
      </div>
    </div>
  );
}

/** Status by receipt only (sent in the body, never in a URL); works signed out (iOS DeletionStatusScreen). */
export function DeletionStatusPage() {
  const { api } = useApi();
  useDocumentMeta({ title: 'Check deletion status · Fancy', robots: 'noindex, nofollow' });
  const [saved, setSaved] = useState(readDeletionReceipt);
  const [token, setToken] = useState(() => saved ?? '');
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const check = async () => {
    const t = token.trim();
    if (!/^[A-Za-z0-9_-]{43}$/.test(t)) { setError('Enter the 43-character reference you saved.'); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await api.client.call('deletionStatus', { body: { receiptToken: t } });
      if (t === saved) rememberDeletionStatus(res.data);
      setStatus(res.data);
    } catch (e) {
      setStatus(null);
      setError(e instanceof ApiError && e.kind === 'gone' ? 'This reference has expired.' : e instanceof ApiError && e.kind === 'not_found' ? 'We couldn’t find that reference.' : 'We couldn’t check the status. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  const forget = () => {
    forgetDeletionReceipt();
    setSaved(null);
    setToken('');
    setStatus(null);
    setError('Saved reference removed from this tab. This does not cancel account deletion.');
  };

  return (
    <form className="scroll" noValidate onSubmit={(e) => { e.preventDefault(); void check(); }}>
      <TitleBar title="Check deletion status" back="/settings" />
      <p className="prose">Use the reference you received when you deleted your account. It works without signing in and is sent privately.</p>
      <div className="mt8">
        <Field label="Deletion reference" hint="The 43-character reference you saved or copied.">
          {(p) => <input {...p} className="input" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={token} onChange={(e) => { setToken(e.target.value); setStatus(null); }} />}
        </Field>
      </div>
      {status ? (
        <div className="summary" role="status">
          <strong>{`Status: ${LABELS[status.status]}`}</strong>
          {status.completedAt ? <p className="muted">Your account has been removed. Some records are kept for a limited time, as explained in the <a className="inline-link" href="/privacy">Privacy Notice</a>.</p> : null}
        </div>
      ) : null}
      <FormMessage message={error} tone={error?.startsWith('Saved reference removed') ? 'info' : 'error'} />
      <div className="mt8"><Primary type="submit" busy={busy}>Check status</Primary></div>
      {saved ? <TextAction onClick={forget}>Forget saved reference</TextAction> : null}
    </form>
  );
}
