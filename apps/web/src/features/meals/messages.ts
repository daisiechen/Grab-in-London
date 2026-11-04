import { ApiError } from '@fancy/client';

/** Copy for meal write rejections; branches on stable codes only. */
export function mealActionMessage(e: ApiError): string {
  switch (e.code) {
    case 'MEAL_FULL':
      return 'This table is full.';
    case 'DEADLINE_PASSED':
      return 'Applications have closed.';
    case 'MEAL_CANCELLED':
      return 'This meal was cancelled.';
    case 'APPLICATION_DECLINED_FINAL':
      return 'The host can’t accept another request from you for this meal.';
    case 'ARRANGEMENT_LOCKED':
      return 'The time, place and table size are locked after the first guest is approved.';
    case 'VERSION_CONFLICT':
    case 'STATE_CONFLICT':
      return 'This changed a moment ago. We’ve refreshed it — please check and try again.';
    case 'PROFILE_INCOMPLETE':
      return 'Complete your profile before applying.';
    case 'FORBIDDEN':
      return 'You can’t do that for this meal.';
    case 'NOT_FOUND':
      return 'This meal isn’t available any more.';
    default:
      break;
  }
  if (e.kind === 'network') return 'We couldn’t confirm this with Fancy. Check your connection and try again.';
  if (e.kind === 'rate_limit') return 'Too many attempts. Please wait a moment and try again.';
  return 'Something went wrong. Please try again.';
}
