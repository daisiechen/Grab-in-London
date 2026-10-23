import { DecimalString, Enum, Obj, T, Text, Uuid } from '../schema.ts';
import { Cursor, Limit } from '../common.ts';
import { MESSAGE_READ_MODES } from '../dictionaries.ts';
import { ConversationNotificationSettings, GroupMessageV2, Mention, MentionCandidate, PushSubscription } from '../messaging-dto.ts';
import { op } from '../operation.ts';
const params = Obj({ conversationId: Uuid });
export const messagingOperations = [
  op({ operationId: 'sendGroupMessageV2', version: 'v2', method: 'POST', path: '/conversations/{conversationId}/messages', summary: 'Group message with validated mention entities', auth: 'session', write: 'resourceKey', ifMatch: false, params,
    body: Obj({ body: Text(1, 2000), clientMessageId: Uuid, mentions: T.Array(Mention, { maxItems: 100 }), draftId: T.Optional(Uuid) }), success: { status: 201, data: GroupMessageV2 }, errors: ['FORBIDDEN', 'NOT_FOUND', 'IDEMPOTENCY_CONFLICT'] }),
  op({ operationId: 'readGroupMessagesV2', version: 'v2', method: 'GET', path: '/conversations/{conversationId}/messages', summary: 'Group messages within the same authorized history intervals as v1', auth: 'session', write: 'read', ifMatch: false, params,
    query: Obj({ mode: Enum(MESSAGE_READ_MODES), afterSeq: T.Optional(DecimalString), cursor: T.Optional(Cursor), limit: T.Optional(Limit) }), success: { status: 200, data: GroupMessageV2, list: true }, errors: ['FORBIDDEN', 'NOT_FOUND'] }),
  op({ operationId: 'mentionCandidates', method: 'GET', path: '/conversations/{conversationId}/mention-candidates', summary: 'Current writable group roster; everyone is host-only', auth: 'session', write: 'read', ifMatch: false, params,
    query: Obj({ q: T.Optional(T.String({ maxLength: 100 })), cursor: T.Optional(Cursor), limit: T.Optional(Limit) }), success: { status: 200, data: MentionCandidate, list: true }, errors: ['FORBIDDEN', 'NOT_FOUND'] }),
  op({ operationId: 'getConversationNotificationSettings', method: 'GET', path: '/conversations/{conversationId}/notification-settings', summary: 'Own cross-device mute setting', auth: 'session', write: 'read', ifMatch: false, params, success: { status: 200, data: ConversationNotificationSettings }, errors: ['FORBIDDEN', 'NOT_FOUND'] }),
  op({ operationId: 'putConversationNotificationSettings', method: 'PUT', path: '/conversations/{conversationId}/notification-settings', summary: 'Versioned own mute setting', auth: 'session', write: 'idempotencyKey', ifMatch: true, params, body: Obj({ muted: T.Boolean() }), success: { status: 200, data: ConversationNotificationSettings }, errors: ['FORBIDDEN', 'NOT_FOUND'] }),
  op({ operationId: 'registerPushSubscription', method: 'POST', path: '/me/push-subscriptions', summary: 'Bind encrypted destination to the current actor and session family', auth: 'session', write: 'idempotencyKey', ifMatch: false,
    body: Obj({ installationId: Uuid, platform: Enum(['apns', 'webpush'] as const), tokenOrEndpoint: Text(1, 4096), keys: T.Optional(Obj({ p256dh: Text(1, 256), auth: Text(1, 128) })), environment: Enum(['development', 'production'] as const), appBuild: Text(1, 100) }), success: { status: 201, data: PushSubscription }, errors: ['FORBIDDEN', 'STATE_CONFLICT'] }),
  op({ operationId: 'deletePushSubscription', method: 'DELETE', path: '/me/push-subscriptions/{subscriptionId}', summary: 'Revoke own subscription', auth: 'session', write: 'idempotencyKey', ifMatch: false, params: Obj({ subscriptionId: Uuid }), success: { status: 204 }, errors: ['NOT_FOUND'] }),
] as const;
