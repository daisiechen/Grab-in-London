import { ApiError } from '@fancy/client';
import { describe, expect, it } from 'vitest';
import { isBlocking, toFailure } from './failure.ts';

const err = (status: number, code: ConstructorParameters<typeof ApiError>[0]['code']) =>
  new ApiError({ status, code, message: 'x', requestId: 'r1' });

describe('toFailure', () => {
  it('maps status/code to UI failure kinds', () => {
    expect(toFailure(err(410, 'SNAPSHOT_REVOKED'))).toEqual({ kind: 'revoked', requestId: 'r1' });
    expect(toFailure(err(401, 'AUTH_REQUIRED')).kind).toBe('signed_out');
    expect(toFailure(err(403, 'REAUTH_REQUIRED')).kind).toBe('reauth');
    expect(toFailure(err(403, 'FORBIDDEN')).kind).toBe('forbidden');
    expect(toFailure(err(409, 'VERSION_CONFLICT')).kind).toBe('conflict');
    expect(toFailure(err(428, 'PRECONDITION_REQUIRED')).kind).toBe('conflict');
    expect(toFailure(err(422, 'VALIDATION_FAILED')).kind).toBe('invalid');
    expect(toFailure(err(0, 'NETWORK_ERROR')).kind).toBe('network');
    expect(toFailure(err(503, 'PROVIDER_UNAVAILABLE')).kind).toBe('unavailable');
    expect(toFailure(new Error('boom'))).toEqual({ kind: 'error', requestId: null });
  });

  it('treats only auth/role failures as blocking', () => {
    expect(['signed_out', 'forbidden', 'reauth'].every((k) => isBlocking(k as never))).toBe(true);
    expect(isBlocking('revoked')).toBe(false);
    expect(isBlocking('network')).toBe(false);
  });
});
