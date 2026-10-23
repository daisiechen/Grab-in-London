# 项目文档索引

项目入口：[README](../README.md)。本目录保存项目知识；Agent 协作规则见 [AGENTS.md](../AGENTS.md)，正式方法在 `.agents/skills/`，待审核候选在 `.agents/candidates/`，不作为现行执行规则。

## 产品与需求

| 文档 | 用途与权威关系 |
| --- | --- |
| [主 PRD](product/PRD.zh-CN.md) | 当前v0.8需求真源；§0为已确认首期规格，沿用星期日恢复版界面 |
| [MVP 补丁版本 PRD](product/mvp-patch-PRD.zh-CN.md) | 下一版增量需求、UX 问答及 Figma / 补丁 Demo 映射；需求梳理中，不改变当前 MVP 开发与测试基线 |
| [产品简介](product/product-brief.md) | 产品定位与摘要；详细规则以主 PRD 为准 |
| [首期运营指标与采集契约](product/admin/measurement-contract.zh-CN.md) | 后台全部指标算法、App采集入口与生产数据接入验收 |
| [管理端 PRD](product/admin/PRD.zh-CN.md) | 管理端范围及指标；引用主 PRD，不替代共享业务规则 |
| [历史R1原型与模拟交接](../shared/README.md) | 历史参考，非现行研发契约；业务真源为主PRD§0 |

## 调研与商业模式

- [竞品调研](research/competitive-landscape.zh-CN.md)与[证据附录](research/competitor-evidence.zh-CN.md)：结论、来源及证据边界。
- [商业模式评估](business/business-assessment.zh-CN.md)、[模型输入](business/model-inputs.json)与[验证记录](business/verification.zh-CN.md)：假设、测算、收入及验证，不代表真实经营结果。

## 设计与模块说明

- [品牌方向](design/brand-direction.zh-CN.md)：品牌与入口体验方向；当前品牌及需求以主 PRD 为准。
- 用户端：[模块说明](../demo/README.md)、[设计规范](../demo/DESIGN.md)、[交互契约](../demo/UX-CONTRACT.md)、[组件说明](../demo/src/mobile/COMPONENTS.md)。
- 管理端：[模块说明](../admin/README.md)、[设计规范](../admin/DESIGN.md)、[交互契约](../admin/UX-CONTRACT.md)。模块说明就近维护，不另建副本。

- [真实AI研发准入复评](reviews/ai-development-readiness-2026-10-21.zh-CN.md)：保留AI-B01/02发现与用户P-04/05决定；需求决策已明确，原PRD/Demo回填待原会话。

## 核心开发执行方案

- [核心架构与决策](engineering/core-development-plan.zh-CN.md)：非AI业务核心的待实施技术基线；与本包真实AI方案共同交付。
- [数据与命令契约](engineering/data-and-command-contract.zh-CN.md)：事务、历史资格、消息区间、删除及快照。
- [API与客户端契约](engineering/api-and-client-contract.zh-CN.md)：接口、权限、Web/iOS与后台适配、通知渠道。
- [验证与发布](engineering/validation-and-release.zh-CN.md)及[场景清单](engineering/acceptance-scenarios.json)：待实施业务验收与真实外部门槛。
- [真实AI技术方案](engineering/ai-development-plan.zh-CN.md)与[AI场景](engineering/ai-acceptance-scenarios.json)：只读检索/草稿、偏好/短期会话、费用硬闸、真实评测与接入门槛。
- [DeepSeek 接入准备核查](engineering/decisions/deepseek-readiness.md)：官方参数、政策与候选价格核对及本地适配；不代表真实模型或数据门槛获准启用。
- [DeepSeek 人民币预算实施决策](engineering/decisions/ai-cny-budget.md)：按用户决定使用人民币最小整数单位计账，月上限50元；真实价格及凭据缺失时关闭模型调用。
- [共同审查记录](engineering/collaborative-review.zh-CN.md)：精确版本、双方意见、关闭情况及适用边界；[哈希清单](engineering/review-manifest.json)固定10份认可文件。
- [Claude执行入口](../tasks/plan.md)与[唯一任务表](../tasks/todo.md)：43个切片，已获用户授权启动实施，实际状态及验证证据以任务表为准。
- [MVP实施协调与资源准备](../tasks/mvp-coordination.md)：三端开发文件分工、DeepSeek人民币50元/月预算、首尔服务器只读核查、外部门槛及自测后测试会话交接条件。
- [MVP运行与交付](../infra/README.md)：本机临时联调、API/worker入口、CI、首尔目录隔离及待授权的真实部署/恢复边界。

## 发布与验收

- [平台配置交接](delivery/platform-configuration-2026-10-21.zh-CN.md)：账号、DNS、密钥安全加载方式和真实接入边界，供后续开发会话使用。

- [政策审核清单](policies/README.md)、[隐私通知英文草稿](policies/privacy-notice.draft.en.md)与[社区规则英文草稿](policies/community-guidelines.draft.en.md)：个人发布主体的英文初稿、申请进度与发布前待确认项；未批准、未生效。

- [原14条阻塞解除准备](delivery/mvp-gate-unblocking-2026-10-21.zh-CN.md)：逐条负责人、解除条件及本地演练；最终状态由独立QA复验判定。
- [MVP 本地自测与独测交接](delivery/mvp-local-selftest-2026-10-21.zh-CN.md)：本机验证、精确版本、模拟与真实边界及待用户操作。

- [MVP与AI测试计划](qa/test-plan.zh-CN.md)、[测试用例目录](qa/test-cases.zh-CN.md)、[结构化用例](qa/test-cases.json)与[Claude协作及差异登记](qa/collaboration-and-gaps.zh-CN.md)：覆盖PRD、双端Demo、技术包的待执行验收，区分模拟、待实现和真实门槛。
- [独立QA部分执行报告](qa/execution-2026-10-21.zh-CN.md)、[逐条执行记录](qa/execution-2026-10-21.json)、[缺陷登记](qa/defects-2026-10-21.zh-CN.md)、[浏览器执行证据](qa/evidence/2026-10-21/browser-journey.zh-CN.md)与[逐项自动化证据](qa/evidence/2026-10-21/automated-runs.json)：交接8ba6fc7及Inbox修复071ecd7的本地证据；保留未执行及真实外部门槛，不代表217条全通过。

- [2026-10-21双端独立复评](reviews/development-readiness-2026-10-21.zh-CN.md)：固定bbadfed基线，逐项核对B-01—B-11；当时核心双端可进入方案设计、AI范围待定；新增FR-13和本轮决定另由上列AI复评承接。

- [2026-10-21最新交互修订](delivery/fancy-picker-refinement-2026-10-21.zh-CN.md)：取消手动新增与Profile返回、紧凑时间菜单及Google餐厅照片来源规则，覆盖v12的相应设计。

- [2026-10-21选店与创建修订](delivery/fancy-restaurant-picker-2026-10-21.zh-CN.md)：任意餐厅Demo、Google Places正式规格、时间下拉、条款与返回路径。

- [浏览器批注与AI恢复](delivery/fancy-comments-ai-2026-10-20.zh-CN.md)：16条批注、Ask Fancy恢复、问卷拆分及验证边界。

- [2026-10-20双端研发前置评审](reviews/development-readiness-2026-10-20.zh-CN.md)：恢复版用户端与当前后台工作区的只读评审，记录未关闭阻塞及原会话修订、复评条件。
- [双端研发准入评审](reviews/development-readiness-2026-10-19.zh-CN.md)：当时R1基线的历史评审；App及主PRD已回滚，该结论不适用于当前组合。

- [发布记录](delivery/demo-release.zh-CN.md)与[完整产品审查](delivery/full-product-audit.zh-CN.md)。
- 用户端：[视觉验证](../demo/design-qa.md)、[浏览器验证](../demo/qa/browser-results.md)，截图按批次保存在 `demo/qa/`。
- 历史 R1：[用户端候选核验](../demo/qa/r1/readiness.md)、[后台候选证据](https://github.com/daisiechen/Grab-in-London/tree/102183d/admin/qa/readiness-2026-10-19)。该R1评审不覆盖当前恢复版PRD。
- [2026-10-20回滚记录](releases/rollback-2026-10-20.zh-CN.md)：当前Demo与主PRD的目标提交、线上版本及回滚边界。
- [管理端指标与采集修订](delivery/fancy-admin-measurement-review.zh-CN.md)：19条批注、App补充、口径与本轮验证。
- [管理端可用性审查](delivery/fancy-admin-usability-review.zh-CN.md)：逐页走查、精简决策、规则维护职责及浏览器证据。
- 管理端：[验证报告](../admin/qa/verification.zh-CN.md)，截图按批次保存在 `admin/qa/`。
- [商业交付产物](../outputs/business-2026-10-17/)：PDF、HTML、PPTX 和 XLSX。`outputs/` 保存需交付的产物，`build/` 为忽略的构建中间目录。

## 维护规则

- 日常更新原文件，Git 保存历史；有意义的已替代基线才移入 `archive/` 并注明替代关系，避免“最终版2”等副本。
- 重要决策需要独立记录时使用 `decisions/`；目录按需创建，不建空目录占位。
- 文件移动必须更新所有入口、引用和依赖，并运行 `python3 -m unittest discover -s tests -v` 及 `git diff --check`。
- 本次整理仅变更文件位置、引用和导航，不重新裁定调研、产品或商业结论；后续结论变化更新对应权威文档。

## Agent 协作

- [Agent 协作与配置边界](agent-collaboration.md)：共用规则、桌面可见评审、文件职责与 Git 交付。

- [2026-10-20 App修订与验证](delivery/fancy-app-readiness-2026-10-20.zh-CN.md)：恢复版上的必要局部修订及B-01—B-11映射；不是双端独立复评通过结论。

- [B3固定源码浏览器走查](qa/evidence/2026-10-21/browser-b3.zh-CN.md)、[结构化浏览器观察](qa/evidence/2026-10-21/browser-b3.json)：本地合成身份/餐厅与真实API/PG；[资料门槛](qa/evidence/2026-10-21/b3-profile-confirmation-gate.jpg)、[条款返回](qa/evidence/2026-10-21/b3-terms-return-arrange.jpg)、[发布详情](qa/evidence/2026-10-21/b3-published-meal.jpg)、[公开资料来源](qa/evidence/2026-10-21/b3-public-profile-origin.jpg)。

- [B4认证回流与导航复验](qa/evidence/2026-10-21/browser-b4.zh-CN.md)、[逐项观察](qa/evidence/2026-10-21/browser-b4.json)：[未发稿](qa/evidence/2026-10-21/b4-auth-return-unsent.jpg)、[Pending卡片](qa/evidence/2026-10-21/b4-pending-inbox.jpg)、[条款返回](qa/evidence/2026-10-21/b4-terms-return-fixed.jpg)、[公开资料返回](qa/evidence/2026-10-21/b4-public-profile-origin-fixed.jpg)、[编辑回Hosting](qa/evidence/2026-10-21/b4-edit-hosting-fixed.jpg)、[退出刷新](qa/evidence/2026-10-21/b4-logout-refresh.jpg)。

- [B5发现筛选与游客门禁](qa/evidence/2026-10-21/browser-b5.zh-CN.md)、[逐项观察](qa/evidence/2026-10-21/browser-b5.json)：[交集](qa/evidence/2026-10-21/b5-filter-intersection.jpg)、[空结果](qa/evidence/2026-10-21/b5-empty-real-results.jpg)、[unknown饮食](qa/evidence/2026-10-21/b5-unknown-vegan-excluded.jpg)、[双语去重](qa/evidence/2026-10-21/b5-chinese-unique-result.jpg)、[游客Inbox](qa/evidence/2026-10-21/b5-guest-inbox-gate.jpg)。

- [B6审批和群身份独立闭环](qa/evidence/2026-10-21/browser-b6.zh-CN.md)、[逐项观察](qa/evidence/2026-10-21/browser-b6.json)：[批准安排锁](qa/evidence/2026-10-21/b6-approved-arrangements-locked.jpg)、[群消息](qa/evidence/2026-10-21/b6-group-message.jpg)、[退席仍群聊](qa/evidence/2026-10-21/b6-cancel-seat-group-still-open.jpg)、[退群历史](qa/evidence/2026-10-21/b6-left-group-history.jpg)、[重入授权并集/解散](qa/evidence/2026-10-21/b6-rejoined-union-history-dissolved.jpg)。

- [B7同场受控钟主链](qa/evidence/2026-10-21/browser-b7.zh-CN.md)、[逐项观察](qa/evidence/2026-10-21/browser-b7.json)、[物理checkpoint](qa/evidence/2026-10-21/b7-lifecycle-checkpoints.json)：[b7-approved-guest-group-message.jpg](qa/evidence/2026-10-21/b7-approved-guest-group-message.jpg)、[b7-auth-profile-return-draft.jpg](qa/evidence/2026-10-21/b7-auth-profile-return-draft.jpg)、[b7-end-minus1-no-report.jpg](qa/evidence/2026-10-21/b7-end-minus1-no-report.jpg)、[b7-exact-close-qualified.jpg](qa/evidence/2026-10-21/b7-exact-close-qualified.jpg)、[b7-exact-end-unknown-attendance.jpg](qa/evidence/2026-10-21/b7-exact-end-unknown-attendance.jpg)、[b7-guest-self-present-private-score.jpg](qa/evidence/2026-10-21/b7-guest-self-present-private-score.jpg)、[b7-host-own-report-guest-host-absent.jpg](qa/evidence/2026-10-21/b7-host-own-report-guest-host-absent.jpg)、[b7-mutual-direct-message.jpg](qa/evidence/2026-10-21/b7-mutual-direct-message.jpg)、[b7-mutual-reconnect-published-references.jpg](qa/evidence/2026-10-21/b7-mutual-reconnect-published-references.jpg)、[b7-new-clock-meal.jpg](qa/evidence/2026-10-21/b7-new-clock-meal.jpg)、[b7-one-sided-reconnect-reference-pending.jpg](qa/evidence/2026-10-21/b7-one-sided-reconnect-reference-pending.jpg)。

- QA B8: [report](qa/evidence/2026-10-21/browser-b8.zh-CN.md), [observations](qa/evidence/2026-10-21/browser-b8.json), [survey](qa/evidence/2026-10-21/b8-survey-yes-factors.jpg), [same-meal attendance](qa/evidence/2026-10-21/b8-admin-same-meal-attendance.jpg), [score/survey](qa/evidence/2026-10-21/b8-admin-score-survey-separated.jpg).

- QA B9: [report](qa/evidence/2026-10-21/browser-b9.zh-CN.md), [observations](qa/evidence/2026-10-21/browser-b9.json), [fixed target](qa/evidence/2026-10-21/b9-f18-fixed-target-reload.jpg).

- QA B10: [report](qa/evidence/2026-10-21/browser-b10.zh-CN.md), [observations](qa/evidence/2026-10-21/browser-b10.json), [application](qa/evidence/2026-10-21/b10-admin-application-trace.jpg), [empty](qa/evidence/2026-10-21/b10-admin-empty-not-zero.jpg), [filter independence](qa/evidence/2026-10-21/b10-admin-language-no-meal-survey-retained.jpg), [quality CSV](qa/evidence/2026-10-21/b10-export-quality.csv), [overview CSV](qa/evidence/2026-10-21/b10-export-overview.csv), [empty CSV](qa/evidence/2026-10-21/b10-export-empty.csv).

- QA R96/R97: [survey and draft authorization boundaries](qa/evidence/2026-10-21/r96-r97-boundaries.md).

- QA R98: [mail fault injection and F19 original red](qa/evidence/2026-10-21/r98-mail-dead-letter.md).

- QA R104/R105: [F19 closure and actual notification matrix](qa/evidence/2026-10-21/r104-r105-mail-closure.md).

- QA R107: [creation and exact publication boundaries](qa/evidence/2026-10-21/r107-create-boundaries.md).

- QA R109: [independent DST and quantile reconciliation](qa/evidence/2026-10-21/r109-dst-quantiles.md).

- QA R111: [P0 guest login isolation](qa/evidence/2026-10-21/r111-guest-login-isolation.md).

- QA F20: [native original first-launch failure evidence](qa/evidence/2026-10-21/native-first-launch-crash.txt).

- QA F21: [native consent safe-area original screenshot](qa/evidence/2026-10-21/native-consent-safe-area-original.png).

- QA F20 formal build: [review](qa/evidence/2026-10-21/f20-independent-build-review.md), [machine bundle proof](qa/evidence/2026-10-21/f20-independent-bundle-proof.json).

- QA B11: [real AI editor report](qa/evidence/2026-10-21/browser-b11.zh-CN.md), [observations](qa/evidence/2026-10-21/browser-b11.json), [DB checkpoints](qa/evidence/2026-10-21/b11-business-write-checkpoints.json), [transferred unsent](qa/evidence/2026-10-21/b11-ai-application-transferred-unsent.jpg), [explicit pending](qa/evidence/2026-10-21/b11-ai-explicit-application-pending.jpg), [create text](qa/evidence/2026-10-21/b11-ai-create-title-description.jpg), [booking unchecked](qa/evidence/2026-10-21/b11-ai-create-booking-unchecked.jpg), [Review blocked](qa/evidence/2026-10-21/b11-ai-create-review-unchecked-blocked.jpg).

- QA F20/F21 closure: [review](qa/evidence/2026-10-21/native-f20-f21-closure.md), [machine provenance](qa/evidence/2026-10-21/native-f20-f21-owner-runtime-review.json), [formal9df native screen](qa/evidence/2026-10-21/native-f20-9df-fixed.png), [formal5b source-equivalent safe-area screen](qa/evidence/2026-10-21/native-f21-formal-source-equivalent.png).

- QA B12: [creation capacity boundary observations](qa/evidence/2026-10-21/browser-b12.json), [preserved six-person draft](qa/evidence/2026-10-21/create-people-six-preserved.jpg).
- QA B13: [dictionary and five-page mobile observations](qa/evidence/2026-10-21/browser-b13.json), [focus return](qa/evidence/2026-10-21/admin-definition-dismiss-focus.jpg), [retention at390px](qa/evidence/2026-10-21/admin-retention-390.jpg), [quality empty state at390px](qa/evidence/2026-10-21/admin-quality-empty-390.jpg), [measured page and table widths](qa/evidence/2026-10-21/admin-small-widths.json).
- QA source review: [area-mapping gap](qa/evidence/2026-10-21/code-review-observations.json); [exact formal native build review](qa/evidence/2026-10-21/native-formal-5b-review.json), [formal native screen](qa/evidence/2026-10-21/native-formal-5b-screen.png).
- QA B14: [actual production create venue preservation](qa/evidence/2026-10-21/browser-b14.json), [empty search retaining confirmed venue](qa/evidence/2026-10-21/cross-create-no-results-keeps-venue.jpg), [explicitly published synthetic table](qa/evidence/2026-10-21/cross-web-published.jpg).
- Independent native QA: [real XCTest execution and unresolved restore boundary](qa/evidence/2026-10-21/native-independent-xcui.json), [OTP XCTest source](qa/evidence/2026-10-21/native-auth-xcui.swift), [profile XCTest source](qa/evidence/2026-10-21/native-profile-xcui.swift).
- Native restore diagnosis: [fixed-stage-only diagnostic7 output](qa/evidence/2026-10-21/native-diagnostic7-safe-stages.jsonl). Diagnostic App intentionally differs from formal19d and does not count as native journey acceptance; failure is before HTTP in readRefresh, exact storage cause remains under investigation.
- QA B15: [Discover Back original defect](qa/evidence/2026-10-21/browser-b15.json), [actual returned screen](qa/evidence/2026-10-21/discovery-back-loses-filter.jpg).
- QA code review: [trust/logging/auth/lock evidence and source hashes](qa/evidence/2026-10-21/code-trust-logging-review.json), [complete joint write-path inventory with independent counterexample disposition](qa/evidence/2026-10-21/write-path-review.md).
- Native scoped follow-up: [diagnostic8 fixed getItem stage](qa/evidence/2026-10-21/native-diagnostic8-safe-stages.jsonl), [signature-only comparison9 fixed stages](qa/evidence/2026-10-21/native-signcheck9-safe-stages.jsonl). Both remain unresolved diagnostics, not formal native acceptance.
- QA B16及原生真实跨端切片：[browser-b16.json](qa/evidence/2026-10-21/browser-b16.json), [create-change-venue-retains-time.jpg](qa/evidence/2026-10-21/create-change-venue-retains-time.jpg), [create-time-menu-390.jpg](qa/evidence/2026-10-21/create-time-menu-390.jpg), [create-time-menu-measurements.json](qa/evidence/2026-10-21/create-time-menu-measurements.json), [create-venue-reset-fixed.jpg](qa/evidence/2026-10-21/create-venue-reset-fixed.jpg), [cross-exchange-facts.json](qa/evidence/2026-10-21/cross-exchange-facts.json), [cross-pending-facts.json](qa/evidence/2026-10-21/cross-pending-facts.json), [cross-web-approved-arrangement-locked.jpg](qa/evidence/2026-10-21/cross-web-approved-arrangement-locked.jpg), [cross-web-native-message-exchange.jpg](qa/evidence/2026-10-21/cross-web-native-message-exchange.jpg), [cross-web-pending-one-seat.jpg](qa/evidence/2026-10-21/cross-web-pending-one-seat.jpg), [discovery-back-fixed-filter.jpg](qa/evidence/2026-10-21/discovery-back-fixed-filter.jpg), [native-application-pending.png](qa/evidence/2026-10-21/native-application-pending.png), [native-apply-header-fixed.png](qa/evidence/2026-10-21/native-apply-header-fixed.png), [native-apply-header-original.png](qa/evidence/2026-10-21/native-apply-header-original.png), [native-apply15-xcui.swift](qa/evidence/2026-10-21/native-apply15-xcui.swift), [native-chat-header-fixed.png](qa/evidence/2026-10-21/native-chat-header-fixed.png), [native-chat-header-original.png](qa/evidence/2026-10-21/native-chat-header-original.png), [native-chat17-xcui.swift](qa/evidence/2026-10-21/native-chat17-xcui.swift), [native-chat18-xcui.swift](qa/evidence/2026-10-21/native-chat18-xcui.swift), [native-chat19-xcui.swift](qa/evidence/2026-10-21/native-chat19-xcui.swift), [native-diagnostic10-safe-stages.jsonl](qa/evidence/2026-10-21/native-diagnostic10-safe-stages.jsonl), [native-formal-runtime-review.json](qa/evidence/2026-10-21/native-formal-runtime-review.json), [native-keychain-safe-status.json](qa/evidence/2026-10-21/native-keychain-safe-status.json), [native-pending-no-group.png](qa/evidence/2026-10-21/native-pending-no-group.png), [native-pending16-xcui.swift](qa/evidence/2026-10-21/native-pending16-xcui.swift).

- QA B17 independent reverse-role and cancellation evidence (partial journeys; original F39/F40 failures retained): [browser-b17.json](qa/evidence/2026-10-21/browser-b17.json), [cross-insufficient-approved-facts.json](qa/evidence/2026-10-21/cross-insufficient-approved-facts.json), [cross-insufficient-published-facts.json](qa/evidence/2026-10-21/cross-insufficient-published-facts.json), [cross-insufficient-published.jpg](qa/evidence/2026-10-21/cross-insufficient-published.jpg), [cross-reverse-approved-facts.json](qa/evidence/2026-10-21/cross-reverse-approved-facts.json), [cross-reverse-cancelled-seat-facts.json](qa/evidence/2026-10-21/cross-reverse-cancelled-seat-facts.json), [cross-reverse-left-facts.json](qa/evidence/2026-10-21/cross-reverse-left-facts.json), [cross-reverse-left-readonly.jpg](qa/evidence/2026-10-21/cross-reverse-left-readonly.jpg), [cross-reverse-pending-facts.json](qa/evidence/2026-10-21/cross-reverse-pending-facts.json), [cross-reverse-rejoined-facts.json](qa/evidence/2026-10-21/cross-reverse-rejoined-facts.json), [cross-reverse-rejoined-union.jpg](qa/evidence/2026-10-21/cross-reverse-rejoined-union.jpg), [f39-inbox-cancelled-seat-false-confirmed.jpg](qa/evidence/2026-10-21/f39-inbox-cancelled-seat-false-confirmed.jpg), [f39-inbox-neutral-fixed.jpg](qa/evidence/2026-10-21/f39-inbox-neutral-fixed.jpg), [native-apply26-xcui.swift](qa/evidence/2026-10-21/native-apply26-xcui.swift), [native-apply29-xcui.swift](qa/evidence/2026-10-21/native-apply29-xcui.swift), [native-b17-execution.json](qa/evidence/2026-10-21/native-b17-execution.json), [native-chat27-xcui.swift](qa/evidence/2026-10-21/native-chat27-xcui.swift), [native-create24-xcui.swift](qa/evidence/2026-10-21/native-create24-xcui.swift), [native-host-no-dissolve-f40.png](qa/evidence/2026-10-21/native-host-no-dissolve-f40.png), [native-host25-xcui.swift](qa/evidence/2026-10-21/native-host25-xcui.swift), [native-host28-xcui.swift](qa/evidence/2026-10-21/native-host28-xcui.swift), [native-reverse-approved-booking.png](qa/evidence/2026-10-21/native-reverse-approved-booking.png), [native-reverse-published.png](qa/evidence/2026-10-21/native-reverse-published.png).

- QA B17 native cancellation follow-up: [cross-native-cancel-left-facts.json](qa/evidence/2026-10-21/cross-native-cancel-left-facts.json), [native-cancel-seat-still-send.png](qa/evidence/2026-10-21/native-cancel-seat-still-send.png), [native-cancel31-xcui.swift](qa/evidence/2026-10-21/native-cancel31-xcui.swift), [native-left-group-readonly.png](qa/evidence/2026-10-21/native-left-group-readonly.png), [native-reapply32-xcui.swift](qa/evidence/2026-10-21/native-reapply32-xcui.swift).

- QA B18 native dissolution/F41 return regression and partial post-meal journey: [browser observations](qa/evidence/2026-10-21/browser-b18.json), [F40 formal proof](qa/evidence/2026-10-21/f40-independent-formal-proof.json), [F41 fixed Inbox](qa/evidence/2026-10-21/f41-native-inbox-return-restored.png), [single-sided facts](qa/evidence/2026-10-21/cross-main-one-sided-feedback-facts.json), [mutual facts before first DM](qa/evidence/2026-10-21/cross-main-mutual-feedback-facts.json). Full journeys remain NOT_RUN; historical failures retained.

- QA B19 actual reciprocal feedback/DM/privacy and F42 closure, with F44 native safety gap retained: [observations](qa/evidence/2026-10-21/browser-b19.json), [formal F42 proof](qa/evidence/2026-10-21/f42-independent-formal-proof.json), [third observer single-side](qa/evidence/2026-10-21/third-privacy-one-sided.json), [third observer mutual](qa/evidence/2026-10-21/third-privacy-mutual.json), [safe checkpoint](qa/evidence/2026-10-21/cross-safe-checkpoint-facts.json), [F44 original profile](qa/evidence/2026-10-21/f44-native-original-profile-no-block.png). Complete journey remains FAIL/NOT_RUN where assertions or same-environment trace are missing.

- [QA B20：原生安全复验、退出边界与同库夹具故障](qa/evidence/2026-10-21/browser-b20.json)

- [QA B21：冷启动与重装实测、键盘遮挡缺陷](qa/evidence/2026-10-21/browser-b21.json)

- [QA B22：原生访客申请登录回流定向验收](qa/evidence/2026-10-21/browser-b22.json)

- [QA B23：原生键盘、明确草稿替换与正常退出基线](qa/evidence/2026-10-21/browser-b23.json)

- [QA B24：退出503全局提示与本机凭据清除定向验收](qa/evidence/2026-10-21/browser-b24.json)

- [QA B25：iOS同进程跨API重启与未发文字保留](qa/evidence/2026-10-21/browser-b25.json)

- [QA B26：J010实际双端路径与站内通知缺陷](qa/evidence/2026-10-21/browser-b26.json)

- [QA B27：新版定向前置复验与合成授权浏览器阻塞](qa/evidence/2026-10-21/browser-b27.json)

- [QA B28：双浏览器无账号表单策略对照](qa/evidence/2026-10-21/browser-b28.json)

- [QA B29：有序浏览器表单Origin与策略因果对照](qa/evidence/2026-10-21/browser-b29.json)

- [QA B30：站内通知与原生键盘发送实际修复验收](qa/evidence/2026-10-21/browser-b30.json)

- [支持授权链表单消费后的定向复验](qa/evidence/2026-10-21/rp-support-live-retest.md)：独立检查与实际浏览器阶段结果，保留未完成边界。

- [J007 产品问卷实际界面部分验收](qa/evidence/2026-10-21/survey-partial-ui.md)：未出席提交、编辑持久化及三账号隔离，完整旅程仍待测。

- [QA B31：同库完整截止不足旅程通过](qa/evidence/2026-10-21/browser-b31.json)：正常支持前置、Web 主持与原生加入、通知去重及取消后群消息。[有限事实](qa/evidence/2026-10-21/b31-finite-facts.json)。

- [QA B32：受控 AI 创建、群草稿与失败恢复实际路径](qa/evidence/2026-10-21/browser-b32.json)：显式生成/转入/发布/发送及失败不写业务；完整 AI 旅程前置仍未满足。[有限事实](qa/evidence/2026-10-21/b32-finite-facts.json)。

- [QA B33：AI 申请草稿与正常登录返回实际路径](qa/evidence/2026-10-21/browser-b33.json)：明确选餐、转入、保留草稿及再次主动发送，未自动申请或批准。

- [QA B34：第三账号隔离与 AI 草稿最终名额重验](qa/evidence/2026-10-21/browser-b34.json)：真实审批满员后旧草稿提交拒绝，原文保留且无业务写入。

- [QA B35：精确截止后的旧 AI 申请提交](qa/evidence/2026-10-21/browser-b35.json)：正常退席后保留草稿；截止取消分支拒绝提交，四项业务摘要无变化。

- [QA B36：F54 真实界面定向关闭](qa/evidence/2026-10-21/browser-b36.json)：替换失败错误在活动确认层可见，人工原文保留；完整双端用例仍待完成。

- [QA B37：统一数据库双端路径阶段证据](qa/evidence/2026-10-21/browser-b37.json)：Web 发布/群消息/受控故障回退、B 权限与问卷、原生申请草稿仅转入；保留测试夹具失败与整条待测边界。

- [QA B38：原生群聊实际重试与跨端发送](qa/evidence/2026-10-21/browser-b38.json)：授权历史边界、同进程限流恢复、转入未发送检查点、键盘实际发送及 Web 接收；完整反向路径仍待执行。

- [QA B39：F47 新环境故障保全定向关闭](qa/evidence/2026-10-21/targeted-b39.json)：真实 PG/worker/IPC 故障回归证明新夹具关闭访问并保留证据；旧丢失数据库不可恢复，不提升旧旅程结果。

- [QA B40：反向原生发布与 F55/F56 外订声明缺陷](qa/evidence/2026-10-21/browser-b40.json)：区分实际机械流程通过与领域验收失败；保留原 Web 通过历史并重开声明用例。

- [QA B41：初始外订人数 F56 定向复验](qa/evidence/2026-10-21/browser-b41.json)：正常 Web 发布、申请、审批与重新声明通过；F55 原生复验仍待完成，声明用例保持 FAIL。

- [QA B42：原生外订声明 F55 实际复验](qa/evidence/2026-10-21/browser-b42.json)：未勾选阻止、完成声明、人数变化重新确认通过；结合 B41 关闭声明用例，保留全部修前失败。

- [QA B43：反向跨端审批、AI 群稿与独立离群](qa/evidence/2026-10-21/browser-b43.json)：同库实际推进至重新申请 Pending；记录原生测试时钟偏差与后台初始快照边界，完整旅程仍待补齐。

- [QA B61–B63：M3 午夜快照、饭局结束与双端饭后反馈切片](qa/evidence/2026-10-21/browser-b61-b63.json)：Web 申请人自报/私评分，原生主持人本人优先/评价/单方再约；整条旅程仍待测。[Codex→Claude 交接记录](qa/handoff-2026-10-22-claude.zh-CN.md)。

- [QA B64：Codex 恢复后 Web 申请人回评/单方隐私/互选/私信与并发处理](qa/evidence/2026-10-21/browser-b64.json)；[QA B65：跨端私信往返、撤回只读、拉黑拒绝再约及 F58/F59/F60](qa/evidence/2026-10-21/browser-b65.json)。

- [QA B66：J007 原生未出席问卷与同库后台下钻 CSV（J007 PASS）及 F61 整页导出失败](qa/evidence/2026-10-21/browser-b66.json)。

- [QA B67：J001/J002 同库双方向整条审计（两条 PASS）](qa/evidence/2026-10-21/audit-b67-j001-j002.zh-CN.md)。

- [QA B68：J008 双端审批 409、Web 编辑中 401 与 F62；rig 于约 20:46 退出](qa/evidence/2026-10-21/browser-b68.json)。

- [QA 剩余用例最小执行计划（2026-10-22）](qa/remaining-plan-2026-10-22.zh-CN.md)：J004/J005/J008/J009/J011 剩余断言、所需新 AI 调用与 Web 新前端复验接入建议。

- [QA B69：source B 同库恢复检查点与 F58/F59 原生实际复验关闭](qa/evidence/2026-10-21/browser-b69.json)。

- [QA B70：F60 Web 实际复验、J004 解除后不复活与第三方隐私（J004 PASS）](qa/evidence/2026-10-21/browser-b70.json)。

- [QA B71：F61 整页导出实际复验关闭](qa/evidence/2026-10-21/browser-b71.json)。

- [QA B72：两次经审推进与 F62 同标签页 401 实际复验关闭](qa/evidence/2026-10-21/browser-b72.json)。

- [QA B73：Codex 接手后的原生举报前置与冻结时钟限流证据（J011 未完成）](qa/evidence/2026-10-21/browser-b73.json)。

- [QA B74：原生收件箱准备复验与三封真实业务邮件运输范围](qa/evidence/2026-10-21/browser-b74.json)。
