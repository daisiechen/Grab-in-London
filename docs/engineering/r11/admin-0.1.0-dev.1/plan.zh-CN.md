# ADMIN-0.1.0-dev.1 独立开发方案（独立RD通过，保留签发闸）

本版已由总PJ通过公开/proto独立实点签收固定代表设计路径/状态及源视觉。本方案已单独通过独立RD的真实文件/契约/共享writer可实施性复核，保留后续签发闸；签收来自独立评审人，PJ-ADMIN未自行签发业务实现，不等待同组另两版或全7份设计。r10架构与现有operation registry继续有效，r10全设计总门槛已被r11版本工作流替代。

## 输入、范围与数据权威

只消费J10固定PRD/Demo与本版Figma；具体输入hash、设计入口和工作包见work-packages.json。PRD不由开发改写，设计可变文件需绑定独立复验的节点/读回hash；这不是Owner冻结。

服务端身份/权限、DB时钟、原意图幂等和对象revision为权威。精确HTTP/schema从packages/contracts/src/operations/operations-admin.ts等registry读同一候选生成，不在本文另造API。业务字段/错误映射有差异先提唯一契约writer，不让客户端猜。

## 逐包交付

### A11 固定快照查询与指标权威

候选负责人角色RD-ANALYTICS；未分配具体writer，未签发。现有候选文件 `apps/api/src/admin/metrics.ts`；签发前缩到最多3个生产文件及对应测试精确白名单，不授整目录。

query/filter/snapshotId/asOf/definitionVersion统一输入；每周userId去重含host，14/30天成熟窗口及unknown/0分母分别表达。

本包验收：夹具含同周多场、host、缺报告、未成熟窗口；快照重放结果稳定。

### A12 脱敏来源与对象返回

候选负责人角色RD-ANALYTICS；未分配具体writer，未签发。现有候选文件 `apps/api/src/admin/drilldown.ts`；签发前缩到最多3个生产文件及对应测试精确白名单，不授整目录。

pages/drilldown只暴露许可伪名DTO；每层绑定原query与snapshot，不重新取latest偷换。

本包验收：M-062→U-002→M-062同查询；401/403/410清内容并拒旧快照。

### A13 原视觉查询/抽屉客户端

候选负责人角色RD-ADMIN；未分配具体writer，未签发。现有候选文件 `apps/admin/src/features/filters/FilterBar.tsx`；签发前缩到最多3个生产文件及对应测试精确白名单，不授整目录。

filter草稿/已应用状态分离；应用、取消、locale/URL与抽屉返回沿同query；复用admin源视觉。

本包验收：38:2745→42:3547→9:2→口径/来源；02恢复只读02，长表/焦点和必要宽度回归。

共享contracts/OpenAPI生成、DB schema/迁移编号、非生成SDK、导航/根配置分别由单writer持有；本组worker提交接口变更请求，不抢改共享文件。Admin1与Admin2若都需snapshots/metrics共享逻辑，由RD-ANALYTICS同一writer串行集成；Support通过公开事件/接口申请传播，不跨模块直接写数据。

## 顺序、并行与环境

先核本版接口与权限契约，再让互不重叠的客户端适配/业务纯规则并行；每小包必须交完整动作和恢复，不先做全库再做全API。真实依赖仅阻断对应集成：IOS-0.1.0-dev.1业务事件/身份与同意合同；分类/支持纠错/删除的真实快照撤销传播在相应模块实现后联调。独立模块可用明确合成fixture验证本端，不冒充真实联调。

环境只做最小预检：复用既有锁文件和项目Node、独立数据库名/角色/合成数据、唯一端口/PID/CWD、候选API schema兼容；不重启旧MVP或全局provider。无真实凭据则标记供应商用例未跑，继续本模块纯规则与合同测试。一次环境失败记录确切命令/错误/责任人，禁止无限搭建。

## 验证、分支与发布

本版定向用例见对应delivery/versions/admin-0.1.0-dev.1/test-plan.zh-CN.md。证据绑定候选SHA/build/接口/迁移/数据/环境；原型、mock、模块、真实服务分别记录。适用单版测试→受影响消费者回归→独立代码评审→必要CI→PR合并；通过后不无理由重跑全项目。

后续代码从核对的main建codex/admin-0.1.0-dev.1-<package>或隔离worktree；每包唯一writer与PR，禁止混入旧QA/研究工作区。只有共享契约兼容、设计本版签收、精确写租约和环境预检通过后，PJ才能在用户后续实施授权内签发代码。当前代码/QA/部署均未启动。

回退以精确候选SHA及可逆迁移为单位；快照/修订/审计历史不靠回滚覆盖。文档合并不触发业务部署；部署仅来自已测合并SHA/build及迁移环境记录，先满足角色/MFA/隐私和所需真实传播门槛，再走独立发布签收。Admin不产生空iOS商店更新，Support不扩建完整客服队列或导航。

## 本版设计签收与工程下一步

A1公开/proto实点：38:2745选28天→42:3547→9:2；取消留原查询；02→38:3328→X仍02；指标→M-062→U-002返回。结论只覆盖固定代表设计路径，不是生产服务QA、Owner冻结或部署批准。独立复验证据由总PJ单独保存。

独立RD已核对方案并关闭问题；下一步逐包签发精确operation/schema增量、实际writer/文件租约、迁移与环境，未授权实现或真实QA。

## R11-EA1-01 原作者定向修订（待独立复验）

|工作包|现有operation / HTTP|输入与权威|
|---|---|---|
|A11|listSnapshots GET /admin/snapshots；adminPage GET /admin/{page}|选择snapshotId UUID，传AdminFilters；snapshot.asOf、definitionVersion与filterHash来自服务端响应，不是客户端任填参数。|
|A12|adminDrilldown GET /admin/drilldowns/{metric}|snapshotId+原响应filterHash+同AdminFilters+DrilldownRowQuery+cursor/limit；mealId/userId用DTO真实UUID，M-062/U-002仅合成显示编号。|
|A13|复用上述读取操作|DetailDialog/DrilldownTable与FilterBar消费同一查询；不另造对象详情endpoint。|

A11/A12复用pages.ts/loadAdminSnapshot，RD-ANALYTICS同writer串行；A13可在固定schema/fixture后独立并行，API返回候选兼容后做真实联调。定向现有测试列于work-packages.json，包含admin/drilldown/analytics API、metrics与filters单测及contracts；补UUID/显示号分离、响应口径只读、query/filterHash/cursor错配拒绝与02不回01回归。原作者已修订，仍待独立RD复验，不自签工程通过。

## 最终独立工程签收

独立RD已逐项关闭本版工程问题，结论为plan-approved-with-issuance-gates；签收证据：docs/reviews/r11/admin1-engineering-review.json。仅方案可实施性通过，不是原作者自签、真实服务QA、代码授权或部署批准。原上文“待独立复验”保留为修订过程记录，本节及work-packages工程状态为最新签收。

尚未签发：

- Actual owner/exact file leases and shared writer serialization
- Bind independently signed design revision and contract candidate
- Minimum environment checks then isolated module tests; real upstream only gates concrete integration
- Independent code review and required CI/PR main merge before exact SHA/build deployment
