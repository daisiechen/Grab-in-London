import { newIntentKey } from '@fancy/client';
import { useEffect, useRef, useState } from 'react';
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

/** Everything the export body depends on; a key is only reused for the identical intent. */
const signature = (scope: ExportScope, binding: Binding, rows: RowQuery | undefined) =>
  JSON.stringify([scope, binding.snapshotId, binding.filterHash, binding.query, rows ?? {}]);

/**
 * Short-lived export of the same snapshot + filters as the page (T23): POST /admin/exports then GET
 * the CSV once. One click = one idempotency key, reused only when the identical intent is retried
 * after a network error. Each await is fenced: after unmount, 410, 401/403, an account/snapshot
 * change or a different binding, a late ticket or CSV is dropped (no download, no success notice).
 * Role and privacy epoch are still re-checked by the server on create and download.
 */
export function ExportButton({ scope, binding, rows, t, className = 'button export-button', label }: {
  scope: ExportScope; binding: Binding | null; rows?: RowQuery; t: Translate; className?: string; label?: string;
}) {
  const c = useConsole();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const pendingKey = useRef<{ signature: string; key: string } | null>(null);
  const mounted = useRef(true);
  const current = useRef({ binding, scope, rows });
  current.current = { binding, scope, rows };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const failText = (kind: FailureKind) => kind === 'revoked'
    ? t('快照已撤销，导出已失效，请选择新快照。', 'Snapshot revoked; the export is no longer available. Choose a new snapshot.')
    : kind === 'network'
      ? t('网络中断，导出未完成，可重试。', 'Network error; export not completed. You can retry.')
      : kind === 'forbidden' || kind === 'signed_out' || kind === 'reauth'
        ? t('没有导出权限。', 'You are not allowed to export.')
        : t('导出失败，请重试。', 'Export failed. Please retry.');

  const run = async () => {
    if (!binding) return;
    const sig = signature(scope, binding, rows);
    const fence = c.fence();
    const live = () => mounted.current && fence.live();
    const sameIntent = () => { const now = current.current; return !!now.binding && signature(now.scope, now.binding, now.rows) === sig; };
    const cancelled = () => {
      if (mounted.current) setMessage({ ok: false, text: t('快照或筛选已变化，导出已取消，请重新导出。', 'The snapshot or filters changed; the export was cancelled. Export again.') });
    };
    setBusy(true);
    setMessage(null);
    if (pendingKey.current?.signature !== sig) pendingKey.current = { signature: sig, key: newIntentKey() };
    try {
      const ticket = await c.api.createExport({ snapshotId: binding.snapshotId, metric: scope, filters: { ...binding.query, ...rows } }, pendingKey.current.key);
      pendingKey.current = null;
      if (!live()) return;
      if (!sameIntent()) { cancelled(); return; }
      if (ticket.snapshotId !== binding.snapshotId) throw new Error('Export bound to a different snapshot');
      const csv = await c.api.downloadExport(ticket.exportId);
      if (!live()) return;
      if (!sameIntent()) { cancelled(); return; }
      saveCsv(csv, `fancy-${scope}-${binding.snapshotId}.csv`);
      setMessage({ ok: true, text: t('已导出当前快照与筛选的指标', 'Exported metrics for this snapshot and filters') });
    } catch (error) {
      // A failure of a superseded scope must not revoke, sign out or message the current one.
      if (!live()) return;
      const failure = c.reportFailure(error);
      if (failure.kind !== 'network') pendingKey.current = null;
      if (mounted.current) setMessage({ ok: false, text: failText(failure.kind) });
    } finally {
      if (mounted.current) setBusy(false);
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
