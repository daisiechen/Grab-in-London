/** Contract-shaped test data (fictional). */
import type { PublicProfile } from '../api/types.ts';

export const USER_ID = '11111111-1111-4111-8111-111111111111';
export const HOST_ID = '22222222-2222-4222-8222-222222222222';
export const MEAL_ID = '33333333-3333-4333-8333-333333333333';
export const VENUE_REF = '44444444-4444-4444-8444-444444444444';
export const APPLICATION_ID = '55555555-5555-4555-8555-555555555555';

export function me(overrides: Record<string, unknown> = {}) {
  return {
    id: USER_ID, version: '3', displayName: 'Sam Rivera', avatarRef: null,
    bio: 'I moved to London last spring and love trying new food.', languages: ['en'], lifeStatus: 'NEW_TO_LONDON',
    interests: ['FOOD'], background: {}, email: 'sam@example.test', ageConfirmedVersion: '2026-10', communityAcceptedVersion: '2026-10',
    profileGate: { ageConfirmed: true, communityAccepted: true, profileComplete: true, missing: [] }, roles: [],
    ...overrides,
  };
}

export function session(meOverrides: Record<string, unknown> = {}) {
  return { user: me(meOverrides), csrfToken: 'csrf-token-0123456789', authTime: '2026-10-21T11:00:00.000Z', amr: ['otp'] };
}

export function publicProfile(id = HOST_ID, displayName = 'Maya Chen'): PublicProfile {
  return { id, displayName, avatarUrl: null, bio: 'Designer who loves dumplings and long dinners.', interests: ['FOOD'], languages: ['en', 'zh'] };
}

export function meal(overrides: Record<string, unknown> = {}) {
  return {
    id: MEAL_ID, version: '7', host: publicProfile(),
    venue: { venueRef: VENUE_REF, placeId: 'place-1', available: true, name: 'Dishoom Carnaby', address: '22 Kingly St, London', location: null, areaCode: 'soho', attributions: [], displayExpiresAt: null },
    title: 'Friday dinner & new faces', description: 'A relaxed dinner with good company and plenty of small plates.',
    startsAt: { instant: '2026-10-23T18:30:00.000Z', localDate: '2026-10-23', localTime: '19:30', timeZone: 'Europe/London', utcOffsetMinutes: 60 },
    closesAt: { instant: '2026-10-23T17:30:00.000Z', localDate: '2026-10-23', localTime: '18:30', timeZone: 'Europe/London', utcOffsetMinutes: 60 },
    scheduledEndAt: '2026-10-23T20:30:00.000Z', minimum: 3, capacity: 4, confirmedCount: 2, members: [publicProfile()],
    budgetMinPence: 2500, budgetMaxPence: 4000, currency: 'GBP', languages: ['en'], mood: 'EASY_CONVERSATION', areaCode: 'soho',
    cuisineCode: null, dietaryCodes: null, declarationSource: 'host_reported', bookingMode: 'EXTERNAL_PAY_AT_VENUE', status: 'OPEN',
    cancelReason: null, arrangementLocked: false, bookingDeclaration: null, allowedActions: ['APPLY'],
    ...overrides,
  };
}
