import { SessionScope } from '../auth/SessionScope.tsx';
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ApiError, type ResponseOf } from '@fancy/client';
import { REPORT_TARGET_TYPES } from '@fancy/contracts';
import { useServices, useSessionState } from '../../services.tsx';
import { Primary, TextAction } from '../../ui/Button.tsx';
import { Field } from '../../ui/Field.tsx';
import { FormMessage } from '../../ui/FormMessage.tsx';
import { AccountPage, SummaryBox, accountText } from '../../ui/AccountPage.tsx';
import { rememberReturnTo } from '../auth/intent.ts';

type Receipt = ResponseOf<'createReport'>['data'];
type Target = (typeof REPORT_TARGET_TYPES)[number];
const STATUS_LABELS: Record<Receipt['status'], string> = { RECEIVED: 'Received', IN_REVIEW: 'In review', RESPONDED: 'Responded' };
const TARGET_LABELS: Record<Target, string> = { USER: 'a member', MEAL: 'a meal', MESSAGE: 'a message' };

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
  const [checking, setChecking] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  if (!targetType || !targetId) return <AccountPage><FormMessage message="This report link isn’t valid." /></AccountPage>;
  if (state.status !== 'signedIn') {
    return (
      <AccountPage footer={<Primary label="Sign in" onPress={() => { rememberReturnTo('/settings'); router.push('/sign-in'); }} />}>
        <Text accessibilityRole="header" style={accountText.h1}>Share a private concern</Text>
        <Text style={accountText.prose}>Sign in to send a private report.</Text>
      </AccountPage>
    );
  }
  if (receipt) {
    const refresh = async () => {
      setChecking(true);
      setStatusError(null);
      try {
        const fresh = (await api.call('reportStatus', { params: { reportId: receipt.id } })).data;
        if (fresh.id === receipt.id) setReceipt(fresh);
      } catch (e) {
        setStatusError(e instanceof ApiError && e.kind === 'network' ? 'We couldn’t check the status. Check your connection and try again.' : 'We couldn’t check the status. Please try again.');
      } finally {
        setChecking(false);
      }
    };
    return (
      <AccountPage testID="report-receipt" footer={<Primary label="Done" onPress={() => router.back()} />}>
        <Text accessibilityRole="header" style={accountText.h1}>Report received</Text>
        <Text style={accountText.prose}>Our team reviews reports privately. The other person isn’t told who reported.</Text>
        <SummaryBox>
          <Text style={accountText.muted}>Reference number</Text>
          <Text selectable style={accountText.strong}>{receipt.receipt}</Text>
          <Text style={[accountText.body, { marginTop: 6, marginBottom: 0 }]}>{`Status: ${STATUS_LABELS[receipt.status]}`}</Text>
          {receipt.publicOutcome ? <Text style={accountText.body}>{receipt.publicOutcome}</Text> : null}
        </SummaryBox>
        <Text style={accountText.muted}>Keep this reference if you contact support. A receipt is not a decision about the report.</Text>
        <View style={{ alignItems: 'flex-start' }}>
          <TextAction label="Check report status" disabled={checking} onPress={() => void refresh()} />
        </View>
        <FormMessage message={statusError} />
      </AccountPage>
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
    <AccountPage testID="report" footer={<><FormMessage message={error} /><Primary label="Submit report" busy={busy} onPress={() => void send()} /></>}>
      <Text accessibilityRole="header" style={accountText.h1}>Share a private concern</Text>
      <Text style={[accountText.prose, { marginBottom: 14 }]}>{`Reports about ${TARGET_LABELS[targetType]} are private and separate from public references. You’ll get a reference number.`}</Text>
      <Field label="What would you like us to know?" value={details} onChangeText={setDetails} maxLength={1000} multiline hint="Up to 1,000 characters." />
    </AccountPage>
  );
}
