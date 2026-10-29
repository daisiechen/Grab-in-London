import { REPORT_TARGET_TYPES } from '@fancy/contracts';
import { newIntentKey } from '@fancy/client';
import { useCallback, useEffect, useState } from 'react';
import type { ModerationAction, ModerationQuery, ModerationSummary } from '../../api/admin-api.ts';
import { endsSession, toFailure, type Failure } from '../../api/failure.ts';
import { NativeSelect } from '../../components/controls.tsx';
import { Badge, Panel } from '../../components/Panel.tsx';
import { formatLondonTime, type Language, type Translate } from '../../i18n.ts';
import { useConsole } from '../../state/console.tsx';
import { FailureScreen } from '../status/FailureScreen.tsx';
import { accountLabel, ageText, caseStatusLabel, presetNote, sla, SLA_HOURS, slaText, targetLabel } from './labels.ts';

type Status = NonNullable<ModerationQuery['status']>;
type QuickAction = Extract<ModerationAction, 'UPHOLD' | 'RESTORE' | 'SUSPEND_USER'>;

/**
 * Report queue: open reports oldest first with the 24-hour response target, metadata only (no report
 * text, names or contact details). One-tap Uphold / Restore / Suspend claim the report and apply the
 * action with a preset internal note; everything else happens in the report view.
 */
export function ModerationQueue({ t, lang, onOpen }: { t: Translate; lang: Language; onOpen(reportId: string): void }) {
  const c = useConsole();
  const [status, setStatus] = useState<Status>('OPEN');
  const [targetType, setTargetType] = useState<string>('');
  const [mine, setMine] = useState(false);
  const [rows, setRows] = useState<ModerationSummary[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [state, setState] = useState<{ status: 'loading' | 'ready' } | { status: 'failed'; failure: Failure }>({ status: 'loading' });
  const [pending, setPending] = useState<{ reportId: string; action: QuickAction } | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const query = useCallback((cursor?: string): ModerationQuery => ({
    status, ...(targetType ? { targetType: targetType as NonNullable<ModerationQuery['targetType']> } : {}), ...(mine ? { claimed: 'me' as const } : {}), ...(cursor ? { cursor } : {}), limit: 25,
  }), [status, targetType, mine]);

  const fail = useCallback((error: unknown) => {
    const failure = toFailure(error);
    if (endsSession(failure.kind)) c.reportFailure(error);
    return failure;
  }, [c]);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const page = await c.api.moderationReports(query());
      setRows(page.data); setNext(page.page.hasMore ? page.page.nextCursor : null); setState({ status: 'ready' });
    } catch (error) { setState({ status: 'failed', failure: fail(error) }); }
  }, [c.api, query, fail]);
  useEffect(() => { void load(); }, [load]);

  const more = async () => {
    if (!next) return;
    try { const page = await c.api.moderationReports(query(next)); setRows((prev) => [...prev, ...page.data]); setNext(page.page.hasMore ? page.page.nextCursor : null); }
    catch (error) { setNotice({ ok: false, text: errorText(t, fail(error)) }); }
  };

  const quick = async (row: ModerationSummary, action: QuickAction) => {
    if (action === 'SUSPEND_USER' && (pending?.reportId !== row.reportId || pending.action !== action)) { setPending({ reportId: row.reportId, action }); return; }
    setPending(null); setBusy(row.reportId); setNotice(null);
    try {
      const detail = await c.api.claimReport(row.reportId, newIntentKey());
      if (!detail.allowedActions.includes(action)) { setNotice({ ok: false, text: t('此操作当前不适用，请打开举报查看。', 'That action is not available now. Open the report to review it.') }); return; }
      await c.api.moderate(row.reportId, { action, note: presetNote(action) }, detail.summary.caseVersion, newIntentKey());
      setNotice({ ok: true, text: t('已处理并通知举报人（审计已记录）。', 'Done. The reporter sees the outcome and the action was audited.') });
      await load();
    } catch (error) { setNotice({ ok: false, text: errorText(t, fail(error)) }); }
    finally { setBusy(null); }
  };

  const types: [string, string][] = [['', t('全部类型', 'All types')], ...REPORT_TARGET_TYPES.map((k) => [k, targetLabel(t, k)] as [string, string])];
  const now = Date.now();
  return (
    <Panel title={t('举报队列', 'Report queue')} eyebrow={t(`目标：${SLA_HOURS} 小时内处理`, `Target: act within ${SLA_HOURS} hours`)}
      action={<button className="button" onClick={() => void load()}>{t('刷新', 'Refresh')}</button>}>
      <p className="method-note">{t('重复举报会自动限制内容并等待复核；30天未处理的举报自动关闭，限制保留。列表只显示必要的业务编号。', 'Repeated reports limit content automatically pending review; reports left for 30 days close automatically with the limit kept. Only pseudonymous IDs are listed.')}</p>
      <div className="moderation-filters">
        <div className="tabs" role="group" aria-label={t('举报状态', 'Report status')}>
          {(['OPEN', 'RESOLVED', 'ALL'] as const).map((s) => (
            <button key={s} aria-pressed={status === s} onClick={() => setStatus(s)}>{{ OPEN: t('待处理', 'Open'), RESOLVED: t('已关闭', 'Closed'), ALL: t('全部', 'All') }[s]}</button>
          ))}
        </div>
        <NativeSelect label={t('对象类型', 'Target type')} value={targetType} onChange={setTargetType} options={types} />
        <label className="inline-check"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />{t('只看我领取的', 'Claimed by me')}</label>
      </div>
      {notice && <p role={notice.ok ? 'status' : 'alert'} className={notice.ok ? 'draft-note' : 'inline-error'}>{notice.text}</p>}
      {state.status === 'failed' ? <FailureScreen failure={state.failure} t={t} onRetry={() => void load()} />
        : state.status === 'loading' ? <p role="status">{t('正在加载举报…', 'Loading reports…')}</p>
          : !rows.length ? <div className="empty"><h3>{status === 'OPEN' ? t('没有待处理的举报', 'No open reports') : t('没有符合条件的举报', 'No matching reports')}</h3></div>
            : (
              <div className="table-scroll">
                <table aria-label={t('举报队列', 'Report queue')}>
                  <thead><tr>
                    <th>{t('举报时间', 'Reported')}</th><th>{t('处理时限', 'Response target')}</th><th>{t('对象', 'Target')}</th><th>{t('状态', 'Status')}</th>
                    <th>{t('7天内举报人', 'Reporters (7d)')}</th><th>{t('账号', 'Account')}</th><th>{t('操作', 'Actions')}</th>
                  </tr></thead>
                  <tbody>
                    {rows.map((row) => {
                      const s = sla(row, now);
                      return (
                        <tr key={row.reportId} data-report={row.reportId}>
                          <td><strong>{ageText(t, row.createdAt, now)}</strong><br /><small>{formatLondonTime(lang, row.createdAt)}</small></td>
                          <td><Badge tone={s.tone}>{slaText(t, row, now)}</Badge></td>
                          <td>{targetLabel(t, row.targetType)}</td>
                          <td>
                            <Badge tone={row.caseStatus === 'RESOLVED' ? 'neutral' : 'amber'}>{caseStatusLabel(t, row.caseStatus)}</Badge>{' '}
                            {row.autoActioned && row.caseStatus !== 'RESOLVED' && <Badge tone="red">{t('已自动限制 · 待复核', 'Auto-limited · review')}</Badge>}
                            {row.autoClosed && <Badge>{t('自动关闭', 'Auto-closed')}</Badge>}
                            {row.claimedByMe && <Badge tone="green">{t('我已领取', 'Mine')}</Badge>}
                          </td>
                          <td>{row.reporterCount}</td>
                          <td>{accountLabel(t, row.subjectStatus)}</td>
                          <td className="row-actions">
                            <button className="button primary" onClick={() => onOpen(row.reportId)}>{t('查看', 'Review')}</button>
                            {row.caseStatus !== 'RESOLVED' && (<>
                              <button className="button" disabled={busy === row.reportId} onClick={() => void quick(row, 'UPHOLD')}>{t('维持', 'Uphold')}</button>
                              <button className="button" disabled={busy === row.reportId} onClick={() => void quick(row, 'RESTORE')}>{t('恢复', 'Restore')}</button>
                              {row.subjectStatus === 'ACTIVE' && (
                                <button className="button danger" disabled={busy === row.reportId} onClick={() => void quick(row, 'SUSPEND_USER')}>
                                  {pending?.reportId === row.reportId ? t('确认停用', 'Confirm suspend') : t('停用', 'Suspend')}
                                </button>
                              )}
                            </>)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {next && <button className="text-button" onClick={() => void more()}>{t('加载更多', 'Load more')}</button>}
              </div>
            )}
    </Panel>
  );
}

export function errorText(t: Translate, failure: Failure) {
  switch (failure.kind) {
    case 'conflict': return t('举报已被更新，已重新读取，请核对后再操作。', 'The report changed meanwhile and was reloaded. Review it and try again.');
    case 'not_found': return t('未找到此举报，或尚未领取。', 'Report not found or not claimed.');
    case 'forbidden': return t('没有处理举报的权限。', 'You are not allowed to handle reports.');
    case 'reauth': case 'signed_out': return t('需要重新验证身份。', 'Re-verify your identity first.');
    case 'invalid': return t('请检查填写内容（内部备注至少5个字）。', 'Check the inputs (internal note needs at least 5 characters).');
    case 'network': return t('网络中断，结果未确认。恢复后可原样重试，不会重复执行。', 'Network lost; outcome unknown. Retry unchanged once connected — it will not run twice.');
    default: return t('操作失败，没有执行。请重试。', 'The action failed and was not applied. Please retry.');
  }
}
