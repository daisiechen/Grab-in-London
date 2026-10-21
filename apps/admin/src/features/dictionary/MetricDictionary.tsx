import { useState } from 'react';
import { Icon } from '../../components/Icon.tsx';
import { Badge, Empty, Panel } from '../../components/Panel.tsx';
import { metrics, type Metric } from '../../dictionary/metrics.ts';
import type { Language, Translate } from '../../i18n.ts';

type CopyKey = 'title' | 'definition' | 'unit' | 'window' | 'source' | 'decision' | 'caveat';
export const metricCopy = (m: Metric, key: CopyKey, lang: Language) => m[key][lang === 'zh' ? 0 : 1];
export const findMetric = (id: string) => metrics.find((m) => m.id === id);

/** Searchable dictionary (quality page): definition copy only, no values. */
export function MetricDictionary({ t, lang, onOpen }: { t: Translate; lang: Language; onOpen(id: string): void }) {
  const [query, setQuery] = useState('');
  const visible = metrics.filter((m) => `${metricCopy(m, 'title', lang)} ${m.id}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <Panel title={t('指标字典', 'Metric dictionary')} eyebrow={t('定义、分母、观察窗口和产品决策', 'DEFINITION, DENOMINATOR, WINDOW & DECISION')}>
      <div className="search-field dictionary-search">
        <Icon name="search" size={17} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('搜索指标…', 'Search metrics…')} aria-label={t('搜索指标', 'Search metrics')} />
        {query && <button aria-label={t('清除指标搜索', 'Clear metric search')} onClick={() => setQuery('')}><Icon name="close" size={15} /></button>}
      </div>
      <div className="dictionary-list">
        {visible.map((m) => (
          <button key={m.id} onClick={() => onOpen(m.id)}>
            <div><strong>{metricCopy(m, 'title', lang)}</strong><p>{metricCopy(m, 'decision', lang)}</p></div>
            <span>{metricCopy(m, 'unit', lang)}<Icon name="chevron" size={16} /></span>
          </button>
        ))}
      </div>
      {!visible.length && <Empty t={t} />}
    </Panel>
  );
}

export function MetricDefinition({ metric, t, lang, definitionVersion }: { metric: Metric; t: Translate; lang: Language; definitionVersion: string | null }) {
  const keys = ['definition', 'unit', 'window', 'source', 'decision', 'caveat'] as const;
  const terms = [t('计算方式', 'Calculation'), t('统计单位', 'Unit'), t('时间口径', 'Window'), t('数据来源', 'Source'), t('支持决策', 'Decision'), t('解释边界', 'Caveat')];
  return (
    <>
      {definitionVersion && <Badge>{t('指标口径', 'Definition')} v{definitionVersion}</Badge>}
      <dl className="definition-list">
        {keys.map((key, i) => <div key={key}><dt>{terms[i]}</dt><dd>{metricCopy(metric, key, lang)}</dd></div>)}
      </dl>
      <p className="method-note">{t('未设置未经验证的达标线。小样本必须同时查看人数和分母。', 'No unvalidated performance targets. Inspect counts and denominators for small samples.')}</p>
    </>
  );
}
