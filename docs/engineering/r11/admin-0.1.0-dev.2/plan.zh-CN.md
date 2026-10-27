# ADMIN-0.1.0-dev.2 独立开发方案（独立RD通过，保留签发闸）

本版已由总PJ通过公开/proto独立实点签收固定代表设计路径/状态及源视觉。本方案已单独通过独立RD的真实文件/契约/共享writer可实施性复核，保留后续签发闸；签收来自独立评审人，PJ-ADMIN未自行签发业务实现，不等待同组另两版或全7份设计。r10架构与现有operation registry继续有效，r10全设计总门槛已被r11版本工作流替代。

## 输入、范围与数据权威

只消费J11固定PRD/Demo与本版Figma；具体输入hash、设计入口和工作包见work-packages.json。PRD不由开发改写，设计可变文件需绑定独立复验的节点/读回hash；这不是Owner冻结。

服务端身份/权限、DB时钟、原意图幂等和对象revision为权威。精确HTTP/schema从packages/contracts/src/operations/operations-admin.ts等registry读同一候选生成，不在本文另造API。业务字段/错误映射有差异先提唯一契约writer，不让客户端猜。

## 逐包交付

### A21 subject分类与原意图状态

候选负责人角色RD-ANALYTICS；未分配具体writer，未签发。现有候选文件 `apps/api/src/admin/routes.ts`；签发前缩到最多3个生产文件及对应测试精确白名单，不授整目录。

classify输入actor/MFA、subjectId、expectedVersion、regular/test/staff、reason、intent；按subject接受revision。

本包验收：409核当前staff2/保test和原因，本人新INTENT-2提交才revision3；UNKNOWN先查原次。

### A22 统计更新与旧读取屏障

候选负责人角色RD-ANALYTICS；未分配具体writer，未签发。现有候选文件 `apps/api/src/admin/snapshots.ts`；签发前缩到最多3个生产文件及对应测试精确白名单，不授整目录。

accepted revision→封存输入覆盖→Ready；Pending/Failed禁止旧图表/明细/导出；失败仅retryStatistics。

本包验收：不比较全局最大revision；分类不回滚，不重复保存；本次subject输入未覆盖不能Ready。

### A23 同范围CSV与授权下载

候选负责人角色RD-EXPORT；未分配具体writer，未签发。现有候选文件 `apps/api/src/admin/exports.ts`；签发前缩到最多3个生产文件及对应测试精确白名单，不授整目录。

export ticket绑定snapshot/query/asOf/definitionVersion与聚合值；每次读取再验角色/隐私屏障。

本包验收：CSV与图表一致；撤销后旧票据拒读，生成票据不等下载成功，无法远程撤回磁盘。

### A24 分类恢复/统计/导出客户端

候选负责人角色RD-ADMIN；未分配具体writer，未签发。现有候选文件 `apps/admin/src/features/classification/ClassificationPanel.tsx`；签发前缩到最多3个生产文件及对应测试精确白名单，不授整目录。

分类选择原因保稿，冲突本人确认新意图，统计只重试不改分类；SnapshotPicker/ExportButton消费同合同。

本包验收：21:2329本人确认→21:2749统计未就绪；权限清理/CSV下载反馈与原视觉保持。

共享contracts/OpenAPI生成、DB schema/迁移编号、非生成SDK、导航/根配置分别由单writer持有；本组worker提交接口变更请求，不抢改共享文件。Admin1与Admin2若都需snapshots/metrics共享逻辑，由RD-ANALYTICS同一writer串行集成；Support通过公开事件/接口申请传播，不跨模块直接写数据。

## 顺序、并行与环境

先核本版接口与权限契约，再让互不重叠的客户端适配/业务纯规则并行；每小包必须交完整动作和恢复，不先做全库再做全API。真实依赖仅阻断对应集成：ADMIN-0.1.0-dev.1同查询快照读取接口；删除与支持修订屏障真实联调只阻断相关传播用例。独立模块可用明确合成fixture验证本端，不冒充真实联调。

环境只做最小预检：复用既有锁文件和项目Node、独立数据库名/角色/合成数据、唯一端口/PID/CWD、候选API schema兼容；不重启旧MVP或全局provider。无真实凭据则标记供应商用例未跑，继续本模块纯规则与合同测试。一次环境失败记录确切命令/错误/责任人，禁止无限搭建。

## 验证、分支与发布

本版定向用例见对应delivery/versions/admin-0.1.0-dev.2/test-plan.zh-CN.md。证据绑定候选SHA/build/接口/迁移/数据/环境；原型、mock、模块、真实服务分别记录。适用单版测试→受影响消费者回归→独立代码评审→必要CI→PR合并；通过后不无理由重跑全项目。

后续代码从核对的main建codex/admin-0.1.0-dev.2-<package>或隔离worktree；每包唯一writer与PR，禁止混入旧QA/研究工作区。只有共享契约兼容、设计本版签收、精确写租约和环境预检通过后，PJ才能在用户后续实施授权内签发代码。当前代码/QA/部署均未启动。

回退以精确候选SHA及可逆迁移为单位；快照/修订/审计历史不靠回滚覆盖。文档合并不触发业务部署；部署仅来自已测合并SHA/build及迁移环境记录，先满足角色/MFA/隐私和所需真实传播门槛，再走独立发布签收。Admin不产生空iOS商店更新，Support不扩建完整客服队列或导航。

## 本版设计签收与工程下一步

A2公开/proto实点：冲突新INTENT-2/expected2→revision3统计未Ready；取消保staff2；原次查询、仅重试统计、SYN-C2 revision2、同范围CSV路径。结论只覆盖固定代表设计路径，不是生产服务QA、Owner冻结或部署批准。独立复验证据由总PJ单独保存。

独立RD已核对方案并关闭问题；下一步逐包签发精确operation/schema增量、实际writer/文件租约、迁移与环境，未授权实现或真实QA。

## R11-EA2-01/02 原作者修订（待独立复验）

A21真实分类写在routes.ts：classifyUser PUT /admin/classifications/{userId UUID}，If-Match为当前subject revision，Idempotency-Key与body分类/reason(5..500)。Unknown复用原PUT相同actor/key/body/If-Match，由defineWrite查原意图重放；getClassification只加载当前事实，不证明旧意图成功，不新增虚构queryIntent。

现Classification.snapshotPending恒true、SnapshotInfo及sealSourceSnapshot只有全局classificationRevision，worker/main只是周期封存，均不足以完成设计。A22明确新增持久任务/subject封存输入覆盖证明，任务状态与统计重试是本版新增schema/API/worker/client工作，不宣称已有。新文件与未创建状态、共享DTO/operation、RD-DATA迁移编号申请、服务端pages/drilldown/exports旧读屏障和客户端消费者均列work-packages.json。排除的test/staff也记录subject输入证明；不能凭其他subject高revision或同subject后来另一意图的当前值猜旧意图已成功。

contracts/data先固定；RD-ANALYTICS同writer串行routes/snapshots/任务接入；RD-EXPORT在共同屏障合同后做下载；RD-ADMIN可并行固定夹具，真实联调只等所消费接口。每次签发仍拆为至多3个生产文件的小租约，不一次授所有共享文件。新增任务候选API为提案，非现存registry事实，独立RD确认后由契约writer实现。

新增回归：同subject再次更新、别subject高revision、原PUTUnknown重放、Pending/Failed客户端及API拒旧图旧导出、统计重试不再classify、排除subject仍有覆盖证明；现有admin/analytics/drilldown/exports/contracts测试路径已列。

## 最终独立工程签收

独立RD已逐项关闭本版工程问题，结论为plan-approved-with-issuance-gates；签收证据：docs/reviews/r11/admin2-engineering-review.json。仅方案可实施性通过，不是原作者自签、真实服务QA、代码授权或部署批准。原上文“待独立复验”保留为修订过程记录，本节及work-packages工程状态为最新签收。

尚未签发：

- RD-CONTRACTS fixes task handle linkage from accepted classify result and exact proposed status/retry DTO, auth/MFA/actor ownership, error and idempotency contracts before dependent leases
- RD-DATA reserves migration and transactionally binds accepted revision/task enqueue; seals per-subject included/excluded input proof
- Exact owners/file leases serialize shared routes/snapshot/barrier changes; no broad all-path lease
- Tests distinguish UNKNOWN original write, pending/failed task, superseded same-subject intent and another-subject high revision; real integration separate
- Required code review/CI/PR main merge and exact tested SHA/build before deployment
