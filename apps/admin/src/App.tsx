import { ADMIN_DRILLDOWN_TARGETS } from '@fancy/contracts';
import { useCallback, useEffect, useState } from 'react';
import { hasAnalytics, hasRole, type AdminApi, type AdminPageName, type DrilldownTarget } from './api/admin-api.ts';
import { DetailDialog } from './components/DetailDialog.tsx';
import { Icon } from './components/Icon.tsx';
import { listTitle, metricTitle } from './dictionary/labels.ts';
import { findMetric, MetricDefinition } from './features/dictionary/MetricDictionary.tsx';
import { DrilldownTable, type Binding } from './features/drilldown/DrilldownTable.tsx';
import { ExportButton } from './features/exports/ExportButton.tsx';
import { FilterBar } from './features/filters/FilterBar.tsx';
import { SnapshotPicker } from './features/snapshot/SnapshotPicker.tsx';
import { FailureScreen } from './features/status/FailureScreen.tsx';
import { SignIn } from './features/auth/SignIn.tsx';
import { ModerationQueue } from './features/moderation/ModerationQueue.tsx';
import { ReportDetail } from './features/moderation/ReportDetail.tsx';
import { formatLondonTime, makeT, type Language, type Translate } from './i18n.ts';
import { openRow, PageBody, type Detail } from './pages/pages.tsx';
import { ConsoleProvider, useConsole } from './state/console.tsx';
import { emptyFilters, type AdminFilters } from './state/filters.ts';
import { PAGES, useUrlState, type Route } from './state/url.ts';

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
  const { state, page, route, update, go, navigate } = useUrlState();
  const onSnapshotChange = useCallback((snapshotId: string | null) => update({ snapshotId }), [update]);
  return (
    <ConsoleProvider api={api} page={page} filters={state.filters} snapshotId={state.snapshotId} onSnapshotChange={onSnapshotChange} analyticsActive={route.kind === 'analytics'}>
      <Shell lang={state.lang} page={page} route={route} filters={state.filters}
        setLang={(lang) => update({ lang })} setFilters={(filters) => update({ filters })} go={go} navigate={navigate} />
    </ConsoleProvider>
  );
}

/** Detail drawer entries carry the binding they were opened with, so nested paging never changes snapshot. */
type OpenDetail = Detail & { binding: Binding | null };

function Shell({ lang, page, route, filters, setLang, setFilters, go, navigate }: {
  lang: Language; page: AdminPageName; route: Route; filters: AdminFilters;
  setLang(lang: Language): void; setFilters(filters: AdminFilters): void; go(page: AdminPageName): void; navigate(route: Route): void;
}) {
  const t = makeT(lang);
  const c = useConsole();
  const analytics = !c.session || hasAnalytics(c.session);
  const support = hasRole(c.session, 'support');
  const moderation = route.kind === 'moderation';
  // Support-only staff land on the report queue instead of an analytics page they cannot read.
  useEffect(() => {
    if (c.gate.status === 'ready' && c.session && !hasAnalytics(c.session) && support && !moderation) navigate({ kind: 'moderation', reportId: null });
  }, [c.gate.status, c.session, support, moderation, navigate]);
  const signOut = async () => { try { await c.api.signOut(); } catch { /* the session is re-read either way */ } c.reloadSession(); };
  const [details, setDetails] = useState<OpenDetail[]>([]);
  const [evidence, setEvidence] = useState('all');
  const nav = navNames(t);
  const binding: Binding | null = c.binding?.filterHash ? { snapshotId: c.binding.snapshotId, filterHash: c.binding.filterHash, query: c.binding.query } : null;
  const open = (detail: Detail) => setDetails((prev) => [...prev, { ...detail, binding }]);
  const close = () => setDetails([]);
  const detail = details.at(-1);

  // Changing page or snapshot closes drawers (their binding belongs to the previous view).
  useEffect(() => { setDetails([]); window.scrollTo?.({ top: 0 }); }, [page, c.snapshot?.id]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">{t('跳转至内容', 'Skip to content')}</a>
      <aside className="sidebar">
        <a href="#overview" className="wordmark">Fancy<span className="brand-flower">✳</span></a>
        {analytics && (
          <nav aria-label={t('主导航', 'Main navigation')}>
            {PAGES.map((p) => (
              <a key={p} href={`#${p}`} aria-label={nav[p]} title={nav[p]} aria-current={!moderation && page === p ? 'page' : undefined}>
                <Icon name={p} /><span>{nav[p]}</span>{!moderation && page === p && <span className="nav-active-dot" />}
              </a>
            ))}
          </nav>
        )}
        {support && (
          <nav aria-label={t('安全与支持', 'Trust & support')} className="nav-section">
            <div className="nav-heading">{t('安全与支持', 'Trust & support')}</div>
            <a href="#moderation" aria-label={t('举报处理', 'Reports')} title={t('举报处理', 'Reports')} aria-current={moderation ? 'page' : undefined}>
              <Icon name="flag" /><span>{t('举报处理', 'Reports')}</span>{moderation && <span className="nav-active-dot" />}
            </a>
          </nav>
        )}
        <div className="sidebar-note">
          <div className="little-table"><i /><i /><i /><i /><span /></div>
          <h3>{t('吃个饭，认识一下。', 'A meal. A new connection.')}</h3>
          <p>{t('衡量真实见面，理解每次选择。', 'Measure real meetings. Understand every choice.')}</p>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">Fancy <span>/</span><strong>{moderation ? t('举报处理', 'Reports') : nav[page]}</strong></div>
          <div className="top-actions">
            {c.session && <button className="text-button" onClick={() => void signOut()}>{t('退出登录', 'Sign out')}</button>}
            <button className="language-button" onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')} aria-label={t('切换为英文', 'Switch to Chinese')}>
              <Icon name="globe" size={16} />{lang === 'zh' ? 'EN' : '中文'}
            </button>
          </div>
        </header>
        <nav className="mobile-nav" aria-label={t('移动端导航', 'Mobile navigation')}>
          {support && <a href="#moderation" aria-current={moderation ? 'page' : undefined}><Icon name="flag" size={16} /><span>{t('举报处理', 'Reports')}</span></a>}
          {analytics && PAGES.map((p) => (
            <a href={`#${p}`} aria-label={nav[p]} title={nav[p]} key={p} aria-current={page === p ? 'page' : undefined}>
              <Icon name={p} size={16} /><span>{nav[p]}</span>
            </a>
          ))}
        </nav>
        <main id="main-content" tabIndex={-1}>
          {moderation ? (
            <ModerationWorkspace t={t} lang={lang} route={route} navigate={navigate} />
          ) : (<>
          <div className="page-title">
            <div>
              <div className="eyebrow">{t('伦敦试点', 'London pilot')}</div>
              <h1>{nav[page]}<span className="heading-dot">.</span></h1>
              <p>{descriptions(t)[page]}</p>
            </div>
            <ExportButton scope={`summary.${page}`} binding={c.gate.status === 'ready' && c.pageState.status === 'ready' ? binding : null} t={t} />
          </div>
          {c.gate.status === 'failed' ? (
            c.gate.failure.kind === 'signed_out' ? <SignIn t={t} /> : <GateFailure t={t} />
          ) : c.gate.status === 'loading' ? (
            <p role="status">{t('正在验证访问权限…', 'Checking access…')}</p>
          ) : !hasAnalytics(c.session) ? (
            <div className="panel load-error" role="alert"><h2>{t('没有访问权限', 'No access')}</h2><p>{t('当前账号没有产品分析权限。', 'This account has no analytics role.')}</p></div>
          ) : (
            <Body t={t} lang={lang} page={page} filters={filters} setFilters={setFilters} go={go} binding={binding}
              open={open} evidence={evidence} setEvidence={setEvidence} />
          )}
          </>)}
          <footer className="page-footer">
            <span>Fancy · {t('让真实见面成为迭代的起点', 'Build from real meetings')}</span>
            <span>{c.snapshot ? `${t('指标定义', 'Definitions')} v${c.snapshot.definitionVersion}` : ''}</span>
          </footer>
        </main>
      </div>
      <SnapshotPicker t={t} lang={lang} />
      {detail && c.gate.status === 'ready' && (
        <DetailDialog t={t} onClose={close} {...(details.length > 1 ? { onBack: () => setDetails((prev) => prev.slice(0, -1)) } : {})}
          title={detail.kind === 'metric' ? metricTitle(t, detail.id) : detail.title}>
          <DetailContent key={details.length} detail={detail} t={t} lang={lang} open={open} />
        </DetailDialog>
      )}
    </div>
  );
}

/** Sign-in for a missing session; otherwise the blocking failure with a way to switch account. */
function GateFailure({ t }: { t: Translate }) {
  const c = useConsole();
  if (c.gate.status !== 'failed') return null;
  const signOut = async () => { try { await c.api.signOut(); } catch { /* re-read the session regardless */ } c.reloadSession(); };
  return (
    <>
      <FailureScreen failure={c.gate.failure} t={t} onRetry={() => c.reloadSession()} />
      {(c.gate.failure.kind === 'reauth' || c.gate.failure.kind === 'forbidden') && (
        <p className="method-note">{t('需要用具备权限并完成多因素验证的员工账号登录。', 'Sign in with a staff account that has the role and completed multi-factor verification.')}{' '}
          <button className="text-button" onClick={() => void signOut()}>{t('切换账号', 'Switch account')}</button></p>
      )}
    </>
  );
}

/** Report queue and report detail (support role). Gate failures replace every data surface. */
function ModerationWorkspace({ t, lang, route, navigate }: { t: Translate; lang: Language; route: Extract<Route, { kind: 'moderation' }>; navigate(route: Route): void }) {
  const c = useConsole();
  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">{t('安全与支持', 'Trust & support')}</div>
          <h1>{t('举报处理', 'Reports')}<span className="heading-dot">.</span></h1>
          <p>{t('及时处理成员举报：限制内容、停用账号并回复举报人，每一步都有审计。', 'Act on member reports promptly: limit content, suspend accounts and reply to reporters — every step audited.')}</p>
        </div>
      </div>
      {c.gate.status === 'failed' ? (c.gate.failure.kind === 'signed_out' ? <SignIn t={t} /> : <GateFailure t={t} />)
        : c.gate.status === 'loading' ? <p role="status">{t('正在验证访问权限…', 'Checking access…')}</p>
          : !hasRole(c.session, 'support') ? (
            <div className="panel load-error" role="alert"><h2>{t('没有访问权限', 'No access')}</h2><p>{t('处理举报需要支持角色与多因素验证。', 'Handling reports needs the support role and multi-factor verification.')}</p></div>
          ) : route.reportId ? (
            <ReportDetail key={route.reportId} reportId={route.reportId} t={t} lang={lang} onBack={() => navigate({ kind: 'moderation', reportId: null })} />
          ) : (
            <ModerationQueue t={t} lang={lang} onOpen={(reportId) => navigate({ kind: 'moderation', reportId })} />
          )}
      <footer className="page-footer"><span>Fancy · {t('社区安全', 'Community safety')}</span><span /></footer>
    </>
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
      {ps.status === 'failed' ? (
        <FailureScreen failure={ps.failure} t={t} onRetry={() => void c.refreshSnapshots()} />
      ) : ps.status !== 'ready' || !binding ? (
        <p role="status">{t('正在加载快照数据…', 'Loading snapshot data…')}</p>
      ) : (
        <section aria-label={t('页面内容', 'Page content')} data-snapshot={ps.data.snapshot.id} data-filter-hash={ps.data.filterHash}>
          <PageBody page={page} data={ps.data} binding={binding} t={t} lang={lang} open={open} go={go} reset={reset}
            evidence={evidence} setEvidence={setEvidence} openMetric={(id) => open({ kind: 'metric', id })} />
        </section>
      )}
    </>
  );
}
