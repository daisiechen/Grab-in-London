import type { Me, SessionInfo } from '../features/auth/session.ts';
import type { CredentialStore, StoredRefresh } from '../features/auth/credential-store.ts';

export const USER_ID = '6a1f6c32-6c4e-4c4d-9a51-6c1d0e5f9b11';
export const ACCESS_1 = 'access-token-one-000000000000000000000';
export const ACCESS_2 = 'access-token-two-000000000000000000000';
export const REFRESH_1 = 'refresh-token-one-00000000000000000000';
export const REFRESH_2 = 'refresh-token-two-00000000000000000000';
export const HANDOFF = 'handoff-code-0000000000000000000000000';

export const NOW = Date.parse('2026-10-21T10:00:00Z');

export function credentials(access = ACCESS_1, refresh = REFRESH_1, now = NOW) {
  return {
    client: 'IOS' as const,
    accessToken: access,
    accessExpiresAt: new Date(now + 15 * 60_000).toISOString(),
    refreshToken: refresh,
    refreshExpiresAt: new Date(now + 30 * 24 * 3600_000).toISOString(),
  };
}

export function me(overrides: Partial<Me> = {}): Me {
  return {
    id: USER_ID,
    version: '3',
    displayName: 'Alex',
    avatarRef: null,
    bio: 'New to London and keen to share a table with new people.',
    languages: ['en'],
    lifeStatus: 'NEW_TO_LONDON',
    interests: ['FOOD'],
    background: {},
    email: 'alex@example.com',
    ageConfirmedVersion: '2026-10-21',
    communityAcceptedVersion: '2026-10-21',
    profileGate: { ageConfirmed: true, communityAccepted: true, profileComplete: true, missing: [] },
    roles: [],
    ...overrides,
  };
}

export const incompleteMe = () =>
  me({
    displayName: null,
    bio: null,
    languages: [],
    lifeStatus: null,
    interests: [],
    ageConfirmedVersion: null,
    communityAcceptedVersion: null,
    profileGate: { ageConfirmed: false, communityAccepted: false, profileComplete: false, missing: ['displayName', 'bio', 'languages', 'lifeStatus', 'interests', 'age', 'community'] },
  });

export function sessionInfo(user: Me = me()): SessionInfo {
  return { user, authTime: '2026-10-21T09:59:00Z', amr: ['otp'] };
}

/** In-memory CredentialStore double that records writes (Keychain stand-in for unit tests). */
export function memoryStore(initial: StoredRefresh | null = null): CredentialStore & { value: StoredRefresh | null; writes: StoredRefresh[] } {
  const s = {
    value: initial,
    writes: [] as StoredRefresh[],
    async readRefresh() {
      return s.value;
    },
    async writeRefresh(v: StoredRefresh) {
      s.value = v;
      s.writes.push(v);
    },
    async clear() {
      s.value = null;
    },
  };
  return s;
}

let counter = 0;
export const seqId = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`;

export const MEAL_ID = '9b2e4c61-7d3f-4a8b-9c1e-2f3a4b5c6d7e';
export const HOST_ID = '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f';
export const APP_ID = '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b';
export const CONVERSATION_ID = '7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d';

export const publicProfile = (id = HOST_ID, displayName = 'Maya') => ({
  id, displayName, avatarUrl: null, bio: 'Designer who loves long dinners and new people.', interests: ['FOOD' as const], languages: ['en' as const],
});

type MealFixture = import('../features/meals/format.ts').Meal;
export function meal(overrides: Partial<MealFixture> = {}): MealFixture {
  return {
    id: MEAL_ID,
    version: '7',
    host: publicProfile(),
    venue: {
      venueRef: '2c1b0a9f-8e7d-4c6b-9a5f-4e3d2c1b0a9f', placeId: 'place-1', available: true, name: 'Dishoom', address: '7 Boundary St, London',
      location: { lat: 51.52, lng: -0.077 }, areaCode: 'shoreditch', attributions: [{ provider: 'google', text: 'Google' }], displayExpiresAt: null,
    },
    title: 'Sunday dinner',
    description: 'A relaxed dinner with new faces and good food.',
    startsAt: { instant: '2026-10-25T19:00:00Z', localDate: '2026-10-25', localTime: '19:00', timeZone: 'Europe/London', utcOffsetMinutes: 0 },
    closesAt: { instant: '2026-10-25T18:00:00Z', localDate: '2026-10-25', localTime: '18:00', timeZone: 'Europe/London', utcOffsetMinutes: 0 },
    scheduledEndAt: '2026-10-25T22:00:00Z',
    minimum: 2,
    capacity: 4,
    confirmedCount: 1,
    members: [publicProfile()],
    budgetMinPence: 2000,
    budgetMaxPence: 3500,
    currency: 'GBP',
    languages: ['en'],
    mood: 'EASY_CONVERSATION',
    areaCode: 'shoreditch',
    cuisineCode: null,
    dietaryCodes: null,
    declarationSource: 'host_reported',
    bookingMode: 'EXTERNAL_PAY_AT_VENUE',
    status: 'OPEN',
    cancelReason: null,
    arrangementLocked: false,
    bookingDeclaration: null,
    allowedActions: ['APPLY'],
    ...overrides,
  };
}

export function application(overrides: Partial<import('../features/meals/format.ts').Application> = {}) {
  return { id: APP_ID, mealId: MEAL_ID, version: '2', round: 1, state: 'PENDING' as const, createdAt: '2026-10-21T09:00:00Z', ...overrides };
}
