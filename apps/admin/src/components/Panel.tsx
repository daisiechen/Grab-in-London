import type { ReactNode } from 'react';
import type { Translate } from '../i18n.ts';
import { Icon } from './Icon.tsx';

export function Panel({ title, eyebrow, action, children, className = '' }: {
  title: string; eyebrow?: string; action?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <div>
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <h2>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'green' | 'amber' | 'red' }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function Empty({ t, reset, unavailable=false }: { t: Translate; reset?: () => void; unavailable?:boolean }) {
  return (
    <div className="empty">
      <Icon name="search" size={30} />
      <h3>{unavailable?t('暂无可计算的指标','No calculable metrics'):t('没有符合条件的数据', 'No matching records')}</h3>
      <p>{unavailable?t('可能是没有记录、观察期未满或数据源尚未就绪；不能据此判断为零。','There may be no records, immature cohorts or incomplete sources. This does not establish a zero value.'):t('请调整日期或筛选；没有记录不等于转化率为零。', 'Try another date or filter. Missing data is not zero conversion.')}</p>
      {reset && <button className="button" onClick={reset}>{t('重置筛选', 'Reset filters')}</button>}
    </div>
  );
}

/** Bar for a server numerator/denominator pair; a zero denominator renders empty. */
export function Progress({ a, b, tone = '' }: { a: number; b: number; tone?: string }) {
  return <div className={`progress ${tone}`}><span style={{ width: `${b ? Math.min(100, (a / b) * 100) : 0}%` }} /></div>;
}
