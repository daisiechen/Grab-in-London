import type { ResponseOf } from '@fancy/client';

type Meal = ResponseOf<'getMeal'>['data']['meal'];

/**
 * Write responses (createMeal, editMeal, declareBooking, cancelMeal, leaveMeal) carry the meal
 * without provider display data: the server never calls Places inside the business transaction, so
 * `venue.available` is false and name/address/location are null. When such a response replaces a
 * cached meal for the same restaurant, keep the display the last read already had instead of
 * showing “restaurant unavailable”; a fresh read replaces it either way.
 */
export function keepVenueDisplay(next: Meal, previous: Meal['venue'] | null | undefined): Meal {
  if (next.venue.available || !previous?.available || previous.venueRef !== next.venue.venueRef) return next;
  return { ...next, venue: previous };
}
