import { ApiError, newIntentKey } from '@fancy/client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CaseAttendance, CaseStatus, SupportCaseInfo } from '../../api/admin-api.ts';
import { endsSession, toFailure } from '../../api/failure.ts';
import { NativeSelect } from '../../components/controls.tsx';
import { Badge, Panel } from '../../components/Panel.tsx';
import { formatLondonTime, type Language, type Translate } from '../../i18n.ts';
import { useConsole } from '../../state/console.tsx';

/** J09 handoff states for the attendance correction and the reply. */
type Outcome =
  | { kind: 'impact'; version: string }
  | { kind: 'window' }
  | { kind: 'conflict' }
  | { kind: 'failed'; uncertain: boolean }
  | { kind: 'not_applicable' }
  | { kind: 'invalid' };

const REASON = { min: 5, max: 500 };
const valueLabel = (t: Translate, v: string | null) => (v === null ? '—' : ({ present: t('出席', 'Present'), absent: t('未出席', 'Absent'), unknown: t('未知', 'Unknown') } as Record<string, string>)[v] ?? v);

/**
 * Overdue attendance correction for a MEAL case (J09): only from scheduled end + 7 days, for a start
 * roster member, with a reason and the effective revision as expectedVersion. Original self/host reports
 * are kept; the server re-checks role, MFA, case grant, window, roster and version on every call.
 */
export function CaseAttendancePanel({ caseId, t, lang, onChanged }: { caseId: string; t: Translate; lang: Language; onChanged(): Promise<void> }) {
  const c = useConsole();
  const { reportFailure } = c;
  const [facts, setFacts] = useState<CaseAttendance | null>(null);
  const [denied, setDenied] = useState(false);
  const [subjectId, setSubjectId] = useState('');
  const [value, setValue] = useState<'present' | 'absent'>('present');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const intent = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await c.api.caseAttendance(caseId);
      setFacts(next); setDenied(false);
      setSubjectId((current) => current || next.roster.find((r) => !r.isHost)?.subjectId || next.roster[0]?.subjectId || '');
    } catch (error) {
      const failure = toFailure(error);
      if (endsSession(failure.kind)) reportFailure(error);
      // Denied: facts are cleared, never left on screen for a role/grant that no longer allows them.
      setFacts(null); setDenied(true);
    }
  }, [c.api, reportFailure, caseId]);
  useEffect(() => { void load(); }, [load]);

  if (denied) return <Panel title={t('出席纠错', 'Attendance correction')}><p role="alert">{t('无权查看此个案的出席事实。请重新验证身份或确认个案授权。', 'No access to this case’s attendance facts. Re-verify or check the case grant.')}</p></Panel>;
  if (!facts) return <Panel title={t('出席纠错', 'Attendance correction')}><p role="status">{t('正在加载出席事实…', 'Loading attendance facts…')}</p></Panel>;

  const subject = facts.roster.find((r) => r.subjectId === subjectId);
  const windowOpen = Date.now() < Date.parse(facts.correctionOpensAt);
  const reasonValid = reason.trim().length >= REASON.min && reason.trim().length <= REASON.max;
  const submit = async () => {
    if (!subject || !reasonValid) return;
    setBusy(true); setOutcome(null);
    intent.current ??= newIntentKey();
    try {
      const result = await c.api.correctAttendance(caseId, { mealId: facts.mealId, subjectId: subject.subjectId, value, reason: reason.trim(), expectedVersion: subject.version }, intent.current);
      intent.current = null; setReason('');
      setOutcome({ kind: 'impact', version: result.version });
      await load(); await onChanged();
    } catch (error) {
      const failure = toFailure(error);
      if (endsSession(failure.kind)) { reportFailure(error); return; }
      const code = error instanceof ApiError ? error.code : null;
      if (failure.kind !== 'network') intent.current = null;
      if (code === 'CORRECTION_WINDOW_OPEN') setOutcome({ kind: 'window' });
      else if (code === 'VERSION_CONFLICT') { setOutcome({ kind: 'conflict' }); await load(); }
      else if (failure.kind === 'forbidden' || failure.kind === 'not_found') { setFacts(null); setDenied(true); }
      else if (failure.kind === 'conflict') setOutcome({ kind: 'not_applicable' });
      else if (failure.kind === 'invalid') setOutcome({ kind: 'invalid' });
      else setOutcome({ kind: 'failed', uncertain: failure.kind === 'network' });
    } finally { setBusy(false); }
  };

  return (
    <Panel title={t('出席纠错', 'Attendance correction')} eyebrow={t('仅在计划结束满7天后由支持追加修订', 'Support revisions only from scheduled end + 7 days')}>
      <p className="method-note">
        {t('计划结束', 'Scheduled end')} {formatLondonTime(lang, facts.scheduledEndAt)} · {t('可纠错时间', 'Corrections from')} {formatLondonTime(lang, facts.correctionOpensAt)}
        {facts.mealStatus === 'CANCELLED' ? ` · ${t('饭局已取消，不适用', 'meal cancelled; not applicable')}` : ''}
      </p>
      {facts.roster.length ? (
        <div className="table-scroll">
          <table aria-label={t('开始名单出席记录', 'Start roster attendance')}>
            <thead><tr><th>{t('成员（匿名编号）', 'Member (ID)')}</th><th>{t('本人报告', 'Self')}</th><th>{t('发起人报告', 'Host')}</th><th>{t('支持修订', 'Support')}</th><th>{t('当前有效', 'Effective')}</th><th>{t('版本', 'Revision')}</th></tr></thead>
            <tbody>
              {facts.roster.map((row) => (
                <tr key={row.subjectId}>
                  <td className="mono">{row.subjectId.slice(0, 8)}{row.isHost ? ` · ${t('发起人', 'host')}` : ''}</td>
                  <td>{valueLabel(t, row.selfValue)}</td><td>{valueLabel(t, row.hostValue)}</td><td>{valueLabel(t, row.supportValue)}</td>
                  <td><strong>{valueLabel(t, row.value)}</strong></td><td>{row.version}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="method-note">{t('此饭局没有开始名单。', 'This meal has no start roster.')}</p>}
      {windowOpen && <p className="draft-note" role="note">{t('仍在7天自助窗口内：请由本人或发起人自助报告，支持暂不能纠错。', 'Still inside the 7-day self-report window: members report themselves; support cannot correct yet.')}</p>}
      {facts.roster.length > 0 && (
        <form className="action-form" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <NativeSelect label={t('纠错对象', 'Member')} value={subjectId} onChange={setSubjectId}
            options={facts.roster.map((r) => [r.subjectId, `${r.subjectId.slice(0, 8)}${r.isHost ? ` · ${t('发起人', 'host')}` : ''}`] as [string, string])} />
          <NativeSelect label={t('出席结果', 'Attendance')} value={value} onChange={(v) => setValue(v as 'present' | 'absent')}
            options={[['present', t('出席 present', 'Present')], ['absent', t('未出席 absent', 'Absent')]]} />
          <label>{t('纠错原因（审计）', 'Reason (audited)')}
            <textarea aria-label={t('纠错原因', 'Correction reason')} value={reason} maxLength={REASON.max} onChange={(e) => setReason(e.target.value)} />
          </label>
          <div className="form-actions">
            <button className="button primary" disabled={busy || !reasonValid || !subject || windowOpen || facts.mealStatus === 'CANCELLED'}>{t('追加修订并核对影响', 'Add revision and review impact')}</button>
            <button type="button" className="text-button" onClick={() => { setReason(''); setOutcome(null); intent.current = null; }}>{t('取消本次修改', 'Discard changes')}</button>
          </div>
        </form>
      )}
      {outcome && <CorrectionOutcome outcome={outcome} t={t} />}
    </Panel>
  );
}

function CorrectionOutcome({ outcome, t }: { outcome: Outcome; t: Translate }) {
  switch (outcome.kind) {
    case 'impact': return (
      <div role="status" className="draft-note">
        <strong>{t(`修订已追加（版本 ${outcome.version}）`, `Revision added (revision ${outcome.version})`)}</strong>
        <p>{t('原始本人/发起人报告保留。公开评价可见性、单场体验统计与仅依赖本场的联系资格按新事实重算；新数据快照生成后统计生效，旧快照不变。', 'Original self/host reports are kept. Public review visibility, experience statistics and connections that depend only on this meal are recalculated; statistics change in the next snapshot, older snapshots stay as they were.')}</p>
      </div>
    );
    case 'window': return <p role="alert" className="inline-error">{t('仍在7天自助窗口内，未执行纠错。', 'Still inside the 7-day self-report window; nothing was changed.')}</p>;
    case 'conflict': return <p role="alert" className="inline-error">{t('记录已发生变化：已载入最新版本，原因与选择已保留，请核对后重新提交。', 'The record changed: the latest revision is loaded and your choice and reason are kept. Review and submit again.')}</p>;
    case 'failed': return <p role="alert" className="inline-error">{outcome.uncertain
      ? t('结果未确认（网络中断）。原因与选择已保留，可原样重试，不会追加第二条修订。', 'Outcome unknown (network). Your inputs are kept; retry unchanged — it will not add a second revision.')
      : t('修订未执行。原因与选择已保留，可重试。', 'The revision was not applied. Your inputs are kept; you can retry.')}</p>;
    case 'not_applicable': return <p role="alert" className="inline-error">{t('不适用：对象须在开始名单内且饭局未取消。', 'Not applicable: the member must be on the start roster and the meal not cancelled.')}</p>;
    case 'invalid': return <p role="alert" className="inline-error">{t('请检查对象、结果与原因。', 'Check the member, result and reason.')}</p>;
  }
}

/**
 * Reply and record the case result (J09 reply → replied). The public outcome is plain text the
 * reporter sees via reportStatus; the reason is internal and audited. If-Match = current case version.
 */
export function CaseReplyPanel({ caseId, t, onChanged }: { caseId: string; t: Translate; onChanged(): Promise<void> }) {
  const c = useConsole();
  const { reportFailure } = c;
  const [info, setInfo] = useState<SupportCaseInfo | null>(null);
  const [denied, setDenied] = useState(false);
  const [status, setStatus] = useState<CaseStatus>('RESOLVED');
  const [reply, setReply] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const intent = useRef<string | null>(null);

  const load = useCallback(async () => {
    try { setInfo(await c.api.supportCase(caseId)); setDenied(false); }
    catch (error) { const failure = toFailure(error); if (endsSession(failure.kind)) reportFailure(error); setInfo(null); setDenied(true); }
  }, [c.api, reportFailure, caseId]);
  useEffect(() => { void load(); }, [load]);

  if (denied) return <Panel title={t('回复并记录处理结果', 'Reply and record the result')}><p role="alert">{t('无权处理此个案。', 'No access to this case.')}</p></Panel>;
  if (!info) return null;
  const replyValid = reply.trim().length >= 1 && reply.trim().length <= 1000;
  const reasonValid = reason.trim().length >= REASON.min && reason.trim().length <= REASON.max;
  const save = async () => {
    if (!replyValid || !reasonValid) return;
    setBusy(true); setMessage(null);
    intent.current ??= newIntentKey();
    try {
      const saved = await c.api.resolveCase(caseId, { status, publicOutcome: reply.trim(), reason: reason.trim() }, info.version, intent.current);
      intent.current = null; setInfo(saved); setReason('');
      setMessage({ ok: true, text: t('处理结果与回复已保存，举报人可在 App 中看到（审计已记录）。', 'Result and reply saved; the reporter sees them in the app (audited).') });
      await onChanged();
    } catch (error) {
      const failure = toFailure(error);
      if (endsSession(failure.kind)) { reportFailure(error); return; }
      if (failure.kind !== 'network') intent.current = null;
      if (failure.kind === 'conflict') { setMessage({ ok: false, text: t('个案已被更新：已载入最新版本，回复内容已保留，请核对后再保存。', 'The case changed: the latest version is loaded and your reply is kept. Review and save again.') }); await load(); }
      else if (failure.kind === 'forbidden' || failure.kind === 'not_found') { setInfo(null); setDenied(true); }
      else setMessage({ ok: false, text: failure.kind === 'network'
        ? t('结果未确认，回复已保留，可原样重试。', 'Outcome unknown; your reply is kept. Retry unchanged.')
        : t('回复未保存，内容已保留，请重试。', 'The reply was not saved; it is kept. Please retry.') });
    } finally { setBusy(false); }
  };
  return (
    <Panel title={t('回复并记录处理结果', 'Reply and record the result')} action={<Badge tone={info.status === 'RESOLVED' ? 'green' : 'amber'}>{info.status === 'RESOLVED' ? t('已回复', 'Replied') : t('处理中', 'In progress')}</Badge>}>
      <form className="action-form" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <NativeSelect label={t('个案状态', 'Case status')} value={status} onChange={(v) => setStatus(v as CaseStatus)}
          options={[['RESOLVED', t('已处理（关闭）', 'Resolved (close)')], ['IN_REVIEW', t('处理中（仅更新回复）', 'In review (update reply only)')]]} />
        <label>{t('举报人可见的回复（纯文本，不含他人私密材料）', 'Reply the reporter sees (plain text, no one else’s private details)')}
          <textarea aria-label={t('提交者可见回复', 'Reporter-visible reply')} value={reply} maxLength={1000} onChange={(e) => setReply(e.target.value)} />
        </label>
        <label>{t('内部原因（审计）', 'Internal reason (audited)')}
          <textarea aria-label={t('内部原因', 'Internal reason')} value={reason} maxLength={REASON.max} onChange={(e) => setReason(e.target.value)} />
        </label>
        <div className="form-actions">
          <button className="button primary" disabled={busy || !replyValid || !reasonValid}>{t('保存处理结果与回复', 'Save result and reply')}</button>
        </div>
      </form>
      {message && <p role={message.ok ? 'status' : 'alert'} className={message.ok ? 'draft-note' : 'inline-error'}>{message.text}</p>}
    </Panel>
  );
}
