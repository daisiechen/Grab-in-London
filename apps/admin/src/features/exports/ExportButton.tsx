import { newIntentKey } from '@fancy/client';
import { useRef, useState } from 'react';
import type { ExportScope, RowQuery } from '../../api/admin-api.ts';
import type { FailureKind } from '../../api/failure.ts';
import { Icon } from '../../components/Icon.tsx';
import type { Translate } from '../../i18n.ts';
import { useConsole } from '../../state/console.tsx';
import type { Binding } from '../drilldown/DrilldownTable.tsx';

/** Hands the server CSV to the browser as a download; the CSV itself (headers, escaping) is server-made. */
export function saveCsv(csv: string, filename: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Short-lived export of the same snapshot + filters as the page (T23): POST /admin/exports then GET
 * the CSV once. One click = one idempotency key, reused if the same intent is retried after a network error.
 */
export function ExportButton({ scope, binding, rows, t, className = 'button export-button', label }: {
  scope: ExportScope; binding: Binding | null; rows?: RowQuery; t: Translate; className?: string; label?: string;
}) {
  const c = useConsole();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const pendingKey = useRef<string | null>(null);

  const failText = (kind: FailureKind) => kind === 'revoked'
    ? t('快照已撤销，导出已失效，请选择新快照。', 'Snapshot revoked; the export is no longer available. Choose a new snapshot.')
    : kind === 'network'
      ? t('网络中断，导出未完成，可重试。', 'Network error; export not completed. You can retry.')
      : kind === 'forbidden' || kind === 'signed_out' || kind === 'reauth'
        ? t('没有导出权限。', 'You are not allowed to export.')
        : t('导出失败，请重试。', 'Export failed. Please retry.');

  const run = async () => {
    if (!binding) return;
    setBusy(true);
    setMessage(null);
    pendingKey.current ??= newIntentKey();
    try {
      const ticket = await c.api.createExport({ snapshotId: binding.snapshotId, metric: scope, filters: { ...binding.query, ...rows } }, pendingKey.current);
      if (ticket.snapshotId !== binding.snapshotId) throw new Error('Export bound to a different snapshot');
      pendingKey.current = null;
      const csv = await c.api.downloadExport(ticket.exportId);
      saveCsv(csv, `fancy-${scope}-${binding.snapshotId}.csv`);
      setMessage({ ok: true, text: t('已导出当前快照与筛选的指标', 'Exported metrics for this snapshot and filters') });
    } catch (error) {
      const failure = c.reportFailure(error);
      if (failure.kind !== 'network') pendingKey.current = null;
      setMessage({ ok: false, text: failText(failure.kind) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="export-control">
      <button className={className} onClick={() => void run()} disabled={!binding || busy} aria-busy={busy}>
        <Icon name="download" size={17} />{label ?? t('导出指标', 'Export metrics')}
      </button>
      {message && <span className={message.ok ? 'toast' : 'inline-error'} role={message.ok ? 'status' : 'alert'}>{message.text}</span>}
    </span>
  );
}
