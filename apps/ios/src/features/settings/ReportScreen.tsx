import { SessionScope } from '../auth/SessionScope.tsx';
import { useEffect, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ApiError, type ResponseOf } from '@fancy/client';
import { REPORT_TARGET_TYPES } from '@fancy/contracts';
import { useServices, useSessionState } from '../../services.tsx';
import { Primary, TextAction } from '../../ui/Button.tsx';
import { FormMessage } from '../../ui/FormMessage.tsx';
import { AccountPage, SummaryBox, accountText } from '../../ui/AccountPage.tsx';
import { Avatar } from '../../ui/Avatar.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { colors, radius, type } from '../../ui/tokens.ts';
import { createStyles } from '../../ui/styles.ts';
import { longDate } from '../../lib/london.ts';
import { rememberReturnTo } from '../auth/intent.ts';

type Receipt = ResponseOf<'createReport'>['data'];
type Target = (typeof REPORT_TARGET_TYPES)[number];
const STATUS_LABELS: Record<Receipt['status'], string> = { RECEIVED: 'Received', IN_REVIEW: 'In review', RESPONDED: 'Responded' };
const TARGET_LABELS: Record<Target, string> = { USER: 'a member', MEAL: 'a meal', MESSAGE: 'a message' };
/** What is being reported, resolved from the route target with the existing public reads. */
type Subject = { kind: 'USER'; name: string; avatarUrl: string | null } | { kind: 'MEAL'; title: string; date: string };

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
  const [subject, setSubject] = useState<{ key: string; value: Subject } | null>(null);
  const signedIn = state.status === 'signedIn';
  const subjectKey = `${targetType}:${targetId}`;

  useEffect(() => {
    // Best effort: the form works without it, and a failed read keeps the generic “a member / a meal”.
    if (!signedIn || !targetId || (targetType !== 'USER' && targetType !== 'MEAL')) return;
    let live = true;
    const read = targetType === 'USER'
      ? api.call('getPublicProfile', { params: { userId: targetId } }).then((res): Subject | null => (res.data.profile.id === targetId ? { kind: 'USER', name: res.data.profile.displayName, avatarUrl: res.data.profile.avatarUrl } : null))
      : api.call('getMeal', { params: { mealId: targetId } }).then((res): Subject | null => (res.data.meal.id === targetId ? { kind: 'MEAL', title: res.data.meal.title, date: res.data.meal.startsAt.localDate } : null));
    read.then((value) => { if (live && value) setSubject({ key: subjectKey, value }); }).catch(() => {});
    return () => { live = false; };
  }, [api, signedIn, targetType, targetId, subjectKey]);

  const cancel = <View style={styles.cancel}><TextAction label="Cancel" onPress={() => router.back()} /></View>;
  if (!targetType || !targetId) return <AccountPage><FormMessage message="This report link isn’t valid." />{cancel}</AccountPage>;
  if (state.status !== 'signedIn') {
    return (
      <AccountPage>
        <Text accessibilityRole="header" style={accountText.h1}>Share a private concern</Text>
        <Text style={accountText.prose}>Sign in to send a private report.</Text>
        <View style={styles.actions}>
          <Primary label="Sign in" onPress={() => { rememberReturnTo('/settings'); router.push('/sign-in'); }} />
          {cancel}
        </View>
      </AccountPage>
    );
  }
  const target = subject?.key === subjectKey ? subject.value : null;
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
      <AccountPage testID="report-receipt">
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
        <View style={styles.actions}><Primary label="Done" onPress={() => router.back()} /></View>
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
    // A text field page: the action is pinned so it rides above the keyboard (an inline button ended up behind it).
    <AccountPage
      testID="report"
      footer={<>
        <FormMessage message={error} />
        <Primary label="Submit report" busy={busy} onPress={() => void send()} />
        {cancel}
      </>}
    >
      <Text accessibilityRole="header" style={accountText.h1}>Share a private concern</Text>
      <TargetRow targetType={targetType} target={target} />
      <Text style={[accountText.prose, { marginBottom: 14 }]}>{`Reports about ${TARGET_LABELS[targetType]} are private and separate from public references. You’ll get a reference number.`}</Text>
      <View style={styles.field}>
        <Text style={styles.label}>What would you like us to know?</Text>
        <TextInput accessibilityLabel="What would you like us to know?" value={details} onChangeText={setDetails} maxLength={1000} multiline placeholderTextColor={colors.muted} style={styles.input} />
        <Text style={styles.hint}>Up to 1,000 characters.</Text>
      </View>
    </AccountPage>
  );
}

/** Who or what the report is about: avatar + name for a member, title + date for a meal. */
function TargetRow({ targetType, target }: { targetType: Target; target: Subject | null }) {
  const label = target?.kind === 'USER' ? target.name : target?.kind === 'MEAL' ? target.title : `${TARGET_LABELS[targetType].charAt(0).toUpperCase()}${TARGET_LABELS[targetType].slice(1)}`;
  return (
    <View style={styles.target} testID="report-target" accessible accessibilityLabel={`Reporting ${label}`}>
      {target?.kind === 'USER' ? <Avatar person={{ displayName: target.name, avatarUrl: target.avatarUrl }} size={36} /> : (
        <View style={styles.targetIcon}><Icon name={targetType === 'MEAL' ? 'Calendar' : targetType === 'MESSAGE' ? 'ChatBubble' : 'Person'} size={16} color={colors.forest} /></View>
      )}
      <View style={styles.targetText}>
        <Text style={accountText.muted}>Reporting</Text>
        <Text style={styles.targetName} numberOfLines={1}>{label}</Text>
        {target?.kind === 'MEAL' ? <Text style={accountText.muted}>{longDate(target.date)}</Text> : null}
      </View>
    </View>
  );
}

const styles = createStyles({
  target: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, marginTop: 6, marginBottom: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  targetIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.selectedSurface, alignItems: 'center', justifyContent: 'center' },
  targetText: { flex: 1, minWidth: 0 },
  targetName: { fontSize: 14, fontWeight: '700', color: colors.ink },
  field: { gap: 6 },
  label: { fontSize: type.control, fontWeight: '700', color: colors.ink },
  input: { minHeight: 140, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: type.body, color: colors.ink, backgroundColor: colors.white, textAlignVertical: 'top' },
  hint: { fontSize: type.meta, color: colors.muted },
  // Short form: the action sits right after the content instead of a pinned bar with a blank band above it.
  actions: { marginTop: 16, gap: 4 },
  cancel: { alignItems: 'center' },
});
