# P1.1 客户端实施进度

执行：原由 Claude Code 实施；2026-10-23 用户明确授权“Claude会话到限额了，你接手后面的开发吧”后，由 Codex 接手客户端与移动 Web 实施。后台仍由独立会话负责。工作区 managed worktree `mvp-patch-p1/约饭App`，分支 `codex/mvp-patch-p1`。历史切片保留原作者与验证记录；接手后由 Codex 实施并以明确范围的回归核证，本文件只记录客户端切片事实，不代替验收结论。真实provider/设备/外部App未测项不称PASS。

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

### 后台P09源码串行集成 — 3dafd6a/a361ada/5ae5197/9d3cf0e/f775ee7，生成 9b3a7d0，worker b683eb0

cherry-pick -x后台 63b088e、f3b0e0b、ea5a2e2、2d7647f、b111c4c（未pick 08912e1）。contracts.unit.test.ts两处冲突均保留双方operation清单（getCommandReceipt + getStatisticsRefresh/findStatisticsRefreshByIntent/retryStatisticsRefresh）。统一生成单独提交9b3a7d0。worker按admin-progress片段每tick处理pending refresh（有pending封存一次并同tick READY，无pending不额外封存），runtime db测试3/3。验证：core:check 0；unit 441；api 238；db 153。运行rig仍未加载0026/新路由。

### P06-R02 账号内存真正清理 — 本次提交

- 双端`discard()`：账号替换或`resetFeedbackMemory()`时调用旧runner.clear()（代际栅栏）、清drafts与listeners并置alive=false；执行器每次尝试（含withRetry内部重试）先检查alive。
- Web：`lib/drafts.ts`的`clearAllPrivateState`增加内存清理注册（`onPrivateStateClear`），所有sign-out/401/账号切换/删除路径已统一调用；FeedbackSection在模块加载时注册。iOS：FeedbackBlock把reset注册到`services.onSessionEnd`（session onClear触发）。
- 同会话离开返回仍恢复草稿；会话结束后同账号重登录不恢复。
- 测试：Codex红例 apps/web/src/test/p11-feedback-clear.unit.test.tsx 只读运行通过（未stage）；新增Web“teardown后为空/同会话返回保留”、iOS“onSessionEnd后在途公评不继续再约”。core:check 0；unit 441；web 303；iOS 383。

### P04 资料与删除恢复（PATCH-001，AC-001/a/b）＋P04-R01 — 提交 0dc3bca，待Codex验收

- 公开支持出口：`packages/client/src/support.ts`（xcheniepaut26@gmail.com，mailto仅subject，无receipt/token/正文）。Web `features/settings/SupportExit.tsx`接入DeletionPage：NEEDS_SUPPORT、回执410/404、未登录且本机无回执时显示；`Copy email address`仅clipboard真实成功才`Copied.`，失败提示手动选中；“打开邮件不等于已发送”。iOS `features/settings/SupportExit.tsx`接入DeletionStatusScreen：selectable地址＋Linking打开邮件，无邮件App时提示手动复制。iOS无剪贴板模块（未新增依赖），复制以系统文本选择实现——如需按钮复制需批准新增expo-clipboard（见遗留）。
- 资料保存：`IntentTracker`（packages/client/src/intents.ts）——unknown/pending/reauth保留原key+body，未决时不同草稿被拒并提示先核对；`Check status`读P03回执：SUCCEEDED刷新Me不再写，NONE（年龄内）原key重发，冲突/过期加载最新并保留编辑，rejected说明不接受。Web ProfileEditPage、iOS ProfileSaver（Edit/Setup两屏）接入。409仍加载最新版本并保留表单编辑。
- **P04-R01**：IntentTracker加epoch栅栏（reset后旧run失败/成功、旧receipt均不改新状态）＋in-flight去重（同fingerprint连点加入同一请求，不产生第二key；不同草稿拒绝）。真实生命周期：Web页面卸载（含session epoch重挂载：sign-out/401/账号切换/删除）reset；iOS两屏注册services.onSessionEnd并在卸载reset；调用方按generation丢弃旧响应，不更新新账号session/表单/导航。Codex红例 infra/patch-client/intent-tracker-late.unit.test.ts 只读运行2/2通过（未stage）。创建页（P05）尚未接入tracker，将在P05切片同样接入。
- 验证（退出0）：core:check；unit 451；web 307（一次全量运行出现1项偶发失败，随后两次全量307/307，未复现，待观察）；iOS 387。
- 遗留：iOS按钮式复制需新增依赖决定；真实邮件收件/支持处理不在本地验证范围。

### P05 发布未知结果与回执（PATCH-003）— 本次提交，待Codex验收

- Web CreatePage、iOS Create Review改用IntentTracker：网络/5xx后为`Status unknown`并保留草稿与原key；`Check status`读createMeal回执，SUCCEEDED用回执`resourceId`进入该meal详情并清草稿，不再写；NONE（年龄内）同key重发；未决时不同草稿被拒。卸载/会话结束reset（Web页面卸载，iOS onSessionEnd＋卸载），旧结果不导航。tracker新增`lastReceipt`。
- DST/不存在时间/批准后锁定等既有逻辑未改（delta-map判定已符合）；BST/GMT选择仍为422确定拒绝后形成新意图。
- 验证（退出0）：core:check；unit 451；web 308；iOS 388。
- 遗留：editMeal仍用原Intent（同key重试、409加载最新），未接回执核对；发现/申请迟到结果与Places状态逐节点核对待后续切片。

### P04-R02 接手后的资料恢复竞态修复

- iOS ProfileSaver.conflict 将原 generation 贯穿 getMe，迟到成功或失败均不更新已重置会话。
- Web 在状态回执之后的 getMe、保存后的 refresh、冲突 reload 及重试入口复核 generation；离开会话不提示成功或跳转。状态查询捕获会话失效异常，防止未处理 rejection，仍保留同会话未知结果的编辑。
- 精确红例转绿：iOS 409→getMe 在途→reset→响应，session.updateUser 为 0；Web 真实 SessionProvider.clearLocal 后放行 receipt-confirmed getMe，仍停留 /sign-in 且无成功提示。Web 8/8、iOS 纯逻辑 1/1，双端及独立严格类型检查通过；未据此称 P04 全面验收完成。

### P07-R01 群聊只读后的旧消息发送边界

- 精确组件红例：iOS 网络失败后退群仍显示 Retry；Web 发送进入 retry 退避等待后退群，放行等待仍发送 4 次（应仅 1 次）。两者均先复现后修复。
- iOS 将发送入口与重试同时受当前发送权限约束；退群、解散、403 同步关闭发送围栏。失败正文仍保留，可删除；权限撤回不再丢正文。
- Web 每次 withRetry 尝试前检查历史只读与组件存活状态，终止退群或卸载后排队的尝试，保留未发送文本。已有授权历史读取、聊天已读/通知已读独立行为保持。
- 验证范围：iOS chat/dissolve/poller，Web inbox 全目录及精确迟到重试回归；名册/候选/mute 的新增界面仍随 P17，不能据此称 P07/P17 整体关闭。
