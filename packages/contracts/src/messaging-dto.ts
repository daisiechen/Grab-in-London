import { DecimalString, Enum, Instant, Obj, T, Uuid, type Static } from './schema.ts';
import { Message } from './dto.ts';

const positions = { start: T.Integer({ minimum: 0, maximum: 1999 }), end: T.Integer({ minimum: 1, maximum: 2000 }) };
/** Half-open Unicode code-point offsets, validated against the unchanged submitted body. */
export type MentionInput = { kind: 'user'; userId: string; start: number; end: number } | { kind: 'everyone'; start: number; end: number };
export interface GroupMessageInput { body: string; clientMessageId: string; mentions: MentionInput[]; draftId?: string }
export const Mention = T.Union([
  Obj({ kind: T.Literal('user'), userId: Uuid, ...positions }),
  Obj({ kind: T.Literal('everyone'), ...positions }),
]);
export interface GroupMessageV2Data extends Static<typeof Message> { mentions: MentionInput[]; warnings: { droppedMentionIds: string[] } }
export const GroupMessageV2 = Obj({ ...Message.properties, mentions: T.Array(Mention, { maxItems: 100 }), warnings: Obj({ droppedMentionIds: T.Array(Uuid, { maxItems: 100, uniqueItems: true }) }) });
export const MentionCandidate = Obj({ kind: Enum(['user', 'everyone'] as const), userId: T.Union([Uuid, T.Null()]), displayName: T.String({ maxLength: 200 }), avatarUrl: T.Union([T.String({ maxLength: 2000 }), T.Null()]) });
export const ConversationNotificationSettings = Obj({ muted: T.Boolean(), version: DecimalString });
/** Destination credentials are write-only and never returned by this DTO. */
export const PushSubscription = Obj({ subscriptionId: Uuid, version: DecimalString, platform: Enum(['apns', 'webpush'] as const), environment: Enum(['development', 'production'] as const), createdAt: Instant });
