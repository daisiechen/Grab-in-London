# Fancy Insights — UX contract

## Source and boundaries
业务/权限/生命周期来源：`../docs/product/admin/PRD.zh-CN.md`；用户端状态来源：`../docs/product/PRD.zh-CN.md`。只做五个分析模块，不提供订单财务、商家、客服、安全审核、内容增长管理。当前数据是本地虚构 fixture，没有真实身份、服务或第三方集成。

## Canonical UI map
| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Select/Listbox | `src/components.tsx` NativeSelect | DESIGN.md, this contract | native | E2E choice, label and locale retention |
| Date | `src/App.tsx` global date filter | admin PRD, this contract | native | date validation and London/DST unit tests |
| Form | `src/App.tsx` filter state | this contract | filter, sample classification | inline error and retained values |
| Scrollbar | `src/styles.css` | DESIGN.md tokens | page, table, dialog | root computed style and narrow viewport |
| Table | `src/components.tsx` DataTable | this contract | read-only, six-row pagination, real-date newest/oldest ordering | search, clear, page boundaries |
| Toast | `src/App.tsx` notice | this contract | status | role=status, localized export/classification feedback |
| Overlay | `src/components.tsx` DetailDialog | this contract | native modal drawer | focus, Escape, restoration |
| Navigation | `src/App.tsx` pages | this contract | desktop, mobile | named icon links, hash routes and URL filters |
| CRUD | No production writes | admin PRD | local sample classification only | eligibility and immutable evidence tests |


## Revision: minimal pilot interactions
- Advanced filters: shared `FilterPopover` owns outside pointer/focus dismissal, Escape focus restoration and route dismissal. Keep inner selection open; display active hidden conditions as removable chips.
- Data checks: `src/checks.ts` owns deterministic summaries for the current dataset and filters. No analyst agent, weekly agenda writer or causal claim. Product team reviews decisions weekly; connected snapshots later supply fresh data.
- Cohort dates open the full cohort. Nested cohort/user/meal details have a back path. User history includes hosted meals; timestamps display Europe/London.
- List sorting uses real dates, newest first by default. Locale preserves search and ordering. Dataset changes/sort/clear search reset pagination.
- Attendance tiles and the evidence action filter the meal list only; aggregation scope stays explicit. Ineligible records show not applicable. Attendance is read-only: self first, host fallback, source differences retained. Late corrections belong to support cases.
- Review switches require `?review=1`; normal screens retain truthful source status but omit test controls and static teaching cards.

## Flow ledger
- Global filters → recompute common facts → all analysis follows the same values; locale changes retain dates, business filters and route. Selected dates define cohorts; follow-up observed to snapshot, explicitly labelled. Source: admin PRD metric rules.
- Invalid dates → inline error → previous valid results retained → correct and apply. No native alert.
- Chart/area → filter and route → relevant records. List pagination/search do not alter metrics.
- Metric card/dictionary → definition drawer → calculation, denominator, unit, source, window, decision, caveat → Escape/close restores focus.
- Meal/user → related business records and events → no chat text/contact information. Source: user PRD privacy boundaries.
- Empty → no-data and clear/reset path; denominator-zero is unavailable. Failed load → stale charts hidden → bounded explicit retry restores sample.
- Export → only aggregate counts plus snapshot and filters → CSV marked fictional → localized status announcement. No raw personal export.

## Data truth and security
UI switches are presentation, not authorization. A real deployment requires server authentication and scoped analytics/classification permissions. Never expose raw production records through a static public build. Events from test/staff/bots/demo, duplicates and malformed records are excluded. Unknown attendance is not a no-show; source differences use self-report priority. The frontend is not authoritative for business outcomes.

## Acceptance evidence
`tests/dashboard.spec.ts` covers core routes, focus/Escape, locale, narrow layout, exports, empty/error recovery. `tests/analytics.test.ts` covers data definitions and windows. `qa/verification.zh-CN.md` records actual validation and limits.


## Measurement revision v3
Normal navigation has five real destinations and no unused workspace/account avatars. Repeated demo badges/banner are removed; source status and local-only edits stay documented on Data & definitions. Numeric filter choices cover the complete domain. Multi-selects use OR within a field and AND across fields; both-language meals match each supported language without duplicated results. Date inputs keep calendar icons with their text and separate Apply.

Account classification in the quality page updates local account metadata, recomputes behavior and facts, and excludes host test meals. It is not an authorization UI. Production requires server data-admin authorization, change reason/version/audit. Experience reasons are grouped by rating, optional missing reasons stay explicit, and person reconnect intent is never used as meal-return intent. Formula and data authority: [measurement contract](../docs/product/admin/measurement-contract.zh-CN.md).
