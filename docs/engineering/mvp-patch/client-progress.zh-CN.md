# P1.1 客户端实施进度（Claude Code）

执行：Claude Code，工作区 managed worktree `mvp-patch-p1/约饭App`，分支 `codex/mvp-patch-p1`。Codex协调并独立验收；本文件只记录客户端切片事实，不代替验收结论。真实provider/设备/外部App未测项不称PASS。

## 测试环境约定

所有命令经清空继承变量的包装执行：`env -i` 仅保留 HOME/USER/LANG、Node24与pnpm11.25.0 PATH、`TMPDIR=<专属fancy-p11-client临时根>/claude-tmp`、`FANCY_PG_BIN=<PG17 bin>`、`FANCY_PATCH_CLIENT=P1.1`。DB/API测试由testkit为本次运行新建临时PG17集群并销毁；不连接rig的合成PG、封存/后台库。未重启运行中的64176 rig，**运行中API仍为加载时版本，未加载本文切片代码**；runtime集成需Codex按rig流程重启后核证。

## 切片记录

### P03 原意图回执契约（PATCH-004/006基础）— 已提交，待Codex验收

- 契约：`GET /v1/me/command-receipts/{operation}/{key}`（operationId `getCommandReceipt`，session，只读）。复用既有 `idempotency` 表(actor+operation+key)，**无新迁移**。
- 白名单：OperationDef新增 `receipt?: true`，仅允许 idempotencyKey 写；当前标记 updateMe、createMeal、editMeal、applyMeal、decideApplication、withdrawApplication、cancelMeal、leaveMeal、reportAttendance、rateExperience、reviewPerson、selectReconnect、revokeConnection、leaveGroup、block、unblock。后台可在自有 operations-admin.ts 对 classifyUser 等加 `receipt: true`（staff操作读取回执时重验role+MFA，已实现），然后重新生成契约；生成由客户端串行执行。
- 返回 CommandReceipt：state NONE/PENDING/SUCCEEDED/REJECTED；retryable、retryAfterSeconds、expired、httpStatus、errorCode、conflict(VERSION/IN_PROGRESS/PAYLOAD/STATE)、resourceId、resourceVersion、currentVersion、completedAt、expiresAt。**不返回请求/响应正文、他人选择或凭据**；按调用者actor查，他人key与未用key同为NONE；非白名单操作404。
- 语义：NONE≠确定失败，仅允许原key+原body重发，禁止换新key；PENDING租约有效→继续查询；租约丢失且未过期→retryable同key重发；**expires_at已过未purge**：expired=true、retryable恒false（claimIntent拒绝过期key，测试证明重发得IDEMPOTENCY_CONFLICT且回执不变），客户端结果为`expired`→读权威资源并由用户显式确认新意图。资源当前值相等不作为成功证据，只有SUCCEEDED或同key重放才清未决意图。
- 客户端：`packages/client/src/intents.ts` 提供 outcomeFromError / outcomeFromReceipt / reconcileIntent（saved/pending/unknown/resend/conflict/rejected/reauth/expired）。
- 文件：packages/contracts/src/{operation.ts,registry.ts,dto.ts,openapi.ts,operations/receipts.ts,operations/{meals,social,people}.ts,contracts.unit.test.ts}、packages/contracts/generated/openapi.json、packages/client/src/{generated/operations.ts,intents.ts,intents.unit.test.ts,index.ts}、apps/api/src/receipts/{routes.ts,receipts.api.test.ts}、apps/api/src/http/server.ts。
- 验证（均退出0）：`pnpm core:check`；`pnpm core:test:unit` 423/423；`pnpm core:test:api` 45文件222/222（含receipts 7项：SUCCEEDED无正文、VERSION冲突、跨actor NONE、PENDING租约有效/丢失、过期未purge、非白名单/格式/游客）。
- 遗留：UI接入随P04/P06切片；未在运行rig上验证。
