# ADMIN-0.1.0-DEV.2 独立研发方案评审

基线0dc558892402aa403bbee6306ef224953af7ea16与当前原作者候选；以下两项已由原作者修回并经独立复验关闭，限定为方案可实施。原作者不得自签，当前不启动代码/QA。

## R11-EA2-01

分类实际落点routes.ts；固定PUT If-Match与原意图重放，不能用当前分类猜旧意图成功。

证据：`apps/api/src/admin/routes.ts`、`apps/api/src/common/idempotency.ts`

## R11-EA2-02

subject输入覆盖与统计Pending/Failed/Retry缺现有持久证明/任务契约，需明确本版增量及旧读屏障。

证据：`apps/api/src/admin/snapshots.ts`、`packages/contracts/src/dto.ts`、`apps/worker/src/main.ts`、`apps/admin/src/features/classification/ClassificationPanel.tsx`

r11本版独立推进，不等整组；夹具与真实API/DB/跨版传播分别验收。实际writer、精确租约、契约增量和环境预检签发后才实施；PR通过必需CI与独立代码评审合main，部署绑定精确已测SHA/build/迁移/环境。既有修订/快照/审计不可回滚覆盖。

独立复验关闭R11-EA2-01/02：classify真实routes.ts及PUT/If-Match原意图重放正确；明确snapshotPending恒true/全局max/周期封存不能满足本版，持久统计任务、subject输入（含排除）证明及status/retry接口均标为新增未创建。服务端pages/drilldown/exports与客户端共同旧读屏障、同subject后续意图及异subject高revision反例、失败统计重试不classify均已入方案。

契约签发仍需固定accepted classify回执到taskId的可追溯关联、状态/重试DTO及actor/MFA授权、错误与幂等规则；迁移由唯一writer预约并使分类受理/任务入队事务一致，切勿实现为先响应成功再尽力入队。以上为实际小包开工前置，不把新增工作误称现成运行能力，不等待A1整版完成，只在真实消费接口处联调。无代码/QA授权。
