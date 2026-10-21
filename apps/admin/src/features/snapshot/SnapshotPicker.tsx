import { DetailDialog } from '../../components/DetailDialog.tsx';
import { Badge } from '../../components/Panel.tsx';
import { formatLondonTime, type Language, type Translate } from '../../i18n.ts';
import { useConsole } from '../../state/console.tsx';

/** Explicit snapshot choice; revoked snapshots are listed but cannot be selected. */
export function SnapshotPicker({ t, lang }: { t: Translate; lang: Language }) {
  const c = useConsole();
  if (!c.pickerOpen) return null;
  const list = [...c.snapshots].sort((a, b) => b.asOf.localeCompare(a.asOf));
  return (
    <DetailDialog t={t} title={t('选择数据快照', 'Choose a data snapshot')} onClose={() => c.openPicker(false)}>
      {c.revokedNotice && (
        <p className="inline-error" role="alert">
          {t('所选快照已因隐私删除撤销，旧数据和缓存已清除。请选择新的快照。', 'The selected snapshot was revoked after a privacy deletion; old data and caches were cleared. Choose a new snapshot.')}
        </p>
      )}
      <p className="method-note">{t('页面、明细、翻页与导出都使用同一快照；切换后重新加载。', 'Pages, drilldowns, paging and exports all use one snapshot; switching reloads them.')}</p>
      <div className="dictionary-list">
        {list.map((s) => (
          <button key={s.id} disabled={s.status !== 'SEALED'} aria-current={c.snapshot?.id === s.id ? 'true' : undefined} onClick={() => c.selectSnapshot(s.id)}>
            <div>
              <strong>{formatLondonTime(lang, s.asOf)}</strong>
              <p className="mono">{s.id} · v{s.definitionVersion} · rev {s.classificationRevision}</p>
            </div>
            <Badge tone={s.status === 'SEALED' ? 'green' : 'red'}>{s.status === 'SEALED' ? t('已密封', 'Sealed') : t('已撤销', 'Revoked')}</Badge>
          </button>
        ))}
      </div>
      {!list.length && <p>{t('暂无可用快照。', 'No snapshot is available yet.')}</p>}
    </DetailDialog>
  );
}
