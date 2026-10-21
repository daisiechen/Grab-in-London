import { ApiError } from '@fancy/client';

/** User-facing copy for auth failures; branches on code/kind only, never on server message text. */
export function authErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Something went wrong. Please try again.';
  switch (error.kind) {
    case 'network':
      return 'You appear to be offline. Check your connection and try again.';
    case 'rate_limit':
      return error.retryAfterSeconds ? `Too many attempts. Try again in ${error.retryAfterSeconds}s.` : 'Too many attempts. Please wait and try again.';
    case 'unavailable':
      return 'Sign-in is temporarily unavailable. Please try again shortly.';
    default:
      break;
  }
  if (error.code === 'STATE_CONFLICT') return 'This sign-in link has already been used or expired. Please start again.';
  return 'Sign-in didn’t finish. Please try again.';
}
