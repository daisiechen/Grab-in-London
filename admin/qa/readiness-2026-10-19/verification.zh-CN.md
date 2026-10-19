# 后台研发准入候选验证

日期：2026-10-19。定义版本r1-v3；共享JSON版本r1-1。范围：后台需求、测量契约与可交互验收原型。不是生产上线结论，也不代替协调会话对22项整体准入的独立复核。本轮不提交、不推送，由协调会话统一原子提交。

## 本轮修正与证据

- F4：拒绝后不可同场重申；前轮未退出不可新开轮次；确认时点含host的有效席位不得超capacity。严格导入直接拒绝，不能仅凭不同applicationId通过。`tests/handoff.test.ts`覆盖非法重入、重叠、超员。
- F5：申请状态按所选snapshot.asOf计算。T−30分钟前仍待审，等于或晚于截止即过期；当前expired布尔和未来审核/退出不能泄漏到历史时点。列表、待审数、过期数、下钻及CSV共用applicationStateAt。`tests/r1-boundaries.test.ts`覆盖截止前/等号/后、未来提交/审核/退出、生效取消与缺取消时刻；A-59-0/60-0/61-0均已过期。
- F6：fixture补记录真实取消时刻；3场host提前取消归入检查前取消，不再报缺检查事实。缺取消时刻仍保持未知，不从当前cancelled推断历史。测试覆盖取消前/等号以及缺时刻。
- F2：低人数pending仅开饭前可作为待host决定；开饭时派生unresolvedAtStart，此后仅为历史观测，不提供迟来的待办或自动第二次取消。测试覆盖开饭前/等号/后。
- r1-1用户字段仅id/joinedAt，拒绝accountType及个人资料。分类由后台授权命令维护，导入保留已有分类、新用户regular。删除取消account-deleted映射other；文档与shared/README保持一致。
- R17导入等待异步成功与新页面文案后再断言；实际App pilotSeed→projectAnalytics→parseHandoff往返，空行为源显示未接入而非零使用。
- R1批准即席位确认，席位确认不等于实际出席；去掉预付/付款成功残留说明，浏览器断言验证现行语义。
- Logo与导航间距48px，主导航可达性与390px回归保留。没有增设空工作区、账号页或人工出席核实入口。

## 22项责任与关闭证据映射

下表“已落实”仅指后台负责部分；用户端实现、共享源定义和整体准入由原负责人及协调会话评审。

| 问题 | 后台负责部分与状态 | 证据/边界 |
|---|---|---|
| R-01 | 已落实首期分析范围，付款/代订/公开评价不进入R1 | 后台PRD§1；journey现行说明；用户端范围由原会话验收 |
| R-02 | 已落实checkpoint、人数与截止观测 | analytics checkpointOutcome/applicationStateAt；r1-boundaries；权威调度由用户端/服务实现 |
| R-03 | 已落实申请轮次、拒绝后不可重申及重叠拒绝 | handoff/r1-boundaries测试；申请记录与出席人次分开 |
| R-04 | 已落实订位人数检查与检查后低人数分组 | checkpoint/lowCount；关键安排锁定由用户端实现 |
| R-05 | 已落实个人退出资格、整场取消与多原因对账 | analytics/handoff；fixture取消时刻测试；通知服务未实现 |
| R-06 | 后台仅收去标识投影，私密字段拒绝 | handoff白名单测试；游客投影属用户端 |
| R-07 | 已规定稳定userId与创始人服务端白名单 | governance权限测试、R13浏览器；真实登录/OAuth属服务目标 |
| R-08 | 已落实本人最新自报优先、host补缺、差异保留 | analytics/r1-boundaries；无verified和人工核实入口 |
| R-09 | 分析仅收合资格整场反馈，不收公评/互选 | handoff拒绝私密字段；互选/私聊联动属用户端 |
| R-10 | 无聊天/单方互选数据进入后台 | handoff白名单；消息权限完整矩阵属用户端 |
| R-11 | 已落实最小个案回执、依据、版本与审计 | governance测试、R11浏览器；固定虚构队列，未连App举报服务 |
| R-12 | 后台提供最小个案回执，通知按现行主PRD矩阵衔接 | 无真实邮件/push；App通知服务及投递/重试由用户端与服务实现，不把页面回执当成通知送达 |
| R-13 | 已落实创始人门禁、账号分类理由/409和审计 | governance测试、R13浏览器；静态门禁不是生产鉴权 |
| R-14 | 已落实不可变快照、新ID、待重算与历史CSV复现 | governance测试、R14浏览器下载前后逐字节对账 |
| R-15 | 已落实startsAt+24h阶段及独立7天窗口 | r1-boundaries精确24h/26h/7天测试；字典同步 |
| R-16 | 已落实宽请求/未知/预算范围、会话身份关联与分类排除 | analytics/r1-boundaries，OR/AND筛选及恢复测试 |
| R-17 | 已落实严格共享JSON实际往返与导入界面 | handoff单测、R17浏览器；生产schema/API目标见measurement§6 |
| R-18 | 桌面Web及390px原型已覆盖异常/交互路径 | 17项浏览器场景；完整跨浏览器/读屏/iOS与网络服务验收待实施 |
| R-19 | 已统一当前后台PRD/measurement及历史说明 | 文档测试；旧交付截图保留历史身份，非现行规则 |
| R-20 | 后台仅接规范区域/语言/预算/时间投影 | handoff校验与映射；真实地点输入/目录由用户端验收 |
| R-21 | 已规定保留/撤回/删除传播及历史快照隐私例外 | measurement§7；90天/12个月暂定，生产清理与法律审定未实现 |
| R-22 | 已落实规范语言/预算区间与历史未知边界 | analytics/handoff单测；姓名/介绍输入长度由用户端验收 |

## 执行记录

- `pnpm --dir admin test`：42/42通过，含实际共享源往返与本轮4项边界回归。
- `pnpm --dir admin build`：TypeScript及Vite构建通过。
- `pnpm --dir admin test:e2e`：完整重跑17/17通过（45.5秒），桌面1440px及390px，使用本机Chrome。包括R13/14/11/17四项治理/快照/回执/导入场景。初轮16/17因旧文案断言失败，修正为现行R1批准即确认、席位不等于出席语义后全量通过，未删除断言。
- `python3 -m unittest discover -s tests -v`：39/39通过。初轮缺本报告链接，报告生成后重跑通过；协调会话新增2项准入矩阵测试，最终计数39。
- `app-handoff.json`来自当前shared/pilot.ts实际导出；`invalid-handoff.json`用于拒绝生产/私密字段路径。均为虚构数据，无真实用户信息。

## 冻结与剩余边界

本轮白名单：`admin/**`、`docs/product/admin/**`、`tests/test_admin.py`。不包含demo、shared、主PRD、索引或协调审查文件。共享文件用于只读往返测试，不由本会话修改。

原型仍是本地会话内事实/快照，不是生产身份授权、持久存储、SDK、消息/通知、小时作业、删除传播或部署。真实举报正文不进入此投影，个案队列不是跨端受理服务。旧快照不可变的承诺受明确隐私撤销例外约束；下载CSV不能远程抹除。完整生产可用性与22项全局关闭须另行验收。


### 最终文件白名单（按交付分组）

- 运行与设计：admin/package.json、admin/README.md、admin/DESIGN.md、admin/UX-CONTRACT.md。
- 实现：admin/src/App.tsx、analytics.ts、checks.ts、fixtures.ts、metrics.ts、styles.css；新增ControlPanels.tsx、governance.ts、handoff.ts、csv.ts。
- 验证：admin/tests/analytics.test.ts、browser-scenarios.mjs、dashboard.spec.ts、measurement-scenarios.mjs；新增csv.test.ts、governance.test.ts、handoff.test.ts、r1-boundaries.test.ts、readiness-scenarios.mjs。
- 需求：docs/product/admin/PRD.zh-CN.md、docs/product/admin/measurement-contract.zh-CN.md；仓库内容验证tests/test_admin.py。
- 证据：admin/qa/readiness-2026-10-19/中的17场景截图、共享虚构导入JSON、本报告与browser-results.json。

测试运行生成的dist、test-results不纳入提交。新增shared由用户端原会话拥有；后台测试对它有只读依赖，协调提交必须一起纳入正确版本。此候选冻结后不再自行写入，独立复核发现问题时再定向修复。
