import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ApiError, type ResponseOf } from '@fancy/client';
import { ChatBubbleIcon, CheckIcon, HeartIcon } from '@radix-ui/react-icons';
import { useApi } from '../../api/ApiProvider.tsx';
import { useSession } from '../../api/session.tsx';
import { useQuery } from '../../api/useQuery.ts';
import { Intent } from '../../api/webApi.ts';
import { errorMessage } from '../../api/errors.ts';
import type { MealDetail } from '../../api/types.ts';
import { longDate } from '../../lib/format.ts';
import { signInPath } from '../../lib/returnTo.ts';
import { Avatar, ChoiceGroup, Field, FormError, Loading, Notice, PageHeader, Primary, PrimaryLink, TextAction } from '../../ui/components.tsx';
import { ConfirmSheet } from '../../ui/ConfirmSheet.tsx';
import { useToast } from '../../ui/toast.tsx';
import { ReportSheet } from '../reports/ReportSheet.tsx';

type PostMeal = ResponseOf<'postMealState'>['data'];
type Attendance = PostMeal['attendance'][number];
type AttendanceValue = 'present' | 'absent';

const london = (iso: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' }).format(new Date(iso));

/** Unknown is its own state: no report is never shown as attended or absent (T13). */
export function attendanceStatus(a: Attendance | undefined): string {
  if (!a || a.value === 'unknown') return 'Unknown · no report yet';
  const v = a.value === 'present' ? 'Attended' : 'Didn’t attend';
  if (a.source === 'SELF') return `${v} · your report`;
  if (a.source === 'HOST') return `${v} · reported by your host. Your own report takes priority.`;
  return `${v} · corrected by support`;
}

const VISIBILITY: Record<PostMeal['reviews'][number]['visibility'], string> = {
  PENDING: 'Your reference is waiting to be published. References appear after both people submit, or after 7 days.',
  PUBLISHED: 'Your reference is published on their profile.',
  WITHDRAWN: 'Your reference isn’t shown publicly.',
};

/**
 * After the meal (T13 attendance + private experience, T14 public reference, T15 private
 * reconnect). Every write carries the object's own revision (first write If-Match "0"). The
 * other person's reconnect choice is never shown: WAITING reads the same whether or not
 * they chose, and only OPEN (mutual) unlocks the direct conversation.
 */
export function PostMealPage() {
  const { mealId = '' } = useParams();
  const { api } = useApi();
  const { state } = useSession();
  const navigate = useNavigate();
  const notify = useToast();
  const me = state.status === 'signed-in' ? state.session.user : null;
  const pm = useQuery<PostMeal>(me ? `postMeal:${mealId}` : null, async (c) => (await c.call('postMealState', { params: { mealId } })).data);
  const meal = useQuery<MealDetail>(me ? `meal:${mealId}:${me.id}` : null, async (c) => (await c.call('getMeal', { params: { mealId } })).data);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [review, setReview] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<'' | 'revoke' | 'report'>('');
  const intent = useMemo(() => new Intent(api.retry), [api]);

  const others = useMemo(() => (pm.data?.eligibleMembers ?? []).filter((m) => m.id !== me?.id), [pm.data, me]);
  useEffect(() => { if (!subjectId && others[0]) setSubjectId(others[0].id); }, [others, subjectId]);

  if (state.status === 'loading') return <Loading />;
  if (state.status === 'guest') return <div className="body-pad"><PrimaryLink to={signInPath(`/post-meal/${mealId}`)}>Sign in to continue</PrimaryLink></div>;
  if (!pm.data) return pm.error ? <><PageHeader title="After the meal" backTo="/meals?section=PAST" /><div className="body-pad"><FormError>{errorMessage(pm.error)}</FormError></div></> : <Loading />;

  const data = pm.data;
  const m = meal.data?.meal;
  const isHost = !!m && m.host.id === me?.id;
  const mine = data.attendance.find((a) => a.subjectId === me?.id);
  const subject = others.find((o) => o.id === subjectId) ?? null;
  const myReview = data.reviews.find((r) => r.subjectId === subjectId);
  const reconnect = data.reconnect.find((r) => r.subjectId === subjectId);

  const write = async <T,>(fingerprint: unknown, run: (key: string) => Promise<T>, done: string) => {
    setBusy(true);
    setError('');
    try {
      await intent.run(fingerprint, run);
      notify(done);
      await pm.reload();
      return true;
    } catch (e) {
      setError(errorMessage(e));
      if (e instanceof ApiError && e.kind === 'conflict') await pm.reload();
      return false;
    } finally {
      setBusy(false);
    }
  };

  const report = (subject: string, value: AttendanceValue) => {
    const current = data.attendance.find((a) => a.subjectId === subject);
    const version = current?.version ?? '0';
    void write({ subject, value, version }, (key) =>
      api.client.call('reportAttendance', { params: { mealId, subjectId: subject }, body: { value }, ifMatch: version, idempotencyKey: key }),
    subject === me?.id ? 'Your attendance report is saved.' : 'Attendance report saved. Each member’s own report takes priority.');
  };

  const rate = (score: number) => {
    const version = data.experience?.version ?? '0';
    void write({ score, version }, (key) =>
      api.client.call('rateExperience', { params: { mealId }, body: { score }, ifMatch: version, idempotencyKey: key }),
    'Thank you. Your private meal experience is saved.');
  };

  const saveReview = async () => {
    if (!subjectId) return;
    const body = review.trim();
    if (!body || body.length > 500) { setError('Write a reference of up to 500 characters.'); return; }
    const version = myReview?.version ?? '0';
    if (await write({ subjectId, body, version }, (key) =>
      api.client.call('reviewPerson', { params: { mealId, subjectId }, body: { body }, ifMatch: version, idempotencyKey: key }), 'Reference saved.')) setReview('');
  };

  const choose = (selected: boolean) => {
    if (!subjectId) return;
    if (!selected && reconnect?.connection === 'OPEN') { setSheet('revoke'); return; }
    const version = reconnect?.version ?? '0';
    void write({ subjectId, selected, version }, (key) =>
      api.client.call('selectReconnect', { params: { mealId, subjectId }, body: { selected }, ifMatch: version, idempotencyKey: key }),
    'Saved. Your reconnect choice stays private.');
  };

  const revoke = async () => {
    if (!subjectId || !reconnect) return;
    if (await write({ revoke: subjectId, v: reconnect.version }, (key) =>
      api.client.call('revokeConnection', { params: { subjectId }, ifMatch: reconnect.version, idempotencyKey: key }),
    'Connection withdrawn. Private messages are now read-only.')) setSheet('');
  };

  const openDirect = async () => {
    if (!subjectId) return;
    try {
      const res = await api.client.call('getDirect', { params: { subjectId } });
      navigate(`/inbox/${res.data.id}`);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const canRate = data.windowOpen && mine?.value === 'present';

  return (
    <>
      <PageHeader title="After the meal" backTo="/meals?section=PAST" />
      <div className="body-pad">
        <h1>{data.reviews.length ? 'Good company stays with you.' : 'How was your table?'}</h1>
        <p className="prose">A little feedback helps the next person feel welcome.</p>
        {m && <p className="muted">{m.title} · {longDate(m.startsAt.localDate)}</p>}

        <section aria-label="Attendance and meal experience">
          <h2>Your attendance</h2>
          <p className="muted">Your report takes priority. If you haven’t reported, we use your host’s report. No report means unknown.</p>
          {data.windowOpen && mine ? (
            <ChoiceGroup<AttendanceValue> label="Your attendance" value={mine.selfValue}
              options={[['present', 'I attended'], ['absent', 'I didn’t attend']]} onChange={(v) => report(mine.subjectId, v)} />
          ) : (
            <Notice>{!mine ? 'This meal isn’t eligible for attendance feedback.' : 'The 7-day reporting window has closed or hasn’t opened yet. Contact support to correct your attendance.'}</Notice>
          )}
          <p className="muted">Attendance: {attendanceStatus(mine)} · Reporting closes {london(data.windowClosesAt)}</p>

          {isHost && data.windowOpen && (
            <fieldset className="filter-section">
              <legend>Report your table’s attendance</legend>
              <p className="muted">Each member’s own report takes priority.</p>
              {others.map((o) => {
                const a = data.attendance.find((x) => x.subjectId === o.id);
                return (
                  <ChoiceGroup<AttendanceValue> key={o.id} label={o.displayName} value={a?.hostValue ?? null}
                    options={[['present', 'Attended'], ['absent', 'Didn’t attend']]} onChange={(v) => report(o.id, v)} />
                );
              })}
            </fieldset>
          )}

          <h2>Meal experience · private</h2>
          <p className="muted">About the whole meal, separate from your thoughts about any one person. Only authorised staff can see this feedback.</p>
          {canRate ? (
            <ChoiceGroup<string> label="How was the meal?" value={data.experience ? String(data.experience.score) : null}
              options={[1, 2, 3, 4, 5].map((n) => [String(n), String(n)] as const)} onChange={(v) => rate(Number(v))} />
          ) : <Notice>Confirm that you attended within the reporting window to share your meal experience.</Notice>}
          {data.experience && <p role="status" className="muted">Your private meal experience is saved.</p>}
        </section>

        {!!others.length && (
          <>
            <h2>Sharing a table with {subject?.displayName ?? 'your tablemates'}</h2>
            {others.length > 1 && (
              <ChoiceGroup<string> label="Choose a tablemate" value={subjectId} options={others.map((o) => [o.id, o.displayName] as const)}
                onChange={(id) => { setSubjectId(id); setReview(''); setError(''); }} />
            )}
            {subject && (
              <div className="host-line">
                <Avatar name={subject.displayName} url={subject.avatarUrl} size={46} />
                <div><strong>{subject.displayName}</strong></div>
              </div>
            )}
            {myReview && <div className="summary-box"><strong>Your reference</strong><p>{VISIBILITY[myReview.visibility]}</p></div>}
            {data.windowOpen && (
              <>
                <Field label={myReview ? 'Update your public reference' : 'A public reference · optional'} hint={`Describe the shared experience, rather than rating a person. ${review.length}/500`}>
                  {(p) => <textarea {...p} rows={4} maxLength={500} placeholder="What was it like sharing a table?" value={review} onChange={(e) => setReview(e.target.value)} />}
                </Field>
                <Primary secondary disabled={busy || !review.trim()} onClick={() => void saveReview()}>Save reference <CheckIcon /></Primary>
                <label className="check-row reconnect">
                  <input type="checkbox" checked={reconnect?.selected ?? false} disabled={busy} onChange={(e) => choose(e.target.checked)} />
                  <span><strong>I’d like to share a table again</strong><small>Private unless you both choose this.</small></span>
                  <HeartIcon />
                </label>
              </>
            )}
            {reconnect?.selected && reconnect.connection === 'WAITING' && <p className="muted">Your wish to meet again is private until mutual.</p>}
            {reconnect?.connection === 'OPEN' && (
              <>
                <Notice icon={<HeartIcon />}>You and {subject?.displayName} both want to meet again.</Notice>
                <Primary onClick={() => void openDirect()}>Say hello to {subject?.displayName} <ChatBubbleIcon /></Primary>
                <TextAction danger onClick={() => setSheet('revoke')}>Withdraw connection</TextAction>
              </>
            )}
          </>
        )}
        <FormError>{error}</FormError>
        {subject && <TextAction onClick={() => setSheet('report')}>Share private feedback or report a concern</TextAction>}
      </div>
      <ConfirmSheet open={sheet === 'revoke'} onOpenChange={(o) => !o && setSheet('')} title="Withdraw your connection?" confirmLabel="Withdraw connection" error={error} onConfirm={() => void revoke()}>
        <p>Private messages will stop. Your earlier messages remain available. You will both need to choose again to reconnect.</p>
      </ConfirmSheet>
      {subject && <ReportSheet open={sheet === 'report'} onOpenChange={(o) => setSheet(o ? 'report' : '')} target={{ type: 'USER', id: subject.id, label: subject.displayName }} />}
    </>
  );
}
