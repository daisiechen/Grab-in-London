# Fancy 项目文档导读

整理日期：2026-10-29。本文用于找文档、分清现行依据和历史记录，不另立需求或进度真源。完整文件清单见[文档索引](README.md)；具体状态始终核对所链接文件的日期、适用版本和证据。

## 1. 先读哪几份

| 想了解什么 | 首选入口 | 阅读重点 |
| --- | --- | --- |
| 产品是什么、首发做什么 | [需求基线](product/fancy-requirements-baseline.zh-CN.md) | 用户目标、首发范围及边界 |
| 业务规则如何定义 | [主PRD](product/PRD.zh-CN.md)、[补丁PRD](product/mvp-patch-PRD.zh-CN.md) | 规则、有效增量、权限和验收；旧模拟交易不代表首期能力 |
| 用户如何完成任务 | [15个旅程](product/journey-modules.zh-CN.md)、[版本映射](product/module-version-plan-2026-10-26.zh-CN.md) | 首发J01—J11；J12—J15后续 |
| 当前分版推进到哪里 | [r11进度总览](delivery/version-progress-r11.zh-CN.md)、[执行登记](delivery/execution-r11.json) | 设计、工程方案、实现、QA与发布分别查看 |
| 最近改了什么、原型在哪 | [r12的21条反馈台账](reviews/r12/feedback-21-register.md)、[需求增量](product/r12/ios-feedback-requirements-2026-10-28.zh-CN.md) | 直接原型入口、验证证据和未实现契约 |
| 旧系统做过什么、还欠什么 | [旧MVP封存](delivery/mvp-freeze-2026-10-23.zh-CN.md)、[2026-10-26跨分支快照](delivery/project-status-2026-10-26.zh-CN.md) | 既有实现、补丁进度和真实发布门槛；不是新版本完工声明 |

## 2. 哪些文件说了算

文档不是简单按日期覆盖：先区分问题属于需求、设计、实现还是验收，再看相应范围的有效输入。

- **需求**：主PRD、后台PRD及明确批准的增量定义业务规则；旅程文件组织完整操作路径。r12局部增量仅覆盖其声明范围，未冲突部分沿原规则。
- **设计**：当前分版交接与固定候选是对应版本的设计输入；r12受影响页面另看本轮交接和复核。未获接受的UX-r01视觉保留历史，不作为开发依据。
- **派工与进度**：r10定义版本范围；r11工作流和执行登记定义按版推进方式；具体阶段查各版status.json及关联评审。旧文档中的“等待全部七份设计”已由r11按版推进取代。
- **实现**：查对应分支、固定提交和工作包证据。main上的方案、Demo或原型不代表真实服务已经实现。
- **验收与发布**：查具体测试记录、构建、环境和批准范围。设计点击通过、静态检查通过、业务QA通过和生产发布是不同结论。

共享规则及文件负责人见[协作说明](agent-collaboration.md)。PRD与Demo由原产出会话维护；本轮只整理导航，不重写其规则或候选。

## 3. 当前七个内部开发版本

范围来自[r10版本方案](delivery/development-versions-r10.zh-CN.md)，进展汇总见[r11总览](delivery/version-progress-r11.zh-CN.md)。下表只列入口，不复制易过期的完成状态。

| 版本 | 用户目标 | 状态入口 | 开发方案 |
| --- | --- | --- | --- |
| IOS-0.1.0-dev.1 | J01发现与申请、J05资料与偏好 | [状态](delivery/versions/ios-0.1.0-dev.1/status.json) | [方案](engineering/r11/ios-0.1.0-dev.1/plan.zh-CN.md) |
| IOS-0.1.0-dev.2 | J02发起饭局与处理申请 | [状态](delivery/versions/ios-0.1.0-dev.2/status.json) | [方案](engineering/r11/ios-0.1.0-dev.2/plan.zh-CN.md) |
| IOS-0.1.0-dev.3 | J03沟通、J04饭后联系、J06问卷 | [状态](delivery/versions/ios-0.1.0-dev.3/status.json) | [方案](engineering/r11/ios-0.1.0-dev.3/plan.zh-CN.md) |
| IOS-0.1.0-dev.4 | J07举报、J08账号删除 | [状态](delivery/versions/ios-0.1.0-dev.4/status.json) | [方案](engineering/r11/ios-0.1.0-dev.4/plan.zh-CN.md) |
| SUPPORT-0.1.0-dev.1 | J09授权个案支持与纠错 | [状态](delivery/versions/support-0.1.0-dev.1/status.json) | [方案](engineering/r11/support-0.1.0-dev.1/plan.zh-CN.md) |
| ADMIN-0.1.0-dev.1 | J10业务概览、来源与下钻 | [状态](delivery/versions/admin-0.1.0-dev.1/status.json) | [方案](engineering/r11/admin-0.1.0-dev.1/plan.zh-CN.md) |
| ADMIN-0.1.0-dev.2 | J11分类、统计快照与导出 | [状态](delivery/versions/admin-0.1.0-dev.2/status.json) | [方案](engineering/r11/admin-0.1.0-dev.2/plan.zh-CN.md) |

`dev.N`是内部迭代，不是已上线版本。各版设计和方案可独立推进；首发集合及跨版验收仍按[r11发布工作流](delivery/parallel-version-workflow-r11.zh-CN.md)执行。

## 4. 最近一轮应如何理解

截至2026-10-28的[r12台账](reviews/r12/feedback-21-register.md)记录21条反馈已独立接受：其中10条含实际鼠标/滚轮流程验证，其余是视觉项。这是固定原型范围的结论，不是新版本真实服务QA通过。

本轮需求增量明确App首发English-only、人数范围呈现和可选预设拒绝原因。拒绝原因对应DTO/API、存储及通知增量仍是待实现项，I2写入和I1读取需补相应工程输入；不影响其他无关工作包独立推进。细节以[需求增量](product/r12/ios-feedback-requirements-2026-10-28.zh-CN.md)及[dev.2状态交接](design/r12/ios-0.1.0-dev.2/state-contracts.zh-CN.md)为准。

r11总览记载本轮新版本业务实现与真实QA尚未启动；旧MVP及P1.1补丁另有实现和测试历史。因此不能把“新版本未实现”理解为整个仓库从未有代码，也不能拿旧QA结果覆盖新方案。

## 5. 文档放在哪里

| 目录或入口 | 内容与用途 |
| --- | --- |
| `docs/product/` | 需求真源、旅程、版本映射及范围增量；`modules/`和`batches/`中的旧切片须先看索引适用说明 |
| `docs/design/` | 设计规范、交接、状态合同和固定产物；当前分版以r10及r11修复、r12增量关联证据阅读 |
| `docs/engineering/` | 架构、接口、数据合同、分版工程方案及历史补丁任务 |
| `docs/delivery/` | 项目管理、版本派工、状态、迁移、集成及发布安排 |
| `docs/reviews/` | 独立评审、问题关闭、复测和历史快照；不是默认可覆盖PRD的需求正文 |
| `docs/qa/` | 用例、缺陷、执行记录及证据；先固定测试版本与环境，再引用结果 |
| `docs/research/`、`docs/business/` | 竞品与市场证据、商业假设及测算；不代表真实经营业绩 |
| `docs/policies/` | 隐私、社区规则与审核清单；草稿状态不等于已生效 |
| [用户端模块说明](../demo/README.md)、[后台模块说明](../admin/README.md) | Demo启动、局部设计及交互说明，留在模块旁维护 |
| [运行交付入口](../infra/README.md)、[历史执行任务](../tasks/todo.md) | 已有实现的运行和执行记录，不替代新七版状态登记 |
| `.agents/skills/`、`.agents/candidates/` | 正式通用方法和待审核草稿；项目业务规则仍留在项目文档 |

## 6. 本次梳理发现的阅读风险

| 发现 | 本轮处理或后续责任 |
| --- | --- |
| 根README还用r07/r08标题概括后续r10—r12工作 | 更新根入口，按范围、分版执行、反馈增量分别导航 |
| 文档索引开头混合多个阶段，后面又夹有旧QA逐轮日志 | 增加本导读和快速定位；保留完整历史索引与证据链接 |
| r10正文有旧全套等待条件，但其顶部及r11已说明替代关系 | 在导读注明有效工作流；保留冻结方案正文，避免破坏签署和哈希 |
| 旧MVP、P1.1补丁和新七版在同一仓库留下不同阶段记录 | 分开入口，不合并成一个“完成率”；跨分支状态以固定快照及原任务负责人更新为准 |
| 原型、Demo、代码CI和真实验收容易混用 | 明确四类证据边界；后续状态维护继续关联精确版本与原报告 |

本次不移动文件、不删除旧文档，不修改PRD、Demo、冻结清单或各版status.json。既有相对链接、历史验收编号和证据路径保留。
