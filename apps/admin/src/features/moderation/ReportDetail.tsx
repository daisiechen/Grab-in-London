import { INTERESTS } from '@fancy/contracts';
import { newIntentKey } from '@fancy/client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ModerationAction, ModerationReport } from '../../api/admin-api.ts';
import { endsSession, toFailure, type Failure } from '../../api/failure.ts';
import { Badge, Panel } from '../../components/Panel.tsx';
import { formatLondonTime, type Language, type Translate } from '../../i18n.ts';
import { useConsole } from '../../state/console.tsx';
import { FailureScreen } from '../status/FailureScreen.tsx';
import { CaseAttendancePanel, CaseReplyPanel } from './SupportCase.tsx';
import { errorText } from './ModerationQueue.tsx';
import { accountLabel, actionLabel, caseStatusLabel, CLOSING_ACTIONS, CONFIRM_ACTIONS, presetNote, sla, slaText, targetLabel } from './labels.ts';

type Load = { status: 'loading' } | { status: 'unclaimed' } | { status: 'ready'; report: ModerationReport } | { status: 'failed'; failure: Failure };

/**
 * One report: the minimum context to decide (public profile fields / meal fields / the reported
 * message with a few neighbours), then audited actions with a required internal note. Reading it
 * requires a claim, which is also what grants the J09 case operations below.
 */
export function ReportDetail({ reportId, t, lang, onBack }: { reportId: string; t: Translate; lang: Language; onBack(): void }) {
  const c = useConsole();
  const { reportFailure } = c;
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const claimIntent = useRef<string | null>(null);

  const handle = useCallback((error: unknown): Failure => {
    const failure = toFailure(error);
    if (endsSession(failure.kind)) reportFailure(error);
    return failure;
  }, [reportFailure]);

  const refresh = useCallback(async () => {
    try { setLoad({ status: 'ready', report: await c.api.moderationReport(reportId) }); }
    catch (error) {
      const failure = handle(error);
      setLoad(failure.kind === 'not_found' ? { status: 'unclaimed' } : { status: 'failed', failure });
    }
  }, [c.api, reportId, handle]);
  useEffect(() => { setLoad({ status: 'loading' }); void refresh(); }, [refresh]);

  const claim = async () => {
    claimIntent.current ??= newIntentKey();
    try { setLoad({ status: 'ready', report: await c.api.claimReport(reportId, claimIntent.current) }); claimIntent.current = null; }
    catch (error) { const failure = handle(error); if (failure.kind !== 'network') claimIntent.current = null; setLoad({ status: 'failed', failure }); }
  };

  const back = <button className="text-button" onClick={onBack}>← {t('返回举报队列', 'Back to the queue')}</button>;
  if (load.status === 'loading') return <>{back}<p role="status">{t('正在加载举报…', 'Loading report…')}</p></>;
  if (load.status === 'failed') {
    return (<>{back}{load.failure.kind === 'forbidden' || load.failure.kind === 'not_found'
      ? <div className="panel load-error" role="alert"><h2>{t('无权查看此举报', 'No access to this report')}</h2><p>{t('需要支持角色与多因素验证；内容不会显示。', 'This needs the support role and multi-factor verification; nothing is shown.')}</p></div>
      : <FailureScreen failure={load.failure} t={t} onRetry={() => void refresh()} />}</>);
  }
  if (load.status === 'unclaimed') {
    return (<>{back}
      <div className="panel load-error">
        <h2>{t('领取后查看详情', 'Claim to view details')}</h2>
        <p>{t('领取会记录在审计中，并授予你处理此个案的权限。', 'Claiming is audited and grants you this case.')}</p>
        <button className="button primary" onClick={() => void claim()}>{t('领取此举报', 'Claim this report')}</button>
      </div>
    </>);
  }
  const r = load.report;
  const s = sla(r.summary);
  return (
    <div className="report-detail" data-report={r.summary.reportId}>
      {back}
      <div className="report-head">
        <div>
          <div className="eyebrow">{targetLabel(t, r.summary.targetType)} · <span className="mono">{r.summary.reportId}</span></div>
          <h2>{t('举报详情', 'Report')}</h2>
        </div>
        <div className="badges">
          <Badge tone={s.tone}>{slaText(t, r.summary)}</Badge>
          <Badge tone={r.summary.caseStatus === 'RESOLVED' ? 'neutral' : 'amber'}>{caseStatusLabel(t, r.summary.caseStatus)}</Badge>
          {r.summary.autoActioned && <Badge tone="red">{t('已自动限制', 'Auto-limited')}</Badge>}
          {r.summary.contentLimited && <Badge>{t('内容当前已限制', 'Content currently limited')}</Badge>}
          {r.summary.autoClosed && <Badge>{t('自动关闭', 'Auto-closed')}</Badge>}
        </div>
      </div>
      <div className="two-column">
        <Panel title={t('举报内容', 'What was reported')}>
          <dl className="definition-list">
            <dt>{t('举报时间', 'Reported at')}</dt><dd>{formatLondonTime(lang, r.summary.createdAt)}</dd>
            <dt>{t('举报人（匿名编号）', 'Reporter (pseudonymous ID)')}</dt><dd className="mono">{r.reporterId}</dd>
            <dt>{t('7天内举报人数', 'Reporters in 7 days')}</dt><dd>{r.summary.reporterCount}</dd>
            <dt>{t('原因', 'Reason')}</dt><dd>{r.summary.reason === 'private_concern' ? t('私密说明', 'Private concern') : r.summary.reason}</dd>
          </dl>
          <blockquote className="report-text">{r.details}</blockquote>
          {r.privacyRedacted && <p className="method-note">{t('举报人或相关账号已删除，文字已按隐私规则移除；只能关闭个案。', 'The reporter or the account involved was deleted; text was removed for privacy and only closing actions remain.')}</p>}
          <p className="method-note">{t('举报人当前看到：', 'The reporter currently sees: ')}{r.publicOutcome ?? '—'}</p>
        </Panel>
        <Panel title={t('被举报内容', 'Reported content')}>
          <TargetView r={r} t={t} lang={lang} />
        </Panel>
      </div>
      <ActionPanel report={r} t={t} onDone={(next) => setLoad({ status: 'ready', report: next })} onConflict={refresh} handle={handle} />
      {r.summary.targetType === 'MEAL' && !r.privacyRedacted && <CaseAttendancePanel caseId={r.summary.caseId} t={t} lang={lang} onChanged={refresh} />}
      <CaseReplyPanel caseId={r.summary.caseId} t={t} onChanged={refresh} />
      <Panel title={t('处理记录', 'History')}>
        {r.history.length ? (
          <ol className="history-list">
            {r.history.map((h) => (
              <li key={h.id}>
                <strong>{actionLabel(t, h.kind)}</strong> · {formatLondonTime(lang, h.createdAt)} · {h.actorId ? <span className="mono">{h.actorId}</span> : t('系统', 'System')}
                {h.note && <div>{t('内部备注：', 'Internal note: ')}{h.note}</div>}
                {h.publicOutcome && <div>{t('举报人可见：', 'Reporter sees: ')}{h.publicOutcome}</div>}
              </li>
            ))}
          </ol>
        ) : <p className="method-note">{t('还没有处理记录。', 'No actions yet.')}</p>}
      </Panel>
    </div>
  );
}

function TargetView({ r, t, lang }: { r: ModerationReport; t: Translate; lang: Language }) {
  if (r.user) {
    return (
      <div className="target-view">
        {r.user.photoUrl && <img className="target-photo" src={r.user.photoUrl} alt={t('被举报成员的头像', 'Reported member photo')} width={96} height={96} />}
        <dl className="definition-list">
          <dt>{t('成员（匿名编号）', 'Member (pseudonymous ID)')}</dt><dd className="mono">{r.user.userId}</dd>
          <dt>{t('账号状态', 'Account')}</dt><dd>{accountLabel(t, r.user.accountStatus)}{r.user.profileHidden ? ` · ${t('简介与头像已隐藏', 'bio & photo hidden')}` : ''}</dd>
          <dt>{t('昵称', 'Display name')}</dt><dd>{r.user.displayName ?? '—'}</dd>
          <dt>{t('简介', 'Bio')}</dt><dd>{r.user.bio ?? '—'}</dd>
          <dt>{t('语言 / 兴趣', 'Languages / interests')}</dt><dd>{[...r.user.languages.map((l) => (l === 'zh' ? '中文' : l === 'en' ? 'English' : l)), ...r.user.interests.map((i) => (INTERESTS as Record<string, string>)[i] ?? i)].join(', ') || '—'}</dd>
        </dl>
      </div>
    );
  }
  if (r.meal) {
    return (
      <dl className="definition-list">
        <dt>{t('饭局', 'Meal')}</dt><dd>{r.meal.title}{r.meal.hidden ? ` · ${t('已从发现页隐藏', 'hidden from discovery')}` : ''}</dd>
        <dt>{t('介绍', 'Description')}</dt><dd>{r.meal.description}</dd>
        <dt>{t('状态 / 时间', 'Status / time')}</dt><dd>{r.meal.status} · {formatLondonTime(lang, r.meal.startsAt)} · {r.meal.areaCode}</dd>
        <dt>{t('发起人（匿名编号）', 'Host (pseudonymous ID)')}</dt><dd className="mono">{r.meal.hostId}</dd>
      </dl>
    );
  }
  if (r.message) {
    return (
      <>
        <p className="method-note">{t('被举报消息及前后最多3条，仅用于判断。', 'The reported message with up to three messages either side, for context only.')}</p>
        <ol className="message-context">
          {r.message.context.map((line) => (
            <li key={line.messageId} className={line.isTarget ? 'is-target' : undefined} aria-current={line.isTarget ? 'true' : undefined}>
              <span className="mono">{line.senderId.slice(0, 8)}</span> · {formatLondonTime(lang, line.createdAt)}{line.hidden ? ` · ${t('已隐藏', 'hidden')}` : ''}
              <div>{line.body}</div>
            </li>
          ))}
        </ol>
      </>
    );
  }
  return <p className="method-note">{t('内容已不存在或因隐私规则不可显示。', 'The content no longer exists or cannot be shown for privacy.')}</p>;
}

function ActionPanel({ report, t, onDone, onConflict, handle }: {
  report: ModerationReport; t: Translate; onDone(next: ModerationReport): void; onConflict(): Promise<void>; handle(error: unknown): Failure;
}) {
  const c = useConsole();
  const [action, setAction] = useState<ModerationAction | null>(null);
  const [note, setNote] = useState('');
  const [reply, setReply] = useState('');
  const [resolve, setResolve] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const intent = useRef<string | null>(null);

  const choose = (next: ModerationAction) => { setAction(next); setNote(presetNote(next)); setReply(''); setResolve(false); setConfirm(false); setMessage(null); intent.current = null; };
  const closes = action ? CLOSING_ACTIONS.includes(action) || resolve : false;
  const noteValid = note.trim().length >= 5 && note.trim().length <= 1000;

  const submit = async () => {
    if (!action || !noteValid) return;
    if (CONFIRM_ACTIONS.includes(action) && !confirm) { setConfirm(true); return; }
    setBusy(true); setMessage(null);
    intent.current ??= newIntentKey();
    try {
      const next = await c.api.moderate(report.summary.reportId, { action, note: note.trim(), ...(closes && reply.trim() ? { publicOutcome: reply.trim() } : {}), ...(resolve ? { resolve: true } : {}) }, report.summary.caseVersion, intent.current);
      intent.current = null;
      setAction(null); setConfirm(false);
      setMessage({ ok: true, text: closes ? t('已执行并关闭，举报人可看到结果（审计已记录）。', 'Applied and closed; the reporter can see the outcome (audited).') : t('已执行（审计已记录）。', 'Applied (audited).') });
      onDone(next);
    } catch (error) {
      const failure = handle(error);
      if (failure.kind !== 'network') intent.current = null;
      setConfirm(false);
      setMessage({ ok: false, text: errorText(t, failure) });
      if (failure.kind === 'conflict') await onConflict();
    } finally { setBusy(false); }
  };

  return (
    <Panel title={t('处理操作', 'Actions')} eyebrow={t('每项操作都需要内部备注并写入审计', 'Every action needs an internal note and is audited')}>
      <div className="action-buttons" role="group" aria-label={t('可用操作', 'Available actions')}>
        {report.allowedActions.map((a) => (
          <button key={a} className={`button${action === a ? ' primary' : ''}${a === 'SUSPEND_USER' ? ' danger' : ''}`} aria-pressed={action === a} onClick={() => choose(a)}>{actionLabel(t, a)}</button>
        ))}
      </div>
      {report.subject && <p className="method-note">{t('停用对象（匿名编号）：', 'Suspension applies to (pseudonymous ID): ')}<span className="mono">{report.subject.userId}</span> · {accountLabel(t, report.subject.accountStatus)}</p>}
      {action && (
        <form className="action-form" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <label>{t('内部备注（仅员工可见）', 'Internal note (staff only)')}
            <textarea aria-label={t('内部备注', 'Internal note')} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
          </label>
          {!noteValid && <small className="inline-error">{t('内部备注需 5–1000 个字符。', 'The internal note needs 5–1000 characters.')}</small>}
          {!CLOSING_ACTIONS.includes(action) && (
            <label className="inline-check"><input type="checkbox" checked={resolve} onChange={(e) => setResolve(e.target.checked)} />{t('同时关闭个案并回复举报人', 'Also close the case and reply to the reporter')}</label>
          )}
          {closes && (
            <label>{t('举报人可见的回复（可留空使用标准说明）', 'Reply the reporter sees (leave empty for the standard wording)')}
              <textarea aria-label={t('举报人可见的回复', 'Reply to reporter')} value={reply} maxLength={1000} onChange={(e) => setReply(e.target.value)} />
            </label>
          )}
          <div className="form-actions">
            <button className={`button primary${action === 'SUSPEND_USER' ? ' danger' : ''}`} disabled={busy || !noteValid}>
              {confirm ? t(`确认：${actionLabel(t, action)}`, `Confirm: ${actionLabel(t, action)}`) : actionLabel(t, action)}
            </button>
            <button type="button" className="text-button" onClick={() => { setAction(null); setConfirm(false); }}>{t('取消', 'Cancel')}</button>
          </div>
          {confirm && <p role="note" className="draft-note">{action === 'SUSPEND_USER'
            ? t('请再次点击确认。之后可以恢复账号。', 'Click again to confirm. The suspension can be lifted later.')
            : t('请再次点击确认。此操作不能撤回。', 'Click again to confirm. This cannot be undone.')}</p>}
        </form>
      )}
      {message && <p role={message.ok ? 'status' : 'alert'} className={message.ok ? 'draft-note' : 'inline-error'}>{message.text}</p>}
    </Panel>
  );
}
