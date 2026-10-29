import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { ApiError, type ResponseOf } from '@fancy/client';
import { REPORT_REASONS, REPORT_TARGET_TYPES } from '@fancy/contracts';
import { CalendarIcon, ChatBubbleIcon, PersonIcon } from '@radix-ui/react-icons';
import { useApi } from '../../api/ApiProvider.tsx';
import { useSession } from '../../api/session.tsx';
import { Intent } from '../../api/webApi.ts';
import { longDate } from '../../lib/format.ts';
import { signInPath } from '../../lib/returnTo.ts';
import { Avatar, ChoiceGroup, Field, FormMessage, Primary, TextAction, TitleBar } from '../../ui/components.tsx';
import { useDocumentMeta } from '../../seo/useDocumentMeta.ts';
import { markMessageReported, messageSubject } from './messageReports.ts';

type Receipt = ResponseOf<'createReport'>['data'];
type Target = (typeof REPORT_TARGET_TYPES)[number];
type Reason = (typeof REPORT_REASONS)[number];

/** Required reason (owner decision 2026-10-29), same order and wording as iOS ReportScreen. */
export const REASON_OPTIONS: ReadonlyArray<readonly [Reason, string]> = [
  ['safety', 'Personal safety or threats'],
  ['harassment', 'Harassment or hate'],
  ['scam', 'Scam, spam or advertising'],
  ['under_18', 'May be under 18'],
  ['other', 'Something else'],
];
const STATUS_LABELS: Record<Receipt['status'], string> = { RECEIVED: 'Received', IN_REVIEW: 'In review', RESPONDED: 'Responded' };
const TARGET_LABELS: Record<Target, string> = { USER: 'a member', MEAL: 'a meal', MESSAGE: 'a message' };
const HEADINGS: Record<Target, string> = { USER: 'Share a private concern', MEAL: 'Share a private concern', MESSAGE: 'Report this message' };
type Subject = { kind: 'USER'; name: string; avatarUrl: string | null } | { kind: 'MEAL'; title: string; date: string } | { kind: 'MESSAGE'; senderName: string; excerpt: string };

/** Private report → receipt, not a resolution (iOS ReportScreen). Route: /report?targetType=USER|MEAL|MESSAGE&targetId=… */
export function ReportPage() {
  const { state } = useSession();
  const user = state.status === 'signed-in' ? state.session.user.id : 'guest';
  return <ReportContent key={user} />;
}

function ReportContent() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { api, cache } = useApi();
  const { state } = useSession();
  const raw = params.get('targetType') ?? '';
  const targetType = (REPORT_TARGET_TYPES as readonly string[]).includes(raw) ? (raw as Target) : null;
  const targetId = params.get('targetId') ?? '';
  const signedIn = state.status === 'signed-in';
  const [reason, setReason] = useState<Reason | null>(null);
  const [details, setDetails] = useState('');
  const [errors, setErrors] = useState<{ reason?: string | undefined; details?: string | undefined; form?: string | undefined }>({});
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [checking, setChecking] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const intent = useMemo(() => new Intent(api.retry), [api]);
  useDocumentMeta({ title: 'Report · Fancy', robots: 'noindex, nofollow' });

  useEffect(() => {
    // Best effort: the form works without it, and a failed read keeps the generic “a member / a meal”.
    if (!signedIn || !targetId || (targetType !== 'USER' && targetType !== 'MEAL')) return;
    let live = true;
    const read = targetType === 'USER'
      ? api.client.call('getPublicProfile', { params: { userId: targetId } }).then((res): Subject | null => (res.data.profile.id === targetId ? { kind: 'USER', name: res.data.profile.displayName, avatarUrl: res.data.profile.avatarUrl } : null))
      : api.client.call('getMeal', { params: { mealId: targetId } }).then((res): Subject | null => (res.data.meal.id === targetId ? { kind: 'MEAL', title: res.data.meal.title, date: res.data.meal.startsAt.localDate } : null));
    read.then((value) => { if (live && value) setSubject(value); }).catch(() => {});
    return () => { live = false; };
  }, [api, signedIn, targetType, targetId]);

  const cancel = <TextAction onClick={() => (location.key !== 'default' ? navigate(-1) : navigate('/discover'))}>Cancel</TextAction>;
  if (!targetType || !targetId) return <div className="scroll"><TitleBar title="Report" /><FormMessage message="This report link isn’t valid." />{cancel}</div>;
  if (!signedIn) {
    return (
      <div className="scroll">
        <TitleBar title={HEADINGS[targetType]} />
        <p className="prose">Sign in to send a private report.</p>
        <div style={{ marginTop: 16 }}><Primary onClick={() => navigate(signInPath(location.pathname + location.search))}>Sign in</Primary>{cancel}</div>
      </div>
    );
  }
  const cached = targetType === 'MESSAGE' ? messageSubject(cache, targetId) : null;
  const target: Subject | null = cached ? { kind: 'MESSAGE', ...cached } : subject;

  if (receipt) {
    const refresh = async () => {
      setChecking(true);
      setStatusError(null);
      try {
        const fresh = (await api.client.call('reportStatus', { params: { reportId: receipt.id } })).data;
        if (fresh.id === receipt.id) setReceipt(fresh);
      } catch (e) {
        setStatusError(e instanceof ApiError && e.kind === 'network' ? 'We couldn’t check the status. Check your connection and try again.' : 'We couldn’t check the status. Please try again.');
      } finally {
        setChecking(false);
      }
    };
    return (
      <div className="scroll">
        <TitleBar title="Report received" noBack />
        <p className="prose">{`Our team reviews reports privately. The other person isn’t told who reported.${targetType === 'MESSAGE' ? ' The message is now hidden for you.' : ''}`}</p>
        <div className="summary" role="status">
          <span className="muted">Reference number</span>
          <strong style={{ userSelect: 'all' }}>{receipt.receipt}</strong>
          <span className="body">{`Status: ${STATUS_LABELS[receipt.status]}`}</span>
          {receipt.publicOutcome && <span className="body">{receipt.publicOutcome}</span>}
        </div>
        <p className="muted">Keep this reference if you contact support. A receipt is not a decision about the report.</p>
        <TextAction className="inline" disabled={checking} onClick={() => void refresh()}>Check report status</TextAction>
        <FormMessage message={statusError} />
        <div style={{ marginTop: 16, maxWidth: 320 }}><Primary onClick={() => (location.key !== 'default' ? navigate(-1) : navigate('/discover'))}>Done</Primary></div>
      </div>
    );
  }

  const send = async () => {
    const text = details.trim();
    const next: typeof errors = {};
    if (!reason) next.reason = 'Choose what the report is about.';
    if (text.length < 1 || text.length > 1000) next.details = 'Tell us what happened in up to 1,000 characters.';
    setErrors(next);
    if (next.reason || next.details || !reason) return;
    const body = { targetType, targetId, reason, details: text };
    setBusy(true);
    try {
      const created = (await intent.run(body, (key) => api.client.call('createReport', { body, idempotencyKey: key }))).data;
      // The API hides a reported message for its reporter; mirror it in the open chat straight away.
      if (targetType === 'MESSAGE') markMessageReported(cache, targetId);
      setReceipt(created);
    } catch (e) {
      setErrors({ form: e instanceof ApiError && e.kind === 'network' ? 'We couldn’t confirm your report was received. Check your connection and send again — it won’t be duplicated.' : 'We couldn’t send your report. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  const label = target?.kind === 'USER' ? target.name : target?.kind === 'MEAL' ? target.title : target?.kind === 'MESSAGE' ? `Message from ${target.senderName}` : TARGET_LABELS[targetType].replace(/^a /, 'A ');
  return (
    <form className="scroll has-footer" noValidate onSubmit={(e) => { e.preventDefault(); void send(); }}>
      <TitleBar title={HEADINGS[targetType]} />
      <div className="sum" style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'var(--surface)' }} aria-label={`Reporting ${label}`} role="group">
        {target?.kind === 'USER' ? <Avatar name={target.name} url={target.avatarUrl} size={36} /> : (
          <span className="av" style={{ width: 36, height: 36, background: 'var(--selected)' }} aria-hidden="true">
            {targetType === 'MEAL' ? <CalendarIcon /> : targetType === 'MESSAGE' ? <ChatBubbleIcon /> : <PersonIcon />}
          </span>
        )}
        <span style={{ minWidth: 0 }}>
          <span className="muted" style={{ display: 'block' }}>Reporting</span>
          <b style={{ fontSize: 14, display: 'block' }}>{label}</b>
          {target?.kind === 'MEAL' && <span className="muted">{longDate(target.date)}</span>}
          {target?.kind === 'MESSAGE' && <span className="muted">{`“${target.excerpt}”`}</span>}
        </span>
      </div>
      <p className="prose" style={{ marginBottom: 14 }}>{`Reports about ${TARGET_LABELS[targetType]} are private and separate from public references. You’ll get a reference number.`}</p>
      <ChoiceGroup<Reason> label="What’s it about?" required options={REASON_OPTIONS} value={reason} onChange={(v) => { setReason(v); setErrors((e) => ({ ...e, reason: undefined })); }} error={errors.reason} />
      <Field label="What would you like us to know?" required strong hint="Up to 1,000 characters." counter={`${details.length}/1,000`} error={errors.details}>
        {(p) => <textarea {...p} className="textarea" rows={6} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} />}
      </Field>
      <p className="muted">In an emergency, call 999.</p>
      <div className="footer">
        <FormMessage message={errors.form} />
        <Primary type="submit" busy={busy}>Submit report</Primary>
        {cancel}
      </div>
    </form>
  );
}
