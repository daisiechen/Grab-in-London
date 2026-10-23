import { ADMIN_DRILLDOWN_TARGETS } from '@fancy/contracts';
import { useCallback, useEffect, useState } from 'react';
import type { AdminApi, AdminPageName, DrilldownTarget } from './api/admin-api.ts';
import { DetailDialog } from './components/DetailDialog.tsx';
import { Icon } from './components/Icon.tsx';
import { listTitle, metricTitle } from './dictionary/labels.ts';
import { findMetric, MetricDefinition } from './features/dictionary/MetricDictionary.tsx';
import { DrilldownTable, type Binding } from './features/drilldown/DrilldownTable.tsx';
import { ExportButton } from './features/exports/ExportButton.tsx';
import { FilterBar } from './features/filters/FilterBar.tsx';
import { SnapshotPicker } from './features/snapshot/SnapshotPicker.tsx';
import { ClassificationPanel } from './features/classification/ClassificationPanel.tsx';
import { FailureScreen } from './features/status/FailureScreen.tsx';
import { formatLondonTime, makeT, type Language, type Translate } from './i18n.ts';
import { openRow, PageBody, type Detail } from './pages/pages.tsx';
import { ConsoleProvider, useConsole } from './state/console.tsx';
import { emptyFilters, type AdminFilters } from './state/filters.ts';
import { PAGES, useUrlState } from './state/url.ts';

const navNames = (t: Translate): Record<AdminPageName, string> => ({
  overview: t('产品概览', 'Overview'),
  journey: t('用户旅程', 'User journeys'),
  supply: t('饭局与供需', 'Meals & supply'),
  retention: t('体验与留存', 'Experience & retention'),
  quality: t('数据与定义', 'Data & definitions'),
});
const descriptions = (t: Translate): Record<AdminPageName, string> => ({
  overview: t('从一次发现，到一次真实见面。', 'From finding a table to meeting in person.'),
  journey: t('找到意愿与行动之间的阻力。', 'Find the friction between intent and action.'),
  supply: t('分清没有合适的饭局，还是没能约成。', 'Understand missing supply and unfinished plans.'),
  retention: t('一次舒服的见面，会让人再次赴约吗？', 'Does a good first meal bring people back?'),
  quality: t('先相信数据，再做产品判断。', 'Trust the evidence before making a decision.'),
});

export default function App({ api }: { api: AdminApi }) {
  const { state, page, update, go } = useUrlState();
  const onSnapshotChange = useCallback((snapshotId: string | null) => update({ snapshotId }), [update]);
  return (
    <ConsoleProvider api={api} page={page} filters={state.filters} snapshotId={state.snapshotId} onSnapshotChange={onSnapshotChange}>
      <Shell lang={state.lang} page={page} filters={state.filters}
        setLang={(lang) => update({ lang })} setFilters={(filters) => update({ filters })} go={go} />
    </ConsoleProvider>
  );
}

/** Detail drawer entries carry the binding they were opened with, so nested paging never changes snapshot. */
type OpenDetail = Detail & { binding: Binding | null };

function Shell({ lang, page, filters, setLang, setFilters, go }: {
  lang: Language; page: AdminPageName; filters: AdminFilters;
  setLang(lang: Language): void; setFilters(filters: AdminFilters): void; go(page: AdminPageName): void;
}) {
  const t = makeT(lang);
  const c = useConsole();
  const [details, setDetails] = useState<OpenDetail[]>([]);
  const [evidence, setEvidence] = useState('all');
  const nav = navNames(t);
  const binding: Binding | null = c.binding?.filterHash ? { snapshotId: c.binding.snapshotId, filterHash: c.binding.filterHash, query: c.binding.query } : null;
  const open = (detail: Detail) => setDetails((prev) => [...prev, { ...detail, binding }]);
  const close = () => setDetails([]);
  const detail = details.at(-1);

  // Changing page or snapshot closes drawers (their binding belongs to the previous view).
  useEffect(() => { setDetails([]); window.scrollTo?.({ top: 0 }); }, [page, c.snapshot?.id]);
  // Pending/failed classification statistics: no drilldown of the old numbers stays open.
  useEffect(() => { if (!c.statisticsSettled) setDetails([]); }, [c.statisticsSettled]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">{t('跳转至内容', 'Skip to content')}</a>
      <aside className="sidebar">
        <a href="#overview" className="wordmark">Fancy<span className="brand-flower">✳</span></a>
        <nav aria-label={t('主导航', 'Main navigation')}>
          {PAGES.map((p) => (
            <a key={p} href={`#${p}`} aria-label={nav[p]} title={nav[p]} aria-current={page === p ? 'page' : undefined}>
              <Icon name={p} /><span>{nav[p]}</span>{page === p && <span className="nav-active-dot" />}
            </a>
          ))}
        </nav>
        <div className="sidebar-note">
          <div className="little-table"><i /><i /><i /><i /><span /></div>
          <h3>{t('吃个饭，认识一下。', 'A meal. A new connection.')}</h3>
          <p>{t('衡量真实见面，理解每次选择。', 'Measure real meetings. Understand every choice.')}</p>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">Fancy <span>/</span><strong>{nav[page]}</strong></div>
          <div className="top-actions">
            <button className="language-button" onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')} aria-label={t('切换为英文', 'Switch to Chinese')}>
              <Icon name="globe" size={16} />{lang === 'zh' ? 'EN' : '中文'}
            </button>
          </div>
        </header>
        <nav className="mobile-nav" aria-label={t('移动端导航', 'Mobile navigation')}>
          {PAGES.map((p) => (
            <a href={`#${p}`} aria-label={nav[p]} title={nav[p]} key={p} aria-current={page === p ? 'page' : undefined}>
              <Icon name={p} size={16} /><span>{nav[p]}</span>
            </a>
          ))}
        </nav>
        <main id="main-content" tabIndex={-1}>
          <div className="page-title">
            <div>
              <div className="eyebrow">{t('伦敦试点', 'London pilot')}</div>
              <h1>{nav[page]}<span className="heading-dot">.</span></h1>
              <p>{descriptions(t)[page]}</p>
            </div>
            <ExportButton scope={`summary.${page}`} binding={c.gate.status === 'ready' && c.pageState.status === 'ready' && c.statisticsSettled ? binding : null} t={t} />
          </div>
          {c.gate.status === 'failed' ? (
            <FailureScreen failure={c.gate.failure} t={t} onRetry={() => location.reload()} />
          ) : c.gate.status === 'loading' ? (
            <p role="status">{t('正在验证访问权限…', 'Checking access…')}</p>
          ) : (
            <Body t={t} lang={lang} page={page} filters={filters} setFilters={setFilters} go={go} binding={binding}
              open={open} evidence={evidence} setEvidence={setEvidence} />
          )}
          <footer className="page-footer">
            <span>Fancy · {t('让真实见面成为迭代的起点', 'Build from real meetings')}</span>
            <span>{c.snapshot ? `${t('指标定义', 'Definitions')} v${c.snapshot.definitionVersion}` : ''}</span>
          </footer>
        </main>
      </div>
      <SnapshotPicker t={t} lang={lang} />
      {detail && c.gate.status === 'ready' && c.statisticsSettled && (
        <DetailDialog t={t} onClose={close} {...(details.length > 1 ? { onBack: () => setDetails((prev) => prev.slice(0, -1)) } : {})}
          title={detail.kind === 'metric' ? metricTitle(t, detail.id) : detail.title}>
          <DetailContent key={details.length} detail={detail} t={t} lang={lang} open={open} />
        </DetailDialog>
      )}
    </div>
  );
}

function DetailContent({ detail, t, lang, open }: { detail: OpenDetail; t: Translate; lang: Language; open(d: Detail): void }) {
  const c = useConsole();
  const metric = detail.kind === 'metric' ? findMetric(detail.id) : undefined;
  const target: DrilldownTarget | null = detail.kind === 'list' ? detail.target
    : (ADMIN_DRILLDOWN_TARGETS as readonly string[]).includes(detail.id) ? (detail.id as DrilldownTarget) : null;
  const rows = detail.kind === 'list' ? detail.rows : {};
  return (
    <>
      {metric && <MetricDefinition metric={metric} t={t} lang={lang} definitionVersion={c.snapshot?.definitionVersion ?? null} />}
      {detail.kind === 'list' && (
        <p className="method-note">{t('匿名业务编号；不展示联系方式、聊天内容或私密互选。', 'Pseudonymous business ID. Contact details, chat content and private choices are omitted.')}</p>
      )}
      {detail.binding && target ? (
        <>
          <h3>{listTitle(t, target)}</h3>
          <DrilldownTable target={target} binding={detail.binding} rows={rows} caption={listTitle(t, target)} t={t} lang={lang}
            onRow={(row) => openRow({ open, t }, row.attributes)} />
          <ExportButton scope={target} binding={detail.binding} rows={rows} t={t} className="text-button" label={t('导出此明细', 'Export these records')} />
        </>
      ) : target && (
        <p className="method-note">{t('快照数据加载后可查看来源明细。', 'Source records are available once snapshot data has loaded.')}</p>
      )}
    </>
  );
}

function Body({ t, lang, page, filters, setFilters, go, binding, open, evidence, setEvidence }: {
  t: Translate; lang: Language; page: AdminPageName; filters: AdminFilters; setFilters(filters: AdminFilters): void;
  go(page: AdminPageName): void; binding: Binding | null; open(d: Detail): void; evidence: string; setEvidence(v: string): void;
}) {
  const c = useConsole();
  if (!c.snapshot || !c.snapshotDay) {
    return (
      <div className="panel load-error" role="status">
        <Icon name="quality" size={36} />
        <h2>{c.revokedNotice ? t('快照已撤销', 'Snapshot revoked') : t('暂无可用快照', 'No snapshot available')}</h2>
        <p>{c.revokedNotice
          ? t('旧数据和缓存已清除，请选择新的快照。', 'Old data and caches were cleared. Choose a new snapshot.')
          : t('还没有已密封的数据快照，未展示任何数值。', 'No sealed snapshot exists yet, so no numbers are shown.')}</p>
        <button className="button primary" onClick={() => c.openPicker(true)}>{t('选择快照', 'Choose snapshot')}</button>
      </div>
    );
  }
  const ps = c.pageState;
  const reset = () => setFilters(emptyFilters());
  return (
    <>
      <FilterBar t={t} filters={filters} snapshotDay={c.snapshotDay} dimensions={c.snapshot.dimensions} route={page} onChange={setFilters} />
      <div className="context-line">
        <span>
          {t('伦敦时间 · 数据截至', 'Europe/London · data as of')} {formatLondonTime(lang, c.snapshot.asOf)}
          {' · '}
          <button className="text-button" onClick={() => c.openPicker(true)}>{t('切换快照', 'Change snapshot')}</button>
        </span>
        <button className="text-button" onClick={() => go('quality')}>{t('查看数据口径', 'View definitions')} <Icon name="arrow" size={14} /></button>
      </div>
      {c.newerSnapshot && (
        <p className="draft-note" role="status">
          {t('有更新的数据快照。当前页面、明细与导出仍使用原快照。', 'A newer snapshot is available. This page, drilldowns and exports keep the current one.')}{' '}
          <button className="text-button" onClick={() => c.selectSnapshot(c.newerSnapshot!.id)}>{t('切换到新快照', 'Switch to the new snapshot')}</button>
        </p>
      )}
      {!c.statisticsSettled ? (
        <section aria-label={t('统计更新中', 'Statistics updating')}>
          <p className="draft-note" role="status">{t('分类统计尚未更新完成：图表、明细与导出已暂停，不展示旧统计。', 'Classification statistics are not updated yet: charts, drilldowns and exports are paused and old statistics are hidden.')}</p>
        </section>
      ) : ps.status === 'failed' ? (
        <FailureScreen failure={ps.failure} t={t} onRetry={c.retryPage} />
      ) : ps.status !== 'ready' || !binding ? (
        <p role="status">{t('正在加载快照数据…', 'Loading snapshot data…')}</p>
      ) : (
        <section aria-label={t('页面内容', 'Page content')} data-snapshot={ps.data.snapshot.id} data-filter-hash={ps.data.filterHash}>
          <PageBody page={page} data={ps.data} binding={binding} t={t} lang={lang} open={open} go={go} reset={reset}
            evidence={evidence} setEvidence={setEvidence} openMetric={(id) => open({ kind: 'metric', id })} />
        </section>
      )}
      {/* Fixed position: the panel (and its loaded target/draft) survives the statistics gate toggling. */}
      {(page === 'quality' || !c.statisticsSettled) && <ClassificationPanel t={t} />}
    </>
  );
}
