import { SessionScope } from '../auth/SessionScope.tsx';
import { useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ApiError, type ResponseOf } from '@fancy/client';
import { REPORT_TARGET_TYPES } from '@fancy/contracts';
import { useServices, useSessionState } from '../../services.tsx';
import { Primary } from '../../ui/Button.tsx';
import { Field } from '../../ui/Field.tsx';
import { FormMessage } from '../../ui/FormMessage.tsx';
import { Screen } from '../../ui/Screen.tsx';
import { Body, Heading } from '../../ui/Text.tsx';
import { rememberReturnTo } from '../auth/intent.ts';

type Receipt = ResponseOf<'createReport'>['data'];
type Target = (typeof REPORT_TARGET_TYPES)[number];

/** Private report → receipt (not a resolution). Route: /report?targetType=USER|MEAL|MESSAGE&targetId=… */
export function ReportScreen() {
  return <SessionScope><ReportScreenContent /></SessionScope>;
}

function ReportScreenContent() {
  const params = useLocalSearchParams<{ targetType: string; targetId: string }>();
  const targetType = (REPORT_TARGET_TYPES as readonly string[]).includes(String(params.targetType)) ? (String(params.targetType) as Target) : null;
  const targetId = String(params.targetId ?? '');
  const { api, newId } = useServices();
  const state = useSessionState();
  const router = useRouter();
  const [details, setDetails] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [busy, setBusy] = useState(false);
  const intent = useRef<{ key: string; body: string } | null>(null);

  if (!targetType || !targetId) return <Screen><FormMessage message="This report link isn’t valid." /></Screen>;
  if (state.status !== 'signedIn') {
    return (
      <Screen>
        <Body>Sign in to send a private report.</Body>
        <Primary label="Sign in" onPress={() => { rememberReturnTo('/settings'); router.push('/sign-in'); }} />
      </Screen>
    );
  }
  if (receipt) {
    return (
      <Screen testID="report-receipt">
        <Heading>Report received</Heading>
        <Body>{`Reference ${receipt.receipt}. Our team reviews reports privately; the other person isn’t told who reported.`}</Body>
        <Body muted>You can check the status of your report later in Settings.</Body>
        <Primary label="Done" onPress={() => router.back()} />
      </Screen>
    );
  }

  const send = async () => {
    const text = details.trim();
    if (text.length < 1 || text.length > 1000) return setError('Tell us what happened in up to 1,000 characters.');
    const body = { targetType, targetId, reason: 'private_concern' as const, details: text };
    const serialized = JSON.stringify(body);
    if (!intent.current || intent.current.body !== serialized) intent.current = { key: newId(), body: serialized };
    setBusy(true);
    setError(null);
    try {
      setReceipt((await api.call('createReport', { body, idempotencyKey: intent.current.key })).data);
    } catch (e) {
      setError(e instanceof ApiError && e.kind === 'network' ? 'We couldn’t confirm your report was received. Check your connection and send again — it won’t be duplicated.' : 'We couldn’t send your report. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen testID="report">
      <Heading>Report a concern</Heading>
      <Body>Reports are private. Tell us what happened; you’ll get a reference number.</Body>
      <Field label="What happened?" value={details} onChangeText={setDetails} maxLength={1000} multiline />
      <FormMessage message={error} />
      <Primary label="Send report" busy={busy} onPress={() => void send()} />
    </Screen>
  );
}
