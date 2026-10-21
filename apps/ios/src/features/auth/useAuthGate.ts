import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useServices, useSessionState } from '../../services.tsx';
import { rememberReturnTo, takeReturnTo } from './intent.ts';
import { acceptLinkProof, clearPendingLink, getPendingLink } from './link.ts';
import type { SessionInfo } from './session.ts';

/**
 * Guards participation/private destinations (QA-AUTH-001): guests are sent to sign-in with the
 * target remembered; signed-in users with an incomplete profile go to profile setup first.
 * Returns true only when the caller may proceed. Never performs the guarded action itself.
 */
export function useAuthGate() {
  const router = useRouter();
  const state = useSessionState();
  return useCallback(
    (returnTo: string): boolean => {
      if (state.status === 'signedIn' && state.session.user.profileGate.profileComplete) return true;
      rememberReturnTo(returnTo);
      router.push(state.status === 'signedIn' ? '/profile-setup' : '/sign-in');
      return false;
    },
    [router, state],
  );
}

/** After a successful sign-in: complete the profile gate first, then return to the remembered target. */
export function useFinishSignIn() {
  const services=useServices();
  const router = useRouter();
  return useCallback(
    (session: SessionInfo, authProof?:string) => {
      if(getPendingLink(services.now())){
        if(authProof&&acceptLinkProof(session,authProof,services.session.generation,services.now(),services.newId())){router.replace('/link-required');return;}
        clearPendingLink();
        router.replace('/link-required');return;
      }
      if (!session.user.profileGate.profileComplete) router.replace('/profile-setup');
      else router.replace(takeReturnTo('/') as never);
    },
    [router,services],
  );
}
