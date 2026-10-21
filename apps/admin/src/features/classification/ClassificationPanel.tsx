import { CLASSIFICATIONS } from '@fancy/contracts';
import { newIntentKey } from '@fancy/client';
import { useRef, useState } from 'react';
import { hasRole, type ClassificationInfo, type ClassificationValue } from '../../api/admin-api.ts';
import { toFailure } from '../../api/failure.ts';
import { NativeSelect } from '../../components/controls.tsx';
import { Panel } from '../../components/Panel.tsx';
import type { Translate } from '../../i18n.ts';
import { useConsole } from '../../state/console.tsx';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const REASON_MIN = 5;
export const REASON_MAX = 500;

/**
 * Analytics classification (regular/test/staff). data_admin only — the server enforces the role,
 * MFA and audit; the UI shows the form only to data_admin and still handles 403. Saving never edits
 * displayed numbers: the server returns snapshotPending and a new snapshot must be chosen explicitly.
 */
export function ClassificationPanel({ t }: { t: Translate }) {
  const c = useConsole();
  const [userId, setUserId] = useState('');
  const [current, setCurrent] = useState<ClassificationInfo | null>(null);
  const [value, setValue] = useState<ClassificationValue>('regular');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const intent = useRef<string | null>(null);
  const names: Record<ClassificationValue, string> = { regular: t('正式', 'Regular'), test: t('测试', 'Test'), staff: t('员工', 'Staff') };

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

  const errorText = (error: unknown) => {
    const { kind } = toFailure(error);
    if (kind === 'not_found') return t('未找到该用户编号。', 'User ID not found.');
    if (kind === 'conflict') return t('分类已被他人更新，已重新读取当前版本，请确认后再保存。', 'The classification changed meanwhile; the current version was reloaded. Review and save again.');
    if (kind === 'forbidden') return t('没有修改分类的权限。', 'You are not allowed to change classifications.');
    if (kind === 'reauth' || kind === 'signed_out') return t('需要重新验证身份后再保存。', 'Re-verify your identity, then save again.');
    if (kind === 'invalid') return t('请检查用户编号与原因。', 'Check the user ID and reason.');
    return t('保存失败，请重试。', 'Save failed. Please retry.');
  };

  const load = async () => {
    setMessage(null);
    setCurrent(null);
    if (!UUID.test(userId.trim())) { setMessage({ ok: false, text: t('请输入有效的用户编号（UUID）。', 'Enter a valid user ID (UUID).') }); return; }
    setBusy(true);
    try {
      const info = await c.api.getClassification(userId.trim().toLowerCase());
      setCurrent(info);
      setValue(info.classification);
    } catch (error) {
      setMessage({ ok: false, text: errorText(error) });
    } finally { setBusy(false); }
  };

  const trimmed = reason.trim();
  const reasonValid = trimmed.length >= REASON_MIN && trimmed.length <= REASON_MAX;
  const save = async () => {
    if (!current || !reasonValid) return;
    setBusy(true);
    setMessage(null);
    intent.current ??= newIntentKey();
    try {
      const saved = await c.api.classify(current.userId, { classification: value, reason: trimmed }, current.revision, intent.current);
      intent.current = null;
      setCurrent(saved);
      setReason('');
      setMessage({
        ok: true,
        text: saved.snapshotPending
          ? t('分类已保存（审计已记录）。新快照生成中，当前页面仍使用原快照；生成后可切换。', 'Classification saved and audited. A new snapshot is being built; this page keeps the current one until you switch.')
          : t('分类已保存。', 'Classification saved.'),
      });
      void c.refreshSnapshots();
    } catch (error) {
      const { kind } = toFailure(error);
      if (kind !== 'network') intent.current = null;
      setMessage({ ok: false, text: errorText(error) });
      if (kind === 'conflict') {
        try { setCurrent(await c.api.getClassification(current.userId)); } catch { setCurrent(null); }
      }
    } finally { setBusy(false); }
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
          <button className="button" disabled={busy || !reasonValid || value === current.classification} onClick={() => void save()}>{t('保存分类', 'Save classification')}</button>
          {!reasonValid && <small>{t(`原因需 ${REASON_MIN}–${REASON_MAX} 个字符。`, `Reason must be ${REASON_MIN}–${REASON_MAX} characters.`)}</small>}
        </div>
      )}
      {message && <p role={message.ok ? 'status' : 'alert'} className={message.ok ? undefined : 'inline-error'}>{message.text}</p>}
    </Panel>
  );
}
