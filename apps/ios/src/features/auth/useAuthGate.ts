import { useCallback } from 'react';
import * as Router from 'expo-router';
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

type RootNavigation = { getState?: () => { routes?: ReadonlyArray<{ name: string }> } | undefined };
// Isolated tests mock expo-router without useNavigation; leaving auth then falls back to replace.
const useRootNavigation: () => RootNavigation | null = typeof Router.useNavigation === 'function' ? () => Router.useNavigation() as unknown as RootNavigation : () => null;

/**
 * Leaves the sign-in flow for `target`. Sign-in is presented modally, so screens opened from inside
 * it would stay in that modal: dismiss everything from the sign-in screen up, back to where the
 * guest started, then open the target there (navigate reuses it if it is that screen).
 */
export function useLeaveAuth() {
  const router = useRouter();
  const navigation = useRootNavigation();
  return useCallback((target: string) => {
    const routes = navigation?.getState?.()?.routes ?? [];
    const start = routes.findIndex((r) => r.name === 'sign-in');
    if (start > 0) {
      router.dismiss(routes.length - start);
      router.navigate(target as never);
    } else router.replace(target as never);
  }, [router, navigation]);
}

/** After a successful sign-in: complete the profile gate first, then return to the remembered target. */
export function useFinishSignIn() {
  const services=useServices();
  const router = useRouter();
  const leave = useLeaveAuth();
  return useCallback(
    (session: SessionInfo, authProof?:string) => {
      if(getPendingLink(services.now())){
        if(authProof&&acceptLinkProof(session,authProof,services.session.generation,services.now(),services.newId())){router.replace('/link-required');return;}
        clearPendingLink();
        router.replace('/link-required');return;
      }
      if (!session.user.profileGate.profileComplete) router.replace('/profile-setup');
      else leave(takeReturnTo('/'));
    },
    [router,services,leave],
  );
}
