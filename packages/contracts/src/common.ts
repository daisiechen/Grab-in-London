import { DecimalString, Enum, Instant, LocalDate, Obj, T, Uuid } from './schema.ts';
import { ERROR_CODES } from './errors.ts';

export const Meta = Obj({
  requestId: T.String({ minLength: 1, maxLength: 64 }),
  serverNow: Instant,
  version: T.Optional(DecimalString),
  snapshotId: T.Optional(Uuid),
});

export const PageInfo = Obj({
  nextCursor: T.Union([T.String({ minLength: 1, maxLength: 2048 }), T.Null()]),
  hasMore: T.Boolean(),
  scannedThroughSeq: T.Optional(DecimalString),
});

export const FieldErrors = T.Record(T.String({ maxLength: 120 }), T.String({ maxLength: 300 }));

export const TimeChoice = Obj({
  utcOffsetMinutes: T.Integer({ minimum: -720, maximum: 840 }),
  label: T.String({ maxLength: 8 }),
  instant: Instant,
});

export const ErrorBody = Obj({
  error: Obj({
    code: Enum(ERROR_CODES),
    message: T.String({ maxLength: 500 }),
    fieldErrors: T.Optional(FieldErrors),
    retryAfterSeconds: T.Optional(T.Integer({ minimum: 0 })),
    currentVersion: T.Optional(DecimalString),
    choices: T.Optional(T.Array(TimeChoice, { maxItems: 2 })),
  }),
  meta: Obj({ requestId: T.String({ minLength: 1, maxLength: 64 }), serverNow: Instant }),
});

/** P-03: London wall time plus an explicit offset when the wall time repeats; never silently shifted. */
export const TimeInput = Obj({
  localDate: LocalDate,
  localTime: T.String({ pattern: '^([01][0-9]|2[0-3]):[0-5][0-9]$' }),
  timeZone: T.Literal('Europe/London'),
  utcOffsetMinutes: T.Optional(T.Integer({ minimum: -720, maximum: 840 })),
});

export const ZonedTime = Obj({
  instant: Instant,
  localDate: LocalDate,
  localTime: T.String({ pattern: '^([01][0-9]|2[0-3]):[0-5][0-9]$' }),
  timeZone: T.Literal('Europe/London'),
  utcOffsetMinutes: T.Integer({ minimum: -720, maximum: 840 }),
});

export const Cursor = T.String({ minLength: 1, maxLength: 2048 });
export const Limit = T.Integer({ minimum: 1, maximum: 100, default: 20 });
export const PageQuery = Obj({ cursor: T.Optional(Cursor), limit: T.Optional(Limit) });

export const IdempotencyKey = Uuid;
/** Quoted decimal version, e.g. `"12"`. */
export const IfMatch = T.String({ pattern: '^"(0|[1-9][0-9]{0,18})"$' });
/** Dedupe key for anonymous/credential-bearing auth steps whose responses must not be stored. */
export const ClientRequestId = Uuid;
