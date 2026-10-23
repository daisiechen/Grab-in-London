import type { dto } from '@fancy/contracts';
import type { Static } from '@sinclair/typebox';
import { ApiError } from './errors.ts';
import type { ApiClient } from './http.ts';

export type CommandReceipt = Static<typeof dto.CommandReceipt>;

/**
 * Client view of one write intent (P1.1 P03). `unknown` and `pending` keep the original
 * key+body+If-Match; only `saved` clears the intent. Equal current values never imply `saved`.
 * - resend: safe to resend the identical request with the same key (lost lease / never recorded)
 * - conflict: definite 409 version conflict, reload latest and ask the person to re-confirm
 * - reauth: rejected before the server claimed the intent; sign in again, then resend same key
 * - expired: the key's window passed without a known success; it can never be resent. Reload the
 *   authoritative resource and let the person confirm a new intent explicitly (no auto new key)
 */
export type IntentOutcome = 'saved' | 'pending' | 'unknown' | 'resend' | 'conflict' | 'rejected' | 'reauth' | 'expired';

export function outcomeFromError(error: unknown): IntentOutcome {
  if (!(error instanceof ApiError)) return 'unknown';
  if (error.kind === 'network' || error.kind === 'unavailable' || error.kind === 'internal' || error.kind === 'rate_limit') return 'unknown';
  if (error.kind === 'auth') return 'reauth';
  if (error.code === 'INTENT_IN_PROGRESS') return 'pending';
  if (error.code === 'VERSION_CONFLICT') return 'conflict';
  return 'rejected';
}

export function outcomeFromReceipt(receipt: CommandReceipt): IntentOutcome {
  switch (receipt.state) {
    case 'SUCCEEDED': return 'saved';
    case 'PENDING': return receipt.expired ? 'expired' : receipt.retryable ? 'resend' : 'pending';
    // No record is not a definite failure: only the identical request with the same key may be resent.
    case 'NONE': return 'resend';
    case 'REJECTED':
      if (receipt.conflict === 'VERSION') return 'conflict';
      if (receipt.conflict === 'IN_PROGRESS') return receipt.expired ? 'expired' : 'pending';
      return 'rejected';
  }
}

/** Reads the original intent's receipt; a failed read keeps the intent `unknown`. */
export async function reconcileIntent(client: ApiClient, operation: string, key: string): Promise<{ outcome: IntentOutcome; receipt: CommandReceipt | null }> {
  try {
    const response = await client.call('getCommandReceipt', { params: { operation, key } });
    return { outcome: outcomeFromReceipt(response.data), receipt: response.data };
  } catch (error) {
    return { outcome: outcomeFromError(error) === 'reauth' ? 'reauth' : 'unknown', receipt: null };
  }
}
