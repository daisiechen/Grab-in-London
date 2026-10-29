import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ApiError } from '@fancy/client';
import type { SessionInfo } from '../../api/types.ts';
import { useSignedIn } from '../../api/session.tsx';
import { currentPath, safeReturnTo, signInPath } from '../../lib/returnTo.ts';

/** 18+, community acknowledgement and required profile fields (core plan §5). */
export const isProfileReady = (session: SessionInfo): boolean => {
  const g = session.user.profileGate;
  return g.ageConfirmed && g.communityAccepted && g.profileComplete;
};

export const profileGatePath = (returnTo: string) => `/profile-setup?returnTo=${encodeURIComponent(safeReturnTo(returnTo))}`;

/**
 * Before a gated write (apply, create): sends a guest to sign-in and an incomplete profile to
 * the profile form, both with a return path. The caller keeps its draft; nothing is replayed.
 */
export function useActionGate() {
  const session = useSignedIn();
  const navigate = useNavigate();
  const location = useLocation();
  const here = currentPath(location);
  const check = useCallback((returnTo: string = here): boolean => {
    if (!session) {
      navigate(signInPath(returnTo));
      return false;
    }
    if (!isProfileReady(session)) {
      navigate(profileGatePath(returnTo));
      return false;
    }
    return true;
  }, [here, navigate, session]);
  /** Maps a server-side gate rejection to the same detour; returns true when handled. */
  const handle = useCallback((error: unknown, returnTo: string = here): boolean => {
    if (!(error instanceof ApiError)) return false;
    if (error.code === 'AUTH_REQUIRED') { navigate(signInPath(returnTo)); return true; }
    if (error.code === 'PROFILE_INCOMPLETE') { navigate(profileGatePath(returnTo)); return true; }
    return false;
  }, [here, navigate]);
  return { check, handle, session };
}
