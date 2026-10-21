/**
 * TODO-contract: replace with GET /v1/meta/policies {termsVersion, communityVersion, ageVersion} (T04/T05).
 * CONTRACT GAP (reported): the API exposes no current version for the age/community
 * acknowledgement or meal terms. These constants are the single client-side place to change
 * once the contract defines a source; the server remains the authority that accepts them.
 */
export const AGE_CONFIRMATION_VERSION = '2026-10-21';
export const COMMUNITY_PRINCIPLES_VERSION = '2026-10-21';
export const MEAL_TERMS_VERSION = '2026-10-21';
