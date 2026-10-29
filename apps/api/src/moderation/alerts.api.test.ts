/**
 * Report reasons and moderation alerts (owner decision 2026-10-29): urgent reasons queue an immediate,
 * coalesced alert through the outbox (support email + Ethan push); Ethan also gets a morning push with
 * the digest and an evening reminder. Alerts carry counts and ids only.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { Browser, createHarness, json, type Harness } from '../test/harness.ts';
import { queueEveningReminder, queueModerationDigest, queuePendingUrgentAlert, URGENT_COALESCE_MINUTES } from './policy.ts';

let h: Harness;
const ETHAN = { SUPPORT_EMAIL: 'support@example.invalid', ETHAN_MODERATION_URL: 'http://127.0.0.1:9/moderation', ETHAN_MODERATION_TOKEN: 't'.repeat(32) };
const targets = { supportEmail: ETHAN.SUPPORT_EMAIL, ethan: true };
beforeAll(async () => { h = await createHarness(inject('pgServerUrl'), undefined, ETHAN); });
afterAll(async () => { await h.close(); });
// Alerts are queue-wide: each test starts with no open cases and no alerts.
beforeEach(async () => {
  await h.db.pool.query(`UPDATE support_cases SET status='RESOLVED',urgent_alert_id=NULL`);
  await h.db.pool.query(`DELETE FROM outbox`);
  await h.db.pool.query(`DELETE FROM moderation_alerts`);
});

type Member = { b: Browser; id: string };
async function member(): Promise<Member> {
  const b = new Browser(h);
  const { body } = await b.signInWithEmail(`${randomUUID()}@example.invalid`);
  return { b, id: body.data.session.user.id as string };
}
const DETAILS = 'PRIVATE_REPORT_TEXT_SENTINEL about what happened.';
async function report(m: Member, targetId: string, reason: string): Promise<string> {
  const r = await m.b.request('POST', '/v1/reports', { headers: { 'idempotency-key': randomUUID() }, body: { targetType: 'USER', targetId, reason, details: DETAILS } });
  expect(r.statusCode, r.body).toBe(201);
  return json(r).data.id as string;
}
const alerts = async () => (await h.db.pool.query(`SELECT * FROM moderation_alerts ORDER BY created_at`)).rows;
const outbox = async (eventId: string) => (await h.db.pool.query(`SELECT channel,recipient_id,template,payload,status FROM outbox WHERE event_id=$1 ORDER BY channel`, [eventId])).rows;
const backdateAlerts = (minutes: number) => h.db.pool.query(`UPDATE moderation_alerts SET created_at=created_at-make_interval(mins=>$1)`, [minutes]);

describe('report reasons', () => {
  it('stores the chosen reason and still accepts the legacy one; unknown reasons are refused', async () => {
    const reporter = await member(), target = await member();
    for (const reason of ['safety', 'harassment', 'scam', 'under_18', 'other', 'private_concern']) {
      const id = await report(reporter, target.id, reason);
      expect((await h.db.pool.query(`SELECT reason FROM reports WHERE id=$1`, [id])).rows[0].reason).toBe(reason);
    }
    const bad = await reporter.b.request('POST', '/v1/reports', { headers: { 'idempotency-key': randomUUID() }, body: { targetType: 'USER', targetId: target.id, reason: 'urgent', details: DETAILS } });
    expect(bad.statusCode).toBe(422);
  });

  it('lists open urgent reports first with an urgent flag, across pages', async () => {
    const reporter = await member(), target = await member(), staff = await member();
    await h.db.pool.query(`INSERT INTO roles(user_id,role,granted_by) VALUES($1,'support','test')`, [staff.id]);
    await h.db.pool.query(`UPDATE session_families SET amr=ARRAY['otp','mfa'] WHERE user_id=$1`, [staff.id]);
    const legacy = await report(reporter, target.id, 'private_concern');
    const scam = await report(reporter, target.id, 'scam');
    const safety = await report(reporter, target.id, 'safety');
    const under18 = await report(reporter, target.id, 'under_18');
    const first = json(await staff.b.request('GET', '/v1/moderation/reports?status=OPEN&limit=3'));
    expect(first.data.map((r: { reportId: string }) => r.reportId)).toEqual([safety, under18, legacy]);
    expect(first.data.map((r: { urgent: boolean }) => r.urgent)).toEqual([true, true, false]);
    expect(first.data[2].reason).toBe('private_concern');
    const second = json(await staff.b.request('GET', `/v1/moderation/reports?status=OPEN&limit=3&cursor=${encodeURIComponent(first.page.nextCursor)}`));
    expect(second.data.map((r: { reportId: string }) => r.reportId)).toEqual([scam]);
    const all = json(await staff.b.request('GET', '/v1/moderation/reports?status=ALL&limit=4'));
    expect(all.data[0].reportId).toBe(under18);
  });
});

describe('urgent alert', () => {
  it('queues one email and one Ethan push in the report transaction, ids only', async () => {
    const reporter = await member(), target = await member();
    const reportId = await report(reporter, target.id, 'harassment');
    const [alert] = await alerts();
    expect(alert).toMatchObject({ kind: 'urgent', reason: 'harassment', report_ids: [reportId], report_count: 1, alert_day: null });
    expect(alert.stats).toMatchObject({ open: 1, urgentOpen: 1, overdue: 0 });
    expect(await outbox(alert.id)).toEqual([
      { channel: 'EMAIL', recipient_id: null, template: 'moderation_urgent', payload: { alertId: alert.id }, status: 'PENDING' },
      { channel: 'ETHAN', recipient_id: null, template: 'moderation_urgent', payload: { alertId: alert.id }, status: 'PENDING' },
    ]);
    expect((await h.db.pool.query(`SELECT urgent_alert_id FROM support_cases WHERE report_id=$1`, [reportId])).rows[0].urgent_alert_id).toBe(alert.id);
    const stored = JSON.stringify(await h.db.pool.query(`SELECT a.*,o.payload FROM moderation_alerts a JOIN outbox o ON o.event_id=a.id`).then((r) => r.rows));
    for (const secret of ['SENTINEL', reporter.id, target.id, '@example.invalid']) expect(stored).not.toContain(secret);
  });

  it('does not alert for scam, other or legacy reports', async () => {
    const reporter = await member(), target = await member();
    for (const reason of ['scam', 'other', 'private_concern']) await report(reporter, target.id, reason);
    expect(await alerts()).toEqual([]);
    expect(await queuePendingUrgentAlert(h.db.pool, targets, new Date())).toBeNull();
  });

  it('coalesces a burst into one follow-up after 10 minutes with a cumulative count, each case once', async () => {
    const reporter = await member(), target = await member();
    const firstReport = await report(reporter, target.id, 'harassment');
    const burst = [await report(reporter, target.id, 'harassment'), await report(reporter, target.id, 'safety'), await report(reporter, target.id, 'under_18')];
    expect((await alerts()).length).toBe(1);
    // Still inside the window: the worker waits.
    expect(await queuePendingUrgentAlert(h.db.pool, targets, new Date())).toBeNull();
    await backdateAlerts(URGENT_COALESCE_MINUTES + 1);
    const followUp = await queuePendingUrgentAlert(h.db.pool, targets, new Date());
    expect(followUp).not.toBeNull();
    const [, second] = await alerts();
    expect(second).toMatchObject({ id: followUp, reason: 'safety', report_count: 4 });
    expect([...second.report_ids].sort()).toEqual([...burst].sort());
    expect(second.report_ids).not.toContain(firstReport);
    expect(second.stats.urgentOpen).toBe(4);
    expect((await outbox(followUp!)).map((o) => o.channel)).toEqual(['EMAIL', 'ETHAN']);
    // Every case is covered: nothing more to send, even after the window.
    await backdateAlerts(URGENT_COALESCE_MINUTES + 1);
    expect(await queuePendingUrgentAlert(h.db.pool, targets, new Date())).toBeNull();
    // A quiet spell ends the burst: the count starts again.
    await backdateAlerts(30);
    await report(reporter, target.id, 'under_18');
    expect((await alerts()).at(-1)).toMatchObject({ reason: 'under_18', report_count: 1 });
  });

  it('skips resolved cases and queues nothing without a destination', async () => {
    const reporter = await member(), target = await member();
    await report(reporter, target.id, 'safety');
    await report(reporter, target.id, 'safety');
    await h.db.pool.query(`UPDATE support_cases SET status='RESOLVED' WHERE urgent_alert_id IS NULL`);
    await backdateAlerts(URGENT_COALESCE_MINUTES + 1);
    expect(await queuePendingUrgentAlert(h.db.pool, targets, new Date())).toBeNull();
    await h.db.pool.query(`UPDATE support_cases SET status='OPEN' WHERE urgent_alert_id IS NULL`);
    expect(await queuePendingUrgentAlert(h.db.pool, { supportEmail: null, ethan: false }, new Date())).toBeNull();
    const id = await queuePendingUrgentAlert(h.db.pool, { supportEmail: null, ethan: true }, new Date());
    expect((await outbox(id!)).map((o) => o.channel)).toEqual(['ETHAN']);
  });
});

describe('Ethan daily pushes', () => {
  it('queues the morning push with the digest from 08:00 London, once a day, only with open reports', async () => {
    const at = new Date('2026-11-05T08:30:00Z');
    expect(await queueModerationDigest(h.db.pool, null, at, true)).toBeNull();
    expect(await alerts()).toEqual([]);
    const reporter = await member(), target = await member();
    await report(reporter, target.id, 'scam');
    expect(await queueModerationDigest(h.db.pool, null, new Date('2026-11-05T07:30:00Z'), true)).toBeNull();
    expect(await queueModerationDigest(h.db.pool, null, at, true)).toBeNull();
    await queueModerationDigest(h.db.pool, null, new Date('2026-11-05T12:00:00Z'), true);
    const morning = (await alerts()).filter((a) => a.kind === 'morning');
    expect(morning).toHaveLength(1);
    expect(morning[0]).toMatchObject({ alert_day: expect.any(Date), report_count: 1, reason: null });
    expect(await outbox(morning[0].id)).toEqual([{ channel: 'ETHAN', recipient_id: null, template: 'moderation_morning', payload: { alertId: morning[0].id }, status: 'PENDING' }]);
  });

  it('queues the evening reminder after 20:00 London only when a report is overdue or due within 6 hours', async () => {
    const reporter = await member(), target = await member();
    const id = await report(reporter, target.id, 'other');
    expect(await queueEveningReminder(h.db.pool, true, new Date('2026-11-05T19:30:00Z'))).toBeNull();
    // Fresh report: due in ~24 h, so no reminder.
    await h.db.pool.query(`UPDATE reports SET created_at=$2 WHERE id=$1`, [id, new Date('2026-11-05T20:00:00Z')]);
    expect(await queueEveningReminder(h.db.pool, true, new Date('2026-11-05T20:30:00Z'))).toBeNull();
    await h.db.pool.query(`UPDATE reports SET created_at=$2 WHERE id=$1`, [id, new Date('2026-11-05T01:00:00Z')]);
    const queued = await queueEveningReminder(h.db.pool, true, new Date('2026-11-05T20:30:00Z'));
    expect(queued).not.toBeNull();
    expect(await queueEveningReminder(h.db.pool, true, new Date('2026-11-05T22:00:00Z'))).toBeNull();
    expect(await queueEveningReminder(h.db.pool, false, new Date('2026-11-06T20:30:00Z'))).toBeNull();
    const [row] = (await alerts()).filter((a) => a.kind === 'evening');
    expect(row.stats).toMatchObject({ open: 1, dueWithin6h: 1, overdue: 0, oldestHoursLeft: 4.5 });
    expect(row.report_count).toBe(1);
  });
});
