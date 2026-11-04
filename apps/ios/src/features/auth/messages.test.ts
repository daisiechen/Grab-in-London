import { ApiError } from '@fancy/client';
import { authErrorMessage } from './messages.ts';

describe('authErrorMessage', () => {
  it('explains a suspended account instead of asking to retry', () => {
    const message = authErrorMessage(new ApiError({ status: 403, code: 'ACCOUNT_SUSPENDED', message: 'server text' }));
    expect(message).toContain('suspended');
    expect(message).toContain('Contact Fancy support');
    expect(message).not.toContain('server text');
  });
});
