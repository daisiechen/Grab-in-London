import { expectTypeOf, it } from 'vitest';
import type { RequestOf } from './types.ts';

it('keeps each operation request correlated when the caller has a union operation', () => {
 expectTypeOf<RequestOf<'getMeal' | 'getCommandReceipt'>>().toEqualTypeOf<RequestOf<'getMeal'> | RequestOf<'getCommandReceipt'>>();
});
