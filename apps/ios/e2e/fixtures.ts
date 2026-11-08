/**
 * Direct writes to the throwaway e2e database for states that need time to pass. Development-only,
 * like the API tests' fixtures (apps/api/src/post-meal/post-meal.api.test.ts): nothing here is
 * reachable through the API, and stack.ts refuses any database that is not a local `fancy_e2e*`.
 *
 * The API reads time from PostgreSQL (clock_timestamp()) and seat history is append-only, so a meal
 * created through the API cannot be moved into the past. Instead a meal that already took place is
 * inserted as the API would have recorded it (confirmed application, seat events before the deadline)
 * with its three lifecycle jobs due, and the real worker process advances it: CLOSE, START (start
 * roster) and END (COMPLETED), exactly as in production.
 */
import { randomUUID } from 'node:crypto';
import { createPool, enqueueJob, type Pool } from '../../../packages/db/src/index.ts';
import { londonTime } from '../../api/src/meals/time.ts';

export function openDatabase(url: string): Pool {
  return createPool(url, { max: 2, application: 'fancy-e2e-fixtures' });
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * A finished meal hosted by `hostId` with `guestId` confirmed; it ended `endedAgoMs` ago (rounded to
 * a quarter hour so London wall-clock fields stay whole minutes). Returns once the worker completed it.
 */
export async function insertFinishedMeal(pool: Pool, o: { hostId: string; guestId: string; venueRef: string; title: string; endedAgoMs: number }): Promise<string> {
  const end = new Date(Math.floor((Date.now() - o.endedAgoMs) / (15 * MINUTE)) * 15 * MINUTE);
  const start = new Date(end.getTime() - 2 * HOUR), close = new Date(start.getTime() - HOUR);
  const s = londonTime(start), c = londonTime(close);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [meal] } = await client.query<{ id: string }>(
      `INSERT INTO meals(host_id,venue_ref,title,description,starts_at,closes_at,scheduled_end_at,start_local_date,start_local_time,start_offset,close_local_date,close_local_time,close_offset,minimum,capacity,budget_min_pence,budget_max_pence,languages,mood,cuisine_code,booking_mode,terms_version,attempt_id,created_at)
       VALUES($1,$2,$3,'A relaxed dinner that already took place, used for the after-the-meal journey.',$4,$5,$6,$7,$8,$9,$10,$11,$12,2,4,2000,3500,ARRAY['en'],'EASY_CONVERSATION','EUROPEAN','EXTERNAL_PAY_AT_VENUE','2026-10-21',$13,$14) RETURNING id`,
      [o.hostId, o.venueRef, o.title, start, close, end, s.localDate, s.localTime, s.utcOffsetMinutes, c.localDate, c.localTime, c.utcOffsetMinutes, randomUUID(), new Date(close.getTime() - 3 * HOUR)],
    );
    const mealId = meal!.id;
    const { rows: [application] } = await client.query<{ id: string }>(
      `INSERT INTO applications(meal_id,user_id,round,state,message,version,created_at,decided_at) VALUES($1,$2,1,'CONFIRMED','I would love to join this table and meet new people over dinner.',2,$3,$4) RETURNING id`,
      [mealId, o.guestId, new Date(close.getTime() - 2 * HOUR), new Date(close.getTime() - HOUR)],
    );
    await client.query(`INSERT INTO seat_events(meal_id,seq,user_id,type,effective_at,command_id) VALUES($1,1,$2,'HOST_CONFIRMED',$3,$4)`, [mealId, o.hostId, new Date(close.getTime() - 3 * HOUR), randomUUID()]);
    await client.query(`INSERT INTO seat_events(meal_id,seq,user_id,application_id,type,effective_at,command_id) VALUES($1,2,$2,$3,'GUEST_CONFIRMED',$4,$5)`, [mealId, o.guestId, application!.id, new Date(close.getTime() - HOUR), randomUUID()]);
    for (const [kind, dueAt] of [['meal.close', close], ['meal.start', start], ['meal.end', end]] as const) await enqueueJob(client, { kind, resourceId: mealId, dueAt });
    await client.query('COMMIT');
    await waitUntil(`worker completes meal ${mealId}`, async () => {
      const { rows: [row] } = await pool.query<{ status: string; roster: number }>(`SELECT status,(SELECT count(*)::int FROM start_roster WHERE meal_id=$1) AS roster FROM meals WHERE id=$1`, [mealId]);
      return row?.status === 'COMPLETED' && row.roster === 2;
    });
    return mealId;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** The member's last sign-in is older than the 5-minute re-authentication window (as in identity.api.test.ts). */
export async function ageSignIn(pool: Pool, userId: string): Promise<void> {
  const { rowCount } = await pool.query(`UPDATE session_families SET auth_time=clock_timestamp()-interval '301 seconds' WHERE user_id=$1 AND revoked_at IS NULL`, [userId]);
  if (!rowCount) throw new Error('no active session family to age');
}

/** Ends the member's current 15-minute access tokens early; refresh tokens stay valid. */
export async function expireAccessTokens(pool: Pool, userId: string): Promise<void> {
  const { rowCount } = await pool.query(`UPDATE sessions SET expires_at=clock_timestamp() WHERE expires_at>clock_timestamp() AND family_id IN (SELECT id FROM session_families WHERE user_id=$1 AND revoked_at IS NULL)`, [userId]);
  if (!rowCount) throw new Error('no live access token to expire');
}

export async function waitUntil(what: string, check: () => Promise<boolean>, timeoutMs = 20_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error(`Timed out: ${what}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}
