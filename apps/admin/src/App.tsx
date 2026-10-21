import { useCallback, useState } from 'react';
import type { AdminApi, AdminPageName } from './api/admin-api.ts';
import { DetailDialog } from './components/DetailDialog.tsx';
import { Icon } from './components/Icon.tsx';
import { findMetric, MetricDefinition, MetricDictionary, metricCopy } from './features/dictionary/MetricDictionary.tsx';
import { FilterBar } from './features/filters/FilterBar.tsx';
import { SnapshotPicker } from './features/snapshot/SnapshotPicker.tsx';
import { FailureScreen } from './features/status/FailureScreen.tsx';
import { formatLondonTime, makeT, type Language, type Translate } from './i18n.ts';
import { ConsoleProvider, useConsole } from './state/console.tsx';
import type { AdminFilters } from './state/filters.ts';
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

function Shell({ lang, page, filters, setLang, setFilters, go }: {
  lang: Language; page: AdminPageName; filters: AdminFilters;
  setLang(lang: Language): void; setFilters(filters: AdminFilters): void; go(page: AdminPageName): void;
}) {
  const t = makeT(lang);
  const c = useConsole();
  const [metricId, setMetricId] = useState<string | null>(null);
  const nav = navNames(t);
  const metric = metricId ? findMetric(metricId) : undefined;

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
            {/* G5 pending: export scope (summary.<page> or metric) not yet in the contract. */}
            <button className="button export-button" disabled title={t('导出范围待接口契约确认', 'Export scope pending API contract')}>
              <Icon name="download" size={17} />{t('导出指标', 'Export metrics')}
            </button>
          </div>
          {c.gate.status === 'failed' ? (
            <FailureScreen failure={c.gate.failure} t={t} onRetry={() => location.reload()} />
          ) : c.gate.status === 'loading' ? (
            <p role="status">{t('正在验证访问权限…', 'Checking access…')}</p>
          ) : (
            <Body t={t} lang={lang} page={page} filters={filters} setFilters={setFilters} go={go} openMetric={setMetricId} />
          )}
          <footer className="page-footer">
            <span>Fancy · {t('让真实见面成为迭代的起点', 'Build from real meetings')}</span>
            <span>{c.snapshot ? `${t('指标定义', 'Definitions')} v${c.snapshot.definitionVersion}` : ''}</span>
          </footer>
        </main>
      </div>
      <SnapshotPicker t={t} lang={lang} />
      {metric && (
        <DetailDialog t={t} title={metricCopy(metric, 'title', lang)} onClose={() => setMetricId(null)}>
          <MetricDefinition metric={metric} t={t} lang={lang} definitionVersion={c.snapshot?.definitionVersion ?? null} />
        </DetailDialog>
      )}
    </div>
  );
}

function Body({ t, lang, page, filters, setFilters, go, openMetric }: {
  t: Translate; lang: Language; page: AdminPageName; filters: AdminFilters;
  setFilters(filters: AdminFilters): void; go(page: AdminPageName): void; openMetric(id: string): void;
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
  return (
    <>
      <FilterBar t={t} filters={filters} snapshotDay={c.snapshotDay} route={page} onChange={setFilters} />
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
      {ps.status === 'failed' ? (
        <FailureScreen failure={ps.failure} t={t} onRetry={() => void c.refreshSnapshots()} />
      ) : ps.status !== 'ready' ? (
        <p role="status">{t('正在加载快照数据…', 'Loading snapshot data…')}</p>
      ) : (
        <section aria-label={t('页面内容', 'Page content')} data-snapshot={ps.data.snapshot.id} data-filter-hash={ps.data.filterHash}>
          {/* G3/G4 pending: per-page metric/series keys and drilldown list keys are not in the contract yet,
              so no page body is rendered rather than inventing keys. */}
          <p className="method-note">{t('本页图表待指标键契约（G3/G4）确认后接入。', 'Charts for this page connect once the metric key contract (G3/G4) lands.')}</p>
          {page === 'quality' && <MetricDictionary t={t} lang={lang} onOpen={openMetric} />}
        </section>
      )}
    </>
  );
}
