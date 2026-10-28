import { DecimalString, Enum, Obj, T, Text, UniqueArray, Uuid } from '../schema.ts';
import { Cursor, Limit } from '../common.ts';
import { ATTENDANCE_VALUES, MESSAGE_READ_MODES, SURVEY_REASONS } from '../dictionaries.ts';
import {
  AttendanceState, BlockState, BlockedMember, Conversation, InboxItem, Message, PostMealState, ProductSurvey, ReconnectState, Revision, ReviewRevision,
} from '../dto.ts';
import { op } from '../operation.ts';

const ConversationId = Obj({ conversationId: Uuid });
const MealSubject = Obj({ mealId: Uuid, subjectId: Uuid });
const Subject = Obj({ subjectId: Uuid });

export const socialOperations = [
  op({ operationId: 'markConversationRead', method: 'POST', path: '/conversations/{conversationId}/read', summary: 'Explicitly acknowledge a rendered conversation position',
    auth: 'session', write: 'resourceKey', ifMatch: false, params: ConversationId, body: Obj({ throughSeq: DecimalString }), success: { status: 204 }, errors: ['NOT_FOUND','FORBIDDEN'] }),
  op({
    operationId: 'inbox', method: 'GET', path: '/inbox', summary: 'Own conversations and application progress',
    auth: 'session', write: 'read', ifMatch: false, query: Obj({ cursor: T.Optional(Cursor), limit: T.Optional(Limit) }),
    success: { status: 200, data: InboxItem, list: true }, errors: [],
  }),
  op({
    operationId: 'readMessages', method: 'GET', path: '/conversations/{conversationId}/messages', summary: 'Messages inside authorised membership intervals',
    auth: 'session', write: 'read', ifMatch: false, params: ConversationId,
    query: Obj({ mode: Enum(MESSAGE_READ_MODES), afterSeq: T.Optional(DecimalString), cursor: T.Optional(Cursor), limit: T.Optional(Limit) }),
    success: { status: 200, data: Message, list: true }, errors: ['FORBIDDEN', 'NOT_FOUND'],
  }),
  op({
    operationId: 'sendMessage', method: 'POST', path: '/conversations/{conversationId}/messages', summary: 'Send (deduped by clientMessageId)',
    auth: 'session', write: 'resourceKey', ifMatch: false, params: ConversationId,
    body: Obj({ body: T.String({ minLength: 1, maxLength: 2000, pattern: '\\S' }), clientMessageId: Uuid, draftId: T.Optional(Uuid) }),
    success: { status: 201, data: Message }, errors: ['FORBIDDEN', 'NOT_FOUND', 'CONNECTION_NOT_AUTHORIZED', 'IDEMPOTENCY_CONFLICT'],
  }),
  op({
    operationId: 'leaveGroup', method: 'POST', path: '/conversations/{conversationId}/leave', summary: 'Leave group chat (seat unchanged)',
    auth: 'session', write: 'idempotencyKey', ifMatch: true, params: ConversationId, body: Obj({ confirm: T.Literal(true) }),
    success: { status: 200, data: Conversation }, errors: ['FORBIDDEN', 'NOT_FOUND', 'STATE_CONFLICT'],
  }),
  op({
    operationId: 'dissolveGroup', method: 'POST', path: '/conversations/{conversationId}/dissolve', summary: 'Host dissolves group (never reopens)',
    auth: 'session', write: 'idempotencyKey', ifMatch: true, params: ConversationId, body: Obj({ confirm: T.Literal(true) }),
    success: { status: 200, data: Conversation }, errors: ['FORBIDDEN', 'NOT_FOUND', 'STATE_CONFLICT'],
  }),
  op({
    operationId: 'postMealState', method: 'GET', path: '/meals/{mealId}/post-meal', summary: 'Own post-meal window, roster and submissions',
    auth: 'session', write: 'read', ifMatch: false, params: Obj({ mealId: Uuid }),
    success: { status: 200, data: PostMealState }, errors: ['FORBIDDEN', 'NOT_FOUND'],
  }),
  op({
    operationId: 'reportAttendance', method: 'PUT', path: '/meals/{mealId}/attendance/{subjectId}', summary: 'SELF (own) or HOST report in [end,end+7d)',
    auth: 'session', write: 'idempotencyKey', ifMatch: true, params: MealSubject, body: Obj({ value: Enum(ATTENDANCE_VALUES) }),
    success: { status: 200, data: AttendanceState }, errors: ['FORBIDDEN', 'NOT_FOUND', 'STATE_CONFLICT'],
  }),
  op({
    operationId: 'rateExperience', method: 'PUT', path: '/meals/{mealId}/experience', summary: 'Private 1–5 meal score',
    auth: 'session', write: 'idempotencyKey', ifMatch: true, params: Obj({ mealId: Uuid }), body: Obj({ score: T.Integer({ minimum: 1, maximum: 5 }) }),
    success: { status: 200, data: Revision }, errors: ['FORBIDDEN', 'NOT_FOUND', 'STATE_CONFLICT'],
  }),
  op({
    operationId: 'reviewPerson', method: 'PUT', path: '/meals/{mealId}/reviews/{subjectId}', summary: 'Public reference (mutual or after 7 days)',
    auth: 'session', write: 'idempotencyKey', ifMatch: true, params: MealSubject, body: Obj({ body: Text(1, 500) }),
    success: { status: 200, data: ReviewRevision }, errors: ['FORBIDDEN', 'NOT_FOUND', 'STATE_CONFLICT'],
  }),
  op({
    operationId: 'selectReconnect', method: 'PUT', path: '/meals/{mealId}/reconnect/{subjectId}', summary: 'Private reconnect choice; WAITING never reveals the other side',
    auth: 'session', write: 'idempotencyKey', ifMatch: true, params: MealSubject, body: Obj({ selected: T.Boolean() }),
    success: { status: 200, data: ReconnectState }, errors: ['FORBIDDEN', 'NOT_FOUND', 'STATE_CONFLICT'],
  }),
  op({
    operationId: 'revokeConnection', method: 'POST', path: '/connections/{subjectId}/revoke', summary: 'Clear both consents; history read-only',
    auth: 'session', write: 'idempotencyKey', ifMatch: true, params: Subject,
    success: { status: 200, data: ReconnectState }, errors: ['NOT_FOUND'],
  }),
  op({
    operationId: 'listBlocks', method: 'GET', path: '/blocks', summary: 'Members the caller currently blocks, newest first',
    auth: 'session', write: 'read', ifMatch: false, query: Obj({ cursor: T.Optional(Cursor), limit: T.Optional(Limit) }),
    success: { status: 200, data: BlockedMember, list: true }, errors: [],
  }),
  op({
    operationId: 'getBlock', method: 'GET', path: '/blocks/{subjectId}', summary: 'Own block state and revision; never reveals the other member choice',
    auth: 'session', write: 'read', ifMatch: false, params: Subject,
    success: { status: 200, data: BlockState }, errors: ['NOT_FOUND', 'FORBIDDEN'],
  }),
  op({
    operationId: 'block', method: 'PUT', path: '/blocks/{subjectId}', summary: 'Block; clears both consents, keeps shared group',
    auth: 'session', write: 'idempotencyKey', ifMatch: true, params: Subject,
    success: { status: 200, data: BlockState }, errors: ['NOT_FOUND', 'FORBIDDEN'],
  }),
  op({
    operationId: 'unblock', method: 'DELETE', path: '/blocks/{subjectId}', summary: 'Unblock; consents are not restored',
    auth: 'session', write: 'idempotencyKey', ifMatch: true, params: Subject,
    success: { status: 200, data: BlockState }, errors: ['NOT_FOUND'],
  }),
  op({
    operationId: 'getDirect', method: 'GET', path: '/connections/{subjectId}/conversation', summary: 'Direct conversation if a participant',
    auth: 'session', write: 'read', ifMatch: false, params: Subject,
    success: { status: 200, data: Conversation }, errors: ['NOT_FOUND'],
  }),
  op({
    operationId: 'getSurvey', method: 'GET', path: '/me/product-survey', summary: 'Own latest ProductSurvey',
    auth: 'session', write: 'read', ifMatch: false, success: { status: 200, data: ProductSurvey }, errors: [],
  }),
  op({
    operationId: 'putSurvey', method: 'PUT', path: '/me/product-survey', summary: 'Upsert ProductSurvey (not tied to a meal)',
    auth: 'session', write: 'idempotencyKey', ifMatch: true,
    // again and reasons may not both be empty: at least one of again (bool) or one reason.
    body: Obj(
      { again: T.Union([T.Boolean(), T.Null()]), reasons: UniqueArray(Enum(SURVEY_REASONS), 0, SURVEY_REASONS.length) },
      { anyOf: [{ required: ['again'], properties: { again: { type: 'boolean' } } }, { required: ['reasons'], properties: { reasons: { type: 'array', minItems: 1 } } }] },
    ),
    success: { status: 200, data: ProductSurvey }, errors: [],
  }),
] as const;
