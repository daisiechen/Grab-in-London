export { createApiClient, newIntentKey, withRetry, type ApiClient, type ClientOptions, type Credentials } from './http.ts';
export { ApiError, type ErrorKind, type TimeChoice } from './errors.ts';
export type { RequestOf, ResponseOf, ResponseMeta, Page } from './types.ts';
export { OPERATIONS, CONTRACT_VERSION } from './generated/operations.ts';
export { IntentTracker, IntentUnresolvedError, outcomeFromError, outcomeFromReceipt, reconcileIntent, type CommandReceipt, type IntentOutcome, type UnresolvedWrite } from './intents.ts';
export { FeedbackRunner, planFeedback, receiptReconciler, scopeKey, statusFor, REVIEW_MAX, type FeedbackDraft, type FeedbackItem, type FeedbackPlan, type FeedbackScope, type FeedbackSnapshot, type FeedbackStep, type ItemStatus, type ScopeState } from './feedback.ts';
export { SUPPORT_EMAIL, supportMailto } from './support.ts';
export { publicMealOrigin, mealShareUrl, mealPathFromLink, publicMealInvitation, type PublicMealShareInput } from './share.ts';
