import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useApi } from '../../api/ApiProvider.tsx';
import { useSession } from '../../api/session.tsx';
import { errorMessage } from '../../api/errors.ts';
import { signInPath } from '../../lib/returnTo.ts';
import { FormError, Loading, PrimaryLink } from '../../ui/components.tsx';
import { destinationAfterSignIn, rememberLinkTicket, takeReturnTo } from './completeSignIn.ts';

/**
 * Provider redirect target for Web: WEB redirect_uri = <web origin>/auth/callback (confirmed).
 * TODO-contract: prefer the server-bound `returnTarget` the AUTHENTICATED outcome will carry (T04);
 * until then the return path is this tab's sessionStorage value. Hands code+state to the core API once; the API verifies
 * state/nonce/PKCE and sets the HttpOnly cookie. The return path comes from this tab's
 * sessionStorage and is re-checked against the allowlist.
 */
export function OAuthCallbackPage() {
  const { api } = useApi();
  const { refresh } = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState('');
  const [linkRequired, setLinkRequired] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const returnTo = takeReturnTo();
    const state = params.get('state');
    if (!state) {
      setError('This sign-in link is incomplete. Please start again.');
      return;
    }
    const code = params.get('code');
    const providerError = params.get('error');
    void (async () => {
      try {
        const res = await api.client.call('oauthCallback', {
          query: { state, ...(code ? { code } : {}), ...(providerError ? { error: providerError.slice(0, 200) } : {}) },
        });
        if (res.data.outcome === 'LINK_REQUIRED') {
          rememberLinkTicket(res.data.linkTicket, res.data.expiresAt);
          setLinkRequired(true);
          return;
        }
        const next = destinationAfterSignIn(await refresh(), returnTo);
        if (next) navigate(next, { replace: true });
        else setError('We couldn’t start your session. Please try again.');
      } catch (e) {
        setError(errorMessage(e));
      }
    })();
  }, [api, navigate, params, refresh]);

  if (linkRequired) {
    return (
      <div className="body-pad">
        <h1>You’ve been here before.</h1>
        <p className="prose">An account already uses this email. Sign in the way you did before to link this sign-in method. We never merge accounts automatically.</p>
        <PrimaryLink to={signInPath('/discover')}>Back to sign-in</PrimaryLink>
      </div>
    );
  }
  if (error) {
    return (
      <div className="body-pad">
        <h1>Sign-in didn’t finish.</h1>
        <FormError>{error}</FormError>
        <PrimaryLink to={signInPath('/discover')}>Try again</PrimaryLink>
      </div>
    );
  }
  return <Loading label="Signing you in…" />;
}
