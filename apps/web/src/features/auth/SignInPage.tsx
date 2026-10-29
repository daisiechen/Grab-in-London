import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ApiError, newIntentKey } from '@fancy/client';
import { ArrowLeftIcon, ArrowRightIcon, Cross2Icon, ExternalLinkIcon } from '@radix-ui/react-icons';
import { useApi } from '../../api/ApiProvider.tsx';
import { useSession } from '../../api/session.tsx';
import { errorMessage } from '../../api/errors.ts';
import { contractReturnTarget, safeReturnTo } from '../../lib/returnTo.ts';
import { browser } from '../../lib/browser.ts';
import { Avatar, Field, FormMessage, Primary, TextAction } from '../../ui/components.tsx';
import { useQuery } from '../../api/useQuery.ts';
import { useDocumentMeta } from '../../seo/useDocumentMeta.ts';
import { signupSource } from '../../lib/attribution.ts';
import { Sheet } from '../../ui/Sheet.tsx';
import { clearLinkTicket,continueLink,destinationAfterSignIn,expectLinkProof,linkForProof,pendingLink,rememberLinkTicket,rememberReturnTo,type PendingLink } from './completeSignIn.ts';
import {LinkConfirmation} from './LinkConfirmation.tsx';
import { CommunityPrinciples } from './CommunityPrinciples.tsx';

type Stage = 'account' | 'email' | 'verify' | 'link';
type Outcome = { outcome: 'AUTHENTICATED';authProof:string } | { outcome: 'LINK_REQUIRED'; linkTicket: string; expiresAt: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Sign-up attribution from the landing URL, memory only (lib/attribution.ts); the API keeps it for new accounts. */
const withSource = () => { const source = signupSource(); return source ? { signupSource: source } : {}; };

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
  const returnTo = safeReturnTo(params.get('returnTo') ?? params.get('next'));
  const apiTarget = contractReturnTarget(returnTo);

  const [stage, setStage] = useState<Stage>('account');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [clock, setClock] = useState(Date.now());
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPrinciples, setShowPrinciples] = useState(false);
  const [confirmation,setConfirmation]=useState<{pending:PendingLink;proof:string;next:string}|null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => () => clearInterval(timer.current), []);
  useEffect(() => {
    if (stage !== 'verify') return;
    const id = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(id);
  }, [stage]);
  const applyMeal = /^\/meals\/([0-9a-f-]{36})\/apply$/i.exec(returnTo)?.[1] ?? null;
  const context = useQuery<{ title: string; host: { displayName: string; avatarUrl: string | null } }>(applyMeal ? `signin-context:${applyMeal}` : null, async (c) => (await c.call('getMeal', { params: { mealId: applyMeal! } })).data.meal);
  useDocumentMeta({ title: 'Sign in · Fancy', robots: 'noindex, nofollow' });
  const browse = () => {
    clearLinkTicket();
    const base = returnTo.replace(/\/(apply|status)$/, '');
    navigate(/^\/(meals|profiles)\/[^/]+/.test(base) ? base : '/discover', { replace: true });
  };

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
        body: { clientRequestId: newIntentKey(), email: trimmed, client: 'WEB', ...(apiTarget ? { returnTarget: apiTarget } : {}), ...withSource() },
      });
      setEmail(trimmed);
      setChallengeId(res.data.challengeId);
      setExpiresAt(Date.now() + secondsUntil(res.data.expiresAt, res.meta.serverNow) * 1000);
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
      const res = await api.client.call('verifyEmail', { body: { clientRequestId: newIntentKey(), challengeId, code, ...withSource() } });
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
        body: { clientRequestId: newIntentKey(), provider, client: 'WEB', ...(apiTarget ? { returnTarget: apiTarget } : {}), ...withSource() },
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

  const linkingOriginal = pendingLink()?.phase === 'original';
  const remaining = expiresAt ? Math.max(0, Math.ceil((expiresAt - clock) / 1000)) : 0;
  if(confirmation)return <div className="scroll auth"><LinkConfirmation key={`${confirmation.pending.ticket}:${confirmation.proof}`} pending={confirmation.pending} proof={confirmation.proof} onDone={()=>navigate(confirmation.next,{replace:true})} onCancel={()=>{setConfirmation(null);setStage('account');}} onReverify={()=>{continueLink();setConfirmation(null);setStage('account');setError('Verify your original sign-in again.');}}/></div>;
  const cancelLinking = linkingOriginal && stage !== 'link' ? <TextAction disabled={busy} onClick={()=>{clearLinkTicket();setStage('account');setError('');setCode('');}}>Cancel linking</TextAction> : null;
  if (stage !== 'account') {
    return (
      <div className="scroll">
        <div className="auth">
          <div className="titlebar">
            <button type="button" className="disc" aria-label="Back in sign-in" onClick={back}><ArrowLeftIcon width={18} height={18} aria-hidden="true" /></button>
            <span className="wordmark" style={{ paddingTop: 7 }}>Fancy</span>
          </div>
          {stage === 'email' && (
            <form onSubmit={(e) => void sendCode(e)} noValidate>
              <h1 className="signh">Let’s keep in touch.</h1>
              <p className="lede">We’ll use a one-time code, so there’s no password to remember.</p>
              <Field label="Email address" required strong error={error || null}>
                {(p) => <input {...p} className="input" type="email" inputMode="email" autoComplete="email" placeholder="alex@example.com" value={email} maxLength={320} autoFocus onChange={(e) => setEmail(e.target.value)} />}
              </Field>
              <Primary type="submit" busy={busy} disabled={resendIn > 0 && !challengeId}>{resendIn > 0 && !challengeId ? `Send code in ${resendIn}s` : 'Send code'} <ArrowRightIcon aria-hidden="true" /></Primary>
              <p className="caption">We only use your email to sign you in and to send updates about your tables. It is never shown to other members.</p>
            </form>
          )}
          {stage === 'verify' && (
            <form onSubmit={(e) => void verify(e)} noValidate>
              <h1 className="signh">Check your inbox.</h1>
              <p className="lede">Enter the six-digit code for {email}.</p>
              <Field label="6-digit code" required strong error={error || null} hint={remaining > 0 ? `Code expires in ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}` : expiresAt ? 'This code has expired. Request a new code.' : undefined}>
                {(p) => (
                  <input {...p} className="input" style={{ fontSize: 24, letterSpacing: 8, textAlign: 'center', height: 56 }} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} placeholder="123456" value={code} autoFocus
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
                )}
              </Field>
              <FormMessage message={info} tone="info" />
              <Primary type="submit" busy={busy}>Verify &amp; continue <ArrowRightIcon aria-hidden="true" /></Primary>
              <div className="row2">
                <TextAction disabled={busy || resendIn > 0} onClick={() => void sendCode()}>{resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}</TextAction>
                <TextAction onClick={() => { setError(''); setInfo(''); setStage('email'); }}>Change email</TextAction>
              </div>
            </form>
          )}
          {stage === 'link' && (
            <>
              <h1 className="signh">You’ve been here before.</h1>
              <p className="lede">An account already uses this email. Sign in the way you did before to link this sign-in method. We never merge accounts automatically.</p>
              <Primary onClick={() => {try{continueLink();setStage('account');setError('');}catch{setError('This linking request expired. Start again.');}}}>Verify original sign-in</Primary>
              <TextAction onClick={()=>{clearLinkTicket();setStage('account');setError('');}}>Cancel linking</TextAction>
              <FormMessage message={error} />
            </>
          )}
          {cancelLinking}
        </div>
      </div>
    );
  }
  const host = context.data?.host;
  return (
    <div className="scroll">
      <div className="auth split">
        <div className="art desk"><img src="/images/brand-table.jpg" alt="" /></div>
        <div>
          <div className="brandbar">
            <span className="wordmark">Fancy</span>
            <button type="button" className="disc" aria-label="Close" onClick={browse}><Cross2Icon width={15} height={15} aria-hidden="true" /></button>
          </div>
          {host && context.data ? (
            <div className="ctx"><Avatar name={host.displayName} url={host.avatarUrl} size={30} /><span>Sign in to send your request to <b>{host.displayName}</b>. You’ll come straight back to <b>{context.data.title}</b>.</span></div>
          ) : <div className="art mob"><img src="/images/brand-table.jpg" alt="A sculptural green table with colourful chairs, laid for new friends" /></div>}
          <h1 className="signh">Fancy a bite?</h1>
          <p className="lede">{linkingOriginal ? 'Verify the sign-in method you used before. You’ll confirm the connection afterwards.' : 'Meet new people over a meal. Join a table, or come back for another.'}</p>
          <Primary onClick={() => { setError(''); setStage('email'); }}>Continue with email <ArrowRightIcon aria-hidden="true" /></Primary>
          <div className="divider">or</div>
          <button type="button" className="prov" disabled={busy} onClick={() => void oauth('GOOGLE')}>Continue with Google <ExternalLinkIcon aria-hidden="true" /></button>
          <button type="button" className="prov" disabled={busy} onClick={() => void oauth('APPLE')}>Continue with Apple <ExternalLinkIcon aria-hidden="true" /></button>
          <FormMessage message={error} />
          <p className="caption" style={{ textAlign: 'center', marginTop: 12 }}>New here? The same steps create your account. Adults 18+.</p>
          <TextAction onClick={() => setShowPrinciples(true)}>Privacy &amp; community principles</TextAction>
          <TextAction onClick={browse}>Keep exploring without an account</TextAction>
          {cancelLinking}
        </div>
      </div>
      <Sheet open={showPrinciples} onOpenChange={setShowPrinciples} title="Community & privacy principles">
        <CommunityPrinciples />
        <Primary secondary onClick={() => setShowPrinciples(false)}>Close</Primary>
      </Sheet>
    </div>
  );
}
