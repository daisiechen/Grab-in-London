import { useState } from 'react';
import { ApiError, type ResponseOf } from '@fancy/client';
import { useServices } from '../../services.tsx';
import { Primary } from '../../ui/Button.tsx';
import { Field } from '../../ui/Field.tsx';
import { FormMessage } from '../../ui/FormMessage.tsx';
import { Screen } from '../../ui/Screen.tsx';
import { Body, Heading } from '../../ui/Text.tsx';

type Status = ResponseOf<'deletionStatus'>['data'];
const LABELS: Record<Status['status'], string> = { PENDING: 'Requested', PROCESSING: 'In progress', COMPLETED: 'Completed', NEEDS_SUPPORT: 'Our support team is completing this' };

/** Status by receipt token only (sent in the body, never in a URL). Works signed out. */
export function DeletionStatusScreen() {
  const { api } = useServices();
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const check = async () => {
    const t = token.trim();
    if (!/^[A-Za-z0-9_-]{43}$/.test(t)) return setError('Enter the 43-character reference you saved.');
    setBusy(true);
    setError(null);
    try {
      setStatus((await api.call('deletionStatus', { body: { receiptToken: t } })).data);
    } catch (e) {
      setStatus(null);
      setError(e instanceof ApiError && e.kind === 'gone' ? 'This reference has expired.' : e instanceof ApiError && e.kind === 'not_found' ? 'We couldn’t find that reference.' : 'We couldn’t check the status. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen testID="deletion-status">
      <Heading>Check deletion status</Heading>
      <Field label="Deletion reference" value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false} />
      <Primary label="Check status" busy={busy} onPress={() => void check()} />
      <FormMessage message={error} />
      {status ? <Body>{`Status: ${LABELS[status.status]}`}</Body> : null}
    </Screen>
  );
}
