/** QA-owned extension of d4582f7 restore fixture: actual pre-backup export E0 must stay revoked. */
import {randomBytes,randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterAll,beforeAll,expect,inject,it} from 'vitest';
import {loadConfig} from '../packages/config/src/index.ts';
import {migrate} from '../packages/db/src/index.ts';
import {createMigratedDatabase} from '../packages/testkit/src/db/index.ts';
import {createHarness,Browser,json,WEB_ORIGIN,type Harness} from '../apps/api/src/test/harness.ts';
import {buildServer} from '../apps/api/src/http/server.ts';
import {TestIdentityProvider} from '../apps/api/src/identity/test-provider.ts';
import {requireRecovery,replayDeletionLedger,type DeletionLedger} from '../apps/api/src/recovery/replay.ts';
import {sealSourceSnapshot} from '../apps/api/src/admin/snapshots.ts';
import {createWorkerRuntime} from '../apps/worker/src/main.ts';
const run=promisify(execFile);let h:Harness;
beforeAll(async()=>{h=await createHarness(inject('pgServerUrl'));});afterAll(async()=>h.close());
it('QA-PRIVACY-008 independent restore keeps a real exported E0 revoked and original deletion receipt stable',async()=>{
 const started=performance.now(),dir=await mkdtemp(join(tmpdir(),'fancy-recovery-'));
 const b=new Browser(h),other=new Browser(h);
 const subject=(await b.signInWithEmail(`${randomUUID()}@example.invalid`)).body.data.session.user.id as string;
 const survivor=(await other.signInWithEmail(`${randomUUID()}@example.invalid`)).body.data.session.user.id as string;
 const subjectCookie=[...b.cookies].map(([k,v])=>`${k}=${v}`).join('; '),survivorCookie=[...other.cookies].map(([k,v])=>`${k}=${v}`).join('; ');
 const snapshot=await sealSourceSnapshot(h.db.pool,new Date('2026-01-01'));
 await h.db.pool.query(`INSERT INTO roles(user_id,role,granted_by) VALUES($1,'analyst','isolated-qa')`,[survivor]);
 await h.db.pool.query(`UPDATE session_families SET amr=ARRAY['otp','mfa'] WHERE user_id=$1`,[survivor]);
 const exported=await other.request('POST','/v1/admin/exports',{body:{snapshotId:snapshot,metric:'formation',filters:{}},headers:{'idempotency-key':randomUUID()}});expect(exported.statusCode,exported.body).toBe(201);const exportId=json(exported).data.exportId;
 expect((await other.request('GET',`/v1/admin/exports/${exportId}`)).statusCode).toBe(200);
 const backup=join(dir,'backup.dump');
 if(!process.env.FANCY_PG_BIN)throw new Error('Local pg_dump/pg_restore binaries required for recovery drill');
 await run(join(process.env.FANCY_PG_BIN,'pg_dump'),['--dbname',h.db.url,'--format=custom','--file',backup]);
 const deleted=await b.request('POST','/v1/me/deletion',{body:{confirm:true,receiptToken:randomBytes(32).toString('base64url')},headers:{'idempotency-key':randomUUID(),'if-match':'"1"'}});
 expect(deleted.statusCode,deleted.body).toBe(202);
 const {rows:[entry]}=await h.db.pool.query(`SELECT id AS "deletionId",user_id AS "userId",requested_at AS "acceptedAt",receipt_token_hash AS "receiptTokenHash",expires_at AS "expiresAt",policy_version AS "policyVersion" FROM deletion_requests WHERE user_id=$1`,[subject]);
 // This manifest is outside the backup being restored. Never reconstruct it from that old copy.
 const ledger:DeletionLedger={version:1,entries:[{...entry,acceptedAt:entry.acceptedAt.toISOString(),expiresAt:entry.expiresAt?.toISOString()??null}]};
 const ledgerPath=join(dir,'independent-ledger.json');await writeFile(ledgerPath,JSON.stringify(ledger),{mode:0o600,flag:'wx'});
 const persistedLedger=JSON.parse(await readFile(ledgerPath,'utf8')) as DeletionLedger;expect(persistedLedger).toEqual(ledger);
 const restored=await createMigratedDatabase(inject('pgServerUrl'),async()=>{});
 let app:Awaited<ReturnType<typeof buildServer>>|undefined;
 try{
  await run(join(process.env.FANCY_PG_BIN,'pg_restore'),['--dbname',restored.url,'--no-owner','--no-privileges',backup]);
  await migrate(restored.url); // verify restored migration checksums, not an in-memory substitute.
  const config=loadConfig({ENVIRONMENT:'test',DATABASE_URL:restored.url,AUTH_ADAPTER:'test',PLACES_ADAPTER:'fixture',MAIL_ADAPTER:'outbox_test',AI_PROVIDER:'mock',WEB_ORIGIN,SESSION_SECRET:'api-test-session-secret-0123456789abcdef',IOS_REDIRECT_URI:'fancy://auth/callback'});
  const deps={config,pool:restored.pool,identity:new TestIdentityProvider('test'),publicOrigin:WEB_ORIGIN};
  await requireRecovery(restored.pool,persistedLedger); // ingress/worker remain stopped until gate is armed.
  app=await buildServer(deps);
  expect((await app.inject('/health/ready')).statusCode).toBe(503);
  expect((await app.inject('/v1/me')).statusCode).toBe(503);
  expect((await createWorkerRuntime(restored.pool,config).tick()).claimed).toBe(0);
  await expect(replayDeletionLedger(deps,{version:1,entries:[]})).rejects.toThrow('RECOVERY_LEDGER_MISMATCH');
  expect((await app.inject('/health/ready')).statusCode).toBe(503);
  await replayDeletionLedger(deps,persistedLedger);
  expect((await app.inject('/health/ready')).statusCode).toBe(200);
  expect((await restored.pool.query(`SELECT status FROM users WHERE id=$1`,[subject])).rows[0].status).toBe('DELETING');
  expect((await restored.pool.query(`SELECT 1 FROM session_families WHERE user_id=$1 AND revoked_at IS NULL`,[subject])).rowCount).toBe(0);
  expect((await restored.pool.query(`SELECT revoked_at FROM analytics_snapshots WHERE id=$1`,[snapshot])).rows[0].revoked_at).not.toBeNull();
  expect((await restored.pool.query(`SELECT status FROM users WHERE id=$1`,[survivor])).rows[0].status).toBe('ACTIVE');
  const oldExport=await app.inject({method:'GET',url:`/v1/admin/exports/${exportId}`,headers:{cookie:survivorCookie}});expect(oldExport.statusCode,oldExport.body).toBe(410);expect(json(oldExport).error.code).toBe('SNAPSHOT_REVOKED');expect(oldExport.headers['content-type']).not.toContain('text/csv');

  await requireRecovery(restored.pool,persistedLedger);await replayDeletionLedger(deps,persistedLedger);
  expect((await restored.pool.query(`SELECT count(*)::int n FROM deletion_requests WHERE user_id=$1`,[subject])).rows[0].n).toBe(1);
  expect((await restored.pool.query('SELECT id,receipt_token_hash FROM deletion_requests WHERE user_id=$1',[subject])).rows[0]).toEqual({id:entry.deletionId,receipt_token_hash:entry.receiptTokenHash});
  const audit=await restored.pool.query(`SELECT 1 FROM audit_events WHERE actor_kind='SYSTEM' AND action='account.deletion_accepted'`);expect(audit.rowCount).toBe(1);
  const recoveryElapsedMs=performance.now()-started;expect(recoveryElapsedMs).toBeLessThan(4*3600_000);console.warn(JSON.stringify({drill:'isolated_pg_restore',recoveryElapsedMs,replayed:ledger.entries.length,independentLedger:true,productionEvidence:false}));
  expect((await app.inject({method:'GET',url:'/v1/auth/session',headers:{cookie:subjectCookie}})).statusCode).toBe(401);
  expect(json(await app.inject({method:'GET',url:'/v1/auth/session',headers:{cookie:survivorCookie}})).data.user.id).toBe(survivor);
 }finally{await app?.close();await restored.drop();await rm(dir,{recursive:true,force:true});}
});
