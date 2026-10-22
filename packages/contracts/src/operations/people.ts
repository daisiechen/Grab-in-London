import { Obj, T, Text, UniqueArray, Uuid } from '../schema.ts';
import { Cursor, Limit } from '../common.ts';
import { AvatarRef, Background, InterestCode, LanguageCode, LifeStatusCode, Me, PublicProfile, PublicReview, Venue, VenueCandidate, VenuePhoto } from '../dto.ts';
import { op } from '../operation.ts';

/** PATCH /me allow-list; `lifeStatus` is profile data and can never touch users.status. */
const MePatch = Obj(
  {
    displayName: T.Optional(Text(2, 40)),
    avatarRef: T.Optional(T.Union([AvatarRef, T.Null()])),
    bio: T.Optional(Text(20, 1000)),
    languages: T.Optional(UniqueArray(LanguageCode, 1, 5)),
    lifeStatus: T.Optional(LifeStatusCode),
    interests: T.Optional(UniqueArray(InterestCode, 1, 11)),
    background: T.Optional(Background),
    ageConfirmedVersion: T.Optional(T.String({ minLength: 1, maxLength: 40 })),
    communityAcceptedVersion: T.Optional(T.String({ minLength: 1, maxLength: 40 })),
  },
  { minProperties: 1 },
);

const Bounds = {
  north: T.Optional(T.Number({ minimum: -90, maximum: 90 })),
  south: T.Optional(T.Number({ minimum: -90, maximum: 90 })),
  east: T.Optional(T.Number({ minimum: -180, maximum: 180 })),
  west: T.Optional(T.Number({ minimum: -180, maximum: 180 })),
};

export const peopleOperations = [
  op({
    operationId: 'getMe', method: 'GET', path: '/me', summary: 'Own private profile and gates',
    auth: 'session', write: 'read', ifMatch: false, success: { status: 200, data: Me }, errors: [],
  }),
  op({
    operationId: 'updateMe', method: 'PATCH', path: '/me', summary: 'Edit own profile (allow-listed fields)',
    auth: 'session', write: 'idempotencyKey', ifMatch: true, body: MePatch,
    success: { status: 200, data: Me }, errors: [],
  }),
  op({
    operationId: 'getPublicProfile', method: 'GET', path: '/profiles/{userId}', summary: 'Public profile and published reviews',
    auth: 'public', write: 'read', ifMatch: false,
    params: Obj({ userId: Uuid }), query: Obj({ cursor: T.Optional(Cursor), limit: T.Optional(Limit) }),
    success: { status: 200, data: Obj({ profile: PublicProfile, reviews: T.Array(PublicReview, { maxItems: 100 }), nextReviewCursor: T.Union([Cursor, T.Null()]) }) },
    errors: ['NOT_FOUND'],
  }),
  op({
    operationId: 'searchVenues', method: 'GET', path: '/venues', summary: 'Search restaurant candidates (not yet confirmed)',
    auth: 'public', write: 'read', ifMatch: false,
    query: Obj({ q: T.Optional(T.String({ minLength: 1, maxLength: 120 })), ...Bounds, cursor: T.Optional(Cursor) }),
    success: { status: 200, data: VenueCandidate, list: true }, errors: ['PROVIDER_UNAVAILABLE'],
  }),
  op({
    operationId:'getVenuePhoto',method:'GET',path:'/venues/{venueRef}/photo',summary:'Fresh restaurant photograph and mandatory author attribution (never cached)',
    auth:'public',write:'read',ifMatch:false,params:Obj({venueRef:Uuid}),query:Obj({}),
    success:{status:200,data:VenuePhoto},errors:['NOT_FOUND','PROVIDER_UNAVAILABLE'],
  }),
  op({
    operationId: 'confirmVenue', method: 'POST', path: '/venues/confirm', summary: 'Server-side confirmation of a placeId',
    auth: 'session', write: 'idempotencyKey', ifMatch: false,
    body: Obj({ placeId: T.String({ minLength: 1, maxLength: 512 }) }),
    success: { status: 200, data: Venue }, errors: ['NOT_FOUND', 'PROVIDER_UNAVAILABLE'],
  }),
] as const;
