# IOS-0.1.0-dev.4 开发方案候选

本版J07举报/跟踪与J08应用内删除/最小回执/未登录支持分别独立页面。PJ-IOS1已独立复验关闭R11-I34-02/03，仅签设计范围；因此本版立即进入方案，不等I2/I3/其他设计。实际研发owner/文件租约、环境预检和实施授权未签发，不写业务代码。

沿r10已盘点Expo/RN iOS＋模块化单体API＋PostgreSQL/Drizzle＋持久worker方向，不另造栈、不合并旧P1.1整分支。精确operationId/schema沿packages/contracts/src/operations/auth.ts、operations-admin.ts。候选小包、角色、候选路径、branch/PR/验收在work-packages.json；candidatePaths不是写入授权，开工前每包分配实际个人与≤5个生产/配套测试精确文件。contracts/迁移/根导航/生成SDK仍各唯一writer；J07与J08可并行，跨租约不抢写同一support/routes或全局入口。

举报私密投影由认证/支持case权威，客户端不拼内部调查材料。删除请求API在事务锁序内执行同步撤权屏障；服务端202表示受理，worker按持久步骤完成后才COMPLETED。私密receipt在设备先安全保存，status通过POST正文，不在URL/日志；外部支持页返回已知状态，不能用UI导航代替worker推进。受理后禁止回账号读写页；公开参考号不能授权读私密资料。

最小环境先复用现有依赖/隔离测试DB/现有iOS工具链，不让验证临场搭整套系统。15分钟或相同失败3次停止同路径重试并交环境owner；其余合同/纯组件继续。测试矩阵区分原型、fixture、真实API/DB、真机、跨版与发布build，每个NOT_RUN有真实证据才关闭，不把原生图连线当真实数据。

仅真实联调点依赖I1身份、I3群/联系、SUPPORT个案与ADMIN旧快照/导出撤权。尚无上游可用时使用有来源夹具核对本端合同，不声称整链完成；不阻断本版方案/局部实现准备。J07不扩客服后台，J08不扩通用隐私平台/交易/移动Web。

合并按r11：已核对main→codex/ios-0.1.0-dev4-小包短分支/隔离worktree→适用单版/影响回归＋独立代码审查＋必需CI→PR合main。部署来自精确合并SHA＋迁移/接口/已测build，失败停止部署或恢复先前兼容候选；删除受理不可回滚成有效账号，重试未完步骤。根PJ唯一串行Git索引/推送，本方案未操作Git。

本版build登记目标仍首发0.1.0，与四个iOS迭代及最小支持合并首发；每个迭代完成仍登记独立build，不能静默漏掉。当前build/mergeSHA/商店提交均null；不因方案文档合并触发部署或提审。后续接口/迁移/数据/环境版本和回退候选在实际PR及版本status绑定，不填写假值。

## 独立工程复核定向修订

R11-E4-01：复用路径是features/settings/ReportScreen.tsx。现createReport契约details为Text(1,1000)且API拒绝trim空串，与PRD可选相冲突，不能声称直接沿用全部schema。由RD-CONTRACTS唯一writer有意兼容修改可缺省/空details，并同步API归一化、生成OpenAPI/SDK与边界测试；不擅加新的最短字数。

R11-E4-02：丢响应尚无reportId时，复用defineWrite/common/idempotency.ts的同actor/operation/key/body原POST重放，处理30天保留、INTENT_IN_PROGRESS与IDEMPOTENCY_CONFLICT；不是不存在的GET /commands。reportStatus仅在取得真实reportId后读取。跨设备Your reports必须由服务端本人最小历史列表权威提供；现契约缺该列表，明确由共享writer新增兼容operation/path/schema，未签发前不能客户端缓存冒充真实历史。

R11-E4-03：删除复用applyDeletion、defineWrite、现成startReauth、Expo SecureStore串行收据与expected-token guard、StepwiseDeletionProvider。Auth0DeletionStep真实存在且按配置选用，不从零重写；Apple当前UnavailableDeletionStep不可冒称可用。供应商配置不全或retention policyApproved未批准不能COMPLETED。补旧失败不可盖新完成、丢/过期receipt、仅公开参考无权查询、缺配置与未批准retention的独立测试。
