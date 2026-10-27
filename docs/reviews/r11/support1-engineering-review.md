# SUPPORT-0.1.0-DEV.1 独立研发方案评审

基线0dc558892402aa403bbee6306ef224953af7ea16与当前原作者候选；以下两项已由原作者修回并经独立复验关闭，限定为方案可实施。原作者不得自签，当前不启动代码/QA。

## R11-ES1-01

SupportCase缺纠错所需最小事实；明确case授权保护的DTO增量、correctAttendance正文expectedVersion与resolveCase case If-Match分开。

证据：`packages/contracts/src/dto.ts`、`packages/contracts/src/operations/operations-admin.ts`、`apps/api/src/support/routes.ts`、`apps/api/src/post-meal/attendance.ts`

## R11-ES1-02

回复写入真实落点routes.ts非privacy.ts；无现成Support UI，明确受限CLI/API交付载体及新增候选路径和共享writer，不把API包冒充Figma完整交互。

证据：`apps/api/src/support/routes.ts`、`apps/api/src/support/privacy.ts`、`docs/product/journeys/j09/requirements.zh-CN.md`

r11本版独立推进，不等整组；夹具与真实API/DB/跨版传播分别验收。实际writer、精确租约、契约增量和环境预检签发后才实施；PR通过必需CI与独立代码评审合main，部署绑定精确已测SHA/build/迁移/环境。既有修订/快照/审计不可回滚覆盖。

独立复验关闭R11-ES1-01/02：受限事实DTO/新GET操作明确新增未实施；correctAttendance正文attendance expectedVersion和resolveCase case If-Match分开，Unknown沿原POST重放。回复落点routes.ts，S4新增受限CLI明确not-created，不冒充现有Web UI。原报告保留，复用recordAttendanceRevision/invalidateIneligiblePairs/sealSourceSnapshot；同routes writer串行并协调I4/J07租约。

签发前固定最小事实契约/授权/隐私映射和CLI实际精确文件租约。CLI可对获授权操作者显示必要事实，但不得在持久日志打印凭据或无关隐私；终端展示与日志证据应区分。UTC七天边界、两版本错配、原意图恢复、reply-only无CORR与传播需真实用例验收。当前没有启动代码或QA，不等其他整版，只在真实接口依赖处联调。
