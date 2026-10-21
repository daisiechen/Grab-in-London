import { ADMIN_PAGE_KEYS } from '@fancy/contracts';
import { useState } from 'react';
import type { AdminPageData, AdminPageName, DrilldownTarget, RowQuery } from '../api/admin-api.ts';
import { BarList, MetricCard, TrendChart, type SeriesPoint } from '../components/charts.tsx';
import { NativeSelect } from '../components/controls.tsx';
import { Icon } from '../components/Icon.tsx';
import { Badge, Empty, Panel, Progress } from '../components/Panel.tsx';
import { itemLabel, listTitle, metricTitle, seriesTitle } from '../dictionary/labels.ts';
import { ClassificationPanel } from '../features/classification/ClassificationPanel.tsx';
import { MetricDictionary } from '../features/dictionary/MetricDictionary.tsx';
import { DrilldownTable, type Binding } from '../features/drilldown/DrilldownTable.tsx';
import { formatMetric, formatNumber, formatRatio, isRatio, type Language, type Translate } from '../i18n.ts';

export type Detail =
  | { kind: 'metric'; id: string }
  | { kind: 'list'; target: DrilldownTarget; rows: RowQuery; title: string };

export interface PageProps {
  data: AdminPageData;
  binding: Binding;
  t: Translate;
  lang: Language;
  open(detail: Detail): void;
  go(page: AdminPageName): void;
  reset(): void;
  /** Supply list attendance filter (list only; never changes aggregate denominators). */
  evidence: string;
  setEvidence(value: string): void;
}

const series = (data: AdminPageData, key: string): SeriesPoint[] => data.series[key] ?? [];
/** True when the snapshot holds no value at all for this page (empty range): no stale charts, no fake zeros. */
const isEmpty = (data: AdminPageData) =>
  Object.values(data.metrics).every((v) => v === null || (isRatio(v) && v.denominator === 0)) && Object.values(data.series).every((s) => !s.length);

function Cards({ ids, p }: { ids: readonly string[]; p: PageProps }) {
  return (
    <div className={`metric-grid${ids.length > 3 ? ' four' : ''}`}>
      {ids.map((id) => (
        <MetricCard key={id} title={metricTitle(p.t, id)} value={p.data.metrics[id]} lang={p.lang} onOpen={() => p.open({ kind: 'metric', id })} />
      ))}
    </div>
  );
}

function SeriesPanel({ id, p, className, onSelect, selected }: { id: string; p: PageProps; className?: string; onSelect?(key: string): void; selected?: string | null }) {
  return (
    <Panel title={seriesTitle(p.t, id)}>
      <BarList points={series(p.data, id)} t={p.t} lang={p.lang} label={(k) => itemLabel(p.t, k)} {...(className ? { className } : {})}
        {...(onSelect ? { onSelect } : {})} {...(selected !== undefined ? { selected } : {})} />
    </Panel>
  );
}

function Overview(p: PageProps) {
  const keys = ADMIN_PAGE_KEYS.overview;
  const coverage = p.data.metrics.coverage;
  const trend = series(p.data, 'weekly.trend');
  return (
    <>
      <Cards ids={keys.metrics.filter((k) => k !== 'coverage')} p={p} />
      <div className="overview-grid">
        <Panel title={p.t('真实见面正在如何发生', 'How real meetings happen')} eyebrow={p.t('结果趋势', 'OUTCOME TREND')}
          action={<button className="text-button" onClick={() => p.open({ kind: 'metric', id: 'weekly' })}>{p.t('指标定义', 'Definition')} <Icon name="info" size={14} /></button>}>
          <div className="chart-legend">
            <span><i className="legend-dot" />{p.t('每周确认出席用户', 'Weekly attended users')}</span>
            <small>{p.t('按周去重 · 首尾周可能不完整', 'Distinct per week · boundary weeks may be partial')}</small>
          </div>
          {trend.length
            ? <TrendChart points={trend} lang={p.lang} label={p.t('每周确认出席人数趋势', 'Weekly attended user trend')} />
            : <Empty t={p.t} reset={p.reset} />}
        </Panel>
        <Panel title={p.t('先看数据是否完整', 'Check the evidence first')} className="quality-card">
          <div className="coverage-number">{formatRatio(coverage)}<Badge tone="amber">{p.t('出席覆盖', 'Attendance coverage')}</Badge></div>
          {isRatio(coverage) && <Progress a={coverage.numerator} b={coverage.denominator} />}
          {isRatio(coverage) && <p className="mono">{formatNumber(p.lang, coverage.numerator)} / {formatNumber(p.lang, coverage.denominator)}</p>}
          <p>{p.t('未确认不代表未出席。解释转化前，先核对缺失记录。', 'Unconfirmed does not mean absent. Inspect missing records before interpreting conversion.')}</p>
          <button className="text-button" onClick={() => { p.setEvidence('unknown'); p.go('supply'); }}>
            {p.t('查看关联记录', 'Inspect related records')} <Icon name="arrow" size={15} />
          </button>
        </Panel>
      </div>
    </>
  );
}

function Journey(p: PageProps) {
  const [journey, setJourney] = useState<'join' | 'create'>('join');
  return (
    <>
      <div className="tabs" aria-label={p.t('旅程选择', 'Journey selection')}>
        <button aria-pressed={journey === 'join'} onClick={() => setJourney('join')}>{p.t('加入饭局', 'Join a meal')}</button>
        <button aria-pressed={journey === 'create'} onClick={() => setJourney('create')}>{p.t('发起饭局', 'Host a meal')}</button>
      </div>
      {journey === 'join' ? (
        <>
          <Cards ids={ADMIN_PAGE_KEYS.journey.metrics} p={p} />
          <div className="two-column">
            <SeriesPanel id="funnel.join" p={p} />
            <SeriesPanel id="browse.people" p={p} />
          </div>
          <p className="method-note">{p.t('浏览与申请采用不同统计单位，不直接计算跨单位转化。', 'Browsing uses users; application stages use application records. No cross-unit conversion is implied.')}</p>
          <Panel title={listTitle(p.t, 'applications')} eyebrow={p.t('只读追溯 · 点击查看参与及证据', 'READ-ONLY · TRACE PARTICIPATION & EVIDENCE')}>
            <DrilldownTable target="applications" binding={p.binding} caption={listTitle(p.t, 'applications')} t={p.t} lang={p.lang} onRow={(row) => openRow(p, row.attributes)} />
          </Panel>
        </>
      ) : (
        <SeriesPanel id="funnel.create" p={p} className="create-funnel" />
      )}
      <SeriesPanel id="features.usage" p={p} className="feature-grid" />
    </>
  );
}

function Supply(p: PageProps) {
  const statuses = ['present', 'absent', 'unknown'] as const;
  return (
    <>
      <Cards ids={ADMIN_PAGE_KEYS.supply.metrics} p={p} />
      <div className="two-column">
        <SeriesPanel id="area.compare" p={p} />
        <SeriesPanel id="attendance.distribution" p={p} className="area-bars" selected={p.evidence === 'all' ? null : p.evidence}
          onSelect={(k) => p.setEvidence(p.evidence === k || !(statuses as readonly string[]).includes(k) ? 'all' : k)} />
      </div>
      <SeriesPanel id="cancellation.reasons" p={p} />
      <Panel title={p.t('饭局记录', 'Meal records')} eyebrow={p.t('只读追溯 · 点击查看参与及证据', 'READ-ONLY · TRACE PARTICIPATION & EVIDENCE')}
        action={<NativeSelect label={p.t('出席记录筛选（仅下方列表）', 'Attendance filter (list only)')} value={p.evidence} onChange={p.setEvidence}
          options={[['all', p.t('全部饭局', 'All meals')], ['unknown', p.t('出席记录待补', 'Unknown attendance')], ['present', p.t('有确认出席', 'Has confirmed attendance')], ['absent', p.t('有未出席记录', 'Has absent reports')]]} />}>
        <DrilldownTable target="meals" binding={p.binding} caption={p.t('饭局记录', 'Meal records')} t={p.t} lang={p.lang}
          rows={p.evidence === 'all' ? {} : { attendanceStatus: p.evidence as (typeof statuses)[number] }}
          onRow={(row) => openRow(p, row.attributes)} />
        <p className="method-note">{p.t('列表筛选不改变上方聚合分母。', 'The list filter does not change the aggregate denominators above.')}</p>
      </Panel>
    </>
  );
}

function Retention(p: PageProps) {
  const cohorts = series(p.data, 'cohort.retention');
  return (
    <>
      <Cards ids={ADMIN_PAGE_KEYS.retention.metrics} p={p} />
      <Panel title={seriesTitle(p.t, 'cohort.retention')} eyebrow={p.t('按首次出席所在周分组 · 后续结果观察至快照', 'FIRST ATTENDANCE WEEK · FOLLOW-UP THROUGH SNAPSHOT')}
        action={<button className="text-button" onClick={() => p.open({ kind: 'metric', id: 'retention' })}>{p.t('指标定义', 'Definition')}</button>}>
        <div className="table-scroll">
          <table className="cohort-table">
            <caption className="sr-only">{p.t('首次赴约后的30天重复参与', '30-day repeat participation after first attendance')}</caption>
            <thead><tr>{[p.t('首次出席周', 'First attendance week'), p.t('实际再赴约 / 已满 30 天', 'Repeat / mature at 30 days'), p.t('30 天重复率', '30-day repeat rate')].map((h) => <th scope="col" key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {cohorts.map((row) => (
                <tr key={row.key}>
                  <td><button className="text-button mono" onClick={() => p.open({ kind: 'list', target: 'cohort.users', rows: { cohortWeek: row.key }, title: `${p.t('首次赴约队列', 'First-attendance cohort')} · ${row.key}` })}>{row.key}</button></td>
                  <td>{isRatio(row.value) ? `${formatNumber(p.lang, row.value.numerator)} / ${formatNumber(p.lang, row.value.denominator)}` : '—'}</td>
                  <td><span className={`cohort-cell ${isRatio(row.value) && row.value.denominator ? 'mature' : ''}`}>{isRatio(row.value) && row.value.denominator ? formatRatio(row.value) : p.t('观察中', 'Observing')}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!cohorts.length && <Empty t={p.t} reset={p.reset} />}
      </Panel>
      <div className="two-column ratings-and-applicants">
        <SeriesPanel id="rating.distribution" p={p} className="rating-bars" />
        <SeriesPanel id="survey.reasons" p={p} className="survey-factors" />
      </div>
      <p className="method-note">{p.t('单场评分与产品问卷独立；问卷只受日期与用户分群影响。', 'Meal ratings and the product survey are separate; the survey only follows dates and user segments.')}</p>
    </>
  );
}

function Quality(p: PageProps & { openMetric(id: string): void }) {
  const ids = ADMIN_PAGE_KEYS.quality.metrics;
  return (
    <>
      <div className="three-stats">
        {ids.map((id) => (
          <div key={id}><span>{metricTitle(p.t, id)}</span><strong>{formatMetric(p.lang, p.data.metrics[id])}{id === 'receiveLatencyP90' && <small>s</small>}</strong></div>
        ))}
      </div>
      <p className="method-note">{p.t('因隐私删除排除的主体', 'Subjects excluded after privacy deletion')}: {formatNumber(p.lang, p.data.privacyExcludedCount)}</p>
      <div className="two-column">
        <Panel title={p.t('数据完整性检查', 'Data integrity checks')} eyebrow={p.t('全量快照，不受业务筛选影响', 'FULL SNAPSHOT · NOT AFFECTED BY BUSINESS FILTERS')}>
          <p>{p.t('缺字段事件进入隔离队列，不参与指标。迟到事件在下次快照按发生时间回补，并更新快照版本。', 'Malformed events are quarantined, not counted. Late events backfill by occurrence time in the next versioned snapshot.')}</p>
          <button className="text-button" onClick={() => p.open({ kind: 'list', target: 'quality.events', rows: {}, title: listTitle(p.t, 'quality.events') })}>
            {p.t('查看异常事件', 'View anomalous events')} →
          </button>
        </Panel>
        <SeriesPanel id="quality.sources" p={p} className="integration-list" />
      </div>
      <ClassificationPanel t={p.t} />
      <MetricDictionary t={p.t} lang={p.lang} onOpen={p.openMetric} />
    </>
  );
}

/** Rows open the related meal or user evidence (attendance list) as a nested detail. */
export function openRow(p: Pick<PageProps, 'open' | 't'>, attributes: Record<string, unknown>) {
  const { mealId, userId } = attributes;
  if (typeof mealId === 'string') p.open({ kind: 'list', target: 'attendance', rows: { mealId }, title: `${itemLabel(p.t, 'mealId')} · ${mealId}` });
  else if (typeof userId === 'string') p.open({ kind: 'list', target: 'attendance', rows: { userId }, title: `${itemLabel(p.t, 'userId')} · ${userId}` });
}

export function PageBody(p: PageProps & { page: AdminPageName; openMetric(id: string): void }) {
  if (p.page !== 'quality' && isEmpty(p.data)) return <Empty t={p.t} reset={p.reset} />;
  switch (p.page) {
    case 'overview': return <Overview {...p} />;
    case 'journey': return <Journey {...p} />;
    case 'supply': return <Supply {...p} />;
    case 'retention': return <Retention {...p} />;
    case 'quality': return <Quality {...p} />;
  }
}
