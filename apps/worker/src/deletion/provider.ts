import type { Pool } from 'pg';

export type StepResult = 'COMPLETED' | 'NEEDS_SUPPORT';
export interface DeletionStep {
  /** A remote success means revocation/deletion was confirmed, including an already absent grant.
   * Providers must deduplicate the stable key across timeouts, restarts and overlapping leases.
   * No call may infer success from missing credentials or an unknown transport outcome. */
  revoke(input: { userId: string; deletionId: string; idempotencyKey: string }): Promise<StepResult>;
}
export interface DeletionSteps {
  /** Confirms all relevant Auth0 identities and refresh grants are deleted/revoked. */
  auth0: DeletionStep;
  /** Confirms Apple grants are revoked, or verifies that this account never had one.
   * A missing Apple credential is not proof that there is no linked grant. */
  apple: DeletionStep;
}
export class UnavailableDeletionStep implements DeletionStep {
  async revoke(): Promise<'NEEDS_SUPPORT'> { return 'NEEDS_SUPPORT'; }
}
export class UnavailableDeletionSteps implements DeletionSteps {
  readonly auth0 = new UnavailableDeletionStep();
  readonly apple = new UnavailableDeletionStep();
}
type StepName = keyof DeletionSteps;

/** Durable orchestration only; actual Auth0/Apple adapters and credentials remain external gates. */
export class StepwiseDeletionProvider {
  private readonly pool: Pool;
  private readonly steps: DeletionSteps;
  constructor(pool: Pool, steps: DeletionSteps) { this.pool = pool; this.steps = steps; }
  async revoke(userId: string, deletionId: string): Promise<StepResult> {
    const read = async () => (await this.pool.query<{ status: string; user_status: string; provider_steps: Record<string, string> }>(
      `SELECT d.status,u.status AS user_status,d.provider_steps FROM deletion_requests d JOIN users u ON u.id=d.user_id WHERE d.id=$1 AND d.user_id=$2`, [deletionId, userId],
    )).rows[0];
    const receipt = await read();
    if (receipt?.status === 'COMPLETED') return 'COMPLETED';
    if (!receipt || receipt.user_status !== 'DELETING' || receipt.provider_steps.local !== 'COMPLETED') return 'NEEDS_SUPPORT';
    for (const name of ['auth0', 'apple'] as const satisfies readonly StepName[]) {
      const current = await read();
      if (current?.status === 'COMPLETED') return 'COMPLETED';
      if (!current || current.provider_steps.local !== 'COMPLETED' || current.user_status !== 'DELETING') return 'NEEDS_SUPPORT';
      if (current.provider_steps[name] === 'COMPLETED') continue;
      let result: StepResult;
      try {
        const outcome = await this.steps[name].revoke({ userId, deletionId, idempotencyKey: `${deletionId}:${name}` });
        result = outcome === 'COMPLETED' ? 'COMPLETED' : 'NEEDS_SUPPORT';
      } catch { result = 'NEEDS_SUPPORT'; }
      // Remote I/O holds no SQL lock. Never overwrite a concurrent confirmed completion with
      // an older timeout/failure. Store only finite status enums, never provider exceptions.
      const { rows: [checkpoint] } = await this.pool.query<{ provider_steps: Record<string, string> }>(
        `UPDATE deletion_requests SET provider_steps=CASE WHEN provider_steps->>$3='COMPLETED' THEN provider_steps ELSE jsonb_set(provider_steps,ARRAY[$3::text],to_jsonb($4::text),true) END WHERE id=$1 AND user_id=$2 AND status<>'COMPLETED' RETURNING provider_steps`,
        [deletionId, userId, name, result],
      );
      if (!checkpoint) return (await read())?.status === 'COMPLETED' ? 'COMPLETED' : 'NEEDS_SUPPORT';
      if (checkpoint.provider_steps[name] !== 'COMPLETED') return 'NEEDS_SUPPORT';
    }
    const finished = await read();
    return finished?.provider_steps.auth0 === 'COMPLETED' && finished.provider_steps.apple === 'COMPLETED' ? 'COMPLETED' : 'NEEDS_SUPPORT';
  }
}
