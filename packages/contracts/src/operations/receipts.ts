import { Obj, T, Uuid } from '../schema.ts';
import { CommandReceipt } from '../dto.ts';
import { op } from '../operation.ts';

/**
 * P1.1 P03: read-only receipt of an idempotent write by its original actor. Only operations
 * flagged `receipt: true` are served (others: 404). Rows are looked up under the caller's own
 * actor id, so another person's key is indistinguishable from an unused one (NONE).
 */
export const receiptOperations = [
  op({
    operationId: 'getCommandReceipt', method: 'GET', path: '/me/command-receipts/{operation}/{key}',
    summary: 'Original-intent outcome (pending / succeeded / rejected) for the caller\'s own key',
    auth: 'session', write: 'read', ifMatch: false,
    params: Obj({ operation: T.String({ pattern: '^[a-z][A-Za-z0-9]{1,63}$' }), key: Uuid }),
    success: { status: 200, data: CommandReceipt }, errors: ['NOT_FOUND', 'FORBIDDEN', 'REAUTH_REQUIRED'],
  }),
] as const;
