/** Schema helpers: every object is closed (additionalProperties:false) so unknown fields are rejected. */
import { Type, type TObject, type TProperties, type TSchema, type ObjectOptions } from '@sinclair/typebox';

export { Type as T };
export type { Static, TSchema, TObject } from '@sinclair/typebox';

export const Obj = <P extends TProperties>(properties: P, options: ObjectOptions = {}): TObject<P> =>
  Type.Object(properties, { additionalProperties: false, ...options });

export const Enum = <V extends string>(values: readonly V[], options: { description?: string } = {}) =>
  Type.Unsafe<V>({ type: 'string', enum: [...values], ...options });

export const Uuid = Type.String({ format: 'uuid' });
export const Instant = Type.String({ format: 'date-time' });
export const LocalDate = Type.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$', format: 'date' });
/** bigint versions and sequence numbers travel as decimal strings to avoid JS precision loss. */
export const DecimalString = Type.String({ pattern: '^(0|[1-9][0-9]{0,18})$' });
export const Pence = Type.Integer({ minimum: 1, maximum: 2147483647 });

/** Text whose trimmed length must fall in [min,max]; enforced again in the domain layer. */
export const Text = (minLength: number, maxLength: number) =>
  Type.String({ minLength, maxLength, pattern: minLength > 0 ? '\\S' : '' });

export const UniqueArray = <S extends TSchema>(item: S, minItems = 0, maxItems = 50) =>
  Type.Array(item, { uniqueItems: true, minItems, maxItems });
