import { useMemo, useState } from 'react';
import { ApiError, type ResponseOf } from '@fancy/client';
import { useApi } from '../../api/ApiProvider.tsx';
import { Intent } from '../../api/webApi.ts';
import { errorMessage } from '../../api/errors.ts';
import { FormError, Notice, Primary, TextAction } from '../../ui/components.tsx';
import { ConfirmSheet } from '../../ui/ConfirmSheet.tsx';
import { Sheet } from '../../ui/Sheet.tsx';
import { useToast } from '../../ui/toast.tsx';
import { ReportSheet } from '../reports/ReportSheet.tsx';

type BlockState = ResponseOf<'block'>['data'];

/**
 * "Report or block this member" (T15/T18). Blocking clears both reconnect consents and stops
 * private contact; shared meal groups are unaffected; unblocking never restores a connection.
 * CONTRACT GAP (reported): there is no read of the current block state/version, so the first
 * write uses If-Match "0" and later writes use the version the server returned.
 */
export function MemberSafety({ subjectId, name }: { subjectId: string; name: string }) {
  const { api } = useApi();
  const notify = useToast();
  const [sheet, setSheet] = useState<'' | 'menu' | 'report' | 'block'>('');
  const [block, setBlock] = useState<BlockState | null>(null);
  const [error, setError] = useState('');
  const intent = useMemo(() => new Intent(api.retry), [api]);
  const version = block?.version ?? '0';

  const setBlocked = async (blocked: boolean) => {
    setError('');
    try {
      const op = blocked ? 'block' : 'unblock';
      const res = await intent.run({ op, subjectId, version }, (key) => api.client.call(op, { params: { subjectId }, ifMatch: version, idempotencyKey: key }));
      setBlock(res.data);
      setSheet('');
      notify(blocked ? 'Member blocked. A new mutual connection is required after unblocking.' : 'Member unblocked. Your previous connection is not restored.');
    } catch (e) {
      setError(errorMessage(e));
      if (e instanceof ApiError && e.currentVersion) setBlock({ subjectId, blocked: !blocked, version: e.currentVersion });
    }
  };

  return (
    <>
      {block?.blocked && (
        <>
          <Notice role="status">You have blocked this member. Private contact is disabled.</Notice>
          <TextAction onClick={() => void setBlocked(false)}>Unblock {name}</TextAction>
        </>
      )}
      <TextAction onClick={() => setSheet('menu')}>Report or block this member</TextAction>
      {!sheet && <FormError>{error}</FormError>}
      <Sheet open={sheet === 'menu'} onOpenChange={(o) => !o && setSheet('')} title={`${name}`}>
        <Primary secondary onClick={() => setSheet('report')}>Report a concern</Primary>
        {!block?.blocked && <Primary secondary onClick={() => setSheet('block')}>Block {name}</Primary>}
      </Sheet>
      <ReportSheet open={sheet === 'report'} onOpenChange={(o) => setSheet(o ? 'report' : '')} target={{ type: 'USER', id: subjectId, label: name }} />
      <ConfirmSheet open={sheet === 'block'} onOpenChange={(o) => !o && setSheet('')} title={`Block ${name}?`} confirmLabel="Block member" error={error} onConfirm={() => void setBlocked(true)}>
        <p>Private messages will stop. Unblocking will not restore your connection; you will both need to choose again. Shared groups are unaffected.</p>
      </ConfirmSheet>
    </>
  );
}
