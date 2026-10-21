import { formatMetric, isRatio, type Language, type MetricValue, type Translate } from '../i18n.ts';
import { Icon } from './Icon.tsx';
import { Progress } from './Panel.tsx';

export interface SeriesPoint {
  key: string;
  value: MetricValue;
}

/** Card for one server metric; shows numerator/denominator for ratios, "—" for 0 denominators/null. */
export function MetricCard({ title, value, foot, lang, onOpen }: {
  title: string; value: MetricValue | undefined; foot?: string; lang: Language; onOpen(): void;
}) {
  return (
    <button className="metric-card" onClick={onOpen}>
      <div className="metric-label"><span>{title}</span><Icon name="info" size={16} /></div>
      <div className="metric-value">{formatMetric(lang, value)}</div>
      <div className="metric-foot">
        {isRatio(value) && <strong>{formatMetric(lang, value.numerator)} / {formatMetric(lang, value.denominator)}</strong>}{" "}
        {foot}
      </div>
    </button>
  );
}

const scalar = (value: MetricValue): number | null => (typeof value === 'number' ? value : isRatio(value) ? value.numerator : null);

/** Line chart ported from the prototype's weekly trend; null points are drawn as gaps in the value row. */
export function TrendChart({ points, label, lang, onPoint }: {
  points: SeriesPoint[]; label: string; lang: Language; onPoint?(key: string): void;
}) {
  const values = points.map((p) => scalar(p.value));
  const max = Math.max(...values.map((v) => v ?? 0), 1);
  const xy = points.map((_, i) => [35 + (i * 590) / Math.max(points.length - 1, 1), 164 - ((values[i] ?? 0) / max) * 144] as const);
  const segments:Array<Array<readonly [number,number]>>=[];
  xy.forEach((point,index)=>{if(values[index]===null)return;if(index===0||values[index-1]===null)segments.push([]);segments.at(-1)!.push(point);});
  return (
    <div className="trend-chart">
      <svg viewBox="0 0 640 195" role="img" aria-label={label}>
        <defs>
          <linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#d7ee79" stopOpacity=".55" />
            <stop offset="1" stopColor="#d7ee79" stopOpacity=".03" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <line x1="35" x2="625" y1={20 + i * 48} y2={20 + i * 48} stroke="#e8ece8" strokeDasharray="3 5" />
            <text x="2" y={24 + i * 48} fill="#7d8982" fontSize="11">{Math.round(max * (1 - i / 3))}</text>
          </g>
        ))}
        {segments.map((segment,index)=>{const path=segment.map(([x,y],i)=>`${i?'L':'M'}${x},${y}`).join(' ');return <g key={index}>
          <path d={`${path} L${segment.at(-1)![0]},164 L${segment[0]![0]},164 Z`} fill="url(#chart-fill)" />
          <path d={path} fill="none" stroke="#256a55" strokeWidth="2.5" />
        </g>;})}
        {xy.map(([x, y], i) => (
          <g key={points[i]!.key}>
            {values[i] !== null && <circle cx={x} cy={y} r="4" fill="#fff" stroke="#256a55" strokeWidth="2" />}
            <text x={x} y="190" fontSize="11" fill="#7d8982" textAnchor="middle">{points[i]!.key.slice(5)}</text>
          </g>
        ))}
      </svg>
      <div className="chart-values">
        {points.map((p) => (
          <button key={p.key} onClick={() => onPoint?.(p.key)} disabled={!onPoint}>
            {p.key.slice(5)} <strong>{formatMetric(lang, p.value)}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Horizontal bars for a server series. Ratios fill by numerator/denominator; counts fill relative to
 * the largest count in the series (visual scale only, no derived metric is displayed).
 */
export function BarList({ points, t, lang, label, className = 'area-bars', selected, onSelect }: {
  points: SeriesPoint[]; t: Translate; lang: Language; label(key: string): string; className?: string;
  selected?: string | null; onSelect?(key: string): void;
}) {
  const max = Math.max(...points.map((p) => (typeof p.value === 'number' ? p.value : 0)), 0);
  return (
    <div className={className}>
      {points.map((p) => {
        const [a, b] = isRatio(p.value) ? [p.value.numerator, p.value.denominator] : [typeof p.value === 'number' ? p.value : 0, max];
        const content = (
          <>
            <span>{label(p.key)}</span>
            <Progress a={a} b={b} />
            <strong>{formatMetric(lang, p.value)}</strong>
            {isRatio(p.value) && <small>{formatMetric(lang, p.value.numerator)} / {formatMetric(lang, p.value.denominator)}</small>}
          </>
        );
        return onSelect
          ? <button key={p.key} aria-pressed={selected === p.key} onClick={() => onSelect(p.key)}>{content}</button>
          : <div key={p.key}>{content}</div>;
      })}
      {!points.length && <p className="method-note">{t('当前范围暂无数据', 'No data in this selection')}</p>}
    </div>
  );
}
