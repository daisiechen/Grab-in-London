import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { migrate } from '@fancy/db';
import { createMigratedDatabase, type MigratedDatabase } from '@fancy/testkit/db';
import { createRunner } from '../runner/runner.ts';
import { deletionHandler, UnavailableDeletionProvider } from './deletion.ts';
let db: MigratedDatabase;
beforeAll(async () => { db = await createMigratedDatabase(inject('pgServerUrl'), migrate); });
afterAll(async () => { await db.drop(); });
describe('purge shared historical records without rewriting other users facts', () => {
  it('physically removes deleted-user text and reviews while retaining other authors messages, seat/roster/attendance and interval sequences', async () => {
    const users: string[] = [];
    for (const status of ['DELETING', 'ACTIVE', 'ACTIVE']) users.push((await db.pool.query(`INSERT INTO users(status) VALUES($1) RETURNING id`, [status])).rows[0].id);
    const [deleted, a, b] = users as [string, string, string];
    await db.pool.query(`INSERT INTO profiles(user_id,display_name,bio) VALUES($1,'Private name','Private biography to purge'),($2,'Survivor A','Survivor biography retained')`, [deleted, a]);
    const venue = (await db.pool.query(`INSERT INTO venues(place_id,provider) VALUES($1,'fixture') RETURNING id`, [`fixture_${randomUUID()}`])).rows[0].id;
    const end = new Date(Date.now() - 86_400_000), start = new Date(end.getTime() - 7_200_000), close = new Date(start.getTime() - 3_600_000);
    const meal = (await db.pool.query(`INSERT INTO meals(host_id,venue_ref,title,description,starts_at,closes_at,scheduled_end_at,start_local_date,start_local_time,start_offset,close_local_date,close_local_time,close_offset,minimum,capacity,budget_min_pence,budget_max_pence,languages,mood,booking_mode,terms_version,attempt_id,status,head) VALUES($1,$2,'Private host title','Private host description must be physically erased',$3,$4,$5,'2026-10-01','12:00',60,'2026-10-01','11:00',60,2,4,1000,2000,ARRAY['en'],'EASY_CONVERSATION','EXTERNAL_PAY_AT_VENUE','2026-10-21',$6,'COMPLETED',3) RETURNING id`, [deleted, venue, start, close, end, randomUUID()])).rows[0].id;
    for (const [index, user] of users.entries()) {
      await db.pool.query(`INSERT INTO seat_events(meal_id,seq,user_id,type,effective_at,command_id) VALUES($1,$2,$3,$4,$5,$6)`, [meal, index + 1, user, index === 0 ? 'HOST_CONFIRMED' : 'GUEST_CONFIRMED', new Date(close.getTime() - 60_000), randomUUID()]);
      await db.pool.query(`INSERT INTO start_roster(meal_id,user_id,source_revision_hash,starts_at) VALUES($1,$2,'preserve-hash',$3)`, [meal, user, start]);
      await db.pool.query(`INSERT INTO attendance_revisions(meal_id,subject_id,source,value,version,actor_id) VALUES($1,$2,'SELF','present',1,$2)`, [meal, user]);
    }
    await db.pool.query(`INSERT INTO applications(meal_id,user_id,round,state,message) VALUES($1,$2,1,'WITHDRAWN','Private applicant introduction to erase'),($1,$3,1,'CONFIRMED','Other applicant introduction retained')`, [meal, deleted, a]);
    await db.pool.query(`INSERT INTO experience_revisions(meal_id,user_id,score,revision) VALUES($1,$2,4,1),($1,$3,5,1)`, [meal, deleted, a]);
    await db.pool.query(`INSERT INTO public_review_revisions(meal_id,author_id,subject_id,body,revision) VALUES($1,$2,$3,'Deleted author private review',1),($1,$3,$2,'Review about deleted user',1),($1,$3,$4,'Other authors historical review retained',1)`, [meal, deleted, a, b]);
    const conversation = (await db.pool.query(`INSERT INTO conversations(kind,meal_id,head) VALUES('GROUP',$1,5) RETURNING id`, [meal])).rows[0].id;
    for (const [index, user] of users.entries()) {
      await db.pool.query(`INSERT INTO conversation_events(conversation_id,seq,kind,actor_id,effective_at) VALUES($1,$2,'JOIN',$3,$4)`, [conversation, index + 1, user, close]);
      await db.pool.query(`INSERT INTO membership_intervals(conversation_id,user_id,join_seq) VALUES($1,$2,$3)`, [conversation, user, index + 1]);
    }
    for (const [index, user] of [deleted, a].entries()) {
      await db.pool.query(`INSERT INTO conversation_events(conversation_id,seq,kind,actor_id,effective_at) VALUES($1,$2,'MESSAGE',$3,$4)`, [conversation, index + 4, user, start]);
      await db.pool.query(`INSERT INTO messages(conversation_id,seq,sender_id,client_message_id,body,created_at) VALUES($1,$2,$3,$4,$5,$6)`, [conversation, index + 4, user, randomUUID(), index === 0 ? 'Private chat body to physically erase' : 'Other author shared historical message retained', start]);
    }
    const snapshots = async () => ({
      seats: (await db.pool.query(`SELECT * FROM seat_events WHERE meal_id=$1 ORDER BY seq`, [meal])).rows,
      roster: (await db.pool.query(`SELECT * FROM start_roster WHERE meal_id=$1 ORDER BY user_id`, [meal])).rows,
      attendance: (await db.pool.query(`SELECT * FROM attendance_revisions WHERE meal_id=$1 ORDER BY subject_id`, [meal])).rows,
      intervals: (await db.pool.query(`SELECT * FROM membership_intervals WHERE conversation_id=$1 ORDER BY join_seq`, [conversation])).rows,
      events: (await db.pool.query(`SELECT * FROM conversation_events WHERE conversation_id=$1 ORDER BY seq`, [conversation])).rows,
    });
    const before = await snapshots();
    const receipt = (await db.pool.query(`INSERT INTO deletion_requests(user_id,receipt_token_hash,status,requested_at,policy_version) VALUES($1,$2,'PENDING',clock_timestamp(),'unconfigured') RETURNING id`, [deleted, randomBytes(32).toString('hex')])).rows[0].id;
    await db.pool.query(`INSERT INTO jobs(kind,resource_id,due_at,run_after) VALUES('account.purge',$1,clock_timestamp(),clock_timestamp())`, [receipt]);
    const runner = createRunner({ pool: db.pool, owner: 'purge-cross-review', handlers: { 'account.purge': deletionHandler(db.pool, new UnavailableDeletionProvider()) } });
    expect(await runner.tick()).toMatchObject({ done: 1, retried: 0 });
    expect(await snapshots()).toEqual(before);
    expect((await db.pool.query(`SELECT body,redacted,seq FROM messages WHERE conversation_id=$1 ORDER BY seq`, [conversation])).rows).toEqual([
      { body: 'Message removed', redacted: true, seq: '4' }, { body: 'Other author shared historical message retained', redacted: false, seq: '5' },
    ]);
    expect((await db.pool.query(`SELECT title,description FROM meals WHERE id=$1`, [meal])).rows[0]).toEqual({ title: 'Meal unavailable', description: 'This meal description has been removed.' });
    expect((await db.pool.query(`SELECT message FROM applications WHERE meal_id=$1 AND user_id=$2`, [meal, deleted])).rows[0].message).toBe('This application has been removed.');
    expect((await db.pool.query(`SELECT message FROM applications WHERE meal_id=$1 AND user_id=$2`, [meal, a])).rows[0].message).toBe('Other applicant introduction retained');
    expect((await db.pool.query(`SELECT body FROM public_review_revisions WHERE meal_id=$1`, [meal])).rows).toEqual([{ body: 'Other authors historical review retained' }]);
    expect((await db.pool.query(`SELECT user_id,score FROM experience_revisions WHERE meal_id=$1`, [meal])).rows).toEqual([{ user_id: a, score: 5 }]);
    expect((await db.pool.query(`SELECT user_id,bio FROM profiles WHERE user_id=ANY($1::uuid[])`, [users])).rows).toEqual([{ user_id: a, bio: 'Survivor biography retained' }]);
    expect((await db.pool.query(`SELECT status,provider_steps FROM deletion_requests WHERE id=$1`, [receipt])).rows[0]).toMatchObject({ status: 'NEEDS_SUPPORT', provider_steps: { local: 'COMPLETED' } });
    expect(await runner.tick()).toMatchObject({ claimed: 0 });
  });
});
