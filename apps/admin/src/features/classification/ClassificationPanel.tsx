import { CLASSIFICATIONS } from '@fancy/contracts';
import { newIntentKey } from '@fancy/client';
import { useEffect, useRef, useState } from 'react';
import { hasRole, type ClassificationInfo, type ClassificationValue } from '../../api/admin-api.ts';
import { isBlocking, toFailure } from '../../api/failure.ts';
import { NativeSelect } from '../../components/controls.tsx';
import { Panel } from '../../components/Panel.tsx';
import type { Translate } from '../../i18n.ts';
import { useConsole } from '../../state/console.tsx';
import { allowedActions, scopeOf, type IntentState } from './intent.ts';
import { retryStatistics, saveFailure } from './sync.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const REASON_MIN = 5;
export const REASON_MAX = 500;

/**
 * Analytics classification (regular/test/staff). data_admin only — the server enforces the role,
 * MFA and audit. One click freezes one intent (payload, base revision, key) in the console's
 * intent book; the draft below stays editable and independent. An unknown outcome is resolved
 * only by reading the original intent's receipt (the console polls it), never by re-sending.
 * Once accepted, only statistics can be retried; old statistics stay hidden until ready.
 */
export function ClassificationPanel({ t }: { t: Translate }) {
  const c = useConsole();
  const [userId, setUserId] = useState('');
  const [current, setCurrent] = useState<ClassificationInfo | null>(null);
  const [value, setValue] = useState<ClassificationValue>('regular');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const retryKey = useRef<{ refreshId: string; key: string } | null>(null);
  const names: Record<ClassificationValue, string> = { regular: t('正式', 'Regular'), test: t('测试', 'Test'), staff: t('员工', 'Staff') };
  const accountId = c.session?.user.id ?? null;
  const target = current?.userId ?? null;
  const actions = allowedActions(target ? c.intents.byTarget[target] : undefined);
  const entries = Object.values(c.intents.byTarget);
  const readyIds = entries.flatMap((s) => (s.phase === 'accepted' && s.stats.status === 'ready' && s.stats.refresh.snapshotId ? [s.stats.refresh.snapshotId] : [])).join(',');

  // Statistics became ready: make the sealed snapshot selectable (switching stays explicit).
  useEffect(() => { if (readyIds) void c.refreshSnapshots(); }, [readyIds]);

  const intro = (
    <p className="method-note">{t('按用户编号标注正式、测试或员工账号。测试/员工的行为和参与记录不计入指标；其发起的饭局整场排除。分类只影响统计，不改变登录权限。', 'Classify IDs as regular, test or staff. Test/staff behavior and participation are excluded; meals hosted by them are excluded entirely. This does not change login permissions.')}</p>
  );
  if (!hasRole(c.session, 'data_admin')) {
    return (
      <Panel title={t('统计账号分类', 'Analytics account classification')}>
        {intro}
        <p role="note">{t('仅数据管理员可修改分类。', 'Only data admins can change classifications.')}</p>
      </Panel>
    );
  }

  const loadErrorText = (error: unknown) => {
    const { kind } = toFailure(error);
    if (kind === 'not_found') return t('未找到该用户编号。', 'User ID not found.');
    if (kind === 'forbidden') return t('没有修改分类的权限。', 'You are not allowed to change classifications.');
    if (kind === 'reauth' || kind === 'signed_out') return t('需要重新验证身份。', 'Re-verify your identity.');
    return t('读取失败，请重试。', 'Loading failed. Please retry.');
  };

  const load = async (id = userId.trim().toLowerCase()) => {
    setMessage(null);
    if (!UUID.test(id)) { setCurrent(null); setMessage({ ok: false, text: t('请输入有效的用户编号（UUID）。', 'Enter a valid user ID (UUID).') }); return; }
    setBusy(true);
    try {
      const info = await c.api.getClassification(id);
      setCurrent(info);
      setValue(info.classification);
    } catch (error) {
      setCurrent(null);
      if (isBlocking(toFailure(error).kind)) c.reportFailure(error);
      setMessage({ ok: false, text: loadErrorText(error) });
    } finally { setBusy(false); }
  };

  const trimmed = reason.trim();
  const reasonValid = trimmed.length >= REASON_MIN && trimmed.length <= REASON_MAX;
  const save = async () => {
    if (!current || !reasonValid || !accountId || !actions.has('submit')) return;
    const frozen = { accountId, key: newIntentKey(), targetUserId: current.userId, classification: value, reason: trimmed, baseRevision: current.revision };
    const saving: IntentState = { phase: 'saving', intent: frozen };
    c.dispatchIntent({ type: 'submit', intent: frozen });
    setBusy(true);
    setMessage(null);
    try {
      const saved = await c.api.classify(frozen.targetUserId, { classification: frozen.classification, reason: frozen.reason }, frozen.baseRevision, frozen.key);
      c.dispatchIntent({ type: 'saved', scope: scopeOf(frozen), revision: saved.revision, statisticsRefresh: saved.statisticsRefresh });
      setReason('');
    } catch (error) {
      const event = saveFailure(saving, error);
      c.dispatchIntent(event);
      if (isBlocking(toFailure(error).kind) && toFailure(error).kind !== 'signed_out') c.reportFailure(error);
      // Version conflict: show the latest version; saving again is a new, explicitly confirmed intent.
      if (event.type === 'saveFailed' && event.code === 'VERSION_CONFLICT') { setBusy(false); await load(frozen.targetUserId); }
    } finally { setBusy(false); }
  };

  const reload = async (id: string) => { setUserId(id); await load(id); };
  const retry = async (intent: IntentState) => {
    if (intent.phase !== 'accepted' || intent.stats.status !== 'failed') return;
    const refreshId = intent.stats.refresh.refreshId;
    if (retryKey.current?.refreshId !== refreshId) retryKey.current = { refreshId, key: newIntentKey() };
    setBusy(true);
    const event = await retryStatistics(c.api, intent, retryKey.current.key);
    setBusy(false);
    if (event) c.dispatchIntent(event);
    if (event?.type === 'stats') retryKey.current = null;
  };

  return (
    <Panel title={t('统计账号分类', 'Analytics account classification')}>
      {intro}
      <div className="classification-form">
        <label>{t('用户编号', 'User ID')}
          <input aria-label={t('分类用户编号', 'Classification user ID')} value={userId} onChange={(e) => { setUserId(e.target.value); setCurrent(null); }} placeholder="00000000-0000-4000-8000-000000000000" />
        </label>
        <button className="button" disabled={busy} onClick={() => void load()}>{t('读取当前分类', 'Load current class')}</button>
      </div>
      {current && (
        <div className="classification-form">
          <p className="mono">{t('当前', 'Current')}: {names[current.classification]} · rev {current.revision}</p>
          <NativeSelect label={t('账号分类', 'Account class')} value={value} onChange={(v) => setValue(v as ClassificationValue)}
            options={CLASSIFICATIONS.map((k) => [k, names[k]] as [string, string])} />
          <label>{t('修改原因', 'Reason')}
            <input aria-label={t('分类修改原因', 'Classification reason')} value={reason} maxLength={REASON_MAX} onChange={(e) => setReason(e.target.value)} />
          </label>
          <button className="button" disabled={busy || !reasonValid || value === current.classification || !actions.has('submit')} onClick={() => void save()}>{t('保存分类', 'Save classification')}</button>
          {!reasonValid && <small>{t(`原因需 ${REASON_MIN}–${REASON_MAX} 个字符。`, `Reason must be ${REASON_MIN}–${REASON_MAX} characters.`)}</small>}
        </div>
      )}
      {entries.length > 0 && (
        <ul className="classification-status" aria-label={t('分类保存状态', 'Classification save status')}>
          {entries.map((state) => {
            const status = describe(state, t, names);
            const allowed = allowedActions(state);
            const ready = state.phase === 'accepted' && state.stats.status === 'ready' ? state.stats.refresh.snapshotId : null;
            return (
              <li key={state.intent.key}>
                <span className="mono">{state.intent.targetUserId}</span>
                <p role={status.ok ? 'status' : 'alert'} className={status.ok ? undefined : 'inline-error'}>{status.text}</p>
                {allowed.has('retryStats') && <button className="button" disabled={busy} onClick={() => void retry(state)}>{t('重试统计更新', 'Retry statistics update')}</button>}
                {allowed.has('reload') && <button className="button" disabled={busy} onClick={() => void reload(state.intent.targetUserId)}>{t('重新读取当前分类', 'Reload current class')}</button>}
                {ready && c.snapshot?.id !== ready && c.snapshots.some((s) => s.id === ready && s.status === 'SEALED') && (
                  <button className="button" onClick={() => c.selectSnapshot(ready)}>{t('切换到包含此分类的快照', 'Switch to the snapshot with this classification')}</button>
                )}
                {(state.phase === 'conflict' || state.phase === 'rejected') && (
                  <button className="text-button" onClick={() => c.dispatchIntent({ type: 'dismiss', targetUserId: state.intent.targetUserId })}>{t('关闭', 'Dismiss')}</button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {message && <p role={message.ok ? 'status' : 'alert'} className={message.ok ? undefined : 'inline-error'}>{message.text}</p>}
    </Panel>
  );
}

function describe(state: IntentState, t: Translate, names: Record<ClassificationValue, string>): { ok: boolean; text: string } {
  const what = `${names[state.intent.classification]} · rev ${state.intent.baseRevision}`;
  switch (state.phase) {
    case 'saving': return { ok: true, text: t(`正在保存（${what}）…`, `Saving (${what})…`) };
    case 'unknown':
      if (state.reason === 'reauth') return { ok: false, text: t('保存结果未知：需要重新验证身份后查询原保存请求，不会重复提交。', 'Save outcome unknown: re-verify your identity to check the original request. It will not be sent again.') };
      if (state.reason === 'pending') return { ok: true, text: t('服务器仍在处理原保存请求，稍后自动查询。', 'The server is still processing the original request; checking again shortly.') };
      return { ok: false, text: t(`保存结果未知（${what}）：正在只查询原保存请求，不会重复提交；查到结果前统计已暂停。`, `Save outcome unknown (${what}): checking the original request only, it will not be sent again. Statistics are paused until it is known.`) };
    case 'conflict': return { ok: false, text: t('分类已被他人更新。请重新读取当前版本并确认后再保存。', 'The classification changed meanwhile. Reload the current version and confirm before saving again.') };
    case 'rejected':
      if (state.reason === 'expired') return { ok: false, text: t('原保存请求已过期且结果未知。请重新读取当前分类，再决定是否重新保存。', 'The original request expired without a known outcome. Reload the current class before deciding to save again.') };
      if (state.reason === 'not_found') return { ok: false, text: t('未找到该用户编号。', 'User ID not found.') };
      if (state.reason === 'forbidden') return { ok: false, text: t('没有修改分类的权限。', 'You are not allowed to change classifications.') };
      return { ok: false, text: t('保存未成功，请检查后重试。', 'The save did not succeed. Check and retry.') };
    case 'accepted':
      switch (state.stats.status) {
        case 'locating':
        case 'pending': return { ok: true, text: t(`分类已保存（审计已记录，rev ${state.acceptedRevision}）。统计更新中，旧统计已隐藏。`, `Classification saved and audited (rev ${state.acceptedRevision}). Statistics are updating; old statistics are hidden.`) };
        case 'failed': return { ok: false, text: t('分类已保存，但统计更新失败。可只重试统计，不会再次修改分类。', 'Classification saved, but the statistics update failed. Retry statistics only; the classification is not changed again.') };
        case 'ready': return { ok: true, text: t('统计已更新到包含此分类的新快照。', 'Statistics are updated in a new snapshot that includes this classification.') };
      }
  }
}
