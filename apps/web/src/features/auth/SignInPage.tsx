import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ApiError, newIntentKey } from '@fancy/client';
import { ArrowRightIcon, ChevronLeftIcon, ExternalLinkIcon } from '@radix-ui/react-icons';
import { useApi } from '../../api/ApiProvider.tsx';
import { useSession } from '../../api/session.tsx';
import { errorMessage } from '../../api/errors.ts';
import { safeReturnTo } from '../../lib/returnTo.ts';
import { browser } from '../../lib/browser.ts';
import { Field, FormError, Primary, TextAction } from '../../ui/components.tsx';
import { Sheet } from '../../ui/Sheet.tsx';
import { clearLinkTicket,continueLink,destinationAfterSignIn,expectLinkProof,linkForProof,pendingLink,rememberLinkTicket,rememberReturnTo,type PendingLink } from './completeSignIn.ts';
import {LinkConfirmation} from './LinkConfirmation.tsx';
import { CommunityPrinciples } from './CommunityPrinciples.tsx';

type Stage = 'account' | 'email' | 'verify' | 'link';
type Outcome = { outcome: 'AUTHENTICATED';authProof:string } | { outcome: 'LINK_REQUIRED'; linkTicket: string; expiresAt: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Seconds until `target`, measured against the server clock in the response, then counted locally. */
const secondsUntil = (target: string, serverNow: string) => Math.max(0, Math.ceil((Date.parse(target) - Date.parse(serverNow)) / 1000));

/**
 * Brand entrance → email OTP or Google/Apple (API §2, core plan §5). Real provider only:
 * no fixed code, no demo account. `returnTo` is allow-listed; drafts stay where they were saved.
 */
export function SignInPage() {
  const { api } = useApi();
  const { refresh } = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnTo = safeReturnTo(params.get('returnTo'));

  const [stage, setStage] = useState<Stage>('account');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPrinciples, setShowPrinciples] = useState(false);
  const [confirmation,setConfirmation]=useState<{pending:PendingLink;proof:string;next:string}|null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => () => clearInterval(timer.current), []);

  const startCountdown = (seconds: number) => {
    clearInterval(timer.current);
    setResendIn(seconds);
    if (seconds <= 0) return;
    const until = Date.now() + seconds * 1000;
    timer.current = setInterval(() => {
      const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setResendIn(left);
      if (!left) clearInterval(timer.current);
    }, 1000);
  };

  const finish = async (result: Outcome) => {
    if (result.outcome === 'LINK_REQUIRED') {
      if(pendingLink()?.phase==='original'){setError('Use a sign-in method already linked to your account.');setStage('account');return;}
      rememberLinkTicket(result.linkTicket, result.expiresAt,returnTo);
      setStage('link');
      return;
    }
    const linking=pendingLink()?.phase==='original';
    const state = await refresh();
    if(linking){const p=linkForProof(result.authProof);if(!p||state.status!=='signed-in'){clearLinkTicket();setError('This linking request expired or the session changed. Start again.');setStage('account');return;}setConfirmation({pending:p,proof:result.authProof,next:destinationAfterSignIn(state,p.returnTo)??'/discover'});return;}
    const next = destinationAfterSignIn(state, returnTo);
    if (next) navigate(next, { replace: true });
    else setError('We couldn’t start your session. Please try again.');
  };

  const sendCode = async (event?: FormEvent) => {
    event?.preventDefault();
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await api.client.call('startEmail', {
        body: { clientRequestId: newIntentKey(), email: trimmed, client: 'WEB', returnTarget: returnTo },
      });
      setEmail(trimmed);
      setChallengeId(res.data.challengeId);
      expectLinkProof(res.data.challengeId);
      setCode('');
      startCountdown(secondsUntil(res.data.resendAfter, res.meta.serverNow));
      if (stage === 'verify') setInfo('A new code is ready.');
      setStage('verify');
    } catch (e) {
      if (e instanceof ApiError && e.retryAfterSeconds !== undefined) startCountdown(e.retryAfterSeconds);
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (event: FormEvent) => {
    event.preventDefault();
    if (!challengeId) return;
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the six-digit code.');
      return;
    }
    setBusy(true);
    setError('');
    setInfo('');
    try {
      const res = await api.client.call('verifyEmail', { body: { clientRequestId: newIntentKey(), challengeId, code } });
      await finish(res.data);
    } catch (e) {
      if (e instanceof ApiError && (e.code === 'STATE_CONFLICT' || e.code === 'NOT_FOUND')) {
        setError('This code has expired or has been tried too many times. Request a new code when resend is ready.');
      } else if (e instanceof ApiError && e.kind === 'validation') {
        setError('That code isn’t right. Check your inbox and try again.');
      } else {
        setError(errorMessage(e));
      }
    } finally {
      setBusy(false);
    }
  };

  const oauth = async (provider: 'GOOGLE' | 'APPLE') => {
    setBusy(true);
    setError('');
    try {
      const res = await api.client.call('startOAuth', {
        body: { clientRequestId: newIntentKey(), provider, client: 'WEB', returnTarget: returnTo },
      });
      const url = new URL(res.data.authorizationUrl);
      if (url.protocol !== 'https:') throw new Error('Unexpected sign-in address');
      rememberReturnTo(returnTo);
      expectLinkProof(res.data.stateTransactionId);
      browser.assign(url.href);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  const back = () => {
    if(stage==='link')clearLinkTicket();
    setError('');
    setInfo('');
    setStage(stage === 'verify' ? 'email' : 'account');
  };

  if(confirmation)return <LinkConfirmation key={`${confirmation.pending.ticket}:${confirmation.proof}`} pending={confirmation.pending} proof={confirmation.proof} onDone={()=>navigate(confirmation.next,{replace:true})} onCancel={()=>{setConfirmation(null);setStage('account');}} onReverify={()=>{continueLink();setConfirmation(null);setStage('account');setError('Verify your original sign-in again.');}}/>;
  return (
    <div className="brand-entrance">
      {stage !== 'account' && (
        <button type="button" aria-label="Back in sign-in" onClick={back}><ChevronLeftIcon /></button>
      )}
      <span className="brand-wordmark">Fancy</span>
      {stage === 'account' && (
        <>
          {pendingLink()?.phase==='original'&&<p className="prose">Verify the sign-in method you used before. You’ll confirm the connection afterwards.</p>}
          <span className="eyebrow">YOUR NEXT TABLE STARTS HERE</span>
          <h1>Let’s keep in touch.</h1>
          <p className="prose">Join a table, or come back for another.</p>
          <Primary onClick={() => { setError(''); setStage('email'); }}>Continue with email <ArrowRightIcon /></Primary>
          <button type="button" className="brand-provider" disabled={busy} onClick={() => void oauth('GOOGLE')}>
            Continue with Google <ExternalLinkIcon />
          </button>
          <button type="button" className="brand-provider" disabled={busy} onClick={() => void oauth('APPLE')}>
            Continue with Apple <ExternalLinkIcon />
          </button>
          <TextAction onClick={() => setShowPrinciples(true)}>Privacy & community principles</TextAction>
        </>
      )}
      {stage === 'email' && (
        <form onSubmit={(e) => void sendCode(e)} noValidate>
          <h1>Let’s keep in touch.</h1>
          <p className="prose">We’ll use a one-time code, so there’s no password to remember.</p>
          <Field label="Email address">
            {(p) => <input {...p} type="email" inputMode="email" autoComplete="email" value={email} maxLength={320} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
          <FormError>{error}</FormError>
          <Primary type="submit" disabled={busy}>Send code <ArrowRightIcon /></Primary>
        </form>
      )}
      {stage === 'verify' && (
        <form onSubmit={(e) => void verify(e)} noValidate>
          <h1>Check your inbox.</h1>
          <p className="prose">Enter the six-digit code for {email}.</p>
          <Field label="6-digit code">
            {(p) => (
              <input {...p} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
            )}
          </Field>
          {info && <p className="muted" role="status">{info}</p>}
          <FormError>{error}</FormError>
          <Primary type="submit" disabled={busy}>Verify & continue <ArrowRightIcon /></Primary>
          <TextAction disabled={busy || resendIn > 0} onClick={() => void sendCode()}>
            {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
          </TextAction>
          <TextAction onClick={() => { setError(''); setStage('email'); }}>Change email</TextAction>
        </form>
      )}
      {stage === 'link' && (
        <>
          <h1>You’ve been here before.</h1>
          <p className="prose">
            An account already uses this email. Sign in the way you did before to link this sign-in method. We never merge accounts automatically.
          </p>
          <Primary onClick={() => {try{continueLink();setStage('account');setError('');}catch{setError('This linking request expired. Start again.');}}}>Verify original sign-in</Primary>
          <TextAction onClick={()=>{clearLinkTicket();setStage('account');setError('');}}>Cancel linking</TextAction>
          <FormError>{error}</FormError>
        </>
      )}
      {stage!=='link'&&pendingLink()?.phase==='original'&&<TextAction disabled={busy} onClick={()=>{clearLinkTicket();setStage('account');setError('');setCode('');}}>Cancel linking</TextAction>}
      {stage === 'account' && <FormError>{error}</FormError>}
      <Sheet open={showPrinciples} onOpenChange={setShowPrinciples} title="Community & privacy principles">
        <CommunityPrinciples />
        <Primary secondary onClick={() => setShowPrinciples(false)}>Close</Primary>
      </Sheet>
    </div>
  );
}
