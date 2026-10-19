import { useEffect, useRef, useState, type ReactNode } from "react";
export type Language = "zh" | "en";
export type Translate = (zh: string, en: string) => string;
export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    overview: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <path d="M14 21v-7h7M14 14l7 7" />
      </>
    ),
    journey: (
      <>
        <path d="M4 4h16l-6 8v7l-4 2v-9z" />
      </>
    ),
    supply: (
      <>
        <path d="M3 7h18M5 7v13M19 7v13M8 3v4M16 3v4M3 13h18" />
        <circle cx="12" cy="17" r="1" />
      </>
    ),
    retention: (
      <>
        <path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5" />
        <path d="M12 8v4l3 2" />
      </>
    ),
    quality: (
      <>
        <path d="M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6z" />
        <path d="M8 12l3 3 5-6" />
      </>
    ),
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    search: (
      <>
        <circle cx="10" cy="10" r="6" />
        <path d="m15 15 5 5" />
      </>
    ),
    chevron: <path d="m9 5 7 7-7 7" />,
    down: <path d="m6 9 6 6 6-6" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6M12 7v1" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
      </>
    ),
    globe: (
      <>
        <circle cx="12" cy="12" r="9" />
        <ellipse cx="12" cy="12" rx="4" ry="9" />
        <path d="M3 12h18" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.info}
    </svg>
  );
}
export function Panel({
  title,
  eyebrow,
  action,
  children,
  className = "",
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
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
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "amber" | "red";
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Empty({ t, reset }: { t: Translate; reset?: () => void }) {
  return (
    <div className="empty">
      <Icon name="search" size={30} />
      <h3>{t("没有符合条件的数据", "No matching records")}</h3>
      <p>
        {t(
          "请调整日期或筛选；没有记录不等于转化率为零。",
          "Try another date or filter. Missing data is not zero conversion.",
        )}
      </p>
      {reset && (
        <button className="button" onClick={reset}>
          {t("重置筛选", "Reset filters")}
        </button>
      )}
    </div>
  );
}
export function NativeSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="select-control">
      <span>{label}</span>
      <span className="select-wrap">
        <select
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.map(([v, text]) => (
            <option key={v} value={v}>
              {text}
            </option>
          ))}
        </select>
        <Icon name="down" size={14} />
      </span>
    </label>
  );
}
export function MultiSelect({ label, value, options, onChange }: {
  label: string; value: string; options: [string, string][]; onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const selected = value === "all" ? [] : value.split(",");
  useEffect(() => {
    const dismiss = (event: Event) => {
      if (ref.current?.open && !ref.current.contains(event.target as Node)) ref.current.open = false;
    };
    const dismissFocus = (event: Event) => {
      if ((event.target as Element).closest?.(".multi-select")) return;
      dismiss(event);
    };
    document.addEventListener("click", dismiss);
    document.addEventListener("focusin", dismissFocus);
    const close = () => { if (ref.current) ref.current.open = false; };
    window.addEventListener("hashchange", close);
    return () => { document.removeEventListener("click", dismiss); document.removeEventListener("focusin", dismissFocus); window.removeEventListener("hashchange", close); };
  }, []);
  return <details ref={ref} className="multi-select select-control" onKeyDown={(e) => {
    if (e.key === "Escape" && ref.current?.open) { e.stopPropagation(); e.preventDefault(); ref.current.open = false; ref.current.querySelector("summary")?.focus(); }
  }}>
    <summary aria-label={label}><span className="multi-caption"><span className="filter-label">{label}</span><span>{selected.length ? selected.map((v) => options.find(([key]) => key === v)?.[1] || ({duo:"2",group:"3–6","25":"≤ £25","30":"≤ £30"}[v] || v)).join("、") : options[0][1]}</span></span><Icon name="down" size={14}/></summary>
    <div className="multi-options" role="group" aria-label={`${label}选项`}>
      {options.map(([v, text]) => <label key={v}><input type="checkbox" checked={v === "all" ? value === "all" : selected.includes(v)} onChange={() => {
        const next = selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v];
        onChange(v === "all" || !next.length ? "all" : next.sort().join(","));
      }}/>{text}</label>)}
    </div>
  </details>;
}
export function FilterPopover({
  children,
  t,
  count,
  route,
}: {
  children: ReactNode;
  t: Translate;
  count: number;
  route: string;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const dismiss = (event: Event) => {
      if (ref.current?.open && !ref.current.contains(event.target as Node))
        ref.current.open = false;
    };
    document.addEventListener("pointerdown", dismiss, true);
    document.addEventListener("focusin", dismiss);
    return () => {
      document.removeEventListener("pointerdown", dismiss, true);
      document.removeEventListener("focusin", dismiss);
    };
  }, []);
  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [route]);
  return (
    <details
      className="advanced-filter"
      ref={ref}
      onKeyDown={(event) => {
        if (event.key === "Escape" && ref.current?.open) {
          event.preventDefault();
          event.stopPropagation();
          ref.current.open = false;
          ref.current.querySelector("summary")?.focus();
        }
      }}
    >
      <summary>
        {t("更多筛选", "More filters")}
        {count > 0 && <span className="filter-count">{count}</span>}
        <Icon name="down" size={13} />
      </summary>
      <div>{children}</div>
    </details>
  );
}
export function DataTable({
  caption,
  columns,
  rows,
  t,
  onRow,
}: {
  caption: string;
  columns: string[];
  rows: {
    id: string;
    cells: ReactNode[];
    search: string;
    sortValue?: string;
  }[];
  t: Translate;
  onRow?: (id: string) => void;
}) {
  const [query, setQuery] = useState(""),
    [page, setPage] = useState(0),
    [reverse, setReverse] = useState(false);
  const filtered = rows
    .filter((r) => r.search.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => (b.sortValue || b.id).localeCompare(a.sortValue || a.id));
  if (reverse) filtered.reverse();
  const datasetKey = rows.map((row) => row.id).join("|");
  useEffect(() => {
    setPage(0);
  }, [datasetKey]);
  const current = Math.min(
    page,
    Math.max(0, Math.ceil(filtered.length / 6) - 1),
  );
  return (
    <div className="data-table">
      <div className="table-tools">
        <div className="search-field">
          <Icon name="search" size={17} />
          <input
            aria-label={t("搜索记录", "Search records")}
            placeholder={t("搜索记录…", "Search records…")}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
          {query && (
            <button
              aria-label={t("清除搜索", "Clear search")}
              onClick={() => {
                setQuery("");
                setPage(0);
              }}
            >
              <Icon name="close" size={15} />
            </button>
          )}
        </div>
        <button
          className="text-button"
          onClick={() => {
            setReverse(!reverse);
            setPage(0);
          }}
        >
          {reverse
            ? t("最早在前", "Oldest first")
            : t("最新在前", "Newest first")}{" "}
          {reverse ? "↑" : "↓"}
        </button>
      </div>
      <div className="table-scroll">
        <table>
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((c) => (
                <th scope="col" key={c}>
                  {c}
                </th>
              ))}
              {onRow && <th scope="col">{t("详情", "Details")}</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.slice(current * 6, current * 6 + 6).map((row) => (
              <tr key={row.id}>
                {row.cells.map((cell, i) => (
                  <td key={i}>{cell}</td>
                ))}
                {onRow && (
                  <td>
                    <button
                      className="row-link"
                      aria-label={`${t("查看", "View")} ${row.id}`}
                      onClick={() => onRow(row.id)}
                    >
                      <Icon name="arrow" size={17} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!filtered.length && <Empty t={t} />}
      <div className="pagination">
        <span>
          {filtered.length
            ? `${current * 6 + 1}–${Math.min(current * 6 + 6, filtered.length)}`
            : "0"}{" "}
          / {filtered.length} {t("条记录", "records")}
        </span>
        <div>
          <button
            disabled={!current}
            onClick={() => setPage(current - 1)}
            aria-label={t("上一页", "Previous page")}
          >
            ←
          </button>
          <button
            disabled={(current + 1) * 6 >= filtered.length}
            onClick={() => setPage(current + 1)}
            aria-label={t("下一页", "Next page")}
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}
// Native dialog provides modal focus containment, Escape and an inert background.
export function DetailDialog({
  title,
  children,
  onClose,
  t,
  onBack,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  t: Translate;
  onBack?: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const trigger = useRef(document.activeElement as HTMLElement);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      trigger.current?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="detail-dialog"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="dialog-title"
    >
      <header>
        {onBack && (
          <button
            className="icon-button"
            onClick={onBack}
            aria-label={t("返回上一条详情", "Back to previous detail")}
          >
            ←
          </button>
        )}
        <div>
          <div className="eyebrow">FANCY INSIGHTS</div>
          <h2 id="dialog-title">{title}</h2>
        </div>
        <button
          className="icon-button"
          autoFocus
          onClick={onClose}
          aria-label={t("关闭详情", "Close details")}
        >
          <Icon name="close" />
        </button>
      </header>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}
