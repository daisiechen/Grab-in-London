import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { Browser, createHarness, json, type Harness } from '../test/harness.ts';
import { autoCloseStaleCases, OUTCOMES, queueModerationDigest } from './policy.ts';
import { purgeKnownSupportText } from '../support/privacy.ts';

let h: Harness;
beforeAll(async () => { h = await createHarness(inject('pgServerUrl')); });
afterAll(async () => { await h.close(); });

type Member = { b: Browser; id: string; email: string };
async function member(): Promise<Member> {
  const b = new Browser(h); const email = `${randomUUID()}@example.invalid`;
  const { body } = await b.signInWithEmail(email);
  return { b, id: body.data.session.user.id as string, email };
}
async function staff(roles: string[] = ['support'], mfa = true): Promise<Member> {
  const s = await member();
  for (const role of roles) await h.db.pool.query(`INSERT INTO roles(user_id,role,granted_by) VALUES($1,$2,'test')`, [s.id, role]);
  if (mfa) await h.db.pool.query(`UPDATE session_families SET amr=ARRAY['otp','mfa'] WHERE user_id=$1`, [s.id]);
  return s;
}
const key = () => ({ 'idempotency-key': randomUUID() });
const report = (m: Member, targetType: 'USER' | 'MEAL' | 'MESSAGE', targetId: string) =>
  m.b.request('POST', '/v1/reports', { headers: key(), body: { targetType, targetId, reason: 'private_concern', details: 'Synthetic concern for the moderation queue.' } });
async function reported(m: Member, type: 'USER' | 'MEAL' | 'MESSAGE', id: string): Promise<string> {
  const r = await report(m, type, id); expect(r.statusCode, r.body).toBe(201); return json(r).data.id as string;
}
const claim = (s: Member, reportId: string) => s.b.request('POST', `/v1/moderation/reports/${reportId}/claim`, { headers: key() });
const act = (s: Member, reportId: string, version: string, body: Record<string, unknown>) =>
  s.b.request('POST', `/v1/moderation/reports/${reportId}/actions`, { headers: { ...key(), 'if-match': `"${version}"` }, body: { note: 'Reviewed against the community guidelines.', ...body } });
async function claimed(s: Member, reportId: string) { const r = await claim(s, reportId); expect(r.statusCode, r.body).toBe(200); return json(r).data; }

async function profile(userId: string, bio = 'Synthetic bio text that is long enough to be valid.') {
  await h.db.pool.query(`INSERT INTO profiles(user_id,display_name,bio,languages,life_status,interests) VALUES($1,'Synthetic Member',$2,ARRAY['en'],'NEW_TO_LONDON',ARRAY['FOOD']) ON CONFLICT (user_id) DO UPDATE SET bio=EXCLUDED.bio,display_name=EXCLUDED.display_name`, [userId, bio]);
}
async function meal(hostId: string, opts: { startsInHours?: number; status?: string } = {}) {
  const start = new Date(Date.now() + (opts.startsInHours ?? 72) * 3600_000), close = new Date(start.getTime() - 3600_000), end = new Date(start.getTime() + 7200_000);
  const { rows: [v] } = await h.db.pool.query(`INSERT INTO venues(place_id,provider) VALUES($1,'fixture') RETURNING id`, [`fixture_${randomUUID()}`]);
  const { rows: [m] } = await h.db.pool.query(`INSERT INTO meals(host_id,venue_ref,title,description,starts_at,closes_at,scheduled_end_at,start_local_date,start_local_time,start_offset,close_local_date,close_local_time,close_offset,minimum,capacity,budget_min_pence,budget_max_pence,languages,mood,booking_mode,terms_version,attempt_id,status)
    VALUES($1,$2,'Moderation fixture supper','A synthetic meal used by the moderation tests only.',$3,$4,$5,'2026-11-01','19:00',0,'2026-11-01','18:00',0,2,4,1000,2000,ARRAY['en'],'EASY_CONVERSATION','EXTERNAL_PAY_AT_VENUE','2026-10-21',$6,$7) RETURNING id`, [hostId, v.id, start, close, end, randomUUID(), opts.status ?? 'OPEN']);
  await h.db.pool.query(`INSERT INTO seat_events(meal_id,seq,user_id,type,effective_at,command_id) VALUES($1,1,$2,'HOST_CONFIRMED',clock_timestamp(),$3)`, [m.id, hostId, randomUUID()]);
  await h.db.pool.query(`UPDATE meals SET head=1 WHERE id=$1`, [m.id]);
  return m.id as string;
}
/** A group chat with the given members and messages (sender index, text), all members joined first. */
async function chat(members: Member[], lines: Array<[number, string]>) {
  const mealId = await meal(members[0]!.id);
  const { rows: [c] } = await h.db.pool.query(`INSERT INTO conversations(kind,meal_id) VALUES('GROUP',$1) RETURNING id`, [mealId]);
  let seq = 0;
  for (const m of members) { seq++; await h.db.pool.query(`INSERT INTO conversation_events(conversation_id,seq,kind,actor_id,effective_at) VALUES($1,$2,'JOIN',$3,clock_timestamp())`, [c.id, seq, m.id]); await h.db.pool.query(`INSERT INTO membership_intervals(conversation_id,user_id,join_seq) VALUES($1,$2,$3)`, [c.id, m.id, seq]); }
  const ids: string[] = [];
  for (const [sender, text] of lines) {
    seq++;
    await h.db.pool.query(`INSERT INTO conversation_events(conversation_id,seq,kind,actor_id,effective_at) VALUES($1,$2,'MESSAGE',$3,clock_timestamp())`, [c.id, seq, members[sender]!.id]);
    const { rows: [msg] } = await h.db.pool.query(`INSERT INTO messages(conversation_id,seq,sender_id,client_message_id,body,created_at) VALUES($1,$2,$3,$4,$5,clock_timestamp()) RETURNING id`, [c.id, seq, members[sender]!.id, randomUUID(), text]);
    ids.push(msg.id);
  }
  await h.db.pool.query(`UPDATE conversations SET head=$2 WHERE id=$1`, [c.id, seq]);
  return { conversationId: c.id as string, ids };
}
const bodies = async (m: Member, conversationId: string) => {
  const r = await m.b.request('GET', `/v1/conversations/${conversationId}/messages?mode=HISTORY`); expect(r.statusCode, r.body).toBe(200);
  return Object.fromEntries((json(r).data as Array<{ id: string; body: string; sender: { displayName: string } }>).map((x) => [x.id, x]));
};
const outcome = async (m: Member, reportId: string) => json(await m.b.request('GET', `/v1/me/reports/${reportId}`)).data;

describe('moderation access', () => {
  it('requires the support role with MFA; details need a claim, which grants the case and is audited', async () => {
    const reporter = await member(), target = await member(); await profile(target.id);
    const reportId = await reported(reporter, 'USER', target.id);
    const analyst = await staff(['analyst']), noMfa = await staff(['support'], false), support = await staff();
    expect((await analyst.b.request('GET', '/v1/moderation/reports')).statusCode).toBe(403);
    expect((await claim(analyst, reportId)).statusCode).toBe(403);
    const reauth = await noMfa.b.request('GET', '/v1/moderation/reports'); expect(reauth.statusCode).toBe(403); expect(json(reauth).error.code).toBe('REAUTH_REQUIRED');
    expect((await reporter.b.request('GET', '/v1/moderation/reports')).statusCode).toBe(403);

    const queue = await support.b.request('GET', '/v1/moderation/reports'); expect(queue.statusCode, queue.body).toBe(200);
    const row = (json(queue).data as Array<Record<string, unknown>>).find((r) => r.reportId === reportId)!;
    expect(row).toMatchObject({ targetType: 'USER', caseStatus: 'OPEN', claimedByMe: false, reporterCount: 1, autoActioned: false });
    expect(queue.body).not.toContain('Synthetic concern'); expect(queue.body).not.toContain(target.email);
    expect((await support.b.request('GET', `/v1/moderation/reports/${reportId}`)).statusCode).toBe(404);

    const detail = await claimed(support, reportId);
    expect(detail.summary).toMatchObject({ claimedByMe: true, caseStatus: 'IN_REVIEW', reportStatus: 'IN_REVIEW' });
    expect(detail).toMatchObject({ reporterId: reporter.id, details: 'Synthetic concern for the moderation queue.', subject: { userId: target.id, accountStatus: 'ACTIVE' } });
    expect(detail.user).toMatchObject({ userId: target.id, displayName: 'Synthetic Member', profileHidden: false });
    expect(JSON.stringify(detail)).not.toContain(target.email);
    expect(detail.allowedActions).toEqual(expect.arrayContaining(['UPHOLD', 'RESTORE', 'HIDE_CONTENT', 'RESET_PROFILE_TEXT', 'SUSPEND_USER']));
    expect((await support.b.request('GET', `/v1/moderation/reports/${reportId}`)).statusCode).toBe(200);
    // The claim is the same case grant the J09 support operations use.
    expect((await support.b.request('GET', `/v1/support/cases/${detail.summary.caseId}`)).statusCode).toBe(200);
    const actions = (await h.db.pool.query(`SELECT action FROM audit_events WHERE aggregate_id=$1`, [detail.summary.caseId])).rows.map((r) => r.action);
    expect(actions).toEqual(expect.arrayContaining(['moderation.claimed', 'moderation.report_viewed']));
    expect((await outcome(reporter, reportId)).status).toBe('IN_REVIEW');
  });

  it('lists open reports oldest first with a 24h due time, resolved newest first, with filters and pages', async () => {
    const support = await staff(); const a = await member(), b = await member(), t = await member();
    await h.db.pool.query(`UPDATE support_cases SET status='RESOLVED'`);
    const ids: string[] = [];
    for (const [who, hoursAgo] of [[a, 30], [b, 5], [a, 1]] as const) {
      const id = await reported(who, 'USER', t.id); ids.push(id);
      await h.db.pool.query(`UPDATE reports SET created_at=clock_timestamp()-make_interval(hours=>$2) WHERE id=$1`, [id, hoursAgo]);
    }
    const page1 = json(await support.b.request('GET', '/v1/moderation/reports?limit=2'));
    expect(page1.data.map((r: { reportId: string }) => r.reportId)).toEqual([ids[0], ids[1]]);
    const first = page1.data[0];
    expect(Date.parse(first.dueAt) - Date.parse(first.createdAt)).toBe(24 * 3600_000);
    expect(Date.parse(first.dueAt)).toBeLessThan(Date.now());
    const page2 = json(await support.b.request('GET', `/v1/moderation/reports?limit=2&cursor=${encodeURIComponent(page1.page.nextCursor)}`));
    expect(page2.data.map((r: { reportId: string }) => r.reportId)).toEqual([ids[2]]);
    expect((await (await staff()).b.request('GET', `/v1/moderation/reports?limit=2&cursor=${encodeURIComponent(page1.page.nextCursor)}`)).statusCode).toBe(422);
    expect(json(await support.b.request('GET', '/v1/moderation/reports?targetType=MEAL')).data).toEqual([]);
    await claimed(support, ids[1]!);
    expect(json(await support.b.request('GET', '/v1/moderation/reports?claimed=me')).data.map((r: { reportId: string }) => r.reportId)).toEqual([ids[1]]);
    await h.db.pool.query(`UPDATE support_cases SET status='RESOLVED' WHERE report_id=ANY($1::uuid[])`, [[ids[0], ids[2]]]);
    const closed = json(await support.b.request('GET', '/v1/moderation/reports?status=RESOLVED&limit=100')).data.map((r: { reportId: string }) => r.reportId);
    expect(closed.indexOf(ids[2])).toBeLessThan(closed.indexOf(ids[0]));
    expect(closed.indexOf(ids[2])).toBeGreaterThanOrEqual(0);
  });
});

describe('automatic interim actions', () => {
  it('hides a reported message from its reporter at once and from everyone after two distinct reporters', async () => {
    const sender = await member(), one = await member(), two = await member(), bystander = await member();
    const { conversationId, ids } = await chat([sender, one, two, bystander], [[0, 'Hello table'], [0, 'Offensive synthetic line'], [1, 'Reply line']]);
    const target = ids[1]!;
    const first = await report(one, 'MESSAGE', target); expect(first.statusCode, first.body).toBe(201);
    expect(json(first).data.publicOutcome).toBe(OUTCOMES.received);
    expect((await bodies(one, conversationId))[target]!.body).toBe('[Message unavailable]');
    expect((await bodies(bystander, conversationId))[target]!.body).toBe('Offensive synthetic line');
    expect((await bodies(one, conversationId))[target]!.sender.displayName).not.toBe('Former member');

    const second = await report(two, 'MESSAGE', target); expect(second.statusCode).toBe(201);
    expect(json(second).data.publicOutcome).toBe(OUTCOMES.limited);
    expect((await outcome(one, json(first).data.id)).publicOutcome).toBe(OUTCOMES.limited);
    expect((await bodies(bystander, conversationId))[target]!.body).toBe('[Message unavailable]');
    expect((await bodies(bystander, conversationId))[ids[0]!]!.body).toBe('Hello table');
    const { rows: cases } = await h.db.pool.query(`SELECT auto_actioned_at FROM support_cases WHERE target_id=$1`, [target]);
    expect(cases.every((c) => c.auto_actioned_at !== null)).toBe(true);
    expect((await h.db.pool.query(`SELECT 1 FROM moderation_actions WHERE target_id=$1 AND action='AUTO_HIDE' AND actor_kind='SYSTEM'`, [target])).rowCount).toBe(1);
    expect((await h.db.pool.query(`SELECT 1 FROM audit_events WHERE action='moderation.auto_hidden' AND payload->>'targetId'=$1`, [target])).rowCount).toBe(1);

    // Staff see context around the reported line and restore it: everyone but the reporters sees it again.
    const support = await staff();
    const detail = await claimed(support, json(second).data.id);
    expect(detail.summary).toMatchObject({ autoActioned: true, contentLimited: true, reporterCount: 2 });
    expect(detail.message.context.map((l: { body: string; isTarget: boolean }) => [l.body, l.isTarget])).toEqual([['Hello table', false], ['Offensive synthetic line', true], ['Reply line', false]]);
    expect(detail.allowedActions).not.toContain('HIDE_CONTENT');
    const restored = await act(support, json(second).data.id, detail.summary.caseVersion, { action: 'RESTORE' });
    expect(restored.statusCode, restored.body).toBe(200);
    expect(json(restored).data.summary).toMatchObject({ caseStatus: 'RESOLVED', contentLimited: false, reportStatus: 'RESPONDED' });
    expect((await bodies(bystander, conversationId))[target]!.body).toBe('Offensive synthetic line');
    expect((await bodies(two, conversationId))[target]!.body).toBe('[Message unavailable]');
    expect(await outcome(two, json(second).data.id)).toMatchObject({ status: 'RESPONDED', publicOutcome: OUTCOMES.restored });
    const history = json(restored).data.history.map((e: { kind: string }) => e.kind);
    expect(history).toEqual(['AUTO_HIDE', 'RESTORE']);
  });

  it('limits a meal from discovery for others and a profile bio/photo, honouring the configured threshold', async () => {
    const host = await member(), one = await member(), two = await member(), other = await member();
    const mealId = await meal(host.id);
    const seen = async (m: Member) => (json(await m.b.request('GET', '/v1/meals?limit=50')).data as Array<{ id: string }>).some((x) => x.id === mealId);
    expect(await seen(other)).toBe(true);
    await reported(one, 'MEAL', mealId);
    expect(await seen(one)).toBe(false);
    expect(await seen(other)).toBe(true);
    await reported(two, 'MEAL', mealId);
    expect(await seen(other)).toBe(false);
    expect((await other.b.request('GET', `/v1/meals/${mealId}`)).statusCode).toBe(404);
    expect((await host.b.request('GET', `/v1/meals/${mealId}`)).statusCode).toBe(200);
    expect((await h.db.pool.query(`SELECT status FROM meals WHERE id=$1`, [mealId])).rows[0].status).toBe('OPEN');

    const target = await member(); await profile(target.id);
    await reported(one, 'USER', target.id);
    const bio = async (m: Member) => json(await m.b.request('GET', `/v1/profiles/${target.id}`)).data.profile.bio;
    expect(await bio(one)).toBeNull();
    expect(await bio(other)).not.toBeNull();
    await reported(two, 'USER', target.id);
    expect(await bio(other)).toBeNull();
    expect(await bio(target)).toBeNull();
    expect(json(await target.b.request('GET', '/v1/me')).data.bio).not.toBeNull();
  });
});

describe('staff actions', () => {
  it('suspends the responsible account: sessions revoked, clear refusal on use and sign-in, content masked, reversible', async () => {
    const reporter = await member(), target = await member(), bystander = await member(); await profile(target.id);
    const { conversationId, ids } = await chat([bystander, target], [[1, 'Line from the reported member']]);
    const reportId = await reported(reporter, 'USER', target.id);
    const support = await staff();
    const detail = await claimed(support, reportId);
    const stale = await act(support, reportId, String(BigInt(detail.summary.caseVersion) - 1n), { action: 'SUSPEND_USER' });
    expect(stale.statusCode).toBe(409); expect(json(stale).error.code).toBe('VERSION_CONFLICT');
    const suspended = await act(support, reportId, detail.summary.caseVersion, { action: 'SUSPEND_USER', publicOutcome: 'We took action on this account.' });
    expect(suspended.statusCode, suspended.body).toBe(200);
    expect(json(suspended).data).toMatchObject({ subject: { userId: target.id, accountStatus: 'SUSPENDED' }, summary: { caseStatus: 'RESOLVED' } });
    expect(json(suspended).data.allowedActions).toContain('UNSUSPEND_USER');

    const blocked = await target.b.request('GET', '/v1/me'); expect(blocked.statusCode).toBe(403); expect(json(blocked).error.code).toBe('ACCOUNT_SUSPENDED');
    expect(json(blocked).error.message).toContain('suspended');
    // Move earlier OTP challenges out of the resend window so the same address can sign in again.
    const reopenOtp = () => h.db.pool.query(`UPDATE auth_transactions SET created_at=created_at-interval '1 hour' WHERE kind='EMAIL_OTP'`);
    await reopenOtp();
    const again = new Browser(h);
    const start = await again.request('POST', '/v1/auth/email/start', { body: { clientRequestId: randomUUID(), email: target.email, client: 'WEB' } });
    const code = h.idp.inbox.get(target.email)!.at(-1)!;
    const verify = await again.request('POST', '/v1/auth/email/verify', { body: { clientRequestId: randomUUID(), challengeId: json(start).data.challengeId, code } });
    expect(verify.statusCode).toBe(403); expect(json(verify).error.code).toBe('ACCOUNT_SUSPENDED');
    expect((await bystander.b.request('GET', `/v1/profiles/${target.id}`)).statusCode).toBe(404);
    expect((await bodies(bystander, conversationId))[ids[0]!]).toMatchObject({ body: '[Message unavailable]', sender: { displayName: 'Former member' } });
    expect(await outcome(reporter, reportId)).toMatchObject({ status: 'RESPONDED', publicOutcome: 'We took action on this account.' });
    // Moderators keep the report text and profile context while the account is suspended.
    const reread = json(await support.b.request('GET', `/v1/moderation/reports/${reportId}`)).data;
    expect(reread).toMatchObject({ privacyRedacted: false, details: 'Synthetic concern for the moderation queue.', user: { accountStatus: 'SUSPENDED' } });
    const audit = (await h.db.pool.query(`SELECT payload FROM audit_events WHERE action='moderation.suspend_user' AND aggregate_id=$1`, [detail.summary.caseId])).rows[0].payload;
    expect(audit).toMatchObject({ subjectStatusBefore: 'ACTIVE', subjectStatusAfter: 'SUSPENDED', resolved: true });
    const row = (await h.db.pool.query(`SELECT actor_id,note,before_state,after_state FROM moderation_actions WHERE case_id=$1 AND action='SUSPEND_USER'`, [detail.summary.caseId])).rows[0];
    expect(row).toMatchObject({ actor_id: support.id, note: 'Reviewed against the community guidelines.', before_state: { subjectStatus: 'ACTIVE' }, after_state: { subjectStatus: 'SUSPENDED', revokedSessionFamilies: 1 } });

    const lifted = await act(support, reportId, reread.summary.caseVersion, { action: 'UNSUSPEND_USER' });
    expect(lifted.statusCode, lifted.body).toBe(200);
    expect(json(lifted).data.subject.accountStatus).toBe('ACTIVE');
    await reopenOtp();
    const back = new Browser(h); const { body } = await back.signInWithEmail(target.email);
    expect(body.data.outcome).toBe('AUTHENTICATED');
    expect((await back.request('GET', '/v1/me')).statusCode).toBe(200);
  });

  it('removes profile text and photo, cancels a meal and refuses unavailable actions', async () => {
    const reporter = await member(), target = await member(), host = await member(); await profile(target.id);
    const support = await staff();
    const userReport = await reported(reporter, 'USER', target.id);
    let detail = await claimed(support, userReport);
    const reset = await act(support, userReport, detail.summary.caseVersion, { action: 'RESET_PROFILE_TEXT' });
    expect(reset.statusCode, reset.body).toBe(200);
    expect(json(reset).data.user).toMatchObject({ displayName: null, bio: null });
    expect(json(reset).data.allowedActions).not.toContain('RESET_PROFILE_TEXT');
    expect(json(reset).data.summary.caseStatus).toBe('IN_REVIEW');
    const before = (await h.db.pool.query(`SELECT before_state FROM moderation_actions WHERE report_id=$1`, [userReport])).rows[0].before_state;
    expect(before).toMatchObject({ displayName: 'Synthetic Member' });
    const missing = await act(support, userReport, json(reset).data.summary.caseVersion, { action: 'REMOVE_PROFILE_PHOTO' });
    expect(missing.statusCode).toBe(409); expect(json(missing).error.code).toBe('STATE_CONFLICT');

    const mealId = await meal(host.id);
    const mealReport = await reported(reporter, 'MEAL', mealId);
    detail = await claimed(support, mealReport);
    expect(detail.meal).toMatchObject({ mealId, hostId: host.id, status: 'OPEN', hidden: false });
    const cancelled = await act(support, mealReport, detail.summary.caseVersion, { action: 'CANCEL_MEAL', resolve: true });
    expect(cancelled.statusCode, cancelled.body).toBe(200);
    expect(json(cancelled).data.meal).toMatchObject({ status: 'CANCELLED', hidden: true });
    expect(json(cancelled).data.summary.caseStatus).toBe('RESOLVED');
    expect((await outcome(reporter, mealReport)).publicOutcome).toBe(OUTCOMES.upheld);
    expect((await h.db.pool.query(`SELECT 1 FROM notifications WHERE recipient_id=$1 AND template='meal_cancelled'`, [host.id])).rowCount).toBe(1);
    const note = await act(support, mealReport, json(cancelled).data.summary.caseVersion, { action: 'UPHOLD', note: 'no' });
    expect(note.statusCode).toBe(422);
  });

  it('serves the J09 attendance facts only for a granted meal case', async () => {
    const reporter = await member(), host = await member(), support = await staff();
    const mealId = await meal(host.id, { startsInHours: -24 * 9 });
    await h.db.pool.query(`UPDATE meals SET status='COMPLETED' WHERE id=$1`, [mealId]);
    await h.db.pool.query(`INSERT INTO start_roster(meal_id,user_id,source_revision_hash,starts_at) VALUES($1,$2,'fixture',clock_timestamp())`, [mealId, host.id]);
    const reportId = await reported(reporter, 'MEAL', mealId);
    const { rows: [c] } = await h.db.pool.query(`SELECT id FROM support_cases WHERE report_id=$1`, [reportId]);
    expect((await support.b.request('GET', `/v1/support/cases/${c.id}/attendance`)).statusCode).toBe(404);
    await claimed(support, reportId);
    const facts = await support.b.request('GET', `/v1/support/cases/${c.id}/attendance`);
    expect(facts.statusCode, facts.body).toBe(200);
    expect(json(facts).data).toMatchObject({ mealId, mealStatus: 'COMPLETED', roster: [{ subjectId: host.id, isHost: true, value: 'unknown', version: '0' }] });
    expect(Date.parse(json(facts).data.correctionOpensAt) - Date.parse(json(facts).data.scheduledEndAt)).toBe(7 * 86_400_000);
    const userReport = await reported(reporter, 'USER', host.id);
    const userCase = (await claimed(support, userReport)).summary.caseId;
    expect((await support.b.request('GET', `/v1/support/cases/${userCase}/attendance`)).statusCode).toBe(409);
  });
});

describe('housekeeping', () => {
  it('auto-closes cases left without staff action for 30 days, keeping the automatic limit and the history', async () => {
    const sender = await member(), one = await member(), two = await member(), support = await staff();
    const { ids } = await chat([sender, one, two], [[0, 'Old reported line']]);
    const a = await reported(one, 'MESSAGE', ids[0]!), b = await reported(two, 'MESSAGE', ids[0]!);
    const acted = await reported(one, 'USER', sender.id);
    const d = await claimed(support, acted);
    expect((await act(support, acted, d.summary.caseVersion, { action: 'HIDE_CONTENT' })).statusCode).toBe(200);
    await h.db.pool.query(`UPDATE support_cases SET created_at=clock_timestamp()-interval '31 days' WHERE report_id=ANY($1::uuid[])`, [[a, b, acted]]);
    expect(await autoCloseStaleCases(h.db.pool)).toBeGreaterThanOrEqual(2);
    expect(await outcome(one, a)).toMatchObject({ status: 'RESPONDED', publicOutcome: OUTCOMES.autoClosedLimited });
    expect((await h.db.pool.query(`SELECT moderation_hidden_at FROM messages WHERE id=$1`, [ids[0]])).rows[0].moderation_hidden_at).not.toBeNull();
    expect((await h.db.pool.query(`SELECT status,auto_closed_at FROM support_cases WHERE report_id=$1`, [acted])).rows[0]).toMatchObject({ status: 'IN_REVIEW', auto_closed_at: null });
    const closed = json(await support.b.request('GET', '/v1/moderation/reports?status=RESOLVED&limit=100')).data.find((r: { reportId: string }) => r.reportId === a);
    expect(closed).toMatchObject({ autoClosed: true, autoActioned: true, caseStatus: 'RESOLVED' });
  });

  it('queues one digest per London day from 08:00 when a support address is configured', async () => {
    const one = await member(), target = await member();
    await reported(one, 'USER', target.id);
    await h.db.pool.query(`DELETE FROM moderation_digests`);
    expect(await queueModerationDigest(h.db.pool, null, new Date('2026-11-02T12:00:00Z'))).toBeNull();
    expect(await queueModerationDigest(h.db.pool, 'support@example.invalid', new Date('2026-11-02T07:30:00Z'))).toBeNull();
    const id = await queueModerationDigest(h.db.pool, 'support@example.invalid', new Date('2026-11-02T08:30:00Z'));
    expect(id).not.toBeNull();
    expect(await queueModerationDigest(h.db.pool, 'support@example.invalid', new Date('2026-11-02T18:00:00Z'))).toBeNull();
    const { rows: [mail] } = await h.db.pool.query(`SELECT recipient_id,template,payload,status FROM outbox WHERE event_id=$1`, [id]);
    expect(mail).toEqual({ recipient_id: null, template: 'moderation_digest', payload: { digestId: id }, status: 'PENDING' });
    const { rows: [digest] } = await h.db.pool.query(`SELECT report_ids FROM moderation_digests WHERE id=$1`, [id]);
    expect(digest.report_ids.length).toBeGreaterThan(0);
  });

  it('redacts staff notes and before/after snapshots when a reported member is purged', async () => {
    const reporter = await member(), target = await member(), support = await staff(); await profile(target.id);
    const reportId = await reported(reporter, 'USER', target.id);
    const d = await claimed(support, reportId);
    expect((await act(support, reportId, d.summary.caseVersion, { action: 'RESET_PROFILE_TEXT' })).statusCode).toBe(200);
    const client = await h.db.pool.connect();
    try {
      await client.query('BEGIN'); await client.query(`SET LOCAL fancy.privacy_purge='on'`);
      await purgeKnownSupportText(client, target.id); await client.query('COMMIT');
    } finally { client.release(); }
    const rows = (await h.db.pool.query(`SELECT note,before_state,after_state FROM moderation_actions WHERE report_id=$1`, [reportId])).rows;
    expect(rows).toEqual([{ note: 'PRIVACY_REDACTED', before_state: {}, after_state: {} }]);
  });
});
