import { useEffect, useMemo, useState } from "react";
import {
  activationUsers,
  attendance,
  cleanEvents,
  cohorts,
  createFunnel,
  DAY,
  defaultFilters,
  filteredEvents,
  funnel,
  latestAttendance,
  londonDay,
  quantile,
  ratio,
  SNAPSHOT,
  summarize,
  validEvent,
  verifyAttendance,
  type Dataset,
  type Filters,
} from "./analytics";
import { fixture, areas } from "./fixtures";
import { metrics, type Metric } from "./metrics";
import {
  Badge,
  DataTable,
  DetailDialog,
  Empty,
  Icon,
  NativeSelect,
  Panel,
  type Language,
} from "./components";

const pages = [
  "overview",
  "journey",
  "supply",
  "retention",
  "quality",
] as const;
type Page = (typeof pages)[number];
const emptyData: Dataset = {
  users: [],
  meals: [],
  applications: [],
  attendance: [],
  feedback: [],
  events: [],
};
const initial = () => {
  const params = new URLSearchParams(location.search),
    f = { ...defaultFilters };
  for (const key of Object.keys(f) as (keyof Filters)[]) {
    const value = params.get(key);
    if (value) f[key] = value;
  }
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(f.start) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(f.end) ||
    f.start > f.end ||
    f.end > "2026-10-18"
  )
    return { ...defaultFilters };
  return f;
};
const pageFromHash = (): Page =>
  pages.includes(location.hash.slice(1) as Page)
    ? (location.hash.slice(1) as Page)
    : "overview";
const MetricCard = ({
  id,
  value,
  numerator,
  denominator,
  foot,
  index,
  titleFor,
  openMetric,
  n,
}: {
  id: string;
  value: string;
  numerator?: number;
  denominator?: number;
  foot: string;
  index: string;
  titleFor: (id: string) => string;
  openMetric: (id: string) => void;
  n: (v: number) => string;
}) => (
  <button className="metric-card" onClick={() => openMetric(id)}>
    <div className="metric-label">
      <span>{titleFor(id)}</span>
      <Icon name="info" size={16} />
    </div>
    <div className="metric-value">
      {value}
      <span>{index}</span>
    </div>
    <div className="metric-foot">
      {numerator !== undefined && denominator !== undefined && (
        <strong>
          {n(numerator)} / {n(denominator)}　
        </strong>
      )}
      {foot}
    </div>
  </button>
);
export default function App() {
  const [lang, setLang] = useState<Language>(() =>
    new URLSearchParams(location.search).get("lang") === "en" ? "en" : "zh",
  );
  const t = (zh: string, en: string) => (lang === "zh" ? zh : en);
  const [page, setPage] = useState<Page>(pageFromHash),
    [filters, setFilters] = useState<Filters>(initial),
    [dates, setDates] = useState(() => ({
      start: initial().start,
      end: initial().end,
    }));
  const [dateError, setDateError] = useState(false),
    [journey, setJourney] = useState<"join" | "create">("join"),
    [mode, setMode] = useState("sample");
  const [detail, setDetail] = useState<{
      kind: "metric" | "meal" | "user" | "events";
      id: string;
    } | null>(null),
    [notice, setNotice] = useState("");
  const [metricQuery, setMetricQuery] = useState("");
  const [sampleData, setSampleData] = useState(fixture);
  const [verifyUser, setVerifyUser] = useState(""),
    [verifyResult, setVerifyResult] = useState("present"),
    [verifyNote, setVerifyNote] = useState(""),
    [verifyError, setVerifyError] = useState(false);
  useEffect(() => {
    setVerifyUser("");
    setVerifyNote("");
    setVerifyError(false);
  }, [detail?.kind, detail?.id]);
  const data = mode === "empty" ? emptyData : sampleData;
  const s = useMemo(() => summarize(data, filters), [data, filters]);
  const f = useMemo(() => funnel(data, filters), [data, filters]);
  const retention = useMemo(() => cohorts(data, filters), [data, filters]);
  const events = useMemo(() => filteredEvents(data, filters), [data, filters]);
  const activation = useMemo(
    () => activationUsers(data, filters),
    [data, filters],
  );
  const n = (value: number) =>
    value.toLocaleString(lang === "zh" ? "zh-CN" : "en-GB");
  const pct = (numerator: number, denominator: number) => {
    const value = ratio(numerator, denominator);
    return value === null ? "—" : `${(value * 100).toFixed(1)}%`;
  };
  const label = (
    m: Metric,
    key:
      | "title"
      | "definition"
      | "unit"
      | "window"
      | "source"
      | "decision"
      | "caveat",
  ) => m[key][lang === "zh" ? 0 : 1];
  const nav = [
    t("产品概览", "Overview"),
    t("用户旅程", "User journeys"),
    t("饭局与供需", "Meals & supply"),
    t("体验与留存", "Experience & retention"),
    t("数据与定义", "Data & definitions"),
  ];
  const descriptions = [
    t(
      "从一次发现，到一次真实见面。",
      "From finding a table to meeting in person.",
    ),
    t(
      "找到意愿与行动之间的阻力。",
      "Find the friction between intent and action.",
    ),
    t(
      "分清没有合适的饭局，还是没能约成。",
      "Understand missing supply and unfinished plans.",
    ),
    t(
      "一次舒服的见面，会让人再次赴约吗？",
      "Does a good first meal bring people back?",
    ),
    t(
      "先相信数据，再做产品判断。",
      "Trust the evidence before making a decision.",
    ),
  ];
  useEffect(() => {
    const onHash = () => {
      setPage(pageFromHash());
      setDetail(null);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    const params = new URLSearchParams({ ...filters, lang });
    history.replaceState(null, "", `?${params}${location.hash || "#overview"}`);
  }, [filters, lang]);
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(""), 4000);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  const reset = () => {
    setFilters({ ...defaultFilters });
    setDates({ start: defaultFilters.start, end: defaultFilters.end });
    setDateError(false);
  };
  const update = (key: keyof Filters, value: string) =>
    setFilters((prev) => ({ ...prev, [key]: value }));
  const range = (days: number) => {
    const start = new Date(+new Date("2026-10-18T12:00:00Z") - (days - 1) * DAY)
      .toISOString()
      .slice(0, 10);
    setFilters((prev) => ({ ...prev, start, end: "2026-10-18" }));
    setDates({ start, end: "2026-10-18" });
    setDateError(false);
  };
  const openMetric = (id: string) => setDetail({ kind: "metric", id });
  const titleFor = (id: string) =>
    label(metrics.find((m) => m.id === id)!, "title");

  const Progress = ({
    a,
    b,
    tone = "",
  }: {
    a: number;
    b: number;
    tone?: string;
  }) => (
    <div className={`progress ${tone}`}>
      <span style={{ width: `${b ? Math.min(100, (a / b) * 100) : 0}%` }} />
    </div>
  );
  const go = (target: Page) => {
    location.hash = target;
    setPage(target);
  };
  const exportSummary = () => {
    const rows = [
      ["Fictional demo data; not actual usage", SNAPSHOT],
      ["start", filters.start, "end", filters.end],
      ...Object.entries(filters).map(([key, value]) => [key, value]),
      ["metric", "numerator", "denominator"],
      [
        "attendance",
        String(s.attendance.present),
        String(s.attendanceCoverage.denominator),
      ],
      [
        "activation14",
        String(s.activation.numerator),
        String(s.activation.denominator),
      ],
      [
        "repeat30",
        String(s.retention.numerator),
        String(s.retention.denominator),
      ],
    ];
    const csv =
      "\uFEFF" +
      rows
        .map((row) =>
          row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","),
        )
        .join("\r\n");
    const url = URL.createObjectURL(
        new Blob([csv], { type: "text/csv;charset=utf-8" }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = "fancy-demo-insights.csv";
    a.click();
    URL.revokeObjectURL(url);
    setNotice(
      t(
        "已导出当前筛选的示例指标",
        "Exported sample metrics for current filters",
      ),
    );
  };
  const sourceName = (source: string) =>
    source === "user" ? t("用户自发", "User-led") : t("平台协助", "Assisted");
  const statusName = (status: string) =>
    ({
      present: t("出席", "Present"),
      absent: t("未出席", "Absent"),
      unknown: t("未知", "Unknown"),
      conflict: t("待核实", "Conflict"),
    })[status] || status;
  const mealRows = s.meals.map((m) => ({
    id: m.id,
    search: `${m.id} ${m.area} ${m.title}`,
    cells: [
      <span>
        <strong>{m.title}</strong>
        <small className="mono">{m.id}</small>
      </span>,
      m.area,
      londonDay(m.startsAt),
      sourceName(m.source),
      `${m.peakConfirmed} / ${m.capacity}`,
      <Badge
        tone={
          m.cancelled ? "red" : m.peakConfirmed >= m.minimum ? "green" : "amber"
        }
      >
        {m.cancelled
          ? t("已取消", "Cancelled")
          : m.peakConfirmed >= m.minimum
            ? t("曾成团", "Formed")
            : t("未成团", "Not formed")}
      </Badge>,
    ],
  }));
  const responseHours = f.records
    .filter((a) => a.decidedAt && a.decidedAt <= SNAPSHOT)
    .map((a) => (+new Date(a.decidedAt!) - +new Date(a.appliedAt)) / 3_600_000);
  const pending = f.records.filter(
    (a) => !a.decidedAt || a.decidedAt > SNAPSHOT,
  );
  const latestWeek = s.weekly.at(-1);
  const qualityEvents = cleanEvents(fixture.events, fixture.identityLinks);
  const missing = fixture.events.filter(
    (e) => e.receivedAt <= SNAPSHOT && !validEvent(e),
  );
  const rawAvailable = fixture.events.filter((e) => e.receivedAt <= SNAPSHOT);
  const lag = qualityEvents.map(
    (e) => (+new Date(e.receivedAt) - +new Date(e.occurredAt)) / 1000,
  );
  const metricDetail =
    detail?.kind === "metric"
      ? metrics.find((m) => m.id === detail.id)
      : undefined;
  const selectedMeal =
    detail?.kind === "meal"
      ? data.meals.find((m) => m.id === detail.id)
      : undefined;
  const selectedUser =
    detail?.kind === "user"
      ? data.users.find((u) => u.id === detail.id)
      : undefined;

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        {t("跳转至内容", "Skip to content")}
      </a>
      <aside className="sidebar">
        <a href="#overview" className="wordmark">
          Fancy<span className="brand-flower">✳</span>
        </a>
        <div className="workspace">
          <span className="workspace-icon">F</span>
          <div>
            <strong>{t("产品洞察", "Product insights")}</strong>
            <small>{t("伦敦试点", "London pilot")}</small>
          </div>
          <span className="workspace-dot" />
        </div>
        <div className="nav-heading">
          {t("观察与理解", "OBSERVE & UNDERSTAND")}
        </div>
        <nav aria-label={t("主导航", "Main navigation")}>
          {pages.map((p, i) => (
            <a
              key={p}
              href={`#${p}`}
              aria-current={page === p ? "page" : undefined}
            >
              <Icon name={p} />
              <span>{nav[i]}</span>
              {page === p && <span className="nav-active-dot" />}
            </a>
          ))}
        </nav>
        <div className="sidebar-note">
          <div className="little-table">
            <i />
            <i />
            <i />
            <i />
            <span />
          </div>
          <h3>{t("吃个饭，认识一下。", "A meal. A new connection.")}</h3>
          <p>
            {t(
              "衡量真实见面，理解每次选择。",
              "Measure real meetings. Understand every choice.",
            )}
          </p>
        </div>
        <div className="sidebar-bottom">
          <span className="avatar">FP</span>
          <div>
            <strong>{t("产品团队", "Product team")}</strong>
            <small>
              {t("分析工作区 · 演示", "Analytics workspace · demo")}
            </small>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Fancy <span>/</span> {t("产品洞察", "Insights")} <span>/</span>
            <strong>{nav[pages.indexOf(page)]}</strong>
          </div>
          <div className="top-actions">
            <span className="sample-label">
              <i />
              {t("模拟数据", "Sample data")}
            </span>
            <button
              className="language-button"
              onClick={() => setLang(lang === "zh" ? "en" : "zh")}
              aria-label={t("切换为英文", "Switch to Chinese")}
            >
              <Icon name="globe" size={16} />
              {lang === "zh" ? "EN" : "中文"}
            </button>
            <span className="avatar small">FP</span>
          </div>
        </header>
        <nav
          className="mobile-nav"
          aria-label={t("移动端导航", "Mobile navigation")}
        >
          {pages.map((p, i) => (
            <a
              href={`#${p}`}
              key={p}
              aria-current={page === p ? "page" : undefined}
            >
              <Icon name={p} size={16} />
              <span>{nav[i]}</span>
            </a>
          ))}
        </nav>
        <main id="main-content" tabIndex={-1}>
          <div className="page-title">
            <div>
              <div className="eyebrow">LONDON PILOT / PRODUCT ANALYTICS</div>
              <h1>
                {nav[pages.indexOf(page)]}
                <span className="heading-dot">.</span>
              </h1>
              <p>{descriptions[pages.indexOf(page)]}</p>
            </div>
            <button
              className="button export-button"
              onClick={exportSummary}
              disabled={mode === "error"}
            >
              <Icon name="download" size={17} />
              {t("导出指标", "Export metrics")}
            </button>
          </div>
          <div className="demo-banner">
            <Icon name="info" size={17} />
            <span>
              {t(
                "交互演示 · 全部记录为虚构示例，尚未连接真实业务服务。",
                "Interactive demo · All records are fictional. No live business service is connected.",
              )}
            </span>
            <span className="snapshot">
              {t("快照", "Snapshot")} 18 Oct 2026 · 13:00 BST
            </span>
          </div>
          <section
            className="filter-panel"
            aria-label={t("全局筛选", "Global filters")}
          >
            <div className="date-filter">
              <span className="filter-label">
                {t("观察日期", "Observation dates")}
              </span>
              <div className="date-inputs">
                <input
                  type="date"
                  aria-label={t("开始日期", "Start date")}
                  value={dates.start}
                  max="2026-10-18"
                  onChange={(e) =>
                    setDates({ ...dates, start: e.target.value })
                  }
                />
                <span>—</span>
                <input
                  type="date"
                  aria-label={t("结束日期", "End date")}
                  value={dates.end}
                  max="2026-10-18"
                  onChange={(e) => setDates({ ...dates, end: e.target.value })}
                />
                <button
                  className="text-button"
                  onClick={() => {
                    if (
                      !dates.start ||
                      !dates.end ||
                      dates.start > dates.end ||
                      dates.end > "2026-10-18"
                    )
                      setDateError(true);
                    else {
                      setFilters({ ...filters, ...dates });
                      setDateError(false);
                    }
                  }}
                >
                  {t("应用", "Apply")}
                </button>
              </div>
            </div>
            <div className="quick-ranges">
              {[7, 28, 90].map((days) => (
                <button
                  key={days}
                  onClick={() => range(days)}
                  aria-pressed={
                    filters.end === "2026-10-18" &&
                    filters.start ===
                      new Date(
                        +new Date("2026-10-18T12:00:00Z") - (days - 1) * DAY,
                      )
                        .toISOString()
                        .slice(0, 10)
                  }
                >
                  {days}
                  {t("天", "d")}
                </button>
              ))}
            </div>
            <NativeSelect
              label={t("区域", "Area")}
              value={filters.area}
              onChange={(v) => update("area", v)}
              options={[
                ["all", t("全部区域", "All areas")],
                ...areas.map((a) => [a, a] as [string, string]),
              ]}
            />
            <NativeSelect
              label={t("来源", "Source")}
              value={filters.source}
              onChange={(v) => update("source", v)}
              options={[
                ["all", t("全部来源", "All sources")],
                ["user", sourceName("user")],
                ["assisted", sourceName("assisted")],
              ]}
            />
            <NativeSelect
              label={t("用户", "Users")}
              value={filters.segment}
              onChange={(v) => update("segment", v)}
              options={[
                ["all", t("全部用户", "All users")],
                ["new", t("期内注册", "Joined in period")],
                ["existing", t("期前注册", "Joined earlier")],
              ]}
            />
            <button className="text-button reset-filter" onClick={reset}>
              {t("重置", "Reset")}
            </button>
            <details className="advanced-filter">
              <summary>
                {t("更多筛选", "More filters")} <Icon name="down" size={13} />
              </summary>
              <div>
                <NativeSelect
                  label={t("交流语言", "Language")}
                  value={filters.language}
                  onChange={(v) => update("language", v)}
                  options={[
                    ["all", t("全部语言", "All languages")],
                    ["English", "English"],
                    ["中文 / English", "中文 / English"],
                  ]}
                />
                <NativeSelect
                  label={t("人数", "Table size")}
                  value={filters.size}
                  onChange={(v) => update("size", v)}
                  options={[
                    ["all", t("全部人数", "All sizes")],
                    ["duo", t("双人", "Two people")],
                    ["group", t("3–6 人", "3–6 people")],
                  ]}
                />
                <NativeSelect
                  label={t("人均预算", "Budget / person")}
                  value={filters.budget}
                  onChange={(v) => update("budget", v)}
                  options={[
                    ["all", t("全部预算", "All budgets")],
                    ["25", "≤ £25"],
                    ["30", "≤ £30"],
                  ]}
                />
              </div>
            </details>
          </section>
          {dateError && (
            <p className="inline-error" role="alert">
              {t(
                "请选择有效日期，开始日期不得晚于结束日期，结束日期不得晚于快照。",
                "Choose valid dates. Start must precede end; end cannot be after snapshot.",
              )}
            </p>
          )}
          <div className="context-line">
            <span>
              {t(
                "伦敦时间 · 排除测试/员工 · 用户分群不改变场次指标 · 口径 v1",
                "Europe/London · Test/staff excluded · User segments do not change meal counts · v1",
              )}
            </span>
            <button className="text-button" onClick={() => go("quality")}>
              {t("查看数据口径", "View definitions")}{" "}
              <Icon name="arrow" size={14} />
            </button>
          </div>
          {mode === "error" ? (
            <div className="panel load-error" role="alert">
              <Icon name="quality" size={36} />
              <h2>{t("演示加载失败状态", "Demo: load failed")}</h2>
              <p>
                {t(
                  "没有展示旧图表。重试将恢复示例数据，不会连接真实服务。",
                  "Stale charts are hidden. Retry restores the sample dataset, without a live connection.",
                )}
              </p>
              <button
                className="button primary"
                onClick={() => setMode("sample")}
              >
                {t("重试加载", "Retry loading")}
              </button>
            </div>
          ) : (
            <>
              {page === "overview" && (
                <>
                  <div className="metric-grid">
                    <MetricCard
                      titleFor={titleFor}
                      openMetric={openMetric}
                      n={n}
                      id="weekly"
                      value={latestWeek ? n(latestWeek.count) : "—"}
                      index={t("人", "users")}
                      foot={
                        latestWeek
                          ? `${latestWeek.week} ${t("所在周 · 含发起人", "week · includes hosts")}`
                          : t("无出席数据", "No attendance data")
                      }
                    />
                    <MetricCard
                      titleFor={titleFor}
                      openMetric={openMetric}
                      n={n}
                      id="activation"
                      value={pct(
                        s.activation.numerator,
                        s.activation.denominator,
                      )}
                      index=""
                      numerator={s.activation.numerator}
                      denominator={s.activation.denominator}
                      foot={t("成熟首次申请用户", "mature first applicants")}
                    />
                    <MetricCard
                      titleFor={titleFor}
                      openMetric={openMetric}
                      n={n}
                      id="retention"
                      value={pct(
                        s.retention.numerator,
                        s.retention.denominator,
                      )}
                      index=""
                      numerator={s.retention.numerator}
                      denominator={s.retention.denominator}
                      foot={t("成熟首次出席用户", "mature first attendees")}
                    />
                  </div>
                  <div className="overview-grid">
                    <Panel
                      title={t(
                        "真实见面正在如何发生",
                        "How real meetings happen",
                      )}
                      eyebrow={t("结果趋势", "OUTCOME TREND")}
                      action={
                        <button
                          className="text-button"
                          onClick={() => openMetric("weekly")}
                        >
                          {t("指标定义", "Definition")}{" "}
                          <Icon name="info" size={14} />
                        </button>
                      }
                    >
                      <div className="chart-legend">
                        <span>
                          <i className="legend-dot" />
                          {t("每周确认出席用户", "Weekly attended users")}
                        </span>
                        <small>
                          {t(
                            "按周去重 · 首尾周可能不完整",
                            "Distinct per week · boundary weeks may be partial",
                          )}
                        </small>
                      </div>
                      {s.weekly.length ? (
                        <div className="trend-chart">
                          <svg
                            viewBox="0 0 640 195"
                            role="img"
                            aria-label={t(
                              "每周确认出席人数趋势",
                              "Weekly attended user trend",
                            )}
                          >
                            <defs>
                              <linearGradient
                                id="chart-fill"
                                x1="0"
                                x2="0"
                                y1="0"
                                y2="1"
                              >
                                <stop
                                  offset="0"
                                  stopColor="#d7ee79"
                                  stopOpacity=".55"
                                />
                                <stop
                                  offset="1"
                                  stopColor="#d7ee79"
                                  stopOpacity=".03"
                                />
                              </linearGradient>
                            </defs>
                            {[0, 1, 2, 3].map((i) => (
                              <g key={i}>
                                <line
                                  x1="35"
                                  x2="625"
                                  y1={20 + i * 48}
                                  y2={20 + i * 48}
                                  stroke="#e8ece8"
                                  strokeDasharray="3 5"
                                />
                                <text
                                  x="2"
                                  y={24 + i * 48}
                                  fill="#7d8982"
                                  fontSize="11"
                                >
                                  {Math.round(
                                    Math.max(
                                      ...s.weekly.map((w) => w.count),
                                      1,
                                    ) *
                                      (1 - i / 3),
                                  )}
                                </text>
                              </g>
                            ))}
                            {(() => {
                              const max = Math.max(
                                  ...s.weekly.map((w) => w.count),
                                  1,
                                ),
                                pts = s.weekly.map((w, i) => [
                                  35 +
                                    (i * 590) /
                                      Math.max(s.weekly.length - 1, 1),
                                  164 - (w.count / max) * 144,
                                ]);
                              const path = pts
                                .map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`)
                                .join(" ");
                              return (
                                <>
                                  <path
                                    d={`${path} L${pts.at(-1)![0]},164 L35,164 Z`}
                                    fill="url(#chart-fill)"
                                  />
                                  <path
                                    d={path}
                                    fill="none"
                                    stroke="#256a55"
                                    strokeWidth="2.5"
                                  />
                                  {pts.map(([x, y], i) => (
                                    <g key={i}>
                                      <circle
                                        cx={x}
                                        cy={y}
                                        r="4"
                                        fill="#fff"
                                        stroke="#256a55"
                                        strokeWidth="2"
                                      />
                                      <text
                                        x={x}
                                        y="190"
                                        fontSize="11"
                                        fill="#7d8982"
                                        textAnchor="middle"
                                      >
                                        {s.weekly[i].week.slice(5)}
                                      </text>
                                    </g>
                                  ))}
                                </>
                              );
                            })()}
                          </svg>
                          <div className="chart-values">
                            {s.weekly.map((w) => (
                              <button
                                key={w.week}
                                onClick={() => {
                                  setFilters((prev) => ({
                                    ...prev,
                                    start: w.week,
                                    end: new Date(
                                      Math.min(
                                        +new Date(`${w.week}T12:00:00Z`) +
                                          6 * DAY,
                                        +new Date("2026-10-18T12:00:00Z"),
                                      ),
                                    )
                                      .toISOString()
                                      .slice(0, 10),
                                  }));
                                  setDates({
                                    start: w.week,
                                    end: new Date(
                                      Math.min(
                                        +new Date(`${w.week}T12:00:00Z`) +
                                          6 * DAY,
                                        +new Date("2026-10-18T12:00:00Z"),
                                      ),
                                    )
                                      .toISOString()
                                      .slice(0, 10),
                                  });
                                  go("supply");
                                }}
                              >
                                {w.week.slice(5)} <strong>{w.count}</strong>
                                <span className="sr-only">
                                  {t("查看饭局", "View meals")}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <Empty t={t} reset={reset} />
                      )}
                    </Panel>
                    <Panel
                      title={t("先看数据是否完整", "Check the evidence first")}
                      className="quality-card"
                      eyebrow="DATA CONFIDENCE"
                    >
                      <div className="coverage-number">
                        {pct(
                          s.attendanceCoverage.numerator,
                          s.attendanceCoverage.denominator,
                        )}
                        <Badge tone="amber">
                          {t("出席覆盖", "Attendance coverage")}
                        </Badge>
                      </div>
                      <Progress
                        a={s.attendanceCoverage.numerator}
                        b={s.attendanceCoverage.denominator}
                      />
                      <div className="quality-counts">
                        <div>
                          <span>{t("待补记录", "Unknown")}</span>
                          <strong>{s.attendance.unknown}</strong>
                        </div>
                        <div>
                          <span>{t("记录冲突", "Conflicts")}</span>
                          <strong>{s.attendance.conflict}</strong>
                        </div>
                      </div>
                      <p>
                        {t(
                          "未确认不代表未出席。解释转化前，先核对缺失记录。",
                          "Unconfirmed does not mean absent. Inspect missing records before interpreting conversion.",
                        )}
                      </p>
                      <button
                        className="text-button"
                        onClick={() => go("supply")}
                      >
                        {t("查看关联记录", "Inspect related records")}{" "}
                        <Icon name="arrow" size={15} />
                      </button>
                    </Panel>
                  </div>
                  <div className="overview-grid">
                    <Panel
                      title={t(
                        "从发现到席位确认",
                        "From discovery to a confirmed seat",
                      )}
                      eyebrow="JOURNEY AT A GLANCE"
                      action={
                        <button
                          className="text-button"
                          onClick={() => go("journey")}
                        >
                          {t("深入分析", "Explore journey")}{" "}
                          <Icon name="arrow" size={14} />
                        </button>
                      }
                    >
                      <div className="mini-funnel">
                        {[
                          [t("发现", "Discover"), f.discovery],
                          [t("看详情", "View details"), f.details],
                          [t("申请", "Apply"), f.applications],
                          [t("获准", "Approved"), f.approved],
                          [t("确认", "Confirmed"), f.confirmed],
                        ].map(([text, value], i) => (
                          <div key={text}>
                            <span>{text}</span>
                            <strong>{value}</strong>
                            <Progress
                              a={Number(value)}
                              b={i < 2 ? f.discovery : f.applications}
                            />
                            <small>
                              {i < 2
                                ? t("用户", "users")
                                : t("申请记录", "applications")}
                            </small>
                          </div>
                        ))}
                      </div>
                      <p className="method-note">
                        {t(
                          "浏览与申请采用不同统计单位，不直接计算跨单位转化。",
                          "Browsing uses users; application stages use application records. No cross-unit conversion is implied.",
                        )}
                      </p>
                    </Panel>
                    <Panel
                      title={t("本周优先验证什么", "What to investigate next")}
                      eyebrow="ITERATION NOTES"
                    >
                      <div className="insight-item">
                        <span className="insight-number">↗</span>
                        <div>
                          <h3>
                            {t("定位没有结果的需求", "Locate unmet demand")}
                          </h3>
                          <p>
                            {pct(
                              s.noResults.numerator,
                              s.noResults.denominator,
                            )}{" "}
                            {t(
                              "发现请求没有可申请饭局。按区域查看差异。",
                              "of discovery requests have no eligible meals. Compare areas.",
                            )}
                          </p>
                          <button
                            className="text-button"
                            onClick={() => go("supply")}
                          >
                            {t("检查供给缺口", "Inspect supply gaps")} →
                          </button>
                        </div>
                      </div>
                      <div className="insight-item">
                        <span className="insight-number">↻</span>
                        <div>
                          <h3>
                            {t(
                              "给重复参与留足观察时间",
                              "Allow time to observe return",
                            )}
                          </h3>
                          <p>
                            {t(
                              "近 28 天首次赴约队列尚未成熟；查看更早队列再判断。",
                              "First attendees in the last 28 days are not yet mature. Inspect older cohorts.",
                            )}
                          </p>
                          <button
                            className="text-button"
                            onClick={() => {
                              range(90);
                              go("retention");
                            }}
                          >
                            {t("查看 90 天队列", "View 90-day cohorts")} →
                          </button>
                        </div>
                      </div>
                    </Panel>
                  </div>
                </>
              )}
              {page === "journey" && (
                <>
                  <div
                    className="tabs"
                    aria-label={t("旅程选择", "Journey selection")}
                  >
                    <button
                      aria-pressed={journey === "join"}
                      onClick={() => setJourney("join")}
                    >
                      {t("加入饭局", "Join a meal")}
                    </button>
                    <button
                      aria-pressed={journey === "create"}
                      onClick={() => setJourney("create")}
                    >
                      {t("发起饭局", "Host a meal")}
                    </button>
                  </div>
                  {journey === "join" ? (
                    <>
                      <div className="two-column">
                        <Panel
                          title={t("浏览意愿", "Browsing intent")}
                          eyebrow={t(
                            "用户去重 · 期内事件",
                            "DISTINCT USERS · EVENTS IN PERIOD",
                          )}
                        >
                          <div className="horizontal-funnel">
                            {[
                              [t("访问发现", "Discovery"), f.discovery],
                              [
                                t("可申请饭局曝光", "Eligible meal exposure"),
                                f.exposed,
                              ],
                              [
                                t("查看饭局详情", "Meal detail view"),
                                f.details,
                              ],
                            ].map(([text, count]) => (
                              <div key={text}>
                                <span>{text}</span>
                                <strong>{count}</strong>
                                <Progress a={Number(count)} b={f.discovery} />
                              </div>
                            ))}
                          </div>
                          <div className="stat-strip">
                            <span>
                              {t(
                                "有曝光但 7 天未申请",
                                "Exposed, no application in 7 days",
                              )}
                            </span>
                            <strong>
                              {pct(f.exposedNoApplyUsers, f.exposedMatureUsers)}
                            </strong>
                            <small>
                              {f.exposedNoApplyUsers} / {f.exposedMatureUsers}{" "}
                              {t("成熟曝光用户", "mature exposed users")}
                            </small>
                          </div>
                          <div className="stat-strip">
                            <span>
                              {t(
                                "发现后 7 天申请率",
                                "7-day discovery to application",
                              )}
                            </span>
                            <strong>
                              {pct(f.appliedWithin7, f.matureDiscovery)}
                            </strong>
                            <small>
                              {f.appliedWithin7} / {f.matureDiscovery}{" "}
                              {t("成熟用户", "mature users")}
                            </small>
                            <button
                              className="text-button"
                              onClick={() => openMetric("discovery7")}
                            >
                              {t("口径", "Definition")}
                            </button>
                          </div>
                        </Panel>
                        <Panel
                          title={t("申请如何推进", "Application progression")}
                          eyebrow={t(
                            "按申请记录关联同一饭局",
                            "APPLICATION RECORDS · SAME MEAL",
                          )}
                        >
                          <div className="horizontal-funnel">
                            {[
                              [t("申请成功", "Applied"), f.applications],
                              [t("获准", "Approved"), f.approved],
                              [t("席位确认", "Seat confirmed"), f.confirmed],
                            ].map(([text, count]) => (
                              <div key={text}>
                                <span>{text}</span>
                                <strong>{count}</strong>
                                <Progress
                                  a={Number(count)}
                                  b={f.applications}
                                />
                              </div>
                            ))}
                          </div>
                          <div className="stat-strip">
                            <span>
                              {t(
                                "已结束场次的申请 → 出席",
                                "Ended meals: application → attendance",
                              )}
                            </span>
                            <strong>{pct(f.present, f.completed)}</strong>
                            <small>
                              {f.present} / {f.completed}{" "}
                              {t("申请", "applications")}
                            </small>
                          </div>
                        </Panel>
                      </div>
                      <div className="three-stats">
                        <div>
                          <span>{t("已审核中位耗时", "Median response")}</span>
                          <strong>
                            {quantile(responseHours, 0.5)?.toFixed(1) ?? "—"}
                            <small>h</small>
                          </strong>
                        </div>
                        <div>
                          <span>{t("已审核 P90 耗时", "P90 response")}</span>
                          <strong>
                            {quantile(responseHours, 0.9)?.toFixed(1) ?? "—"}
                            <small>h</small>
                          </strong>
                        </div>
                        <div>
                          <span>
                            {t("仍在等待审核", "Still awaiting a decision")}
                          </span>
                          <strong>
                            {pending.length}
                            <small>{t("份申请", "applications")}</small>
                          </strong>
                        </div>
                      </div>
                      <Panel
                        title={t(
                          "申请记录与等待原因",
                          "Applications and waiting states",
                        )}
                        action={
                          <button
                            className="text-button"
                            onClick={() => openMetric("approval")}
                          >
                            {t("耗时口径", "Timing definition")}
                          </button>
                        }
                      >
                        <DataTable
                          key={`${page}-${lang}`}
                          t={t}
                          caption={t("申请记录", "Applications")}
                          columns={[
                            t("申请", "Application"),
                            t("用户", "User"),
                            t("饭局 / 区域", "Meal / area"),
                            t("当前结果", "Current state"),
                            t("等待 / 处理耗时", "Wait / response"),
                          ]}
                          rows={f.records.map((a) => ({
                            id: a.id,
                            search: `${a.id} ${a.userId} ${a.mealId} ${data.meals.find((m) => m.id === a.mealId)?.area}`,
                            cells: [
                              <span className="mono">{a.id}</span>,
                              <button
                                className="text-button mono"
                                onClick={() =>
                                  setDetail({ kind: "user", id: a.userId })
                                }
                              >
                                {a.userId}
                              </button>,
                              <button
                                className="text-button"
                                onClick={() =>
                                  setDetail({ kind: "meal", id: a.mealId })
                                }
                              >
                                {a.mealId} ·{" "}
                                {
                                  data.meals.find((m) => m.id === a.mealId)
                                    ?.area
                                }
                              </button>,
                              <Badge
                                tone={
                                  a.confirmedAt
                                    ? "green"
                                    : a.decision === "declined"
                                      ? "neutral"
                                      : "amber"
                                }
                              >
                                {a.withdrawnAt
                                  ? t("已退出", "Withdrawn")
                                  : a.confirmedAt
                                    ? t("席位确认", "Confirmed")
                                    : a.decision === "declined"
                                      ? t("未获准", "Declined")
                                      : t("待审核", "Pending")}
                              </Badge>,
                              `${((+new Date(a.decidedAt || SNAPSHOT) - +new Date(a.appliedAt)) / 3_600_000).toFixed(1)}h`,
                            ],
                          }))}
                        />
                      </Panel>
                    </>
                  ) : (
                    <>
                      <Panel
                        title={t(
                          "从发起到实际举行",
                          "From creating to holding a meal",
                        )}
                        eyebrow={t(
                          "创建尝试与已发布场次分别计算",
                          "CREATE ATTEMPTS AND PUBLISHED MEALS ARE SEPARATE",
                        )}
                      >
                        <div className="mini-funnel create-funnel">
                          {(() => {
                            const counts = createFunnel(data, filters);
                            return counts.map((count, i) => (
                              <div key={i}>
                                <span>
                                  {
                                    [
                                      t("进入创建", "Started"),
                                      t("完成安排", "Arranged"),
                                      t("发布成功", "Published"),
                                    ][i]
                                  }
                                </span>
                                <strong>{count}</strong>
                                <Progress a={count} b={counts[0]} />
                                <small>
                                  {t("创建尝试", "create attempts")}
                                </small>
                              </div>
                            ));
                          })()}
                        </div>
                        <p className="method-note">
                          {t(
                            "按期内开始的 attemptId 建立队列，追踪同一用户截至快照的后续完成；不与按开饭日期统计的场次混算。",
                            "Cohort by attempt start in period; same-user completion is followed through snapshot. This is separate from meals grouped by start date.",
                          )}
                        </p>
                      </Panel>
                      <div className="two-column">
                        <Panel
                          title={t("已发布饭局结果", "Published meal outcomes")}
                        >
                          <div className="result-pair">
                            <div>
                              <span>
                                {t("曾达到最低人数", "Reached minimum size")}
                              </span>
                              <strong>
                                {s.formation.numerator} /{" "}
                                {s.formation.denominator}
                              </strong>
                            </div>
                            <div>
                              <span>
                                {t(
                                  "有出席证据的场次",
                                  "Meals with attendance evidence",
                                )}
                              </span>
                              <strong>
                                {
                                  new Set(
                                    s.parts
                                      .filter((p) => p.status === "present")
                                      .map((p) => p.meal.id),
                                  ).size
                                }
                              </strong>
                            </div>
                          </div>
                          <p className="method-note">
                            {t(
                              "按饭局开始日期，不将曾成团自动视作实际举行。",
                              "By meal start date. Formation alone is not evidence of a held meal.",
                            )}
                          </p>
                        </Panel>
                        <Panel title={t("创建卡点", "Creation friction")}>
                          <div className="stat-strip">
                            <span>
                              {t(
                                "安排字段校验失败",
                                "Schedule validation errors",
                              )}
                            </span>
                            <strong>
                              {
                                events.filter(
                                  (e) =>
                                    e.name === "form_error" &&
                                    e.field === "schedule",
                                ).length
                              }
                            </strong>
                          </div>
                          <p>
                            {t(
                              "待验证：时间和场地的输入是否过早、是否提供了足够清晰的错误提示。",
                              "Hypothesis: scheduling may ask for too much too early, or errors may be unclear.",
                            )}
                          </p>
                          <button
                            className="text-button"
                            onClick={() =>
                              setDetail({ kind: "events", id: "form_error" })
                            }
                          >
                            {t("查看相关事件", "View related events")} →
                          </button>
                        </Panel>
                      </div>
                    </>
                  )}
                  <Panel title={t("功能使用诊断", "Feature diagnostics")}>
                    <div className="feature-grid">
                      {[
                        ["map_opened", t("地图", "Map")],
                        ["filter_applied", t("筛选", "Filters")],
                        ["profile_view", t("个人资料", "Profiles")],
                        ["chat_opened", t("饭局群聊", "Meal chat")],
                      ].map(([name, text]) => (
                        <button
                          key={name}
                          onClick={() =>
                            setDetail({ kind: "events", id: name })
                          }
                        >
                          <span>{text}</span>
                          <strong>
                            {
                              new Set(
                                events
                                  .filter((e) => e.name === name)
                                  .map((e) => e.userId || e.anonymousId),
                              ).size
                            }
                          </strong>
                          <small>
                            {t(
                              "去重用户 · 查看事件",
                              "distinct users · inspect events",
                            )}{" "}
                            →
                          </small>
                        </button>
                      ))}
                    </div>
                    <p className="method-note">
                      {t(
                        "功能使用仅用于诊断，不以停留时长或消息数量替代产品价值。",
                        "Feature use is diagnostic. Time spent and message count do not substitute for product value.",
                      )}
                    </p>
                  </Panel>
                </>
              )}
              {page === "supply" && (
                <>
                  <div className="metric-grid four">
                    <MetricCard
                      titleFor={titleFor}
                      openMetric={openMetric}
                      n={n}
                      id="discovery"
                      value={pct(
                        s.noResults.numerator,
                        s.noResults.denominator,
                      )}
                      index=""
                      numerator={s.noResults.numerator}
                      denominator={s.noResults.denominator}
                      foot={t("发现请求", "discovery requests")}
                    />
                    <MetricCard
                      titleFor={titleFor}
                      openMetric={openMetric}
                      n={n}
                      id="formation"
                      value={pct(
                        s.formation.numerator,
                        s.formation.denominator,
                      )}
                      index=""
                      numerator={s.formation.numerator}
                      denominator={s.formation.denominator}
                      foot={t("已到开始时间的场次", "meals past planned start")}
                    />
                    <MetricCard
                      titleFor={titleFor}
                      openMetric={openMetric}
                      n={n}
                      id="cancellation"
                      value={pct(
                        s.cancellations.numerator,
                        s.cancellations.denominator,
                      )}
                      index=""
                      numerator={s.cancellations.numerator}
                      denominator={s.cancellations.denominator}
                      foot={t("已发布场次", "published meals")}
                    />
                    <MetricCard
                      titleFor={titleFor}
                      openMetric={openMetric}
                      n={n}
                      id="coverage"
                      value={pct(
                        s.attendanceCoverage.numerator,
                        s.attendanceCoverage.denominator,
                      )}
                      index=""
                      numerator={s.attendanceCoverage.numerator}
                      denominator={s.attendanceCoverage.denominator}
                      foot={t("应确认人次", "eligible participations")}
                    />
                  </div>
                  <div className="two-column">
                    <Panel
                      title={t(
                        "哪里缺少合适的饭局",
                        "Where demand finds no table",
                      )}
                      eyebrow={t(
                        "区域 × 无结果请求",
                        "AREA × ZERO-RESULT REQUESTS",
                      )}
                    >
                      <div className="area-bars">
                        {areas.map((area) => {
                          const requests = events.filter(
                              (e) =>
                                e.name === "discovery_results" &&
                                e.area === area,
                            ),
                            zero = requests.filter((e) => e.resultCount === 0);
                          return (
                            <button
                              key={area}
                              onClick={() => update("area", area)}
                            >
                              <span>{area}</span>
                              <Progress a={zero.length} b={requests.length} />
                              <strong>
                                {pct(zero.length, requests.length)}
                              </strong>
                              <small>
                                {zero.length} / {requests.length}
                              </small>
                            </button>
                          );
                        })}
                      </div>
                      <p className="method-note">
                        {t(
                          "点击区域筛选全部分析。无结果可能来自预算、人数或时间，不直接归因为获客不足。",
                          "Select an area to filter all analyses. No results may reflect budget, size or timing, rather than acquisition.",
                        )}
                      </p>
                    </Panel>
                    <Panel
                      title={t("出席证据分布", "Attendance evidence")}
                      action={
                        <button
                          className="text-button"
                          onClick={() => openMetric("coverage")}
                        >
                          {t("定义", "Definition")}
                        </button>
                      }
                    >
                      <div className="attendance-grid">
                        {Object.entries(s.attendance).map(([status, count]) => (
                          <div key={status} className={`attendance-${status}`}>
                            <span>{statusName(status)}</span>
                            <strong>{count}</strong>
                          </div>
                        ))}
                      </div>
                      <p className="method-note">
                        {t(
                          "提前退出与整场取消不进入应确认人次；未知和待核实绝不自动算作失约。",
                          "Early withdrawals and cancelled meals are excluded. Unknown and conflicting records are never inferred no-shows.",
                        )}
                      </p>
                    </Panel>
                  </div>
                  <Panel
                    title={t("饭局记录", "Meal records")}
                    eyebrow={t(
                      "只读追溯 · 点击查看参与及证据",
                      "READ-ONLY · TRACE PARTICIPATION & EVIDENCE",
                    )}
                  >
                    <DataTable
                      key={`${page}-${lang}`}
                      t={t}
                      caption={t("饭局记录", "Meal records")}
                      columns={[
                        t("饭局", "Meal"),
                        t("区域", "Area"),
                        t("开始日期", "Start date"),
                        t("来源", "Source"),
                        t("曾确认 / 上限", "Peak / capacity"),
                        t("结果", "Outcome"),
                      ]}
                      rows={mealRows}
                      onRow={(id) => setDetail({ kind: "meal", id })}
                    />
                  </Panel>
                  <Panel
                    title={t(
                      "分析结论如何转成迭代",
                      "Turn observations into a product test",
                    )}
                  >
                    <div className="decision-flow">
                      <div>
                        <small>{t("现象", "OBSERVATION")}</small>
                        <p>
                          {t(
                            "某区域的无结果率较高",
                            "An area has more zero-result requests",
                          )}
                        </p>
                      </div>
                      <Icon name="arrow" />
                      <div>
                        <small>{t("待验证解释", "HYPOTHESIS")}</small>
                        <p>
                          {t(
                            "时段、预算或人数供给不匹配",
                            "Supply may not match timing, budget or size",
                          )}
                        </p>
                      </div>
                      <Icon name="arrow" />
                      <div>
                        <small>{t("下一步", "NEXT TEST")}</small>
                        <p>
                          {t(
                            "补充特定供给，比较申请与赴约",
                            "Add targeted supply; compare applications and attendance",
                          )}
                        </p>
                      </div>
                    </div>
                  </Panel>
                </>
              )}
              {page === "retention" && (
                <>
                  <div className="metric-grid">
                    <MetricCard
                      titleFor={titleFor}
                      openMetric={openMetric}
                      n={n}
                      id="retention"
                      value={pct(
                        s.retention.numerator,
                        s.retention.denominator,
                      )}
                      index=""
                      numerator={s.retention.numerator}
                      denominator={s.retention.denominator}
                      foot={t("成熟首次出席用户", "mature first attendees")}
                    />
                    <MetricCard
                      titleFor={titleFor}
                      openMetric={openMetric}
                      n={n}
                      id="feedback"
                      value={pct(
                        s.feedbackCoverage.numerator,
                        s.feedbackCoverage.denominator,
                      )}
                      index=""
                      numerator={s.feedbackCoverage.numerator}
                      denominator={s.feedbackCoverage.denominator}
                      foot={t("饭后反馈覆盖", "feedback coverage")}
                    />
                    <MetricCard
                      titleFor={titleFor}
                      openMetric={openMetric}
                      n={n}
                      id="feedback"
                      value={pct(s.again.numerator, s.again.denominator)}
                      index=""
                      numerator={s.again.numerator}
                      denominator={s.again.denominator}
                      foot={t(
                        "反馈者愿再参加 · 非实际留存",
                        "respondents willing to return · not retention",
                      )}
                    />
                  </div>
                  {!s.retention.denominator && (
                    <div className="maturity-banner">
                      <Icon name="retention" />
                      <div>
                        <strong>
                          {t(
                            "当前队列还没有完整的 30 天观察窗口",
                            "No fully observed 30-day cohort in this selection",
                          )}
                        </strong>
                        <p>
                          {t(
                            "未成熟不等于流失。选择更早的首次赴约队列再评估重复参与。",
                            "Immaturity is not churn. Select older first-attendance cohorts to evaluate repeat participation.",
                          )}
                        </p>
                      </div>
                      <button className="button" onClick={() => range(90)}>
                        {t("查看 90 天", "View 90 days")}
                      </button>
                    </div>
                  )}
                  <Panel
                    title={t("首次赴约队列", "First-attendance cohorts")}
                    eyebrow={t(
                      "按首次出席所在周分组 · 后续结果观察至快照",
                      "FIRST ATTENDANCE WEEK · FOLLOW-UP THROUGH SNAPSHOT",
                    )}
                    action={
                      <button
                        className="text-button"
                        onClick={() => openMetric("retention")}
                      >
                        {t("指标定义", "Definition")}
                      </button>
                    }
                  >
                    <div className="table-scroll">
                      <table className="cohort-table">
                        <caption className="sr-only">
                          {t(
                            "首次赴约后的30天重复参与",
                            "30-day repeat participation after first attendance",
                          )}
                        </caption>
                        <thead>
                          <tr>
                            {[
                              t("首次出席周", "First attendance week"),
                              t("首次出席用户", "First attendees"),
                              t("已满 30 天", "Mature at 30 days"),
                              t("实际再赴约", "Repeat attendees"),
                              t("30 天重复率", "30-day repeat rate"),
                              t("后续机会曝光", "Later opportunity exposure"),
                            ].map((c) => (
                              <th scope="col" key={c}>
                                {c}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {retention.map((row) => (
                            <tr key={row.week}>
                              <td>
                                <button
                                  className="text-button mono"
                                  onClick={() =>
                                    setDetail({
                                      kind: "user",
                                      id: row.users[0],
                                    })
                                  }
                                >
                                  {row.week}
                                </button>
                              </td>
                              <td>{row.total}</td>
                              <td>
                                {row.mature}
                                <small> / {row.total}</small>
                              </td>
                              <td>{row.repeat}</td>
                              <td>
                                <span
                                  className={`cohort-cell ${row.mature ? "mature" : ""}`}
                                >
                                  {row.mature
                                    ? pct(row.repeat, row.mature)
                                    : t("观察中", "Observing")}
                                </span>
                              </td>
                              <td>
                                {pct(row.opportunity, row.mature)}
                                <small>
                                  　{row.opportunity} / {row.mature}
                                </small>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {!retention.length && <Empty t={t} reset={reset} />}
                    <p className="method-note">
                      {t(
                        "机会覆盖指成熟用户在首次出席后 30 天内实际看到另一场未来可申请饭局的比例，仅为曝光代理；不是有无供给的完整证明。后续赴约不限于入组饭局的区域或来源。",
                        "Opportunity coverage is the share of mature users exposed to another future eligible meal within 30 days. It is a proxy, not proof of complete supply. Follow-up attendance is not restricted to the first meal’s area or source.",
                      )}
                    </p>
                  </Panel>
                  <div className="two-column">
                    <Panel
                      title={t("饭后体验分布", "Post-meal experience")}
                      eyebrow={`${s.feedback.length} ${t("份有效反馈", "valid responses")}`}
                    >
                      <div className="rating-bars">
                        {[5, 4, 3, 2, 1].map((score) => {
                          const count = s.feedback.filter(
                            (r) => r.score === score,
                          ).length;
                          return (
                            <div key={score}>
                              <span>{score} / 5</span>
                              <Progress a={count} b={s.feedback.length} />
                              <strong>{count}</strong>
                            </div>
                          );
                        })}
                      </div>
                      <p className="method-note">
                        {t(
                          "未反馈者可能有不同体验；不将反馈均分描述为全体满意度。",
                          "Non-respondents may have different experiences. Ratings do not represent all attendees.",
                        )}
                      </p>
                    </Panel>
                    <Panel
                      title={t("首次申请用户追溯", "Trace first applicants")}
                    >
                      <DataTable
                        key={`${page}-${lang}`}
                        t={t}
                        caption={t("首次申请用户", "First applicants")}
                        columns={[
                          t("用户", "User"),
                          t("首次申请", "First application"),
                          t("观察状态", "Observation"),
                        ]}
                        rows={activation.map((a) => ({
                          id: a.userId,
                          search: `${a.userId} ${a.mealId}`,
                          cells: [
                            <span className="mono">{a.userId}</span>,
                            londonDay(a.appliedAt),
                            <Badge
                              tone={
                                !a.mature
                                  ? "amber"
                                  : a.converted
                                    ? "green"
                                    : "neutral"
                              }
                            >
                              {!a.mature
                                ? t("观察中", "Observing")
                                : a.converted
                                  ? t("14天内赴约", "Attended in 14d")
                                  : t("未确认赴约", "No confirmed attendance")}
                            </Badge>,
                          ],
                        }))}
                        onRow={(id) => setDetail({ kind: "user", id })}
                      />
                    </Panel>
                  </div>
                </>
              )}
              {page === "quality" && (
                <>
                  <div className="data-status">
                    <span className="status-orbit">
                      <Icon name="quality" size={30} />
                    </span>
                    <div>
                      <Badge tone="amber">
                        {t("尚未接入真实数据", "Live data not connected")}
                      </Badge>
                      <h2>
                        {t(
                          "清楚知道每个数字从哪里来。",
                          "Know where every number comes from.",
                        )}
                      </h2>
                      <p>
                        {t(
                          "当前为可复现的虚构数据快照。正式接入需要客户端埋点、业务结果和出席确认三类来源。",
                          "This reproducible snapshot is fictional. Live integration needs client events, business facts and attendance reports.",
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="three-stats">
                    <div>
                      <span>
                        {t("全量快照 · 原始事件", "Snapshot · raw events")}
                      </span>
                      <strong>{n(rawAvailable.length)}</strong>
                    </div>
                    <div>
                      <span>
                        {t(
                          "去重并排除测试后",
                          "Deduplicated live-scope events",
                        )}
                      </span>
                      <strong>{n(qualityEvents.length)}</strong>
                    </div>
                    <div>
                      <span>{t("接收延迟 P90", "P90 receive latency")}</span>
                      <strong>
                        {quantile(lag, 0.9)?.toFixed(0) ?? "—"}
                        <small>s</small>
                      </strong>
                    </div>
                  </div>
                  <div className="two-column">
                    <Panel
                      title={t("数据完整性检查", "Data integrity checks")}
                      eyebrow={t(
                        "全量快照，不受业务筛选影响",
                        "FULL SNAPSHOT · NOT AFFECTED BY BUSINESS FILTERS",
                      )}
                    >
                      <div className="check-row">
                        <span>
                          {t(
                            "缺失必需事件字段",
                            "Missing required event fields",
                          )}
                        </span>
                        <Badge tone={missing.length ? "amber" : "green"}>
                          {missing.length} {t("条", "events")}
                        </Badge>
                      </div>
                      <div className="check-row">
                        <span>
                          {t(
                            "快照后才接收的事件",
                            "Events arriving after snapshot",
                          )}
                        </span>
                        <Badge tone="neutral">
                          {
                            fixture.events.filter(
                              (e) => e.receivedAt > SNAPSHOT,
                            ).length
                          }
                        </Badge>
                      </div>
                      <div className="check-row">
                        <span>
                          {t(
                            "当前筛选出席未知 / 冲突",
                            "Filtered unknown / conflicting attendance",
                          )}
                        </span>
                        <Badge tone="amber">
                          {s.attendance.unknown} / {s.attendance.conflict}
                        </Badge>
                      </div>
                      <p>
                        {t(
                          "缺字段事件进入隔离队列，不参与指标。迟到事件在下次快照按发生时间回补，并更新快照版本。",
                          "Malformed events are quarantined, not counted. Late events backfill by occurrence time in the next versioned snapshot.",
                        )}
                      </p>
                      <button
                        className="text-button"
                        onClick={() =>
                          setDetail({ kind: "events", id: "quality" })
                        }
                      >
                        {t("查看异常事件", "View anomalous events")} →
                      </button>
                    </Panel>
                    <Panel title={t("演示状态验证", "Demo state checks")}>
                      <p>
                        {t(
                          "切换状态以验证无数据和失败恢复。这些控件仅影响当前浏览器中的演示。",
                          "Switch states to inspect empty results and failure recovery. These controls affect only this browser demo.",
                        )}
                      </p>
                      <NativeSelect
                        label={t("数据场景", "Data scenario")}
                        value={mode}
                        onChange={setMode}
                        options={[
                          ["sample", t("示例数据", "Sample data")],
                          ["empty", t("没有数据", "No data")],
                          ["error", t("加载失败", "Load failed")],
                        ]}
                      />
                      <div className="integration-line">
                        <span>{t("客户端行为", "Client behaviour")}</span>
                        <Badge>{t("待接入", "Not connected")}</Badge>
                      </div>
                      <div className="integration-line">
                        <span>{t("业务服务结果", "Business results")}</span>
                        <Badge>{t("待接入", "Not connected")}</Badge>
                      </div>
                      <div className="integration-line">
                        <span>{t("线下出席确认", "Attendance reports")}</span>
                        <Badge>{t("待接入", "Not connected")}</Badge>
                      </div>
                    </Panel>
                  </div>
                  <Panel
                    title={t("指标字典", "Metric dictionary")}
                    eyebrow={t(
                      "定义、分母、观察窗口和产品决策",
                      "DEFINITION, DENOMINATOR, WINDOW & DECISION",
                    )}
                  >
                    <div className="search-field dictionary-search">
                      <Icon name="search" size={17} />
                      <input
                        value={metricQuery}
                        onChange={(e) => setMetricQuery(e.target.value)}
                        placeholder={t("搜索指标…", "Search metrics…")}
                        aria-label={t("搜索指标", "Search metrics")}
                      />
                      {metricQuery && (
                        <button
                          aria-label={t("清除指标搜索", "Clear metric search")}
                          onClick={() => setMetricQuery("")}
                        >
                          <Icon name="close" size={15} />
                        </button>
                      )}
                    </div>
                    <div className="dictionary-list">
                      {metrics
                        .filter((m) =>
                          `${label(m, "title")} ${m.id}`
                            .toLowerCase()
                            .includes(metricQuery.toLowerCase()),
                        )
                        .map((m) => (
                          <button key={m.id} onClick={() => openMetric(m.id)}>
                            <div>
                              <strong>{label(m, "title")}</strong>
                              <p>{label(m, "decision")}</p>
                            </div>
                            <span>
                              {label(m, "unit")}
                              <Icon name="chevron" size={16} />
                            </span>
                          </button>
                        ))}
                    </div>
                    {!metrics.some((m) =>
                      `${label(m, "title")} ${m.id}`
                        .toLowerCase()
                        .includes(metricQuery.toLowerCase()),
                    ) && <Empty t={t} />}
                  </Panel>
                </>
              )}
            </>
          )}
          <footer className="page-footer">
            <span>
              Fancy ·{" "}
              {t("让真实见面成为迭代的起点", "Build from real meetings")}
            </span>
            <span>
              {t(
                "示例快照 · 指标定义 v1 · 无生产连接",
                "Sample snapshot · Definitions v1 · No production connection",
              )}
            </span>
          </footer>
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
      {detail && (
        <DetailDialog
          t={t}
          onClose={() => setDetail(null)}
          title={
            metricDetail
              ? label(metricDetail, "title")
              : selectedMeal
                ? `${selectedMeal.id} · ${selectedMeal.title}`
                : selectedUser
                  ? selectedUser.id
                  : t("事件追溯", "Event trace")
          }
        >
          {metricDetail && (
            <>
              <Badge>{t("指标口径 v1", "Definition v1")}</Badge>
              <dl className="definition-list">
                {(
                  [
                    "definition",
                    "unit",
                    "window",
                    "source",
                    "decision",
                    "caveat",
                  ] as const
                ).map((key, i) => (
                  <div key={key}>
                    <dt>
                      {
                        [
                          t("计算方式", "Calculation"),
                          t("统计单位", "Unit"),
                          t("时间口径", "Window"),
                          t("数据来源", "Source"),
                          t("支持决策", "Decision"),
                          t("解释边界", "Caveat"),
                        ][i]
                      }
                    </dt>
                    <dd>{label(metricDetail, key)}</dd>
                  </div>
                ))}
              </dl>
              <p className="method-note">
                {t(
                  "未设置未经验证的达标线。小样本必须同时查看人数和分母。",
                  "No unvalidated performance targets. Inspect counts and denominators for small samples.",
                )}
              </p>
            </>
          )}
          {selectedMeal && (
            <>
              <div className="detail-meta">
                <Badge tone={selectedMeal.cancelled ? "red" : "green"}>
                  {selectedMeal.cancelled
                    ? t("已取消", "Cancelled")
                    : selectedMeal.startsAt <= SNAPSHOT
                      ? t("已到开始时间", "Past planned start")
                      : t("尚未开始", "Not started")}
                </Badge>
                <span>
                  {selectedMeal.area} · {sourceName(selectedMeal.source)}
                </span>
                <span>
                  {londonDay(selectedMeal.startsAt)} · £{selectedMeal.budget} /{" "}
                  {t("人", "person")}
                </span>
              </div>
              <h3>
                {t("参与与出席证据", "Participation and attendance evidence")}
              </h3>
              <div className="evidence-list">
                {[
                  ...new Set([
                    selectedMeal.hostId,
                    ...data.applications
                      .filter((a) => a.mealId === selectedMeal.id)
                      .map((a) => a.userId),
                  ]),
                ].map((userId) => {
                  const a = data.applications.find(
                      (a) =>
                        a.mealId === selectedMeal.id && a.userId === userId,
                    ),
                    record = latestAttendance(data, userId, selectedMeal.id),
                    status = attendance(record);
                  return (
                    <div key={userId}>
                      <button
                        className="text-button mono"
                        onClick={() => setDetail({ kind: "user", id: userId })}
                      >
                        {userId}
                      </button>
                      <span>
                        {userId === selectedMeal.hostId
                          ? t("发起人", "Host")
                          : a?.withdrawnAt
                            ? t("提前退出", "Withdrew")
                            : a?.confirmedAt
                              ? t("确认成员", "Confirmed")
                              : t("未确认", "Unconfirmed")}
                      </span>
                      <Badge
                        tone={
                          status === "present"
                            ? "green"
                            : status === "conflict"
                              ? "amber"
                              : "neutral"
                        }
                      >
                        {selectedMeal.cancelled
                          ? t("不适用", "Not applicable")
                          : statusName(status)}
                      </Badge>
                      {!selectedMeal.cancelled &&
                        selectedMeal.startsAt < SNAPSHOT &&
                        (userId === selectedMeal.hostId ||
                          (!!a?.confirmedAt &&
                            (!a.withdrawnAt ||
                              a.withdrawnAt > selectedMeal.startsAt))) && (
                          <button
                            className="text-button"
                            onClick={() => {
                              setVerifyUser(userId);
                              setVerifyNote("");
                              setVerifyError(false);
                            }}
                          >
                            {t("核实示例", "Verify sample")}
                          </button>
                        )}
                      {record?.verified && (
                        <small>
                          {t("已核实（模拟）", "Verified (demo)")} ·{" "}
                          {record.verificationNote}
                        </small>
                      )}
                      {record && (
                        <small>
                          {record.host
                            ? t("发起人记录", "Host report")
                            : t("本人自报", "Self-report")}
                          {record.self && record.host
                            ? t(" + 本人自报", " + self-report")
                            : ""}
                        </small>
                      )}
                    </div>
                  );
                })}
              </div>
              {verifyUser && (
                <section className="verification-editor">
                  <h3>
                    {t(
                      "核实出席（仅本次演示）",
                      "Verify attendance (this demo only)",
                    )}
                  </h3>
                  <p>
                    {verifyUser} ·{" "}
                    {t(
                      "保留原始来源，只追加核实结果。刷新恢复示例。",
                      "Preserve original evidence and append a resolution. Reload resets the sample.",
                    )}
                  </p>
                  <NativeSelect
                    label={t("核实结果", "Verified result")}
                    value={verifyResult}
                    onChange={setVerifyResult}
                    options={[
                      ["present", t("出席", "Present")],
                      ["absent", t("未出席", "Absent")],
                    ]}
                  />
                  <label className="verification-note">
                    {t("核实依据（必填）", "Verification basis (required)")}
                    <input
                      value={verifyNote}
                      onChange={(e) => setVerifyNote(e.target.value)}
                      aria-invalid={verifyError}
                      aria-describedby={
                        verifyError ? "verification-error" : undefined
                      }
                      maxLength={200}
                    />
                  </label>
                  {verifyError && (
                    <p
                      id="verification-error"
                      className="inline-error"
                      role="alert"
                    >
                      {t(
                        "请填写核实依据，且仅核实已结束饭局的有效成员。",
                        "Provide a basis. Only eligible participants in ended meals may be verified.",
                      )}
                    </p>
                  )}
                  <button
                    className="button primary"
                    onClick={() => {
                      try {
                        setSampleData(
                          verifyAttendance(
                            sampleData,
                            selectedMeal.id,
                            verifyUser,
                            verifyResult as "present" | "absent",
                            verifyNote,
                          ),
                        );
                        setVerifyUser("");
                        setVerifyError(false);
                        setNotice(
                          t(
                            "示例核实已保存，相关指标已重算；刷新恢复",
                            "Sample verified; metrics recalculated. Reload resets it.",
                          ),
                        );
                      } catch {
                        setVerifyError(true);
                      }
                    }}
                  >
                    {t("保存示例核实", "Save sample verification")}
                  </button>
                </section>
              )}
              <h3>{t("业务时间线", "Business timeline")}</h3>
              <ol className="timeline">
                <li>
                  <span>{t("发布饭局", "Meal published")}</span>
                  <time>
                    {selectedMeal.publishedAt.replace("T", " ").slice(0, 16)}{" "}
                    UTC
                  </time>
                </li>
                <li>
                  <span>{t("计划开始", "Planned start")}</span>
                  <time>
                    {selectedMeal.startsAt.replace("T", " ").slice(0, 16)} UTC
                  </time>
                </li>
                {selectedMeal.cancelled && (
                  <li>
                    <span>{t("取消原因", "Cancellation reason")}</span>
                    <p>
                      {selectedMeal.cancelReason === "insufficient"
                        ? t("人数不足", "Insufficient attendance")
                        : t("发起人取消", "Host cancelled")}
                    </p>
                  </li>
                )}
              </ol>
            </>
          )}
          {selectedUser && (
            <>
              <p className="method-note">
                {t(
                  "匿名业务编号；不展示联系方式、聊天内容或私密互选。",
                  "Pseudonymous business ID. Contact details, chat content and private choices are omitted.",
                )}
              </p>
              <div className="stat-strip">
                <span>{t("注册日期", "Joined")}</span>
                <strong>{londonDay(selectedUser.joinedAt)}</strong>
              </div>
              <h3>{t("相关饭局", "Related meals")}</h3>
              <div className="evidence-list">
                {data.applications
                  .filter(
                    (a) =>
                      a.userId === selectedUser.id && a.appliedAt <= SNAPSHOT,
                  )
                  .map((a) => (
                    <div key={a.id}>
                      <button
                        className="text-button mono"
                        onClick={() =>
                          setDetail({ kind: "meal", id: a.mealId })
                        }
                      >
                        {a.mealId}
                      </button>
                      <span>{londonDay(a.appliedAt)}</span>
                      <Badge>
                        {statusName(
                          attendance(
                            latestAttendance(data, selectedUser.id, a.mealId),
                          ),
                        )}
                      </Badge>
                    </div>
                  ))}
              </div>
              <h3>
                {t(
                  "事件时间线（最多 30 条）",
                  "Event timeline (up to 30 records)",
                )}
              </h3>
              <ol className="timeline">
                {cleanEvents(data.events, data.identityLinks)
                  .filter((e) => e.userId === selectedUser.id)
                  .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
                  .slice(0, 30)
                  .map((e) => (
                    <li key={e.id}>
                      <span className="mono">{e.name}</span>
                      <time>
                        {e.occurredAt.replace("T", " ").slice(0, 16)} UTC ·{" "}
                        {e.mealId}
                      </time>
                    </li>
                  ))}
              </ol>
            </>
          )}
          {detail.kind === "events" && (
            <>
              <p className="method-note">
                {detail.id === "quality"
                  ? t(
                      "异常字段样本已隔离；以下为排查记录，不计入指标。",
                      "Malformed event samples are quarantined and excluded from metrics.",
                    )
                  : t(
                      "遵循当前筛选。事件名称为稳定的采集标识，保留英文。",
                      "Uses current filters. Stable instrumentation identifiers remain in English.",
                    )}
              </p>
              <ol className="timeline">
                {(detail.id === "quality"
                  ? missing
                  : events.filter((e) => e.name === detail.id)
                )
                  .slice(0, 30)
                  .map((e) => (
                    <li key={e.id}>
                      <span className="mono">
                        {e.id} · {e.name}
                      </span>
                      <time>
                        {e.occurredAt.replace("T", " ").slice(0, 16)} UTC
                      </time>
                      <p>
                        {e.userId} · {e.mealId || "—"} · {t("会话", "Session")}:{" "}
                        {e.sessionId || t("缺失", "Missing")}
                      </p>
                    </li>
                  ))}
              </ol>
              {detail.id !== "quality" &&
                !events.some((e) => e.name === detail.id) && <Empty t={t} />}
            </>
          )}
        </DetailDialog>
      )}
    </div>
  );
}
