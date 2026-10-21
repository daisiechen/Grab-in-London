import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { loadConfig } from '@fancy/config';
import { AssistantRuntime } from '../../../../packages/assistant/src/index.ts';
import { Browser, createHarness, WEB_ORIGIN, type Harness } from '../test/harness.ts';
import { ledgerDigest, requireRecovery, replayDeletionLedger, type DeletionLedger } from './replay.ts';
let h: Harness;
const acceptedAt = '2026-09-01T10:00:00.000Z', start = '2026-09-01T12:00:00.000Z', restoreAt = '2026-09-01T13:00:00.000Z';
beforeAll(async () => {
  h = await createHarness(inject('pgServerUrl'));
  // This isolated PG connection clock is the trusted recovery wall time T3. No real wait or
  // global JS clock replacement: all lifecycle, mutation and membership queries use real PG.
  await h.db.pool.query(`CREATE SCHEMA recovery_clock`);
  await h.db.pool.query(`CREATE FUNCTION recovery_clock.clock_timestamp() RETURNS timestamptz LANGUAGE sql VOLATILE AS $$ SELECT '${restoreAt}'::timestamptz $$`);
  await h.db.pool.query(`SET search_path=recovery_clock,pg_catalog,public`);
});
afterAll(async () => { await h.close(); });
async function fixture(deletedRole: 'host' | 'guest') {
  const members: string[] = [];
  for (let n = 0; n < 3; n++) {
    const b = new Browser(h), login = await b.signInWithEmail(`${randomUUID()}@example.invalid`);
    members.push(login.body.data.session.user.id as string);
  }
  const [host, guest, survivor] = members as [string, string, string];
  await h.db.pool.query(`UPDATE users SET created_at='2026-08-01' WHERE id=ANY($1::uuid[])`, [members]);
  const venue = (await h.db.pool.query(`INSERT INTO venues(place_id,provider) VALUES($1,'fixture') RETURNING id`, [`fixture_${randomUUID()}`])).rows[0].id;
  const meal = (await h.db.pool.query(`INSERT INTO meals(host_id,venue_ref,title,description,starts_at,closes_at,scheduled_end_at,start_local_date,start_local_time,start_offset,close_local_date,close_local_time,close_offset,minimum,capacity,budget_min_pence,budget_max_pence,languages,mood,booking_mode,terms_version,attempt_id,status,head,created_at) VALUES($1,$2,'Recovery meal fixture','Historical backup fixture before accepted deletion',$3,'2026-09-01T11:00Z','2026-09-01T14:00Z','2026-09-01','13:00',60,'2026-09-01','12:00',60,2,4,1000,2000,ARRAY['en'],'EASY_CONVERSATION','EXTERNAL_PAY_AT_VENUE','2026-10-21',$4,'OPEN',3,'2026-08-30') RETURNING id`, [host, venue, start, randomUUID()])).rows[0].id as string;
  for (const [index, user] of members.entries()) {
    let application: string | null = null;
    if (index) application = (await h.db.pool.query(`INSERT INTO applications(meal_id,user_id,round,state,message,created_at,decided_at) VALUES($1,$2,1,'CONFIRMED','A historical accepted introduction','2026-08-30','2026-08-30') RETURNING id`, [meal, user])).rows[0].id;
    await h.db.pool.query(`INSERT INTO seat_events(meal_id,seq,user_id,application_id,type,effective_at,command_id) VALUES($1,$2,$3,$4,$5,'2026-08-30',$6)`, [meal, index + 1, user, application, index ? 'GUEST_CONFIRMED' : 'HOST_CONFIRMED', randomUUID()]);
  }
  const conversation = (await h.db.pool.query(`INSERT INTO conversations(kind,meal_id,head) VALUES('GROUP',$1,3) RETURNING id`, [meal])).rows[0].id as string;
  for (const [index, user] of members.entries()) {
    await h.db.pool.query(`INSERT INTO conversation_events(conversation_id,seq,kind,actor_id,effective_at) VALUES($1,$2,'JOIN',$3,'2026-08-30')`, [conversation, index + 1, user]);
    await h.db.pool.query(`INSERT INTO membership_intervals(conversation_id,user_id,join_seq) VALUES($1,$2,$3)`, [conversation, user, index + 1]);
  }
  const userId = deletedRole === 'host' ? host : guest;
  const ledger: DeletionLedger = { version: 1, entries: [{ userId, deletionId: randomUUID(), acceptedAt, receiptTokenHash: randomBytes(32).toString('hex'), expiresAt: null, policyVersion: 'fixture-approved-ledger' }] };
  const config = loadConfig({ ENVIRONMENT: 'test', DATABASE_URL: h.db.url, AUTH_ADAPTER: 'test', PLACES_ADAPTER: 'fixture', MAIL_ADAPTER: 'outbox_test', AI_PROVIDER: 'mock', WEB_ORIGIN, SESSION_SECRET: 'api-test-session-secret-0123456789abcdef', IOS_REDIRECT_URI: 'fancy://auth/callback' });
  const deps = { pool: h.db.pool, config, identity: h.idp, publicOrigin: WEB_ORIGIN, assistantRuntime: new AssistantRuntime() };
  return { userId, host, guest, survivor, meal, conversation, ledger, deps };
}
describe('replay uses original deletion acceptance time across meal start', () => {
  it('cancels a host meal accepted before start even though recovery is after start, without inventing a start roster', async () => {
    const f = await fixture('host'); await requireRecovery(h.db.pool, f.ledger); await replayDeletionLedger(f.deps, f.ledger);
    expect((await h.db.pool.query(`SELECT status,cancel_reason FROM meals WHERE id=$1`, [f.meal])).rows[0]).toEqual({ status: 'CANCELLED', cancel_reason: 'host' });
    expect((await h.db.pool.query(`SELECT * FROM start_roster WHERE meal_id=$1`, [f.meal])).rowCount).toBe(0);
    expect((await h.db.pool.query(`SELECT effective_at FROM conversation_events WHERE conversation_id=$1 AND actor_id=$2 AND kind='LEAVE'`, [f.conversation, f.userId])).rows[0].effective_at.toISOString()).toBe(acceptedAt);
    const before = (await h.db.pool.query(`SELECT * FROM seat_events WHERE meal_id=$1 ORDER BY seq`, [f.meal])).rows;
    await requireRecovery(h.db.pool, f.ledger); await replayDeletionLedger(f.deps, f.ledger);
    expect((await h.db.pool.query(`SELECT * FROM seat_events WHERE meal_id=$1 ORDER BY seq`, [f.meal])).rows).toEqual(before);
    expect((await h.db.pool.query(`SELECT count(*)::int n FROM deletion_requests WHERE user_id=$1`, [f.userId])).rows[0].n).toBe(1);
    expect((await h.db.pool.query(`SELECT status FROM users WHERE id=$1`, [f.survivor])).rows[0].status).toBe('ACTIVE');
  });
  it('removes a guest at original acceptance and retains the other two historical start participants on catch-up', async () => {
    const f = await fixture('guest'); await requireRecovery(h.db.pool, f.ledger); await replayDeletionLedger(f.deps, f.ledger);
    expect((await h.db.pool.query(`SELECT state FROM applications WHERE meal_id=$1 AND user_id=$2`, [f.meal, f.guest])).rows[0].state).toBe('CANCELLED');
    expect((await h.db.pool.query(`SELECT effective_at FROM seat_events WHERE meal_id=$1 AND user_id=$2 AND type='LEFT'`, [f.meal, f.guest])).rows[0].effective_at.toISOString()).toBe(acceptedAt);
    expect((await h.db.pool.query(`SELECT user_id FROM start_roster WHERE meal_id=$1 ORDER BY user_id`, [f.meal])).rows.map(r => r.user_id)).toEqual([f.host, f.survivor].sort());
    expect((await h.db.pool.query(`SELECT status FROM meals WHERE id=$1`, [f.meal])).rows[0].status).toBe('OPEN');
    const before = (await h.db.pool.query(`SELECT * FROM start_roster WHERE meal_id=$1 ORDER BY user_id`, [f.meal])).rows;
    await requireRecovery(h.db.pool, f.ledger); await replayDeletionLedger(f.deps, f.ledger);
    expect((await h.db.pool.query(`SELECT * FROM start_roster WHERE meal_id=$1 ORDER BY user_id`, [f.meal])).rows).toEqual(before);
  });
  it('preserves genuinely started history when the original acceptance was after meal start', async () => {
    const f = await fixture('guest'); f.ledger.entries[0]!.acceptedAt = '2026-09-01T12:30:00.000Z';
    await requireRecovery(h.db.pool, f.ledger); await replayDeletionLedger(f.deps, f.ledger);
    expect((await h.db.pool.query(`SELECT user_id FROM start_roster WHERE meal_id=$1 ORDER BY user_id`, [f.meal])).rows.map(r => r.user_id)).toEqual([f.host, f.guest, f.survivor].sort());
    expect((await h.db.pool.query(`SELECT * FROM seat_events WHERE meal_id=$1 AND type='LEFT'`, [f.meal])).rowCount).toBe(0);
    expect((await h.db.pool.query(`SELECT status FROM users WHERE id=$1`, [f.guest])).rows[0].status).toBe('DELETING');
  });
  it('rejects invalid calendar/expiry, future acceptance and acceptance before account creation before replaying facts', async () => {
    const f = await fixture('host'), entry = f.ledger.entries[0]!;
    for (const invalid of ['2026-02-30T10:00:00Z', '2026-09-01 10:00:00', '2026-09-01T24:01:00Z']) {
      expect(() => ledgerDigest({ version: 1, entries: [{ ...entry, acceptedAt: invalid }] })).toThrow('INVALID_DELETION_LEDGER');
    }
    expect(() => ledgerDigest({ version: 1, entries: [{ ...entry, expiresAt: '2026-09-01T09:59:00Z' }] })).toThrow('INVALID_DELETION_LEDGER');
    expect(() => ledgerDigest({version:1,entries:[{...entry,acceptedAt:'2026-09-01T10:00:00.000500Z',expiresAt:'2026-09-01T10:00:00.000900Z'}]})).not.toThrow();
    for (const badTime of ['2026-09-01T13:01:00Z', '2026-07-01T10:00:00Z']) {
      const ledger: DeletionLedger = { version: 1, entries: [{ ...entry, acceptedAt: badTime }] };
      await requireRecovery(h.db.pool, ledger); await expect(replayDeletionLedger(f.deps, ledger)).rejects.toThrow('INVALID_DELETION_LEDGER');
      expect((await h.db.pool.query(`SELECT status FROM users WHERE id=$1`, [f.userId])).rows[0].status).toBe('ACTIVE');
      expect((await h.db.pool.query(`SELECT status FROM meals WHERE id=$1`, [f.meal])).rows[0].status).toBe('OPEN');
      expect((await h.db.pool.query(`SELECT * FROM deletion_requests WHERE user_id=$1`, [f.userId])).rowCount).toBe(0);
      expect((await h.db.pool.query(`SELECT state FROM recovery_control WHERE id=1`)).rows[0].state).toBe('REPLAY_REQUIRED');
    }
  });
});
