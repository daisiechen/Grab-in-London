# P1.1 客户端实施进度（Claude Code）

执行：Claude Code，工作区 managed worktree `mvp-patch-p1/约饭App`，分支 `codex/mvp-patch-p1`。Codex协调并独立验收；本文件只记录客户端切片事实，不代替验收结论。真实provider/设备/外部App未测项不称PASS。

## 测试环境约定

所有命令经清空继承变量的包装执行：`env -i` 仅保留 HOME/USER/LANG、Node24与pnpm11.25.0 PATH、`TMPDIR=<专属fancy-p11-client临时根>/claude-tmp`、`FANCY_PG_BIN=<PG17 bin>`、`FANCY_PATCH_CLIENT=P1.1`。DB/API测试由testkit为本次运行新建临时PG17集群并销毁；不连接rig的合成PG、封存/后台库。未重启运行中的64176 rig，**运行中API仍为加载时版本，未加载本文切片代码**；runtime集成需Codex按rig流程重启后核证。

## 切片记录

### P02 冻结稿差异盘点 — 见[delta-map](delta-map.zh-CN.md)

只读Figma CURRENT 565:32377/581:*与代码对照。主要待改：PATCH-004组合反馈状态机、PATCH-001公开支持出口、PATCH-007分享全部、PATCH-008全部、资料/创建unknown回执核对；DST、AI替换确认、简介/申请长度等已符合不重写。

### P03 原意图回执契约（PATCH-004/006基础）— 提交 2e133da48695ca9520e0cf7c1078a483ebf8775d，待Codex验收

- 契约：`GET /v1/me/command-receipts/{operation}/{key}`（operationId `getCommandReceipt`，session，只读）。复用既有 `idempotency` 表(actor+operation+key)，**无新迁移**。
- 白名单：OperationDef新增 `receipt?: true`，仅允许 idempotencyKey 写；当前标记 updateMe、createMeal、editMeal、applyMeal、decideApplication、withdrawApplication、cancelMeal、leaveMeal、reportAttendance、rateExperience、reviewPerson、selectReconnect、revokeConnection、leaveGroup、block、unblock。后台可在自有 operations-admin.ts 对 classifyUser 等加 `receipt: true`（staff操作读取回执时重验role+MFA，已实现），然后重新生成契约；生成由客户端串行执行。
- 返回 CommandReceipt：state NONE/PENDING/SUCCEEDED/REJECTED；retryable、retryAfterSeconds、expired、httpStatus、errorCode、conflict(VERSION/IN_PROGRESS/PAYLOAD/STATE)、resourceId、resourceVersion、currentVersion、completedAt、expiresAt。**不返回请求/响应正文、他人选择或凭据**；按调用者actor查，他人key与未用key同为NONE；非白名单操作404。
- 语义：NONE≠确定失败，禁止换新key；**P03-R01修复（48df2cc）**：NONE可能是已purge的完成意图，仅当客户端持有意图签发时间且距今<29天（30天保留减时钟余量）才可原key原body重发，否则为unknown；PENDING租约有效→继续查询；租约丢失且未过期→retryable同key重发；**expires_at已过未purge**：expired=true、retryable恒false（claimIntent拒绝过期key，测试证明重发得IDEMPOTENCY_CONFLICT且回执不变），客户端结果为`expired`→读权威资源并由用户显式确认新意图。资源当前值相等不作为成功证据，只有SUCCEEDED或同key重放才清未决意图。
- 客户端：`packages/client/src/intents.ts` 提供 outcomeFromError / outcomeFromReceipt / reconcileIntent（saved/pending/unknown/resend/conflict/rejected/reauth/expired）。
- 文件：packages/contracts/src/{operation.ts,registry.ts,dto.ts,openapi.ts,operations/receipts.ts,operations/{meals,social,people}.ts,contracts.unit.test.ts}、packages/contracts/generated/openapi.json、packages/client/src/{generated/operations.ts,intents.ts,intents.unit.test.ts,index.ts}、apps/api/src/receipts/{routes.ts,receipts.api.test.ts}、apps/api/src/http/server.ts。
- 验证（均退出0）：`pnpm core:check`；`pnpm core:test:unit` 423/423；`pnpm core:test:api` 45文件222/222（含receipts 7项：SUCCEEDED无正文、VERSION冲突、跨actor NONE、PENDING租约有效/丢失、过期未purge、非白名单/格式/游客）。
- 遗留：UI接入随P04/P06切片；未在运行rig上验证。

### P03-R01 NONE重发需年龄证明 — 提交 48df2cc

packages/client/src/intents.ts、intents.unit.test.ts。Codex红例 infra/patch-client/receipt-recovery.api.test.ts 只读运行通过（未stage）。

### P06 饭后反馈组合保存（PATCH-004，AC-004a–d）— 本次提交，待Codex验收

- 共享纯模型 `packages/client/src/feedback.ts`：planFeedback（trim dirty、首次空=Skipped、已有公评不能空覆盖、取消WAITING为false写、OPEN取消→确认后revoke、窗口关闭仅revoke-only可保存/公评dirty进入串行先失败）；FeedbackRunner（串行先公评后再约/revoke、每项独立key+If-Match、失败/409/unknown暂停后项为Not saved yet、成功不回滚不重交、unknown保留原key+body经P03回执核对或同key重放、新草稿不并入原未决意图、按账号+meal+subject隔离、clear()代际栅栏）。
- **P06-R01**：clear()后迟到await不得重建scope/继续写——已以generation栅栏实现（与P06首次交付同一提交，因feedback.ts此前未提交）；Codex红例 infra/patch-client/feedback-late.unit.test.ts 只读运行通过（未stage）。
- 契约：postMealState.reviews新增作者本人最新`body`（仅作者可见，作为dirty权威快照）；API测试断言他人正文不返回。
- Web：`FeedbackSection.tsx`替换原“Save reference”+复选框即时保存；单一`Save feedback`/`Check status and continue`，逐项结果列表、部分结果、unknown/409/失败提示，OPEN撤回确认`Keep connection`零写；按账号内存保存草稿与未决意图（离开返回恢复、换账号清空）；独立`Withdraw connection`入口保留。
- iOS：`FeedbackBlock.tsx`每位同桌一块，同语义；窗口关闭后OPEN仍可撤回。
- 验证（退出0）：core:check；unit 439/439（含feedback 15、intents 5及Codex两红例中的unit）；web 300/300（post-meal 18）；iOS jest 382/382；api 223/223（含Codex receipt红例、post-meal本人body断言）。
- 遗留：真实浏览器/模拟器路径未跑（运行rig未加载新代码）；375–430与键盘焦点待UI验收。
