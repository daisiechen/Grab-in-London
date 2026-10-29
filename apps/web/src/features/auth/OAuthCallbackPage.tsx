import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useApi } from '../../api/ApiProvider.tsx';
import { useSession } from '../../api/session.tsx';
import { errorMessage } from '../../api/errors.ts';
import { signInPath } from '../../lib/returnTo.ts';
import { FormError, Loading, PrimaryLink,Primary,TextAction } from '../../ui/components.tsx';
import { clearLinkTicket,continueLink,destinationAfterSignIn,linkForProof,pendingLink,rememberLinkTicket,takeReturnTo,type PendingLink } from './completeSignIn.ts';
import {LinkConfirmation} from './LinkConfirmation.tsx';

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
  const [confirmation,setConfirmation]=useState<{pending:PendingLink;proof:string;next:string}|null>(null);
  const started = useRef(false);
  const returnTarget = useRef('/discover');

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const returnTo = takeReturnTo();
    returnTarget.current = returnTo;
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
          if(pendingLink()?.phase==='original'){setError('Use a sign-in method already linked to your account.');return;}
          rememberLinkTicket(res.data.linkTicket, res.data.expiresAt,returnTo);
          setLinkRequired(true);
          return;
        }
        const linking=pendingLink()?.phase==='original';const session=await refresh();
        if(linking){const p=linkForProof(res.data.authProof);if(!p||session.status!=='signed-in'){clearLinkTicket();setError('This linking request expired or the session changed. Start again.');return;}setConfirmation({pending:p,proof:res.data.authProof,next:destinationAfterSignIn(session,p.returnTo)??'/discover'});return;}
        const next = destinationAfterSignIn(session, returnTo);
        if (next) navigate(next, { replace: true });
        else setError('We couldn’t start your session. Please try again.');
      } catch (e) {
        setError(errorMessage(e));
      }
    })();
  }, [api, navigate, params, refresh]);

  if(confirmation)return <LinkConfirmation key={`${confirmation.pending.ticket}:${confirmation.proof}`} pending={confirmation.pending} proof={confirmation.proof} onDone={()=>navigate(confirmation.next,{replace:true})} onCancel={()=>{clearLinkTicket();navigate(signInPath('/discover'),{replace:true});}} onReverify={()=>{continueLink();navigate(signInPath(confirmation.pending.returnTo),{replace:true});}}/>;
  if (linkRequired) {
    return (
      <div className="scroll auth-state">
        <h1>You’ve been here before.</h1>
        <p className="prose">An account already uses this email. Sign in the way you did before to link this sign-in method. We never merge accounts automatically.</p>
        <Primary onClick={()=>{try{continueLink();navigate(signInPath(pendingLink()?.returnTo??'/discover'),{replace:true});}catch{setLinkRequired(false);setError('This linking request expired. Start again.');}}}>Verify original sign-in</Primary>
        <TextAction onClick={()=>{clearLinkTicket();navigate(signInPath('/discover'),{replace:true});}}>Cancel linking</TextAction>
      </div>
    );
  }
  if (error) {
    return (
      <div className="scroll auth-state">
        <h1>Sign-in didn’t finish.</h1>
        <FormError>{error}</FormError>
        <PrimaryLink to={signInPath(returnTarget.current)}>Try again</PrimaryLink>
      </div>
    );
  }
  return <Loading label="Signing you in…" />;
}
