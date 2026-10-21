import type { SessionState } from '../../api/session.tsx';
import { safeReturnTo } from '../../lib/returnTo.ts';
import { readJson, remove, writeJson } from '../../lib/storage.ts';
import { isProfileReady, profileGatePath } from './gate.ts';

const RETURN_KEY = 'auth.returnTo';
const LINK_KEY = 'auth.linkTicket';

export const rememberReturnTo = (target: string) => writeJson(RETURN_KEY, safeReturnTo(target));
export const takeReturnTo = (): string => {
  const value = readJson<string>(RETURN_KEY);
  remove(RETURN_KEY);
  return safeReturnTo(value);
};
export const rememberLinkTicket = (ticket: string, expiresAt: string) => writeJson(LINK_KEY, { ticket, expiresAt });

/** Where to go after a verified sign-in: the profile gate first if incomplete, else the original page. */
export function destinationAfterSignIn(state: SessionState, returnTo: string): string | null {
  if (state.status !== 'signed-in') return null;
  return isProfileReady(state.session) ? safeReturnTo(returnTo) : profileGatePath(returnTo);
}
