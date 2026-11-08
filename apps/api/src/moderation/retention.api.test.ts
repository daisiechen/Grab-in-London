/**
 * Safety-record retention after account deletion (owner decision 2026-10-29: 12 months, then delete).
 * Evidence about or reported by a deleted member stays readable to support staff with a case grant,
 * and the worker redacts it once the case is closed and the retention period has passed.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import type { Job } from '@fancy/db';
import { Browser, createHarness, json, type Harness } from '../test/harness.ts';
import { DEFAULT_SAFETY_RECORD_DAYS, purgeExpiredSafetyRecords, REMOVED_SUPPORT_TEXT } from '../support/privacy.ts';
import { deletionHandler, UnavailableDeletionProvider } from '../../../worker/src/handlers/deletion.ts';

let h: Harness;
beforeAll(async () => { h = await createHarness(inject('pgServerUrl')); });
afterAll(async () => { await h.close(); });

type Member = { b: Browser; id: string };
async function member(): Promise<Member> {
  const b = new Browser(h); const { body } = await b.signInWithEmail(`${randomUUID()}@example.invalid`);
  return { b, id: body.data.session.user.id as string };
}
async function staff(): Promise<Member> {
  const s = await member();
  await h.db.pool.query(`INSERT INTO roles(user_id,role,granted_by) VALUES($1,'support','test')`, [s.id]);
  await h.db.pool.query(`UPDATE session_families SET amr=ARRAY['otp','mfa'] WHERE user_id=$1`, [s.id]);
  return s;
}
const key = () => ({ 'idempotency-key': randomUUID() });
const DETAILS = 'RETAINED_REPORT_TEXT: synthetic concern kept as a safety record.';
async function reported(m: Member, targetType: 'USER' | 'MEAL' | 'MESSAGE', targetId: string): Promise<string> {
  const r = await m.b.request('POST', '/v1/reports', { headers: key(), body: { targetType, targetId, reason: 'private_concern', details: DETAILS } });
  expect(r.statusCode, r.body).toBe(201); return json(r).data.id as string;
}
async function claimed(s: Member, reportId: string) {
  const r = await s.b.request('POST', `/v1/moderation/reports/${reportId}/claim`, { headers: key() }); expect(r.statusCode, r.body).toBe(200); return json(r).data;
}
const act = (s: Member, reportId: string, version: string, body: Record<string, unknown>) =>
  s.b.request('POST', `/v1/moderation/reports/${reportId}/actions`, { headers: { ...key(), 'if-match': `"${version}"` }, body: { note: 'STAFF_NOTE_SENTINEL reviewed against the guidelines.', ...body } });
const detail = async (s: Member, reportId: string) => { const r = await s.b.request('GET', `/v1/moderation/reports/${reportId}`); expect(r.statusCode, r.body).toBe(200); return json(r).data; };
async function profile(userId: string) {
  await h.db.pool.query(`INSERT INTO profiles(user_id,display_name,bio,languages,life_status,interests) VALUES($1,'Retained Member','PROFILE_SENTINEL bio that a reporter flagged.',ARRAY['en'],'NEW_TO_LONDON',ARRAY['FOOD'])`, [userId]);
}
async function chat(members: Member[], lines: Array<[number, string]>) {
  const { rows: [v] } = await h.db.pool.query(`INSERT INTO venues(place_id,provider) VALUES($1,'fixture') RETURNING id`, [`fixture_${randomUUID()}`]);
  const { rows: [m] } = await h.db.pool.query(`INSERT INTO meals(host_id,venue_ref,title,description,starts_at,closes_at,scheduled_end_at,start_local_date,start_local_time,start_offset,close_local_date,close_local_time,close_offset,minimum,capacity,budget_min_pence,budget_max_pence,languages,mood,booking_mode,terms_version,attempt_id,status)
    VALUES($1,$2,'Retention fixture supper','A synthetic meal used by the retention tests only.',now()-interval '3 day',now()-interval '4 day',now()-interval '3 day'+interval '2 hour','2026-10-01','19:00',0,'2026-10-01','18:00',0,2,4,1000,2000,ARRAY['en'],'EASY_CONVERSATION','EXTERNAL_PAY_AT_VENUE','2026-10-21',$3,'COMPLETED') RETURNING id`, [members[0]!.id, v.id, randomUUID()]);
  const { rows: [c] } = await h.db.pool.query(`INSERT INTO conversations(kind,meal_id) VALUES('GROUP',$1) RETURNING id`, [m.id]);
  let seq = 0;
  for (const x of members) { seq++; await h.db.pool.query(`INSERT INTO conversation_events(conversation_id,seq,kind,actor_id,effective_at) VALUES($1,$2,'JOIN',$3,clock_timestamp())`, [c.id, seq, x.id]); await h.db.pool.query(`INSERT INTO membership_intervals(conversation_id,user_id,join_seq) VALUES($1,$2,$3)`, [c.id, x.id, seq]); }
  const ids: string[] = [];
  for (const [sender, text] of lines) {
    seq++;
    await h.db.pool.query(`INSERT INTO conversation_events(conversation_id,seq,kind,actor_id,effective_at) VALUES($1,$2,'MESSAGE',$3,clock_timestamp())`, [c.id, seq, members[sender]!.id]);
    const { rows: [msg] } = await h.db.pool.query(`INSERT INTO messages(conversation_id,seq,sender_id,client_message_id,body,created_at) VALUES($1,$2,$3,$4,$5,clock_timestamp()) RETURNING id`, [c.id, seq, members[sender]!.id, randomUUID(), text]);
    ids.push(msg.id);
  }
  await h.db.pool.query(`UPDATE conversations SET head=$2 WHERE id=$1`, [c.id, seq]);
  return { ids, mealId: m.id as string };
}
/** Accepted deletion (barrier + receipt) followed by the worker's local purge. */
async function deleteAccount(userId: string) {
  await h.db.pool.query(`WITH d AS(UPDATE users SET status='DELETING',version=version+1 WHERE id=$1 RETURNING id) UPDATE privacy_control SET epoch=epoch+1 WHERE id=1 AND EXISTS(SELECT 1 FROM d)`, [userId]);
  const { rows: [receipt] } = await h.db.pool.query(`INSERT INTO deletion_requests(user_id,receipt_token_hash,status,requested_at,policy_version) VALUES($1,$2,'PENDING',clock_timestamp(),'test') RETURNING id,requested_at`, [userId, randomBytes(32).toString('hex')]);
  const job: Job = { id: randomUUID(), kind: 'account.purge', resourceId: receipt.id, dueAt: new Date(), attempts: 1, maxAttempts: 8, leaseOwner: 'test', leaseUntil: new Date(Date.now() + 10_000), claimToken: randomUUID() };
  await deletionHandler(h.db.pool, new UnavailableDeletionProvider())(job);
  return receipt.requested_at as Date;
}
const days = (n: number) => new Date(Date.now() + n * 86_400_000);
const holds = async (caseId: string) => (await h.db.pool.query(`SELECT user_id,role,evidence FROM safety_record_holds WHERE case_id=$1 ORDER BY user_id`, [caseId])).rows;

describe('safety records of a deleted reported member', () => {
  it('keep the report, staff notes and a copy of the reported profile for granted staff only, then are redacted after the retention period', async () => {
    const reporter = await member(), target = await member(), support = await staff(), other = await staff(); await profile(target.id);
    const reportId = await reported(reporter, 'USER', target.id);
    const d = await claimed(support, reportId);
    const reset = await act(support, reportId, d.summary.caseVersion, { action: 'RESET_PROFILE_TEXT' }); expect(reset.statusCode, reset.body).toBe(200);
    // The member writes their profile again before deleting the account.
    await h.db.pool.query(`UPDATE profiles SET display_name='Retained Member',bio='PROFILE_SENTINEL bio written again.' WHERE user_id=$1`, [target.id]);

    await deleteAccount(target.id);
    // Live personal data is gone as before.
    expect((await h.db.pool.query(`SELECT count(*)::int AS n FROM profiles WHERE user_id=$1`, [target.id])).rows[0].n).toBe(0);
    expect((await reporter.b.request('GET', `/v1/profiles/${target.id}`)).statusCode).toBe(404);
    expect(await holds(d.summary.caseId)).toEqual([{ user_id: target.id, role: 'SUBJECT', evidence: { profile: { displayName: 'Retained Member', bio: 'PROFILE_SENTINEL bio written again.', languages: ['en'], interests: ['FOOD'] } } }]);

    const kept = await detail(support, reportId);
    expect(kept).toMatchObject({ details: DETAILS, privacyRedacted: false, subject: { userId: target.id, accountStatus: 'DELETING' } });
    expect(kept.user).toMatchObject({ userId: target.id, accountStatus: 'DELETING', displayName: 'Retained Member', bio: 'PROFILE_SENTINEL bio written again.', hasPhoto: false, photoUrl: null });
    expect(kept.history).toEqual([expect.objectContaining({ kind: 'RESET_PROFILE_TEXT', note: expect.stringContaining('STAFF_NOTE_SENTINEL') })]);
    expect(kept.allowedActions).toEqual(['UPHOLD', 'RESTORE']);
    expect((await h.db.pool.query(`SELECT before_state FROM moderation_actions WHERE report_id=$1`, [reportId])).rows[0].before_state).toMatchObject({ displayName: 'Retained Member' });
    const viaCase = await support.b.request('GET', `/v1/support/cases/${d.summary.caseId}`); expect(json(viaCase).data.details).toBe(DETAILS);
    // Without the case grant, or without the support role, nothing is readable.
    expect((await other.b.request('GET', `/v1/moderation/reports/${reportId}`)).statusCode).toBe(404);
    expect((await other.b.request('GET', `/v1/support/cases/${d.summary.caseId}`)).statusCode).toBe(404);
    expect((await reporter.b.request('GET', `/v1/moderation/reports/${reportId}`)).statusCode).toBe(403);
    const queue = await other.b.request('GET', '/v1/moderation/reports?status=ALL&limit=100'); expect(queue.statusCode).toBe(200);
    expect(queue.body).not.toContain('RETAINED_REPORT_TEXT'); expect(queue.body).not.toContain('PROFILE_SENTINEL');

    // Staff can still close the case with an answer to the reporter.
    const closed = await act(support, reportId, kept.summary.caseVersion, { action: 'UPHOLD', publicOutcome: 'We reviewed this report.' });
    expect(closed.statusCode, closed.body).toBe(200);
    expect(json(await reporter.b.request('GET', `/v1/me/reports/${reportId}`)).data.publicOutcome).toBe('We reviewed this report.');

    // Not before the period has passed since the later of deletion and closure.
    expect(await purgeExpiredSafetyRecords(h.db.pool, DEFAULT_SAFETY_RECORD_DAYS, days(DEFAULT_SAFETY_RECORD_DAYS - 1))).toBe(0);
    expect((await detail(support, reportId)).details).toBe(DETAILS);
    expect(await purgeExpiredSafetyRecords(h.db.pool, DEFAULT_SAFETY_RECORD_DAYS, days(DEFAULT_SAFETY_RECORD_DAYS + 1))).toBeGreaterThanOrEqual(1);
    const gone = await detail(support, reportId);
    expect(gone).toMatchObject({ details: REMOVED_SUPPORT_TEXT, privacyRedacted: true, publicOutcome: null, user: null });
    expect(gone.history.every((e: { note: string | null }) => e.note === null || e.note === 'PRIVACY_REDACTED')).toBe(true);
    expect(JSON.stringify(gone)).not.toMatch(/SENTINEL|RETAINED_REPORT_TEXT|Retained Member/);
    expect(await holds(d.summary.caseId)).toEqual([]);
    expect((await h.db.pool.query(`SELECT before_state,after_state FROM moderation_actions WHERE report_id=$1`, [reportId])).rows.every((r) => JSON.stringify(r) === '{"before_state":{},"after_state":{}}')).toBe(true);
    expect((await h.db.pool.query(`SELECT count(*)::int AS n FROM audit_events WHERE aggregate_id=$1 AND reason LIKE '%SENTINEL%'`, [d.summary.caseId])).rows[0].n).toBe(0);
  });

  it('keep an open case and show the deleted sender\'s own lines around a reported message from the retained copy', async () => {
    const sender = await member(), reporter = await member(), support = await staff();
    const { ids } = await chat([sender, reporter], [[0, 'MESSAGE_SENTINEL before'], [1, 'Reporter reply line'], [0, 'MESSAGE_SENTINEL reported line'], [0, 'MESSAGE_SENTINEL after']]);
    const reportId = await reported(reporter, 'MESSAGE', ids[2]!);
    const d = await claimed(support, reportId);
    await deleteAccount(sender.id);
    expect((await h.db.pool.query(`SELECT count(*)::int AS n FROM messages WHERE sender_id=$1 AND NOT redacted`, [sender.id])).rows[0].n).toBe(0);
    const kept = await detail(support, reportId);
    expect(kept.message.context.map((l: { body: string; isTarget: boolean }) => [l.body, l.isTarget])).toEqual([
      ['MESSAGE_SENTINEL before', false], ['Reporter reply line', false], ['MESSAGE_SENTINEL reported line', true], ['MESSAGE_SENTINEL after', false]]);
    expect(kept.details).toBe(DETAILS);
    // An open case is never due, however late it is.
    expect(await purgeExpiredSafetyRecords(h.db.pool, 1, days(5000))).toBe(0);
    expect((await detail(support, reportId)).details).toBe(DETAILS);
    expect(d.summary.caseStatus).toBe('IN_REVIEW');
  });
});

describe('safety records of a deleted reporter', () => {
  it('keep the report text and every action against the still-active member', async () => {
    const reporter = await member(), target = await member(), support = await staff(); await profile(target.id);
    const reportId = await reported(reporter, 'USER', target.id);
    const d = await claimed(support, reportId);
    await deleteAccount(reporter.id);
    expect(await holds(d.summary.caseId)).toEqual([{ user_id: reporter.id, role: 'REPORTER', evidence: {} }]);
    const kept = await detail(support, reportId);
    expect(kept).toMatchObject({ details: DETAILS, privacyRedacted: false, reporterId: reporter.id, user: { displayName: 'Retained Member', accountStatus: 'ACTIVE' } });
    expect(kept.allowedActions).toEqual(expect.arrayContaining(['HIDE_CONTENT', 'RESET_PROFILE_TEXT', 'SUSPEND_USER']));
    // The deleted reporter's account keeps no identity: no email, profile or sign-in.
    expect((await h.db.pool.query(`SELECT (SELECT count(*) FROM private_contact WHERE user_id=$1)::int AS contact,(SELECT count(*) FROM session_families WHERE user_id=$1)::int AS sessions`, [reporter.id])).rows[0]).toEqual({ contact: 0, sessions: 0 });
    const suspended = await act(support, reportId, kept.summary.caseVersion, { action: 'SUSPEND_USER' });
    expect(suspended.statusCode, suspended.body).toBe(200);
    expect(json(suspended).data.subject.accountStatus).toBe('SUSPENDED');
  });
});
