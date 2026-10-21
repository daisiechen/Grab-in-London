# 项目文档索引

项目入口：[README](../README.md)。本目录保存项目知识；Agent 协作规则见 [AGENTS.md](../AGENTS.md)，正式方法在 `.agents/skills/`，待审核候选在 `.agents/candidates/`，不作为现行执行规则。

## 产品与需求

| 文档 | 用途与权威关系 |
| --- | --- |
| [主 PRD](product/PRD.zh-CN.md) | 当前v0.8需求真源；§0为已确认首期规格，沿用星期日恢复版界面 |
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
- [DeepSeek 人民币预算实施决策](engineering/decisions/ai-cny-budget.md)：按用户决定使用人民币最小整数单位计账，月上限50元；真实价格及凭据缺失时关闭模型调用。
- [共同审查记录](engineering/collaborative-review.zh-CN.md)：精确版本、双方意见、关闭情况及适用边界；[哈希清单](engineering/review-manifest.json)固定10份认可文件。
- [Claude执行入口](../tasks/plan.md)与[唯一任务表](../tasks/todo.md)：43个切片，已获用户授权启动实施，实际状态及验证证据以任务表为准。
- [MVP实施协调与资源准备](../tasks/mvp-coordination.md)：三端开发文件分工、DeepSeek人民币50元/月预算、首尔服务器只读核查、外部门槛及自测后测试会话交接条件。
- [MVP运行与交付](../infra/README.md)：本机临时联调、API/worker入口、CI、首尔目录隔离及待授权的真实部署/恢复边界。

## 发布与验收

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
