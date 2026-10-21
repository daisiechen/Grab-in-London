import { useRef, useState } from 'react';
import { Share } from 'react-native';
import { useRouter } from 'expo-router';
import { ApiError } from '@fancy/client';
import { useServices, useSessionState } from '../../services.tsx';
import { AUTH_REDIRECT_URL } from '../../config.ts';
import { base64UrlEncode } from '../../platform/base64url.ts';
import { Primary, TextAction } from '../../ui/Button.tsx';
import { Field } from '../../ui/Field.tsx';
import { FormMessage } from '../../ui/FormMessage.tsx';
import { Screen } from '../../ui/Screen.tsx';
import { Body, Heading } from '../../ui/Text.tsx';
import { parseAuthRedirect } from '../auth/oauth.ts';
import { otpErrorMessage } from '../auth/otp.ts';
import { StaleSessionError } from '../auth/session.ts';

type Stage = { kind: 'intro' } | { kind: 'reauthEmail'; challengeId: string } | { kind: 'done'; receipt: string; status: string };

/**
 * Account deletion (API §4): 5-minute re-authentication, then a synchronous barrier. The client
 * generates the 256-bit receipt token (only its hash is stored server-side) and shows it once so the
 * user can check status after every session and local cache has been removed.
 * CONTRACT GAP: how a startReauth email challenge is completed is not specified; verifyEmail +
 * exchangeHandoff (same as sign-in) is assumed.
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
  const intent = useRef<{ key: string; receiptToken: string } | null>(null);
  const pkce = useRef<{ verifier: string; challenge: string } | null>(null);

  if (stage.kind === 'done') {
    return (
      <Screen testID="deletion-receipt">
        <Heading>Your account is being deleted</Heading>
        <Body>{`Status: ${stage.status.toLowerCase()}. You’ve been signed out on this iPhone and its saved data has been removed.`}</Body>
        <Body>Save this reference now. It’s the only way to check the deletion status later, and it isn’t stored on this device.</Body>
        <Body>{stage.receipt}</Body>
        <Primary secondary label="Save or share reference" onPress={() => void Share.share({ message: `Fancy account deletion reference: ${stage.receipt}` })} />
        <Primary label="Done" onPress={() => router.replace('/')} />
      </Screen>
    );
  }
  if (state.status !== 'signedIn') return <Screen><Body>Please sign in to delete your account.</Body></Screen>;
  const me = state.session.user;
  const amr = state.session.amr;

  const requestDeletion = async () => {
    if (!intent.current) intent.current = { key: newId(), receiptToken: base64UrlEncode(services.randomBytes(32)) };
    setBusy(true);
    setError(null);
    try {
      const res = await api.call('requestDeletion', { body: { confirm: true, receiptToken: intent.current.receiptToken }, idempotencyKey: intent.current.key, ifMatch: me.version });
      const receipt = intent.current.receiptToken;
      intent.current = null;
      setStage({ kind: 'done', receipt, status: res.data.status });
      await session.endForDeletion();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'REAUTH_REQUIRED') await startReauth();
      else setError(e instanceof ApiError && e.kind === 'network' ? 'We couldn’t confirm the request. Check your connection and try again.' : 'We couldn’t delete your account. Please try again or contact support.');
    } finally {
      setBusy(false);
    }
  };

  const startReauth = async () => {
    const method = amr.includes('google') ? 'GOOGLE' : amr.includes('apple') ? 'APPLE' : 'EMAIL';
    try {
      const pair = await services.createChallenge();
      pkce.current = pair;
      const res = await api.call('startReauth', { body: { clientRequestId: newId(), method, appChallenge: pair.challenge } });
      if (method === 'EMAIL' && res.data.challengeId) {
        setStage({ kind: 'reauthEmail', challengeId: res.data.challengeId });
        setError('For your security, enter the code we just emailed you.');
        return;
      }
      if (!res.data.authorizationUrl) return setError('We couldn’t confirm it’s you. Please try again.');
      const result = await services.openAuthSession(res.data.authorizationUrl, AUTH_REDIRECT_URL);
      if (result.type !== 'success') return setError('Confirm it’s you to delete your account.');
      const parsed = parseAuthRedirect(result.url, AUTH_REDIRECT_URL);
      if (parsed.kind !== 'handoff') return setError('We couldn’t confirm it’s you. Please try again.');
      await session.completeHandoff(parsed.code, pair.verifier);
      await requestDeletion();
    } catch (e) {
      if (!(e instanceof StaleSessionError)) setError('We couldn’t confirm it’s you. Please try again.');
    }
  };

  const verifyCode = async () => {
    if (stage.kind !== 'reauthEmail' || !pkce.current) return;
    setBusy(true);
    try {
      const pair = pkce.current;
      const res = await api.call('verifyEmail', { body: { clientRequestId: newId(), challengeId: stage.challengeId, code, appChallenge: pair.challenge } });
      if (res.data.outcome !== 'AUTHENTICATED' || !res.data.handoffCode) throw new ApiError({ status: 409, code: 'STATE_CONFLICT', message: 'unexpected' });
      await session.completeHandoff(res.data.handoffCode, pair.verifier);
      setStage({ kind: 'intro' });
      await requestDeletion();
    } catch (e) {
      setError(otpErrorMessage(e).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen testID="delete-account">
      <Heading>Delete your account?</Heading>
      <Body>Your profile is removed, you leave your groups, and upcoming places and hosted meals are cancelled. This can’t be undone.</Body>
      {stage.kind === 'reauthEmail' ? (
        <>
          <Field label="6-digit code" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" textContentType="oneTimeCode" maxLength={6} />
          <Primary label="Confirm and delete" busy={busy} onPress={() => void verifyCode()} />
        </>
      ) : (
        <Primary label="Delete my account" busy={busy} onPress={() => void requestDeletion()} />
      )}
      <FormMessage message={error} />
      <TextAction label="Keep my account" onPress={() => router.back()} />
    </Screen>
  );
}
