import { createApiClient } from '@fancy/client';
import { createPreviewBackend, PREVIEW_NOW } from './fake-api.ts';

it('times the email code on the same business clock the sign-in screen counts down with', async () => {
  const backend = createPreviewBackend({ now: () => PREVIEW_NOW, latencyMs: 0 });
  const api = createApiClient({ baseUrl: 'http://localhost:3000', credentials: { kind: 'bearer', accessToken: () => null }, fetch: backend.fetch });
  const res = await api.call('startEmail', { body: { clientRequestId: '11111111-1111-4111-8111-111111111111', email: 'a@example.com', client: 'IOS' } });
  expect(Date.parse(res.data.resendAfter) - backend.now()).toBe(30_000);
  // Same 5-minute code lifetime as the server (apps/api identity/routes.ts OTP_TTL_MS).
  expect(Date.parse(res.data.expiresAt) - backend.now()).toBe(5 * 60_000);
});
