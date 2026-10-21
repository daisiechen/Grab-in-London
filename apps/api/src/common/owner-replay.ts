import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormatsImport from 'ajv-formats';
import { dto, Meta, Obj } from '@fancy/contracts';
import type { Pool } from 'pg';
import type { Claim } from './idempotency.ts';

const addFormats = addFormatsImport as unknown as (ajv: Ajv2020) => Ajv2020;
const ajv = new Ajv2020({ removeAdditional: false, coerceTypes: false, useDefaults: false });
addFormats(ajv);
const survey = ajv.compile(Obj({ data: dto.ProductSurvey, meta: Meta }));
const application = ajv.compile(Obj({ data: dto.Application, meta: Meta }));
type RecordValue = Record<string, unknown>;
function closed(value: unknown, keys: readonly string[]): value is RecordValue {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every((key) => keys.includes(key));
}

/** A deliberately frozen field allowlist, independent of future DTO expansion.
 * Only self-owned success responses can survive an unrelated global privacy epoch change.
 * Never sanitize a stored response: an unknown field rejects the entire replay.
 */
export async function ownerOnlyReplay(pool: Pool, operation: string, actorId: string,
  claim: Extract<Claim, { kind: 'replay' }>, params: unknown): Promise<boolean> {
  if (!closed(claim.body, ['data', 'meta']) || !closed(claim.body.meta, ['requestId', 'serverNow', 'version'])) return false;
  const data = claim.body.data;
  if (operation === 'putSurvey') {
    if (claim.status !== 200 || claim.resourceId !== actorId || !survey(claim.body) ||
      !closed(data, ['version', 'again', 'reasons', 'submittedAt']) || data.version !== claim.body.meta.version || data.submittedAt === null) return false;
    const { rowCount } = await pool.query('SELECT 1 FROM product_surveys WHERE user_id=$1 AND version=$2', [actorId, data.version]);
    return rowCount === 1;
  }
  if (operation === 'applyMeal') {
    if (claim.status !== 201 || !application(claim.body) ||
      !closed(data, ['id', 'mealId', 'version', 'round', 'state', 'createdAt', 'decidedAt', 'message', 'applicant']) ||
      claim.resourceId !== data.id || data.version !== claim.body.meta.version ||
      !closed(data.applicant, ['id', 'displayName', 'avatarUrl', 'bio', 'languages', 'interests', 'background']) || data.applicant.id !== actorId ||
      (data.applicant.background !== undefined && !closed(data.applicant.background, ['work', 'school', 'hometown'])) ||
      !closed(params, ['mealId']) || params.mealId !== data.mealId) return false;
    const { rowCount } = await pool.query('SELECT 1 FROM applications WHERE id=$1 AND user_id=$2 AND meal_id=$3', [claim.resourceId, actorId, data.mealId]);
    return rowCount === 1;
  }
  return false;
}
