import type { RequestOf, ResponseOf } from '@fancy/client';

export type SessionInfo = ResponseOf<'getSession'>['data'];
export type Me = ResponseOf<'getMe'>['data'];
export type ProfileGate = Me['profileGate'];
export type PublicProfile = ResponseOf<'getPublicProfile'>['data']['profile'];
export type PublicReview = ResponseOf<'getPublicProfile'>['data']['reviews'][number];
export type Meal = ResponseOf<'getMeal'>['data']['meal'];
export type MealDetail = ResponseOf<'getMeal'>['data'];
export type Application = ResponseOf<'applyMeal'>['data'];
export type MyMealItem = ResponseOf<'myMeals'>['data'][number];
export type VenueCandidate = ResponseOf<'searchVenues'>['data'][number];
export type Venue = ResponseOf<'confirmVenue'>['data'];
export type MePatch = RequestOf<'updateMe'>['body'];
export type CreateMealBody = RequestOf<'createMeal'>['body'];
export type TimeInput = CreateMealBody['start'];
export type DiscoverQuery = NonNullable<RequestOf<'discoverMeals'>['query']>;
export type MyMealSection = NonNullable<RequestOf<'myMeals'>['query']>['section'];
