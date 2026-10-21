import { randomUUID } from 'node:crypto';
import { setTimeout as pause } from 'node:timers/promises';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { migrate } from '@fancy/db';
import { createMigratedDatabase, type MigratedDatabase } from '@fancy/testkit/db';
import { AssistantRuntime, type SessionBinding } from '../../../../packages/assistant/src/index.ts';
import { AssistantController } from './controller.ts';
import { SessionService, createGuest } from './sessions.ts';
import { revokeGuestAI } from './invalidate.ts';
import { RequestService } from './requests.ts';
import { createDraft, transferDraft } from './drafts.ts';
let db: MigratedDatabase;
beforeAll(async () => { db = await createMigratedDatabase(inject('pgServerUrl'), migrate); });
afterAll(async () => { await db.drop(); });
async function fixture() {
  const viewer = (await db.pool.query(`INSERT INTO users DEFAULT VALUES RETURNING id`)).rows[0].id as string;
  const other = (await db.pool.query(`INSERT INTO users DEFAULT VALUES RETURNING id`)).rows[0].id as string;
  const runtime = new AssistantRuntime(), sessions = new SessionService(db.pool, runtime);
  const requests = new RequestService(db.pool, sessions, 'independent-privacy-review-secret-0123456789');
  const controller = new AssistantController({ pool: db.pool, sessions, secret: 'independent-privacy-review-secret-0123456789', allowedAreas: [] });
  const subject = `user:${viewer}`, session = await sessions.create(subject);
  const binding: SessionBinding = { subject, deviceToken: session.deviceToken, generation: 1, preferenceEpoch: '0' };
  const requestId = randomUUID(); await requests.accept(session.id, binding, requestId, { input: 'Synthetic public author fact' });
  const draft = createDraft('CREATE', null, null, '0', { title: 'Public author fixture', description: 'A public author fixture candidate before deletion.' }, 'A public author fixture candidate before deletion.');
  return { viewer, other, runtime, sessions, requests, controller, subject, session, binding, requestId, draft };
}
async function publish(f: Awaited<ReturnType<typeof fixture>>) {
  await f.requests.finish(f.subject, f.requestId, 'SUCCEEDED', null, async () => {
    f.runtime.appendMessage(f.session.id, f.binding, 'assistant', 'OTHER AUTHOR TRANSCRIPT SENTINEL');
    f.runtime.saveArtifact(f.session.id, f.binding, f.draft.id, { requestId: f.requestId, value: f.draft });
    f.runtime.publish(f.session.id, f.binding, f.requestId, { replyText: 'OTHER AUTHOR RESULT SENTINEL', cards: [] });
  });
}
async function deleteOther(other: string) {
  const c = await db.pool.connect();
  try { await c.query('BEGIN'); await c.query(`UPDATE users SET status='DELETING' WHERE id=$1`, [other]); await c.query(`UPDATE privacy_control SET epoch=epoch+1 WHERE id=1`); await c.query('COMMIT'); }
  finally { c.release(); }
}
async function waitForPrivacyLock() {
  for (let n = 0; n < 100; n++) {
    const { rows } = await db.pool.query(`SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%privacy_control%FOR SHARE%'`);
    if (rows.length) return;
    await pause(5);
  }
  throw new Error('Expected privacy lock wait was not observed.');
}
describe('independent global AI privacy epoch review', () => {
  it('serializes guest login invalidation and finish in guest-before-AI lock order without a deadlock', async () => {
    const guest = await createGuest(db.pool), runtime = new AssistantRuntime(), sessions = new SessionService(db.pool, runtime);
    const requests = new RequestService(db.pool, sessions, 'guest-lock-review-secret-01234567890123456789');
    const subject = `guest:${guest.id}`, session = await sessions.create(subject), binding = { subject, deviceToken: session.deviceToken, generation: 1, preferenceEpoch: '0' };
    const requestId = randomUUID(); await requests.accept(session.id, binding, requestId, { input: 'Guest candidate' });
    const login = await db.pool.connect(); let published = false;
    try {
      await login.query('BEGIN'); await login.query(`SELECT id FROM guest_sessions WHERE id=$1 FOR UPDATE`, [guest.id]);
      const pending = requests.finish(subject, requestId, 'SUCCEEDED', null, async c => { await sessions.validate(c, session.id, binding); published = true; });
      // Attach immediately: either transaction may be selected as the PostgreSQL deadlock victim.
      const finishOutcome = pending.then(value => ({ ok: true, value }), error => ({ ok: false, error }));
      let waiting = false;
      for (let n = 0; n < 100; n++) {
        const { rows } = await db.pool.query(`SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%FROM guest_sessions%FOR SHARE%'`);
        if (rows.length) { waiting = true; break; } await pause(5);
      }
      expect(waiting).toBe(true);
      let invalidationError: unknown;
      try { await revokeGuestAI(login, runtime, guest.token); await login.query('COMMIT'); }
      catch (error) { invalidationError = error; await login.query('ROLLBACK'); }
      const outcome = await finishOutcome;
      expect(invalidationError).toBeUndefined();
      expect(outcome.ok, `finish SQL code: ${'error' in outcome ? (outcome.error as {code?:string}).code : 'none'}`).toBe(true);
      expect(published).toBe(false);
    } finally { await login.query('ROLLBACK'); login.release(); }
  });
  it('denies old result, transcript and direct transfer after another account deletion, while a new session works', async () => {
    // Separate RAM sessions ensure the first denial cannot make the other assertions pass merely by destroying RAM.
    const result = await fixture(), transcript = await fixture(), transfer = await fixture();
    for (const f of [result, transcript, transfer]) await publish(f);
    expect((await result.controller.status(result.session.id, result.binding, result.requestId)).result?.replyText).toContain('RESULT SENTINEL');
    expect((await transcript.sessions.read(transcript.session.id, transcript.binding)).messages.at(-1)?.text).toContain('TRANSCRIPT SENTINEL');
    await deleteOther(result.other);
    await expect(transferDraft(db.pool, transfer.runtime, transfer.session.id, transfer.binding, { draftId: transfer.draft.id, editorKind: 'CREATE', targetId: null, editorVersion: '0', replaceConfirmed: false })).rejects.toMatchObject({ code: 'DRAFT_EXPIRED' });
    await expect(result.controller.status(result.session.id, result.binding, result.requestId)).rejects.toMatchObject({ code: 'AI_SESSION_EXPIRED' });
    await expect(transcript.sessions.read(transcript.session.id, transcript.binding)).rejects.toMatchObject({ code: 'AI_SESSION_EXPIRED' });
    const fresh = await transcript.sessions.create(transcript.subject);
    expect((await transcript.sessions.read(fresh.id, { ...transcript.binding, deviceToken: fresh.deviceToken })).messages).toEqual([]);
    expect((await db.pool.query(`SELECT status FROM users WHERE id=$1`, [transcript.viewer])).rows[0].status).toBe('ACTIVE');
  });
  it('a transfer already in progress waits for the deletion barrier then rejects the obsolete artifact', async () => {
    const f = await fixture(); await publish(f); const barrier = await db.pool.connect();
    let pending: ReturnType<typeof transferDraft> | undefined;
    try {
      await barrier.query('BEGIN'); await barrier.query(`UPDATE users SET status='DELETING' WHERE id=$1`, [f.other]); await barrier.query(`UPDATE privacy_control SET epoch=epoch+1 WHERE id=1`);
      pending = transferDraft(db.pool, f.runtime, f.session.id, f.binding, { draftId: f.draft.id, editorKind: 'CREATE', targetId: null, editorVersion: '0', replaceConfirmed: false });
      const checked = expect(pending).rejects.toMatchObject({ code: 'DRAFT_EXPIRED' });
      await waitForPrivacyLock(); await barrier.query('COMMIT'); await checked;
    } finally { await barrier.query('ROLLBACK'); barrier.release(); if (pending) await pending.catch(() => undefined); }
  });
  it('an in-flight finish waiting at the final global barrier never publishes and releases its reserved slot', async () => {
    const f = await fixture(), barrier = await db.pool.connect(); let pending: ReturnType<RequestService['finish']> | undefined; let published = false;
    try {
      await barrier.query('BEGIN'); await barrier.query(`UPDATE users SET status='DELETING' WHERE id=$1`, [f.other]); await barrier.query(`UPDATE privacy_control SET epoch=epoch+1 WHERE id=1`);
      pending = f.requests.finish(f.subject, f.requestId, 'SUCCEEDED', null, async () => { published = true; });
      await waitForPrivacyLock(); await barrier.query('COMMIT'); expect(await pending).toBe(true);
      expect(published).toBe(false);
      expect((await db.pool.query(`SELECT state FROM ai_requests WHERE request_id=$1`, [f.requestId])).rows[0].state).toBe('SUPERSEDED');
      expect((await db.pool.query(`SELECT successes,reserved_success_slots FROM ai_quota WHERE subject=$1`, [f.subject])).rows[0]).toMatchObject({ successes: 0, reserved_success_slots: 0 });
    } finally { await barrier.query('ROLLBACK'); barrier.release(); if (pending) await pending; }
  });
});
