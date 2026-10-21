import { ApiError } from '@fancy/client';

/** Field errors from a 422 response, keyed by JSON pointer-ish field name. */
export function fieldErrorsOf(error: unknown): Record<string, string> {
  return error instanceof ApiError && error.fieldErrors ? error.fieldErrors : {};
}

/** User-facing copy, branching on stable codes only (never on server message text). */
export function errorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Something went wrong. Please try again.';
  switch (error.code) {
    case 'NETWORK_ERROR': return 'You appear to be offline. Check your connection and try again.';
    case 'AUTH_REQUIRED': return 'Please sign in to continue.';
    case 'PROFILE_INCOMPLETE': return 'Complete your profile before continuing.';
    case 'REAUTH_REQUIRED': return 'For your security, please confirm it’s you again.';
    case 'FORBIDDEN': return 'This action isn’t available to you right now.';
    case 'NOT_FOUND': return 'We couldn’t find that. It may have been removed.';
    case 'VERSION_CONFLICT': return 'This was updated elsewhere. We’ve refreshed the latest details; please check and try again.';
    case 'IDEMPOTENCY_CONFLICT': return 'This request changed while it was being sent. Please try again.';
    case 'INTENT_IN_PROGRESS': return 'Still working on your last request. Please wait a moment.';
    case 'DEADLINE_PASSED': return 'Applications for this meal have closed.';
    case 'MEAL_FULL': return 'This table is full.';
    case 'MEAL_CANCELLED': return 'This meal was cancelled.';
    case 'APPLICATION_DECLINED_FINAL': return 'Your earlier request for this meal was declined, so you can’t apply again.';
    case 'ARRANGEMENT_LOCKED': return 'A guest has been approved, so the arrangements can no longer be changed.';
    case 'TIME_AMBIGUOUS': return 'This London time happens twice when the clocks go back. Choose BST or GMT.';
    case 'TIME_NONEXISTENT': return 'This London time doesn’t exist because the clocks go forward. Choose another time.';
    case 'INVALID_OFFSET': return 'That time zone offset doesn’t match London time. Choose the time again.';
    case 'CONNECTION_NOT_AUTHORIZED': return 'You can’t message this person right now.';
    case 'PROVIDER_UNAVAILABLE': return 'The service is temporarily unavailable. Please try again shortly.';
    case 'RATE_LIMITED':
      return error.retryAfterSeconds !== undefined
        ? `Too many attempts. Try again in ${error.retryAfterSeconds} seconds.`
        : 'Too many attempts. Please wait a moment.';
    case 'LINK_REQUIRED': return 'An account already uses this email. Sign in the way you did before to link them.';
    case 'LINK_TICKET_INVALID': return 'This link request has expired. Please sign in again.';
    case 'ACCOUNT_LINK_CONFLICT': return 'Both accounts already have activity, so they can’t be linked automatically.';
    default:
      if (error.kind === 'validation') return 'Please check the highlighted details.';
      if (error.kind === 'rate_limit') return 'Too many attempts. Please wait a moment.';
      if (error.kind === 'unavailable') return 'The service is temporarily unavailable. Please try again shortly.';
      return 'Something went wrong. Please try again.';
  }
}
