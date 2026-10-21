import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it, vi } from 'vitest';
import { migrate } from '@fancy/db';
import { createMigratedDatabase, type MigratedDatabase } from '@fancy/testkit/db';
import { deletionHandler } from '../handlers/deletion.ts';
import { createRunner } from '../runner/runner.ts';
import { StepwiseDeletionProvider, UnavailableDeletionSteps, type DeletionStep } from './provider.ts';
let db: MigratedDatabase;
beforeAll(async () => { db = await createMigratedDatabase(inject('pgServerUrl'), migrate); });
afterAll(async () => { await db.drop(); });
async function fixture() {
  const user = (await db.pool.query(`INSERT INTO users(status) VALUES('DELETING') RETURNING id`)).rows[0].id as string;
  const other = (await db.pool.query(`INSERT INTO users DEFAULT VALUES RETURNING id`)).rows[0].id as string;
  for (const id of [user, other]) {
    await db.pool.query(`INSERT INTO profiles(user_id,display_name,bio) VALUES($1,'Synthetic identity','Synthetic private profile remains scoped to its owner')`, [id]);
    await db.pool.query(`INSERT INTO identities(user_id,issuer,subject,provider) VALUES($1::uuid,'auth0-fixture',$1::text,'EMAIL'),($1::uuid,'apple-fixture',$1::text,'APPLE')`, [id]);
  }
  const receipt = (await db.pool.query(`INSERT INTO deletion_requests(user_id,receipt_token_hash,status,requested_at,policy_version) VALUES($1,$2,'PENDING',clock_timestamp(),'fixture-policy') RETURNING id`, [user, randomBytes(32).toString('hex')])).rows[0].id as string;
  return { user, other, receipt };
}
async function enqueue(receipt: string) { await db.pool.query(`INSERT INTO jobs(kind,resource_id,due_at,run_after) VALUES('account.purge',$1,clock_timestamp(),clock_timestamp())`, [receipt]); }
async function receipt(id: string) { return (await db.pool.query(`SELECT status,completed_at,provider_steps FROM deletion_requests WHERE id=$1`, [id])).rows[0]; }
async function assertOtherIntact(id: string) {
  expect((await db.pool.query(`SELECT status FROM users WHERE id=$1`, [id])).rows[0].status).toBe('ACTIVE');
  expect((await db.pool.query(`SELECT 1 FROM profiles WHERE user_id=$1`, [id])).rowCount).toBe(1);
  expect((await db.pool.query(`SELECT 1 FROM identities WHERE user_id=$1`, [id])).rowCount).toBe(2);
}
describe('QA-PRIVACY-007 production deletion handler with injected provider steps', () => {
  it('Auth0 failure never completes, preserves remote lookup identities, and a restarted handler resumes with stable step keys', async () => {
    const f = await fixture(); let recovered = false;
    const auth0 = vi.fn<DeletionStep['revoke']>(async () => { if (!recovered) throw Error('PRIVATE_PROVIDER_TOKEN_SENTINEL'); return 'COMPLETED'; });
    const apple = vi.fn<DeletionStep['revoke']>(async () => 'COMPLETED');
    const tick = () => createRunner({ pool: db.pool, owner: 'step-recovery', handlers: { 'account.purge': deletionHandler(db.pool, { auth0: { revoke: auth0 }, apple: { revoke: apple } }, true) } }).tick();
    await enqueue(f.receipt); expect(await tick()).toMatchObject({ done: 1 });
    expect(await receipt(f.receipt)).toMatchObject({ status: 'NEEDS_SUPPORT', completed_at: null, provider_steps: { local: 'COMPLETED', auth0: 'NEEDS_SUPPORT', identity: 'NEEDS_SUPPORT' } });
    expect(JSON.stringify(await receipt(f.receipt))).not.toContain('PRIVATE_PROVIDER_TOKEN_SENTINEL');
    expect(apple).not.toHaveBeenCalled(); expect((await db.pool.query(`SELECT 1 FROM profiles WHERE user_id=$1`, [f.user])).rowCount).toBe(0);
    expect((await db.pool.query(`SELECT 1 FROM identities WHERE user_id=$1`, [f.user])).rowCount).toBe(2); await assertOtherIntact(f.other);
    recovered = true; await enqueue(f.receipt); expect(await tick()).toMatchObject({ done: 1 });
    expect(await receipt(f.receipt)).toMatchObject({ status: 'COMPLETED', completed_at: expect.any(Date), provider_steps: { auth0: 'COMPLETED', apple: 'COMPLETED', identity: 'COMPLETED', retention: 'APPROVED' } });
    expect(auth0.mock.calls.map(([arg]) => arg)).toEqual(Array(2).fill({ userId: f.user, deletionId: f.receipt, idempotencyKey: `${f.receipt}:auth0` }));
    expect(apple).toHaveBeenCalledWith({ userId: f.user, deletionId: f.receipt, idempotencyKey: `${f.receipt}:apple` });
    expect((await db.pool.query(`SELECT 1 FROM identities WHERE user_id=$1`, [f.user])).rowCount).toBe(0);
    await enqueue(f.receipt); await tick(); expect(auth0).toHaveBeenCalledTimes(2); expect(apple).toHaveBeenCalledTimes(1); await assertOtherIntact(f.other);
  });
  it('Apple failure preserves the completed Auth0 checkpoint and recovery skips that step after process reconstruction', async () => {
    const f = await fixture(); let recovered = false;
    const auth0 = vi.fn<DeletionStep['revoke']>(async () => 'COMPLETED');
    const apple = vi.fn<DeletionStep['revoke']>(async () => recovered ? 'COMPLETED' : 'NEEDS_SUPPORT');
    const tick = () => createRunner({ pool: db.pool, owner: 'apple-recovery', handlers: { 'account.purge': deletionHandler(db.pool, { auth0: { revoke: auth0 }, apple: { revoke: apple } }, true) } }).tick();
    await enqueue(f.receipt); await tick();
    expect(await receipt(f.receipt)).toMatchObject({ status: 'NEEDS_SUPPORT', completed_at: null, provider_steps: { local: 'COMPLETED', auth0: 'COMPLETED', apple: 'NEEDS_SUPPORT', identity: 'NEEDS_SUPPORT' } });
    expect((await db.pool.query(`SELECT status FROM users WHERE id=$1`, [f.user])).rows[0].status).toBe('DELETING');
    recovered = true; await enqueue(f.receipt); await tick();
    expect(auth0).toHaveBeenCalledTimes(1); expect(apple).toHaveBeenCalledTimes(2);
    expect(apple.mock.calls[0]).toEqual(apple.mock.calls[1]);
    expect(await receipt(f.receipt)).toMatchObject({ status: 'COMPLETED', provider_steps: { auth0: 'COMPLETED', apple: 'COMPLETED' } }); await assertOtherIntact(f.other);
  });
  it('a timed-out remote success is retried with the same key, produces one remote effect, and still cannot bypass retention approval', async () => {
    const f = await fixture(), effects = new Set<string>();
    const auth0 = vi.fn<DeletionStep['revoke']>(async input => { if (effects.has(input.idempotencyKey)) return 'COMPLETED'; effects.add(input.idempotencyKey); throw Error('Timeout after provider side effect'); });
    const apple = vi.fn<DeletionStep['revoke']>(async () => 'COMPLETED');
    const tick = (approved: boolean) => createRunner({ pool: db.pool, owner: 'unknown-recovery', handlers: { 'account.purge': deletionHandler(db.pool, { auth0: { revoke: auth0 }, apple: { revoke: apple } }, approved) } }).tick();
    await enqueue(f.receipt); await tick(false); expect((await receipt(f.receipt)).status).toBe('NEEDS_SUPPORT');
    await enqueue(f.receipt); await tick(false);
    expect(await receipt(f.receipt)).toMatchObject({ status: 'NEEDS_SUPPORT', completed_at: null, provider_steps: { auth0: 'COMPLETED', apple: 'COMPLETED', identity: 'COMPLETED', retention: 'NEEDS_APPROVAL' } });
    expect(effects.size).toBe(1); expect(auth0).toHaveBeenCalledTimes(2); expect(apple).toHaveBeenCalledTimes(1);
    await enqueue(f.receipt); await tick(true); expect((await receipt(f.receipt)).status).toBe('COMPLETED');
    expect(auth0).toHaveBeenCalledTimes(2); expect(apple).toHaveBeenCalledTimes(1); await assertOtherIntact(f.other);
  });
  it('refuses remote work without the matching accepted deletion/local purge barrier and fails closed when unconfigured', async () => {
    const f = await fixture(); const auth0 = vi.fn<DeletionStep['revoke']>(async () => 'COMPLETED'), apple = vi.fn<DeletionStep['revoke']>(async () => 'COMPLETED');
    const p = new StepwiseDeletionProvider(db.pool, { auth0: { revoke: auth0 }, apple: { revoke: apple } });
    expect(await p.revoke(f.user, f.receipt)).toBe('NEEDS_SUPPORT'); expect(await p.revoke(f.other, f.receipt)).toBe('NEEDS_SUPPORT');
    expect(auth0).not.toHaveBeenCalled(); expect(apple).not.toHaveBeenCalled();
    await enqueue(f.receipt); await createRunner({ pool: db.pool, owner: 'unconfigured-steps', handlers: { 'account.purge': deletionHandler(db.pool, new UnavailableDeletionSteps(), true) } }).tick();
    expect(await receipt(f.receipt)).toMatchObject({ status: 'NEEDS_SUPPORT', completed_at: null, provider_steps: { local: 'COMPLETED', auth0: 'NEEDS_SUPPORT' } }); await assertOtherIntact(f.other);
  });
  it('an older overlapping timeout cannot overwrite another confirmed step completion', async () => {
    const f = await fixture(); await db.pool.query(`UPDATE deletion_requests SET status='PROCESSING',provider_steps='{"local":"COMPLETED"}' WHERE id=$1`, [f.receipt]);
    let announce: () => void = () => undefined, finishFirst: (value: 'NEEDS_SUPPORT') => void = () => undefined;
    const entered = new Promise<void>(resolve => { announce = resolve; });
    const delayed = new Promise<'NEEDS_SUPPORT'>(resolve => { finishFirst = resolve; });
    let calls = 0;
    const auth0: DeletionStep = { revoke: async () => { if (++calls === 1) { announce(); return delayed; } return 'COMPLETED'; } };
    const apple = vi.fn<DeletionStep['revoke']>(async () => 'COMPLETED');
    const p = new StepwiseDeletionProvider(db.pool, { auth0, apple: { revoke: apple } });
    const old = p.revoke(f.user, f.receipt); await entered;
    expect(await p.revoke(f.user, f.receipt)).toBe('COMPLETED');
    finishFirst('NEEDS_SUPPORT'); expect(await old).toBe('COMPLETED');
    expect(await receipt(f.receipt)).toMatchObject({ provider_steps: { auth0: 'COMPLETED', apple: 'COMPLETED' } });
    expect(apple).toHaveBeenCalledTimes(1); await assertOtherIntact(f.other);
  });
});
