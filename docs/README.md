# 项目文档索引

项目入口：[README](../README.md)。本目录保存项目知识；Agent 协作规则见 [AGENTS.md](../AGENTS.md)，正式方法在 `.agents/skills/`，待审核候选在 `.agents/candidates/`，不作为现行执行规则。

## 产品与需求

| 文档 | 用途与权威关系 |
| --- | --- |
| [主 PRD](product/PRD.zh-CN.md) | 当前恢复版0.4的需求真源，目标为2026-10-18 01:03:45快照 |
| [产品简介](product/product-brief.md) | 产品定位与摘要；详细规则以主 PRD 为准 |
| [首期运营指标与采集契约](product/admin/measurement-contract.zh-CN.md) | 后台全部指标算法、App采集入口与生产数据接入验收 |
| [管理端 PRD](product/admin/PRD.zh-CN.md) | 管理端范围及指标；引用主 PRD，不替代共享业务规则 |
| [R1 研发契约与模拟交接](../shared/README.md) | 对象、命令、权限、时间、幂等和脱敏JSON；明确真实服务依赖 |

## 调研与商业模式

- [竞品调研](research/competitive-landscape.zh-CN.md)与[证据附录](research/competitor-evidence.zh-CN.md)：结论、来源及证据边界。
- [商业模式评估](business/business-assessment.zh-CN.md)、[模型输入](business/model-inputs.json)与[验证记录](business/verification.zh-CN.md)：假设、测算、收入及验证，不代表真实经营结果。

## 设计与模块说明

- [品牌方向](design/brand-direction.zh-CN.md)：品牌与入口体验方向；当前品牌及需求以主 PRD 为准。
- 用户端：[模块说明](../demo/README.md)、[设计规范](../demo/DESIGN.md)、[交互契约](../demo/UX-CONTRACT.md)、[组件说明](../demo/src/mobile/COMPONENTS.md)。
- 管理端：[模块说明](../admin/README.md)、[设计规范](../admin/DESIGN.md)、[交互契约](../admin/UX-CONTRACT.md)。模块说明就近维护，不另建副本。

## 发布与验收

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
