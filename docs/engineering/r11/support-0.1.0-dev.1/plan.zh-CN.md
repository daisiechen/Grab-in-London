# SUPPORT-0.1.0-dev.1 独立开发方案（独立RD通过，保留签发闸）

本版已由总PJ通过公开/proto独立实点签收固定代表设计路径/状态及源视觉。本方案已单独通过独立RD的真实文件/契约/共享writer可实施性复核，保留后续签发闸；签收来自独立评审人，PJ-ADMIN未自行签发业务实现，不等待同组另两版或全7份设计。r10架构与现有operation registry继续有效，r10全设计总门槛已被r11版本工作流替代。

## 输入、范围与数据权威

只消费J09固定PRD/Demo与本版Figma；具体输入hash、设计入口和工作包见work-packages.json。PRD不由开发改写，设计可变文件需绑定独立复验的节点/读回hash；这不是Owner冻结。

服务端身份/权限、DB时钟、原意图幂等和对象revision为权威。精确HTTP/schema从packages/contracts/src/operations/operations-admin.ts等registry读同一候选生成，不在本文另造API。业务字段/错误映射有差异先提唯一契约writer，不让客户端猜。

## 逐包交付

### S1 本案事实读取与授权

候选负责人角色RD-SUPPORT；未分配具体writer，未签发。现有候选文件 `apps/api/src/support/routes.ts`；签发前缩到最多3个生产文件及对应测试精确白名单，不授整目录。

case facts：actor/MFA/caseId/subject/meal/原报告/当前revision/UTC窗口；返回最小投影。

本包验收：无授权不暴露事实；仅本案读取与窗口边界测试。

### S2 保原报告的支持追加

候选负责人角色RD-SUPPORT；未分配具体writer，未签发。现有候选文件 `apps/api/src/support/routes.ts`；签发前缩到最多3个生产文件及对应测试精确白名单，不授整目录。

appendCorrection：原意图key、subject expectedVersion、present/absent与必填reason；事务中重验权限/7天/名单/取消，追加审计而非覆盖报告。

本包验收：409加载本对象最新事实+保本地选择，新确认才新意图；UNKNOWN查询原次、重复不增修订。

### S3 本人可见回复与影响交接

候选负责人角色RD-SUPPORT；未分配具体writer，未签发。现有候选文件 `apps/api/src/support/routes.ts`；签发前缩到最多3个生产文件及对应测试精确白名单，不授整目录。

publicOutcome只投影本案可公开结论；通过PostMeal/Analytics公开接口传播新修订，不直接写他模块数据。

本包验收：仅回复无CORR；其他共同依据不误伤；撤回/拉黑不复活。

共享contracts/OpenAPI生成、DB schema/迁移编号、非生成SDK、导航/根配置分别由单writer持有；本组worker提交接口变更请求，不抢改共享文件。Admin1与Admin2若都需snapshots/metrics共享逻辑，由RD-ANALYTICS同一writer串行集成；Support通过公开事件/接口申请传播，不跨模块直接写数据。

## 顺序、并行与环境

先核本版接口与权限契约，再让互不重叠的客户端适配/业务纯规则并行；每小包必须交完整动作和恢复，不先做全库再做全API。真实依赖仅阻断对应集成：IOS-0.1.0-dev.1身份/MFA与授权合同；饭后名单/出席与再约公评、J07/J08个案/删除、Analytics快照需真实组合联调。独立模块可用明确合成fixture验证本端，不冒充真实联调。

环境只做最小预检：复用既有锁文件和项目Node、独立数据库名/角色/合成数据、唯一端口/PID/CWD、候选API schema兼容；不重启旧MVP或全局provider。无真实凭据则标记供应商用例未跑，继续本模块纯规则与合同测试。一次环境失败记录确切命令/错误/责任人，禁止无限搭建。

## 验证、分支与发布

本版定向用例见对应delivery/versions/support-0.1.0-dev.1/test-plan.zh-CN.md。证据绑定候选SHA/build/接口/迁移/数据/环境；原型、mock、模块、真实服务分别记录。适用单版测试→受影响消费者回归→独立代码评审→必要CI→PR合并；通过后不无理由重跑全项目。

后续代码从核对的main建codex/support-0.1.0-dev.1-<package>或隔离worktree；每包唯一writer与PR，禁止混入旧QA/研究工作区。只有共享契约兼容、设计本版签收、精确写租约和环境预检通过后，PJ才能在用户后续实施授权内签发代码。当前代码/QA/部署均未启动。

回退以精确候选SHA及可逆迁移为单位；快照/修订/审计历史不靠回滚覆盖。文档合并不触发业务部署；部署仅来自已测合并SHA/build及迁移环境记录，先满足角色/MFA/隐私和所需真实传播门槛，再走独立发布签收。Admin不产生空iOS商店更新，Support不扩建完整客服队列或导航。

## 本版设计签收与工程下一步

S1公开/proto实点：新CORR-2/expected2→revision3保原报告；取消保revision2；正常纠错影响回复与仅回复无CORR分支到结果。结论只覆盖固定代表设计路径，不是生产服务QA、Owner冻结或部署批准。独立复验证据由总PJ单独保存。

独立RD已核对方案并关闭问题；下一步逐包签发精确operation/schema增量、实际writer/文件租约、迁移与环境，未授权实现或真实QA。

## R11-ES1-01/02 原作者修订（待独立复验）

当前supportCase GET /support/cases/{caseId}只返基础SupportCase，没有纠错所需原self/host、开始名单、scheduledEndAt和subject attendanceVersion。新增受case grant/MFA保护的最小纠错事实DTO及读取operation作为本版增量，由RD-CONTRACTS唯一writer修改dto.ts/operations-admin.ts，RD-SUPPORT在routes.ts实现；提案字段与操作在work-packages.json，不从分析DTO拼权威或读取他案。

correctAttendance真实POST /support/cases/{caseId}/attendance-corrections正文mealId/subjectId/value/reason(5..500)/expectedVersion；expectedVersion是出席subject版本，不是case If-Match。resolveCase POST /support/cases/{caseId}/status才使用case If-Match，并保存status/publicOutcome/reason。两者分别来自facts DTO的attendanceVersion/caseVersion，Unknown各自按原POST actor/key/body及适用的原If-Match重放，不混版本猜成功。回复真实写在routes.ts，privacy.ts只是隐私策略。

交付载体选受限API+新增受限CLI（apps/api/src/support/cli.ts，尚未创建），不是全客服Web。Figma最小个案动作映射为CLI读取事实、确认/取消、纠错、原意图恢复、影响回执和本人回复；不将API三个包冒充交互产品完成。S4单独交CLI及对应单测，禁止输出凭据与无关隐私。

S1→S2→S3同routes.ts由唯一RD-SUPPORT writer串行，S3与I4/J07 routes共享写租约由根协调；契约生成、DB迁移仍单writer。传播复用recordAttendanceRevision/invalidateIneligiblePairs及Analytics封存，不重建另一出席写层。新CLI/DTO能力、新operation提案和not-created路径不靠假装现有文件通过测试。

现有support/support.api.test.ts、correction.api.test.ts、privacy.api.test.ts与contracts测试定向回归；新增事实授权、两版本故意不同、原POST重放、CLI本人确认/取消/保原因、reply-only无CORR、7天UTC和传播测试。工程方案仍待独立RD复验，未签实施。

## 最终独立工程签收

独立RD已逐项关闭本版工程问题，结论为plan-approved-with-issuance-gates；签收证据：docs/reviews/r11/support1-engineering-review.json。仅方案可实施性通过，不是原作者自签、真实服务QA、代码授权或部署批准。原上文“待独立复验”保留为修订过程记录，本节及work-packages工程状态为最新签收。

尚未签发：

- RD-CONTRACTS fixes exact new facts DTO/query/auth/schema; recheck case target/meal/subject grant and redaction each read/write
- Actual owner and exact leases; routes changes serialized with I4/J07
- Restricted CLI must use authenticated APIs and retain same original intent across transport uncertainty; permitted terminal facts differ from persisted logs, no token/unrelated private text in logs
- Run separate facts auth, two-version, original replay, exact UTC boundary, CLI confirm/cancel/reply-only and propagation tests; real API/native/integration evidence separate
- Independent code review/required CI/PR main merge before tested SHA/build deployment
