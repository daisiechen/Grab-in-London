/**
 * Node-side actor on the real API through the same @fancy/client and native (bearer) credential
 * path the iOS app uses: email OTP for client IOS → app challenge → one-time handoff → access token.
 * Used to seed data and to play the "other side" of a journey the browser is not driving.
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createApiClient, type ApiClient, type RequestOf, type ResponseOf } from '@fancy/client';
import type { OperationId } from '@fancy/contracts';

export const POLICY_VERSION = '2026-10-21';
const b64url = (buf: Buffer) => buf.toString('base64url');

export interface Actor {
  email: string;
  userId: string;
  call<I extends OperationId>(op: I, request: RequestOf<I>): Promise<ResponseOf<I>>;
}

export async function signIn(baseUrl: string, email: string, otp: string): Promise<Actor> {
  const anon = createApiClient({ baseUrl, credentials: { kind: 'none' } });
  const start = await anon.call('startEmail', { body: { clientRequestId: randomUUID(), email, client: 'IOS' } });
  const verifier = b64url(randomBytes(32));
  const appChallenge = b64url(createHash('sha256').update(verifier).digest());
  const verified = await anon.call('verifyEmail', { body: { clientRequestId: randomUUID(), challengeId: start.data.challengeId, code: otp, appChallenge } });
  if (verified.data.outcome !== 'AUTHENTICATED' || !verified.data.handoffCode) throw new Error(`sign-in for ${email}: ${verified.data.outcome}`);
  const creds = await anon.call('exchangeHandoff', { body: { clientRequestId: randomUUID(), code: verified.data.handoffCode, appVerifier: verifier } });
  const token = creds.data.accessToken;
  const api: ApiClient = createApiClient({ baseUrl, credentials: { kind: 'bearer', accessToken: () => token } });
  const me = await api.call('getMe', {});
  return { email, userId: me.data.id, call: (op, request) => api.call(op, request) };
}

export async function completeProfile(actor: Actor, displayName: string): Promise<void> {
  const me = await actor.call('getMe', {});
  await actor.call('updateMe', {
    ifMatch: me.data.version, idempotencyKey: randomUUID(),
    body: { displayName, bio: `${displayName} enjoys shared tables and meeting new people in London.`, languages: ['en'], lifeStatus: 'NEW_TO_LONDON', interests: ['FOOD'], ageConfirmedVersion: POLICY_VERSION, communityAcceptedVersion: POLICY_VERSION },
  });
}

/** London calendar date `days` from now (YYYY-MM-DD). */
export function londonDateIn(days: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + days * 86_400_000));
}

/** Wall-clock London input `days` ahead at hh:00, as the app's time pickers send it. */
export function londonInput(days: number, hour: number) {
  return { localDate: londonDateIn(days), localTime: `${String(hour).padStart(2, '0')}:00`, timeZone: 'Europe/London' as const };
}

export async function publishMeal(host: Actor, o: { placeId: string; title: string; days: number; capacity?: number }) {
  const venue = await host.call('confirmVenue', { idempotencyKey: randomUUID(), body: { placeId: o.placeId } });
  const meal = await host.call('createMeal', {
    idempotencyKey: randomUUID(),
    body: {
      venueRef: venue.data.venueRef, title: o.title, description: 'A relaxed dinner to share stories, swap tips about London and try something new together.',
      start: londonInput(o.days, 19), close: londonInput(o.days, 17), minimum: 2, capacity: o.capacity ?? 4, budgetMinPence: 2000, budgetMaxPence: 3500,
      languages: ['en'], mood: 'EASY_CONVERSATION', cuisineCode: 'EUROPEAN', dietaryCodes: null,
      bookingMode: 'EXTERNAL_PAY_AT_VENUE', attemptId: randomUUID(), bookingDeclarationConfirmed: true, reviewConfirmed: true, termsVersion: POLICY_VERSION,
    },
  });
  return meal.data;
}
