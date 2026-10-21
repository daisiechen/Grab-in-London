import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import type { ResponseOf } from '@fancy/client';
import { useApi } from '../../api/ApiProvider.tsx';
import { Intent } from '../../api/webApi.ts';
import { errorMessage } from '../../api/errors.ts';
import { Field, FormError, Primary } from '../../ui/components.tsx';
import { Sheet } from '../../ui/Sheet.tsx';

type Receipt = ResponseOf<'createReport'>['data'];
export type ReportTarget = { type: 'USER' | 'MEAL' | 'MESSAGE'; id: string; label: string };

/**
 * Private report (T18). It goes to the support team with a receipt; it is not a resolution
 * and does not by itself give support access to the whole chat. The one reason code is the
 * prototype's single private concern.
 */
export function ReportSheet({ open, onOpenChange, target }: { open: boolean; onOpenChange: (open: boolean) => void; target: ReportTarget }) {
  const { api } = useApi();
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const intent = useMemo(() => new Intent(api.retry), [api]);

  const submit = async () => {
    const text = details.trim();
    if (!text || text.length > 1000) { setError('Describe your concern in up to 1,000 characters.'); return; }
    setBusy(true);
    setError('');
    try {
      const body = { targetType: target.type, targetId: target.id, reason: 'private_concern' as const, details: text };
      const res = await intent.run(body, (key) => api.client.call('createReport', { body, idempotencyKey: key }));
      setReceipt(res.data);
      setDetails('');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setReceipt(null); setError(''); } }} title={receipt ? 'Report received' : `Report a concern about ${target.label}`}>
      {receipt ? (
        <>
          <p>Thank you. Our support team will review your report. This is a receipt, not a decision.</p>
          <div className="summary-box"><strong>Receipt {receipt.receipt}</strong><p>Status: received</p></div>
          <Link className="primary secondary" to={`/settings/reports/${receipt.id}`}>Check report status</Link>
        </>
      ) : (
        <>
          <p className="muted">Only the support team sees this. The person you report isn’t told who reported them.</p>
          <Field label="What happened?" hint={`${details.length}/1,000`}>
            {(p) => <textarea {...p} rows={5} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} />}
          </Field>
          <FormError>{error}</FormError>
          <Primary disabled={busy} onClick={() => void submit()}>Send report</Primary>
        </>
      )}
    </Sheet>
  );
}
