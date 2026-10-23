import { DecimalString, Enum, Obj, Pence, T, Text, UniqueArray, Uuid } from '../schema.ts';
import { Cursor, Limit, TimeInput } from '../common.ts';
import { BOOKING_DECLARATION_STATUSES, BOOKING_MODES, HOST_CANCEL_REASONS, MY_MEAL_SECTIONS, TIME_OF_DAY } from '../dictionaries.ts';
import { Application, CuisineCode, DietaryCode, LanguageCode, Meal, MoodCode, MyMealItem } from '../dto.ts';
import { op } from '../operation.ts';

/** Arrangement fields shared by create and edit; P-05 declarations are optional (null = not provided). */
const arrangement = {
  venueRef: Uuid,
  title: Text(5, 80),
  description: Text(20, 1000),
  start: TimeInput,
  close: TimeInput,
  minimum: T.Integer({ minimum: 2, maximum: 6 }),
  capacity: T.Integer({ minimum: 2, maximum: 6 }),
  budgetMinPence: Pence,
  budgetMaxPence: Pence,
  languages: UniqueArray(LanguageCode, 1, 5),
  mood: MoodCode,
  /** P-05 optional host declaration; omitted and null both mean not provided (normalizeHostDeclarations). */
  cuisineCode: T.Optional(T.Union([CuisineCode, T.Null()])),
  dietaryCodes: T.Optional(T.Union([UniqueArray(DietaryCode, 1, 2), T.Null()])),
};

const CreateMeal = Obj({
  ...arrangement,
  bookingMode: Enum(BOOKING_MODES),
  attemptId: Uuid,
  /** Must be explicitly ticked by the host; the schema refuses `false` and missing. */
  bookingDeclarationConfirmed: T.Literal(true),
  reviewConfirmed: T.Literal(true),
  termsVersion: T.String({ minLength: 1, maxLength: 40 }),
});

const EditMeal = T.Partial(Obj(arrangement), { additionalProperties: false, minProperties: 1 });

const csv = (pattern: string, maxLength = 400) => T.String({ pattern: `^(${pattern})(,(${pattern}))*$`, maxLength });

/** Discover filters (API §6): OR within a dimension, AND across; arrays travel as comma lists. */
const DiscoverQuery = Obj({
  north: T.Optional(T.Number({ minimum: -90, maximum: 90 })),
  south: T.Optional(T.Number({ minimum: -90, maximum: 90 })),
  east: T.Optional(T.Number({ minimum: -180, maximum: 180 })),
  west: T.Optional(T.Number({ minimum: -180, maximum: 180 })),
  dates: T.Optional(csv('\\d{4}-\\d{2}-\\d{2}')),
  timeOfDay: T.Optional(Enum(TIME_OF_DAY)),
  areaCodes: T.Optional(csv('[a-z0-9]+(-[a-z0-9]+)*')),
  budgetMaxPence: T.Optional(Pence),
  tableSizes: T.Optional(csv('[2-6]', 20)),
  languages: T.Optional(csv('en|zh|fr|es|hi', 40)),
  moods: T.Optional(csv('EASY_CONVERSATION|FOOD_DISCOVERIES|TRAVEL_CULTURE')),
  cuisineCodes: T.Optional(csv('EUROPEAN|JAPANESE|SPANISH|CHINESE')),
  dietaryCodes: T.Optional(csv('VEGETARIAN_OPTIONS|VEGAN')),
  keyword: T.Optional(T.String({ minLength: 1, maxLength: 80 })),
  cursor: T.Optional(Cursor),
  limit: T.Optional(Limit),
});

const MealId = Obj({ mealId: Uuid });
const ApplicationId = Obj({ applicationId: Uuid });

export const mealOperations = [
  op({
    operationId: 'discoverMeals', method: 'GET', path: '/meals', summary: 'Public discovery (pure lifecycle projection, no writes)',
    auth: 'optionalSession', write: 'read', ifMatch: false, query: DiscoverQuery,
    success: { status: 200, data: Meal, list: true }, errors: [],
  }),
  op({
    operationId: 'getMeal', method: 'GET', path: '/meals/{mealId}', summary: 'Public meal detail; own progress when signed in',
    auth: 'optionalSession', write: 'read', ifMatch: false, params: MealId,
    success: { status: 200, data: Obj({ meal: Meal, myApplication: T.Union([Application, T.Null()]), conversationId: T.Union([Uuid, T.Null()]) }) },
    errors: ['NOT_FOUND'],
  }),
  op({
    operationId: 'createMeal', method: 'POST', path: '/meals', summary: 'Publish a meal (host takes one seat)',
    auth: 'session', write: 'idempotencyKey', receipt: true, ifMatch: false, body: CreateMeal,
    success: { status: 201, data: Meal },
    errors: ['PROFILE_INCOMPLETE', 'NOT_FOUND', 'TIME_AMBIGUOUS', 'TIME_NONEXISTENT', 'INVALID_OFFSET'],
  }),
  op({
    operationId: 'editMeal', method: 'PATCH', path: '/meals/{mealId}', summary: 'Edit arrangement before the first guest is approved',
    auth: 'session', write: 'idempotencyKey', receipt: true, ifMatch: true, params: MealId, body: EditMeal,
    success: { status: 200, data: Meal },
    errors: ['FORBIDDEN', 'NOT_FOUND', 'ARRANGEMENT_LOCKED', 'MEAL_CANCELLED', 'DEADLINE_PASSED', 'TIME_AMBIGUOUS', 'TIME_NONEXISTENT', 'INVALID_OFFSET'],
  }),
  op({
    operationId: 'declareBooking', method: 'POST', path: '/meals/{mealId}/booking-declarations', summary: 'Host self-reported external booking status',
    auth: 'session', write: 'idempotencyKey', ifMatch: true, params: MealId,
    body: Obj({ status: Enum(BOOKING_DECLARATION_STATUSES), count: T.Integer({ minimum: 1, maximum: 6 }) }),
    success: { status: 201, data: Meal }, errors: ['FORBIDDEN', 'NOT_FOUND', 'MEAL_CANCELLED'],
  }),
  op({
    operationId: 'cancelMeal', method: 'POST', path: '/meals/{mealId}/cancel', summary: 'Host cancels before start (terminal)',
    auth: 'session', write: 'idempotencyKey', receipt: true, ifMatch: true, params: MealId,
    body: Obj({ reason: Enum(HOST_CANCEL_REASONS) }),
    success: { status: 200, data: Meal }, errors: ['FORBIDDEN', 'NOT_FOUND', 'MEAL_CANCELLED', 'DEADLINE_PASSED'],
  }),
  op({
    operationId: 'applyMeal', method: 'POST', path: '/meals/{mealId}/applications', summary: 'Apply (new round; pending holds no seat)',
    auth: 'session', write: 'idempotencyKey', receipt: true, ifMatch: false, params: MealId,
    body: Obj({ message: Text(20, 300), draftId: T.Optional(Uuid) }),
    success: { status: 201, data: Application },
    errors: ['PROFILE_INCOMPLETE', 'NOT_FOUND', 'FORBIDDEN', 'DEADLINE_PASSED', 'MEAL_FULL', 'MEAL_CANCELLED', 'APPLICATION_DECLINED_FINAL', 'STATE_CONFLICT'],
  }),
  op({
    operationId: 'listApplications', method: 'GET', path: '/meals/{mealId}/applications', summary: 'Host: all rounds; applicant: own rounds',
    auth: 'session', write: 'read', ifMatch: false, params: MealId, query: Obj({ cursor: T.Optional(Cursor), limit: T.Optional(Limit) }),
    success: { status: 200, data: Application, list: true }, errors: ['NOT_FOUND'],
  }),
  op({
    operationId: 'decideApplication', method: 'POST', path: '/applications/{applicationId}/decision', summary: 'Host approves or declines (atomic seat)',
    auth: 'session', write: 'idempotencyKey', receipt: true, ifMatch: true, params: ApplicationId,
    body: Obj({ decision: Enum(['APPROVE', 'DECLINE'] as const) }),
    success: { status: 200, data: Obj({ application: Application, mealVersion: DecimalString, conversationId: T.Union([Uuid, T.Null()]) }) },
    errors: ['FORBIDDEN', 'NOT_FOUND', 'DEADLINE_PASSED', 'MEAL_FULL', 'MEAL_CANCELLED', 'STATE_CONFLICT'],
  }),
  op({
    operationId: 'withdrawApplication', method: 'POST', path: '/applications/{applicationId}/withdraw', summary: 'Applicant withdraws a pending round',
    auth: 'session', write: 'idempotencyKey', receipt: true, ifMatch: true, params: ApplicationId,
    success: { status: 200, data: Application }, errors: ['FORBIDDEN', 'NOT_FOUND', 'STATE_CONFLICT'],
  }),
  op({
    operationId: 'leaveMeal', method: 'POST', path: '/meals/{mealId}/leave', summary: 'Confirmed guest leaves before start (stays in group)',
    auth: 'session', write: 'idempotencyKey', receipt: true, ifMatch: true, params: MealId,
    success: { status: 200, data: Obj({ application: Application, meal: Meal }) },
    errors: ['FORBIDDEN', 'NOT_FOUND', 'DEADLINE_PASSED', 'MEAL_CANCELLED', 'STATE_CONFLICT'],
  }),
  op({
    operationId: 'myMeals', method: 'GET', path: '/me/meals', summary: 'Own Meals sections',
    auth: 'session', write: 'read', ifMatch: false,
    query: Obj({ section: Enum(MY_MEAL_SECTIONS), cursor: T.Optional(Cursor), limit: T.Optional(Limit) }),
    success: { status: 200, data: MyMealItem, list: true }, errors: [],
  }),
] as const;

