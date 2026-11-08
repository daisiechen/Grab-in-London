import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { ApiError, newIntentKey, type ResponseOf } from '@fancy/client';
import { ChatBubbleIcon, CheckIcon, ChevronRightIcon, HeartFilledIcon, HeartIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import { useApi } from '../../api/ApiProvider.tsx';
import { useSession } from '../../api/session.tsx';
import { useQuery } from '../../api/useQuery.ts';
import { errorMessage } from '../../api/errors.ts';
import { longDate } from '../../lib/london.ts';
import { signInPath } from '../../lib/returnTo.ts';
import { useDocumentMeta } from '../../seo/useDocumentMeta.ts';
import { Avatar, ChoiceGroup, Field, FormMessage, Loading, Primary, TextAction, TitleBar } from '../../ui/components.tsx';
import { Sheet } from '../../ui/Sheet.tsx';

type PostMeal = ResponseOf<'postMealState'>['data'];
type Attendance = PostMeal['attendance'][number];
type AttendanceValue = 'present' | 'absent';
/** Save feedback shown right under the control it belongs to (one per section / tablemate). */
type SaveNote = { kind: 'saving' | 'saved' | 'error'; text: string };

/**
 * Version to send for a record that may not exist yet. CONTRACT GAP (as iOS): the PUT operations
 * require If-Match but PostMealState has no version for a not-yet-created row; "0" means “create”.
 */
export const NEW_RECORD_VERSION = '0';

/** UNKNOWN (nobody reported) is distinct from absent; SELF beats HOST and the page says so (iOS attendanceText). */
export function attendanceText(a: Attendance | undefined, self = false): string {
  if (!a || a.value === 'unknown') return 'Not reported yet';
  const who = a.source === 'SELF' ? (self ? 'you reported' : 'they reported') : a.source === 'HOST' ? 'host reported' : 'support corrected';
  return `${a.value === 'present' ? 'Came' : 'Didn’t come'} · ${who}`;
}

/** Why references and meet-again aren't open for this tablemate yet (their attendance isn't present). */
export function mateAttendanceReason(name: string, value: 'absent' | 'unknown', host: boolean): string {
  if (value === 'absent') return `${name} didn’t attend this meal, so a reference or meeting again isn’t available.`;
  return host
    ? `${name} hasn’t confirmed attending yet. Report their attendance above, or wait for them to confirm, to leave a reference or choose to meet again.`
    : `${name} hasn’t confirmed attending yet. You can leave a reference or choose to meet again once they do.`;
}

const referenceStatus = (visibility: 'PENDING' | 'PUBLISHED' | 'WITHDRAWN') =>
  visibility === 'PUBLISHED' ? 'Your reference is published on their profile.' : visibility === 'PENDING' ? 'Your reference is waiting to be published.' : 'Your reference was withdrawn and isn’t shown.';
const CLOSES = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });

/**
 * After the meal (iOS PostMealScreen; T13 attendance + private experience, T14 public reference,
 * T15 private reconnect). Choices save as they are made, each with its own revision (first write
 * If-Match "0"); the result shows next to the control. The other person's reconnect choice is
 * never shown: only OPEN (mutual) unlocks the direct conversation.
 */
export function PostMealPage() {
  const { mealId = '' } = useParams();
  const { api } = useApi();
  const { state } = useSession();
  const navigate = useNavigate();
  useDocumentMeta({ title: 'After the meal · Fancy', robots: 'noindex, nofollow' });
  const me = state.status === 'signed-in' ? state.session.user : null;
  const q = useQuery<PostMeal>(me ? `postMeal:${mealId}` : null, async (c) => (await c.call('postMealState', { params: { mealId } })).data);
  const detail = useQuery<ResponseOf<'getMeal'>['data']>(me ? `meal:${mealId}:${me.id}` : null, async (c) => (await c.call('getMeal', { params: { mealId } })).data);
  const [notes, setNotes] = useState<Record<string, SaveNote>>({});
  const note = (section: string, value: SaveNote | null) => setNotes((cur) => { const next = { ...cur }; if (value) next[section] = value; else delete next[section]; return next; });
  const [busy, setBusy] = useState<string | null>(null);
  const [score, setScore] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Record<string, string>>({});
  const [mateId, setMateId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<{ subjectId: string; version: string } | null>(null);
  const [hostChoices, setHostChoices] = useState<Record<string, AttendanceValue>>({});
  const [pendingHost, setPendingHost] = useState<{ subjectId: string; value: AttendanceValue; version: string } | null>(null);
  const [hostError, setHostError] = useState<string | null>(null);
  const keys = useRef(new Map<string, string>());
  const key = (intent: string) => {
    if (!keys.current.has(intent)) keys.current.set(intent, newIntentKey());
    return keys.current.get(intent)!;
  };
  useEffect(() => { setScore(null); }, [q.data?.experience?.version]);

  if (state.status === 'guest') return <Navigate to={signInPath(`/post-meal/${mealId}`)} replace />;
  if (!q.data) {
    return (
      <div className="scroll">
        <TitleBar title="How was your table?" back="/meals?section=PAST" />
        {q.error ? <><FormMessage message={errorMessage(q.error)} /><div className="mt8"><Primary secondary onClick={() => void q.reload()}>Try again</Primary></div></> : <Loading />}
      </div>
    );
  }
  const s = q.data;
  const meal = detail.data?.meal;
  const meId = me?.id ?? null;
  const nameOf = (subjectId: string) => (subjectId === meId ? 'You' : s.eligibleMembers.find((m) => m.id === subjectId)?.displayName ?? 'Member');
  const myAttendance = s.attendance.find((a) => a.subjectId === meId);
  const attended = myAttendance?.value === 'present';
  const isHost = !!meal && meal.id === mealId && meal.host.id === meId;

  /** Every write saves on its own; its outcome is shown in `section`, next to the control. */
  const run = async (section: string, intent: string, op: (k: string) => Promise<unknown>, success = 'Saved'): Promise<boolean> => {
    setBusy(intent);
    note(section, { kind: 'saving', text: 'Saving…' });
    try {
      await op(key(intent));
      keys.current.delete(intent);
      note(section, { kind: 'saved', text: success });
      await q.reload();
      return true;
    } catch (e) {
      if (e instanceof ApiError && !e.retryable) keys.current.delete(intent);
      note(section, {
        kind: 'error',
        text: e instanceof ApiError && e.kind === 'conflict' ? 'This changed a moment ago or the feedback window has closed. We’ve refreshed it.'
          : e instanceof ApiError && e.kind === 'forbidden' ? 'This action isn’t available to you right now.'
            : e instanceof ApiError && e.kind === 'network' ? 'We couldn’t confirm this with Fancy. Check your connection and try again.'
              : 'Something went wrong. Please try again.',
      });
      if (e instanceof ApiError && e.kind === 'conflict') await q.reload();
      return false;
    } finally {
      setBusy(null);
    }
  };

  const others = s.eligibleMembers.filter((m) => m.id !== meId);
  const mate = others.find((m) => m.id === mateId) ?? others[0] ?? null;
  const selfReport = (value: AttendanceValue, a: Attendance) => void run('att', `att:${a.subjectId}:${value}:${a.version}`, (k) => api.client.call('reportAttendance', { params: { mealId, subjectId: a.subjectId }, body: { value }, idempotencyKey: k, ifMatch: a.version }));
  /** Choosing a score saves it; a failed save falls back to the last saved score. */
  const saveScore = async (value: string) => {
    if (busy !== null) return;
    setScore(value);
    const version = s.experience?.version ?? NEW_RECORD_VERSION;
    const saved = await run('exp', `exp:${value}:${version}`, (k) => api.client.call('rateExperience', { params: { mealId }, body: { score: Number(value) }, idempotencyKey: k, ifMatch: version }));
    if (!saved) setScore(null);
  };
  const reportGuest = async () => {
    if (!pendingHost || !isHost || !s.windowOpen || busy !== null) return;
    const pending = pendingHost;
    setHostError(null);
    const ok = await run('host', `host-att:${pending.subjectId}:${pending.value}:${pending.version}`,
      (k) => api.client.call('reportAttendance', { params: { mealId, subjectId: pending.subjectId }, body: { value: pending.value }, ifMatch: pending.version, idempotencyKey: k }),
      'Host report saved. Each member’s own report takes priority.');
    if (ok) setPendingHost(null);
    else setHostError('We couldn’t save this host report. Your selection is kept.');
  };
  const openDirect = async (subjectId: string) => {
    setBusy(`direct:${subjectId}`);
    note(`rc:${subjectId}`, null);
    try {
      const conversation = (await api.client.call('getDirect', { params: { subjectId } })).data;
      navigate(`/chat/${conversation.id}`);
    } catch {
      note(`rc:${subjectId}`, { kind: 'error', text: 'This conversation isn’t available right now.' });
    } finally {
      setBusy(null);
    }
  };
  const revoke = async () => {
    if (!revoking) return;
    const target = revoking;
    await run(`rc:${target.subjectId}`, `revoke:${target.subjectId}:${target.version}`, (k) => api.client.call('revokeConnection', { params: { subjectId: target.subjectId }, idempotencyKey: k, ifMatch: target.version }), 'Connection withdrawn. Private messages are now read-only.');
    setRevoking(null);
  };

  const mateBlock = attended && s.windowOpen && mate ? (() => {
    const existing = s.reviews.find((r) => r.subjectId === mate.id);
    const body = reviews[mate.id] ?? '';
    const r = s.reconnect.find((row) => row.subjectId === mate.id);
    // PRD §0.5: a reference or a meet-again choice needs the tablemate's own valid attendance too.
    const mateAttendance = s.attendance.find((a) => a.subjectId === mate.id)?.value ?? 'unknown';
    return (
      <section aria-labelledby="pm-mate">
        <h2 id="pm-mate">{`Sharing a table with ${mate.displayName}`}</h2>
        {others.length > 1 ? <ChoiceGroup<string> label="Choose a tablemate" value={mate.id} options={others.map((m) => [m.id, m.displayName] as const)} onChange={setMateId} /> : null}
        {mateAttendance !== 'present' ? <Note>{mateAttendanceReason(mate.displayName, mateAttendance, isHost)}</Note> : (
          <>
            <Field label="A public reference · optional" counter={`${body.length}/500`}
              hint={existing ? referenceStatus(existing.visibility) : 'Describe the shared experience, rather than rating a person.'}>
              {(p) => <textarea {...p} className="textarea" rows={4} maxLength={500} placeholder="What was it like sharing a table?" value={body}
                onChange={(e) => { setReviews({ ...reviews, [mate.id]: e.target.value }); if (notes[`rev:${mate.id}`]?.kind !== 'saving') note(`rev:${mate.id}`, null); }} />}
            </Field>
            <p className="muted">References appear after both people submit, or after 7 days. Private feedback is separate.</p>
            <div className="mt8">
              <Primary secondary disabled={!body.trim() || busy !== null}
                onClick={() => void run(`rev:${mate.id}`, `rev:${mate.id}:${existing?.version ?? NEW_RECORD_VERSION}:${body.trim()}`, (k) => api.client.call('reviewPerson', { params: { mealId, subjectId: mate.id }, body: { body: body.trim() }, idempotencyKey: k, ifMatch: existing?.version ?? NEW_RECORD_VERSION }), 'Reference saved')
                  .then((ok) => { if (ok) setReviews((cur) => ({ ...cur, [mate.id]: '' })); })}>
                {`Save reference for ${mate.displayName}`}
              </Primary>
              <SaveStatus note={notes[`rev:${mate.id}`]} />
            </div>
            {r ? (
              <>
                <label className={`reconnect${r.selected ? ' on' : ''}`}>
                  <input type="checkbox" checked={r.selected} disabled={busy !== null} aria-label={`I’d like to share a table again with ${mate.displayName}`}
                    onChange={() => {
                      if (r.selected && r.connection === 'OPEN') setRevoking({ subjectId: r.subjectId, version: r.version });
                      else void run(`rc:${r.subjectId}`, `rc:${r.subjectId}:${!r.selected}:${r.version}`, (k) => api.client.call('selectReconnect', { params: { mealId, subjectId: r.subjectId }, body: { selected: !r.selected }, idempotencyKey: k, ifMatch: r.version }), 'Saved privately');
                    }} />
                  <span className="mid"><b>I’d like to share a table again</b><span>Private unless you both choose this.</span></span>
                  {r.selected ? <HeartFilledIcon aria-hidden="true" /> : <HeartIcon aria-hidden="true" />}
                </label>
                <SaveStatus note={notes[`rc:${mate.id}`]} />
                {r.connection === 'OPEN' ? (
                  <>
                    <div className="summary"><strong>{`You and ${mate.displayName} both want to meet again.`}</strong><p className="muted">A private conversation is open between you.</p></div>
                    <Primary disabled={busy !== null} onClick={() => void openDirect(mate.id)}><ChatBubbleIcon aria-hidden="true" /> {`Say hello to ${mate.displayName}`}</Primary>
                  </>
                ) : <p className="muted mt8">{r.selected ? `Your choice is private. ${mate.displayName} is never told unless they choose you too.` : 'Only a mutual choice opens a private conversation. A one-sided choice is never shown to anyone.'}</p>}
              </>
            ) : null}
          </>
        )}
      </section>
    );
  })() : null;

  return (
    <div className="scroll pm">
      <TitleBar title="How was your table?" subtitle={meal ? `${meal.title} · ${longDate(meal.startsAt.localDate)}` : undefined} back="/meals?section=PAST" />
      <p className="prose">A little feedback helps the next person feel welcome. Choices save as you make them.</p>
      {!s.windowOpen ? <Note>The feedback window for this meal has closed.</Note> : null}

      <div className="pmgrid">
        <div>
          <section aria-labelledby="pm-att">
            <h2 id="pm-att">Your attendance</h2>
            <p className="muted">Your own report takes priority. If you haven’t reported, we use your host’s report. No report means unknown.</p>
            {s.windowOpen && myAttendance ? (
              <ChoiceGroup<AttendanceValue> label="Your attendance" value={myAttendance.selfValue} disabled={() => busy !== null}
                options={[['present', 'I attended'], ['absent', 'I didn’t attend']]} onChange={(v) => selfReport(v, myAttendance)} />
            ) : null}
            <SaveStatus note={notes.att} />
            <p className="muted">{`Reporting closes ${CLOSES.format(new Date(s.windowClosesAt))}`}</p>
          </section>

          <section aria-labelledby="pm-table">
            <h2 id="pm-table">At the table</h2>
            <ul className="people-list">
              {s.attendance.map((a) => {
                const member = s.eligibleMembers.find((m) => m.id === a.subjectId);
                const inner = (
                  <>
                    <Avatar name={member?.displayName ?? nameOf(a.subjectId)} url={member?.avatarUrl ?? null} size={34} />
                    <span className="nm"><b>{nameOf(a.subjectId)}</b>{` · ${attendanceText(a, a.subjectId === meId)}`}</span>
                  </>
                );
                return (
                  <li key={a.subjectId}>
                    {member && a.subjectId !== meId
                      ? <Link to={`/profiles/${member.id}`} aria-label={`View ${member.displayName}’s profile`}>{inner}<ChevronRightIcon aria-hidden="true" /></Link>
                      : <div className="row">{inner}</div>}
                  </li>
                );
              })}
              {others.filter((m) => !s.attendance.some((a) => a.subjectId === m.id)).map((member) => (
                <li key={member.id}>
                  <Link to={`/profiles/${member.id}`} aria-label={`View ${member.displayName}’s profile`}>
                    <Avatar name={member.displayName} url={member.avatarUrl} size={34} />
                    <span className="nm"><b>{member.displayName}</b></span>
                    <ChevronRightIcon aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {isHost && s.windowOpen ? (
            <section aria-labelledby="pm-host">
              <h2 id="pm-host">Report your table’s attendance</h2>
              <p className="muted">Report facts, not ratings. Each member’s own report takes priority over your host report. Unreported attendance stays unknown.</p>
              <SaveStatus note={notes.host} />
              {others.map((member) => {
                const a = s.attendance.find((row) => row.subjectId === member.id);
                const version = a?.version ?? NEW_RECORD_VERSION;
                const hostValue = a?.hostValue ?? null;
                return (
                  <div className="host-att" key={member.id}>
                    <p className="body"><b>{member.displayName}</b>{` · Your host report: ${hostValue === 'present' ? 'came' : hostValue === 'absent' ? 'didn’t come' : 'not reported'}`}</p>
                    <div className="host-att-row">
                      <ChoiceGroup<AttendanceValue> label={`Host report for ${member.displayName}`} value={hostChoices[member.id] ?? null}
                        options={[['present', `${member.displayName} came`], ['absent', `${member.displayName} didn’t come`]]}
                        onChange={(value) => setHostChoices((prev) => ({ ...prev, [member.id]: value }))} />
                      <Primary secondary className="small inline" aria-label={`Review attendance for ${member.displayName}`} disabled={!hostChoices[member.id] || busy !== null}
                        onClick={() => { const value = hostChoices[member.id]; if (value) { setHostError(null); setPendingHost({ subjectId: member.id, value, version }); } }}>Review</Primary>
                    </div>
                  </div>
                );
              })}
            </section>
          ) : null}
        </div>

        <div>
          {s.windowOpen ? (
            <section aria-labelledby="pm-exp">
              <h2 id="pm-exp">Meal experience · private</h2>
              <p className="muted">About the whole meal, separate from your thoughts about any one person. Only authorised staff can see it.</p>
              {attended ? (
                <>
                  <ChoiceGroup<string> label="How was the meal?" value={score ?? (s.experience ? String(s.experience.score) : null)} disabled={() => busy !== null}
                    options={['1', '2', '3', '4', '5'].map((n) => [n, n] as const)} onChange={(v) => void saveScore(v)} />
                  <SaveStatus note={notes.exp} />
                </>
              ) : <Note>Confirm that you attended within the reporting window to share your meal experience.</Note>}
            </section>
          ) : null}

          {mateBlock}

          <div className="pm-links">
            {attended && s.windowOpen && mate ? <Link className="link underline" to={`/report?targetType=USER&targetId=${mate.id}`}>Share private feedback or report a concern</Link> : null}
            <Link className="link underline" to="/survey">Help shape Fancy: product survey</Link>
          </div>
        </div>
      </div>

      <Sheet open={pendingHost !== null} onOpenChange={(o) => { if (!o) setPendingHost(null); }} title={`Report attendance for ${pendingHost ? nameOf(pendingHost.subjectId) : 'member'}?`}>
        <p className="body">{pendingHost ? `${nameOf(pendingHost.subjectId)} ${pendingHost.value === 'present' ? 'came' : 'didn’t come'}.` : 'Review this fact.'}</p>
        <p className="body">This saves your host report only. The member’s own report takes priority. This is separate from ratings.</p>
        <FormMessage message={hostError} />
        <Primary secondary onClick={() => setPendingHost(null)}>Keep editing</Primary>
        <Primary disabled={busy !== null || !s.windowOpen} onClick={() => void reportGuest()}>Confirm attendance report</Primary>
      </Sheet>
      <Sheet open={revoking !== null} onOpenChange={(o) => { if (!o) setRevoking(null); }} title="Withdraw your connection?">
        <p className="body">Private messages will stop. Your earlier messages remain available. You will both need to choose again to reconnect.</p>
        <Primary secondary onClick={() => setRevoking(null)}>Keep things as they are</Primary>
        <TextAction danger disabled={busy !== null} onClick={() => void revoke()}>Withdraw connection</TextAction>
      </Sheet>
    </div>
  );
}

/** Compact read-only note. */
function Note({ children }: { children: string }) {
  return <p className="pm-note"><InfoCircledIcon aria-hidden="true" /><span>{children}</span></p>;
}

/** Inline save outcome under the control it belongs to: “Saving…”, a ticked “Saved”, or the error. */
function SaveStatus({ note }: { note: SaveNote | undefined }) {
  if (!note) return null;
  if (note.kind === 'error') return <FormMessage message={note.text} />;
  return <p className={`save-note${note.kind === 'saving' ? ' saving' : ''}`} role="status">{note.kind === 'saved' ? <CheckIcon aria-hidden="true" /> : null}{note.text}</p>;
}
