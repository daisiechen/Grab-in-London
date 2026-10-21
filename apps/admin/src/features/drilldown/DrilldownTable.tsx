import { ADMIN_DRILLDOWN_SORTS } from '@fancy/contracts';
import { useEffect, useState } from 'react';
import type { DrilldownRow, DrilldownTarget, RowQuery } from '../../api/admin-api.ts';
import type { Failure } from '../../api/failure.ts';
import { NativeSelect } from '../../components/controls.tsx';
import { Icon } from '../../components/Icon.tsx';
import { Badge, Empty } from '../../components/Panel.tsx';
import { itemLabel } from '../../dictionary/labels.ts';
import { formatLondonTime, type Language, type Translate } from '../../i18n.ts';
import { useConsole } from '../../state/console.tsx';
import type { FilterQuery } from '../../state/filters.ts';
import { FailureScreen } from '../status/FailureScreen.tsx';

/** One snapshot + filter hash + canonical filters, captured when a drill-down opens; paging never changes it. */
export interface Binding {
  snapshotId: string;
  filterHash: string;
  query: FilterQuery;
}

export const PAGE_SIZE = 6;

type Cell = DrilldownRow['attributes'][string] | undefined;
const render = (lang: Language, t: Translate, key: string, value: Cell) => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? t('是', 'Yes') : t('否', 'No');
  if (typeof value === 'string' && /At$/.test(key) && !Number.isNaN(Date.parse(value))) return formatLondonTime(lang, value);
  if (key === 'status' || key === 'attendanceStatus' || key === 'source') return itemLabel(t, String(value));
  return String(value);
};

/**
 * Server-paged de-identified source rows. Search, sort and paging are server-side (q/sort/order/cursor);
 * the table never filters or counts rows itself and shows no fabricated total.
 */
export function DrilldownTable({ target, binding, rows: rowQuery = {}, caption, t, lang, onRow }: {
  target: DrilldownTarget; binding: Binding; rows?: RowQuery; caption: string; t: Translate; lang: Language;
  onRow?(row: DrilldownRow): void;
}) {
  const c = useConsole();
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<(typeof ADMIN_DRILLDOWN_SORTS)[number] | ''>('');
  const [order, setOrder] = useState<'desc' | 'asc'>('desc');
  /** cursors[i] = cursor for page i (page 0 has none). */
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [index, setIndex] = useState(0);
  const [state, setState] = useState<{ status: 'loading' } | { status: 'ready'; rows: DrilldownRow[]; next: string | null } | { status: 'failed'; failure: Failure }>({ status: 'loading' });
  const rowKey = JSON.stringify(rowQuery);

  // Changing search/sort/row filter returns to the first page.
  useEffect(() => { setCursors([undefined]); setIndex(0); }, [q, sort, order, rowKey]);

  useEffect(() => {
    let live = true;
    setState({ status: 'loading' });
    const rows: RowQuery = { ...rowQuery, ...(q ? { q } : {}), ...(sort ? { sort } : {}), order };
    c.api.drilldown(target, binding.snapshotId, binding.filterHash, binding.query, rows, { cursor: cursors[index], limit: PAGE_SIZE })
      .then((res) => { if (live) setState({ status: 'ready', rows: res.data, next: res.page.hasMore ? res.page.nextCursor : null }); },
        (error: unknown) => { if (live) setState({ status: 'failed', failure: c.reportFailure(error) }); });
    return () => { live = false; };
    // Binding is fixed for the lifetime of this table; rowKey covers rowQuery.
  }, [target, binding.snapshotId, binding.filterHash, rowKey, q, sort, order, index, cursors[index]]);

  const columns = state.status === 'ready'
    ? [...new Set(state.rows.flatMap((r) => Object.keys(r.attributes)))]
    : [];
  return (
    <div className="data-table">
      <div className="table-tools">
        <form className="search-field" role="search" onSubmit={(e) => { e.preventDefault(); setQ(draft.trim()); }}>
          <Icon name="search" size={17} />
          <input aria-label={t('搜索记录', 'Search records')} placeholder={t('搜索编号、饭局、区域…', 'Search ID, meal, area…')} value={draft} maxLength={80}
            onChange={(e) => setDraft(e.target.value)} />
          {draft && <button type="button" aria-label={t('清除搜索', 'Clear search')} onClick={() => { setDraft(''); setQ(''); }}><Icon name="close" size={15} /></button>}
        </form>
        <NativeSelect label={t('排序', 'Sort')} value={sort} onChange={(v) => setSort(v as typeof sort)}
          options={[['', t('默认（实际日期）', 'Default (actual date)')], ...ADMIN_DRILLDOWN_SORTS.map((s) => [s, itemLabel(t, s)] as [string, string])]} />
        <button className="text-button" onClick={() => setOrder(order === 'desc' ? 'asc' : 'desc')}>
          {order === 'asc' ? t('最早在前', 'Oldest first') : t('最新在前', 'Newest first')} {order === 'asc' ? '↑' : '↓'}
        </button>
      </div>
      {state.status === 'failed' ? (
        state.failure.kind === 'revoked' ? null : <FailureScreen failure={state.failure} t={t} />
      ) : state.status === 'loading' ? (
        <p role="status">{t('正在加载明细…', 'Loading records…')}</p>
      ) : (
        <>
          <div className="table-scroll">
            <table>
              <caption className="sr-only">{caption}</caption>
              <thead>
                <tr>
                  <th scope="col">ID</th>
                  {columns.map((col) => <th scope="col" key={col}>{itemLabel(t, col)}</th>)}
                  <th scope="col">{t('口径', 'Measure')}</th>
                  {onRow && <th scope="col">{t('详情', 'Details')}</th>}
                </tr>
              </thead>
              <tbody>
                {state.rows.map((row) => (
                  <tr key={row.rowId}>
                    <td className="mono">{row.rowId}</td>
                    {columns.map((col) => <td key={col}>{render(lang, t, col, row.attributes[col])}</td>)}
                    <td>
                      {row.inNumerator && <Badge tone="green">{t('分子', 'Numerator')}</Badge>}{' '}
                      {row.inDenominator && <Badge>{t('分母', 'Denominator')}</Badge>}
                    </td>
                    {onRow && (
                      <td><button className="row-link" aria-label={`${t('查看', 'View')} ${row.rowId}`} onClick={() => onRow(row)}><Icon name="arrow" size={17} /></button></td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!state.rows.length && <Empty t={t} />}
          <div className="pagination">
            <span>{t(`第 ${index + 1} 页`, `Page ${index + 1}`)}</span>
            <div>
              <button disabled={index === 0} onClick={() => setIndex(index - 1)} aria-label={t('上一页', 'Previous page')}>←</button>
              <button disabled={!state.next} aria-label={t('下一页', 'Next page')} onClick={() => {
                const next = state.next ?? undefined;
                setCursors((prev) => [...prev.slice(0, index + 1), next]);
                setIndex(index + 1);
              }}>→</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
