import { useEffect, useRef, useState } from 'react';
import { Share, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ApiError } from '@fancy/client';
import { useServices, useSessionState } from '../../services.tsx';
import { AUTH_REDIRECT_URL } from '../../config.ts';
import { base64UrlEncode } from '../../platform/base64url.ts';
import { Primary, TextAction } from '../../ui/Button.tsx';
import { Field } from '../../ui/Field.tsx';
import { FormMessage } from '../../ui/FormMessage.tsx';
import { AccountPage, SummaryBox, accountText } from '../../ui/AccountPage.tsx';
import { Notice } from '../../ui/Bits.tsx';
import { parseAuthRedirect,providerState } from '../auth/oauth.ts';
import { otpErrorMessage } from '../auth/otp.ts';
import { StaleSessionError } from '../auth/session.ts';

type Binding={generation:number;userId:string};
type Stage = { kind: 'intro' } | { kind: 'reauthEmail'; challengeId: string } | { kind: 'done'; ownerId: string; receipt: string; status: string };

/**
 * Account deletion (API §4): 5-minute re-authentication, then a synchronous barrier. The client
 * securely saves the 256-bit receipt before the request (only its hash is stored server-side) so the
 * user can check status after every session and local cache has been removed.
 * Reauthentication verifies provider/OTP proof on the existing family; it never redeems a new login handoff.
 */
export function DeleteAccountScreen() {
  const services = useServices();
  const { api, session, newId } = services;
  const state = useSessionState();
  const router = useRouter();
  const [stage, setStage] = useState<Stage>({ kind: 'intro' });
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // One deletion intent: same receipt token and Idempotency-Key across re-auth and network retries.
  const intent = useRef<({ key: string; receiptToken: string }&Binding) | null>(null);
  const pkce = useRef<({ verifier: string; challenge: string;binding:Binding }) | null>(null);
  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const actor=state.status==='signedIn'?state.session.user.id:null;const previousActor=useRef(actor);
  useEffect(()=>{if(previousActor.current!==actor){previousActor.current=actor;intent.current=null;pkce.current=null;setCode('');setError(null);setStage(current=>actor===null&&current.kind==='done'?current:{kind:'intro'});}},[actor]);
  const assertOwner=(binding:Binding)=>{session.assertGeneration(binding.generation);const current=session.getState();if(!mounted.current||current.status!=='signedIn'||current.session.user.id!==binding.userId)throw new StaleSessionError();};

  if (stage.kind === 'done' && (state.status==='signedOut'||state.status==='signedIn'&&state.session.user.id===stage.ownerId)) {
    return (
      <AccountPage testID="deletion-receipt" footer={<Primary label="Done" onPress={() => router.replace('/')} />}>
        <Text accessibilityRole="header" style={accountText.h1}>Your account is being deleted</Text>
        <Text style={accountText.prose}>{`Status: ${stage.status.toLowerCase()}. You’ve been signed out on this iPhone and its saved data has been removed.`}</Text>
        <SummaryBox>
          <Text style={accountText.muted}>Deletion reference</Text>
          <Text selectable style={accountText.code}>{stage.receipt}</Text>
        </SummaryBox>
        <Text style={accountText.muted}>Your reference is saved securely on this device. Save or share a copy to check status elsewhere. You can forget the saved reference on the deletion status screen.</Text>
        <View style={{ marginTop: 12 }}>
          <Primary secondary label="Save or share reference" onPress={() => void Share.share({ message: `Fancy account deletion reference: ${stage.receipt}` })} />
        </View>
      </AccountPage>
    );
  }
  if (state.status !== 'signedIn') return <AccountPage><Text style={accountText.prose}>Please sign in to delete your account.</Text></AccountPage>;
  const me = state.session.user;
  const amr = state.session.amr;

  const requestDeletion = async (binding:Binding={generation:session.generation,userId:me.id},afterReauth=false) => {
    setBusy(true);setError(null);
    try {
      assertOwner(binding);
      if (!intent.current||intent.current.generation!==binding.generation||intent.current.userId!==binding.userId) {
        let saved;
        try { saved=await services.deletionReceipts.read();assertOwner(binding);
          const next=saved?.ownerId===binding.userId?saved:{ownerId:binding.userId,key:newId(),receiptToken:base64UrlEncode(services.randomBytes(32))};
          await services.deletionReceipts.write(next);assertOwner(binding);
          intent.current={key:next.key,receiptToken:next.receiptToken,...binding};
        } catch(e) { if(e instanceof StaleSessionError)throw e;assertOwner(binding);setError('We couldn’t securely save your removal reference. Try again before deleting your account.');return; }
      }
      const attempt=intent.current;const current=session.getState();if(current.status!=='signedIn')throw new StaleSessionError();
      const res = await api.call('requestDeletion', { body: { confirm: true, receiptToken: attempt.receiptToken }, idempotencyKey: attempt.key, ifMatch: current.session.user.version });
      assertOwner(binding);intent.current = null;
      setStage({ kind: 'done', ownerId:binding.userId, receipt:attempt.receiptToken, status: res.data.status });
      await session.endForDeletion();
    } catch (e) {
      if(e instanceof StaleSessionError)return;
      try {assertOwner(binding);}catch{return;}
      if (e instanceof ApiError && e.code === 'REAUTH_REQUIRED'&&!afterReauth) await startReauth(binding);
      else setError(e instanceof ApiError && e.kind === 'network' ? 'We couldn’t confirm the request. Check your connection and try again.' : 'We couldn’t delete your account. Please try again or contact support.');
    } finally {if(mounted.current)setBusy(false);}
  };

  const confirmReauth=async(outcome:import('@fancy/client').ResponseOf<'oauthCallback'>['data'],binding:Binding)=>{
    assertOwner(binding);
    if(outcome.outcome!=='AUTHENTICATED'||!outcome.session||outcome.handoffCode||outcome.session.user.id!==binding.userId)throw new ApiError({status:409,code:'STATE_CONFLICT',message:'Unexpected reauthentication outcome'});
    // Rotation/revalidation preserves the original family; no new sign-in credentials are minted.
    const checked=await session.revalidate();assertOwner(binding);
    if(checked.status!=='signedIn'||checked.session.user.id!==binding.userId)throw new StaleSessionError();
  };
  const startReauth = async (binding:Binding) => {
    const method = amr.includes('google') ? 'GOOGLE' : amr.includes('apple') ? 'APPLE' : 'EMAIL';
    try {
      assertOwner(binding);const pair = await services.createChallenge();assertOwner(binding);
      pkce.current = {...pair,binding};
      const res = await api.call('startReauth', { body: { clientRequestId: newId(), method, appChallenge: pair.challenge } });assertOwner(binding);
      if (method === 'EMAIL' && res.data.challengeId) {
        setStage({ kind: 'reauthEmail', challengeId: res.data.challengeId });setError('For your security, enter the code we just emailed you.');return;
      }
      if (!res.data.authorizationUrl) return setError('We couldn’t confirm it’s you. Please try again.');
      const expectedState=providerState(res.data.authorizationUrl);
      const result = await services.openAuthSession(res.data.authorizationUrl, AUTH_REDIRECT_URL);assertOwner(binding);
      if (result.type !== 'success') return setError('Confirm it’s you to delete your account.');
      const parsed = parseAuthRedirect(result.url, AUTH_REDIRECT_URL,expectedState);
      if (parsed.kind !== 'provider') return setError('We couldn’t confirm it’s you. Please try again.');
      const outcome=await api.call('oauthCallback',{query:{code:parsed.code,state:parsed.state}});assertOwner(binding);
      await confirmReauth(outcome.data,binding);await requestDeletion(binding,true);
    } catch (e) {if (!(e instanceof StaleSessionError)) setError('We couldn’t confirm it’s you. Please try again.');}
  };

  const verifyCode = async () => {
    if (stage.kind !== 'reauthEmail' || !pkce.current) return;
    const attempt=pkce.current;setBusy(true);
    try {
      assertOwner(attempt.binding);
      const res = await api.call('verifyEmail', { body: { clientRequestId: newId(), challengeId: stage.challengeId, code, appChallenge: attempt.challenge } });assertOwner(attempt.binding);
      await confirmReauth(res.data,attempt.binding);setStage({ kind: 'intro' });await requestDeletion(attempt.binding,true);
    } catch (e) {if(!(e instanceof StaleSessionError))setError(otpErrorMessage(e).message);}
    finally {if(mounted.current)setBusy(false);}
  };

  const footer = (
    <>
      <FormMessage message={error} />
      {stage.kind === 'reauthEmail'
        ? <Primary label="Confirm and delete" busy={busy} onPress={() => void verifyCode()} />
        : <Primary label="Delete my account" busy={busy} onPress={() => void requestDeletion()} />}
      <TextAction label="Keep my account" onPress={() => router.back()} />
    </>
  );
  return (
    <AccountPage testID="delete-account" footer={footer}>
      <Text accessibilityRole="header" style={accountText.h1}>Delete your account?</Text>
      <Text style={accountText.prose}>Your profile is removed, you leave your groups, and upcoming places and hosted meals are cancelled. This can’t be undone.</Text>
      <Notice icon>For your security we’ll ask you to confirm it’s you. You’ll get a deletion reference to check the status later, even when signed out.</Notice>
      {stage.kind === 'reauthEmail' ? (
        <Field label="6-digit code" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" textContentType="oneTimeCode" maxLength={6} />
      ) : null}
    </AccountPage>
  );
}
