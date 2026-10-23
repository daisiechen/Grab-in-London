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

### P05-R01 Web 修改餐局未知结果恢复

- EditMealPage 以 mealId 键控子组件及 IntentTracker 代替旧 Intent；网络未知后保留草稿、原 body/version/key，显示 Check status，阻止另建意图。
- SUCCEEDED 只清缓存并返回详情，零次额外 editMeal；NONE 在保留期内仅原 key/body/version 重发，即使表单随后已编辑。冲突/拒绝/过期重新读取权威安排并保留草稿；首批准后的永久锁仍优先。卸载重置并拒绝迟到更新。
- 精确缺失入口红例转绿；create/edit 共 20/20 通过（含原 DST、首次发布、永久锁用例），Web 类型与 ESLint 通过。iOS 当前没有 editMeal 调用，尚需按冻结范围核对其入口；发现/申请和最终 UI 验收仍待推进。

### 后台共享固定增量接入

后台明确交回 02338fd 与 844e532，客户端串行 cherry-pick 为 f840cb0 / ee02370：统计 Ready 绑定最新有效快照、明细默认实际日期倒序。无契约生成或 worker 变动，未取后台 UI/环境。专属临时数据库下 API 8/8、排序 unit 4/4 通过，已同步远程。

### P11 分享公开投影基础（尚未完成双端分享）

packages/client/share.ts 只从显式公开输入构造 HTTPS canonical meal URL、London 时间/offset、区域、状态与 View meal 文本，WhatsApp 仅生成 wa.me 预填链接；不序列化整个 DTO。严格拒绝带凭据/路径/query/hash 的 origin、非 UUID ID、非公开 runtime 状态；入站链接仅接受配置 origin 下的单一 meal 详情，拒绝外部/申请子路由/私密 query。11 项单元测试、client 类型与 ESLint 通过。双端菜单、剪贴板、Universal Link/AASA/OG 与真实渠道验收仍待后续，未部署正式域名。

### P11/P12 双端分享菜单（局部交付，原生设备/外部渠道未验收）

- Web/iOS 详情接入可访问名称 Share meal；沿用现有 Sheet/按钮/tokens，菜单含 More sharing options、WhatsApp、Copy link for WeChat、Copy link、Copy invitation text 和可选中文本。配置必须显式提供 HTTPS origin，无生产默认、不回退当前私密 URL。Web 为 VITE_PUBLIC_MEAL_ORIGIN，iOS 为 EXPO_PUBLIC_MEAL_ORIGIN。
- Web 分享取消（AbortError）不称成功；不支持时仅因用户点击执行复制。剪贴板成功后才显示 Copied，失败保持链接/邀请文本。iOS 引入当前本地 Expo SDK 兼容表指定的官方 expo-clipboard 58.0.3；setStringAsync false/异常均走手动选择。原生 Share resolve/dismiss 不作收件证明。全部异步菜单反馈在关闭/卸载后拒绝迟到更新。
- Web Sheet 新增可选 onCloseAutoFocus，无默认行为改变；Share 使用该回调恢复触发按钮焦点。小屏 sheet-body 原有滚动承载完整文本及关闭按钮。
- 验证：共享投影 unit 11；Web 菜单 4，分享/meal 23；Web 稳定源码全量 316/316；iOS 分享 2，全量 392/392，仍输出已有 act(...) 警告（profile/postmeal/VirtualizedList），未掩盖。最终布局修改后相关 Web 23/23 及 core:check 均退出 0。首次 Web 全量在提示文案修改过程中出现旧组件/新断言混合输入，随后停止编辑并完整重跑 316/316；保留首次失败事实，不称其为产品通过。
- 真实 IAB：独立合成餐局、API 固定 854029b，Web 本轮待提交菜单；375/390/393/430 四档 document scrollWidth=viewportWidth，截图核对，375 的关闭按钮可通过 Tab 自动滚入可视区；Escape 返回 Share meal 焦点。控制台 error/warn 为空。复制按钮真实显示 Copied，但自动化 clipboard.readText 与预期公开链接比较为 false（不输出未知剪贴板内容），因此**只确认 UI/API resolve，未独立确认真实剪贴板内容**。WhatsApp/微信未打开外部应用，原生分享未安装设备验收。
- 浏览器发现时间带秒时 API 返回 BST offset59；根会话尝试新增 API 测试被自动审批以用户限定客户端/Web范围拒绝，未绕过。交后台 owner 修复为04f1cd2，串行接入854029b，固定6项时间单测通过；仅受控停止自己已核 PID/CWD 的 API/worker，保留旧PG并建立新合成库、再次seed，真实菜单重验得到 BST60 和 Ended/View meal。
- 参考：[Web Share](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share)、[React Native Share](https://reactnative.dev/docs/share)、[Expo Clipboard](https://docs.expo.dev/versions/latest/sdk/clipboard/)。Universal Link/AASA/OG、登录回流和外部真实渠道仍待 P11/P12 后续，完整补丁仍未完成。新增原生依赖要求重新 prebuild/pods/build，旧 P04 build-only 证据不能覆盖。

服务端后续归属：按用户“这里仅客户端和移动Web”边界，P13–P16 服务端拟交后台会话；该会话正在向用户确认在 PATCH006 后承接，尚未获得其确认，不并发写 migration0027+/生成/worker。客户端可继续纯UI及现有接口切片。

### P04 公开支持邮箱的原生复制按钮

分享切片已引入 expo-clipboard 后，补齐 SupportExit 的 Copy email address；只复制公开 SUPPORT_EMAIL，不含 receipt/token/用户描述。false/异常保留 selectable 地址并提示失败，真实成功才 Copied。设置模块 29/29、iOS 类型与 ESLint 通过。原生设备剪贴板验收仍待新构建，历史“需批准新增依赖”遗留已由用户授权接手后的常规实现选择取代。

### P08 AI 转入绑定点击时的编辑器实例

- Web 精确红例：validateAIDraft 在途，关闭助手并重新挂载同 kind/target/version0 的原编辑器；旧结果仍调用 apply 1 次（应0）。修复为点击时捕获 generation/scene/editor 实例，前置会话校验之后及服务端校验之后均复核，不只比较相同字段值。
- iOS 精确红例：transfer 的第一次 ensureResumed await 期间用相同 key/target/version 替换编辑器，原实现选择新编辑器并成功；现于 await 前捕获实例/current版本/contextOwner，两个 await 后都复核，EDITOR_CONFLICT 且 validate 写0。
- Web AI 目录43/43、iOS manager/widget46/46；双端类型与 ESLint 通过。已有 Keep my text（QA-AI-016）、Replace/长度/过期/换账号等回归保留；这些是 mock transport 证据，不是模型/真实provider或完整 F66/F68 发布门槛关闭。

### P11 原生公开链接入口与关联域名配置

- 新增 Expo +native-intent 的冷/热启动入口，仅把显式配置 HTTPS origin 下的 /meals/UUID 改写为详情页；外域、http、申请子路由、query/hash、protocol-relative、空白标准化和畸形URL拒绝到可读的 Meal link unavailable 页面，不发申请/写操作。非HTTP现有 OAuth 回调保留原路径/state，仍由既有 PKCE/状态逻辑验证。
- patch-p11 native-config 仅在显式 EXPO_PUBLIC_MEAL_ORIGIN 时添加该单一 applinks hostname，禁止 credentials/path/query/hash/port；默认封存配置不变。未填写 Apple Team ID、未生成或部署 AASA、未更改 DNS/证书。
- 原生链接与已有 OAuth 回归 33/33，关联配置+分享纯逻辑 19/19，iOS 类型与 ESLint 通过。仍须新原生构建、模拟器冷/热跳转与真实 HTTPS 双向关联验收；单元检查不等于 Universal Link 打通。参考 [Expo native-intent](https://docs.expo.dev/router/advanced/native-intent/) 与 [Universal Links](https://docs.expo.dev/linking/ios-universal-links/)。

### P05 发布内部重试在401后必须停止

真实 SessionProvider 路径红例：createMeal 首次网络失败进入退避，另一个 getMe 返回401结束会话，再放行等待，原实现仍发送共4次（应1）。现每次 withRetry attempt 前验证 tracker generation，会话清理/卸载后不再发送旧发布请求，迟到结果也不导航。create/edit 21/21、Web 类型与 ESLint 通过。此检查不扩大服务端写范围。

### P05 申请页作用域与迟到保稿

- 两项精确红例：真实401结束会话后，等待中的申请重试仍发送4次；同一餐局离开并重新打开后，新草稿被旧成功响应清除。现申请/撤回/退席每次尝试和await后检查组件scope，卸载或账号内存清理同步失效。
- 仅等React卸载仍有一次额外重试窗口，故接入既有onPrivateStateClear同步注册，并给注册API增加unsubscribe返回值以避免每次挂载累积监听。保持原触发401的登录回流：WebApi已将旧账号响应转换STATE_CONFLICT，只有原有效401进入gate.handle；未丢失原账号隔离的过期草稿恢复。
- 首轮同步围栏修复导致原401回流2项失败（未导航登录），保留记录；恢复合法401处理后apply+expired-draft+真实feedback clear共15/15通过，Web类型与ESLint通过。旧响应不再删除新草稿，登录后仍须用户主动提交。

### 2026-10-23 服务端范围明确授权与后台报告交接

人类用户在本会话明确选择“交给现有后台会话继续（推荐）”，授权原“开发-后台P1.1”会话在PATCH006后承接群提及/跨端静音/推送所需服务端API、存储和worker。根会话仍只实施客户端/移动Web，停止并行写服务端、0027+及共享契约/生成物；待后台逐文件和单一生成writer确认后继续契约交接。真实provider、DNS/AASA正式部署、生产发布未获授权。

后台PATCH006报告aa8a4c6已交回并整合为374e703；README尾部索引冲突保留双方内容，从同一固定tree补齐报告依赖的3份交接/进度文档和4张合成响应式截图。首次因缺引用文档/截图导致文档验证失败，补齐后3/3通过。tasks仅P09/P10标PASS_ADMIN_LOCAL_SCOPE，具体范围及A01–A13见报告，不扩大为客户端、服务端新增功能或整体发布通过。

### 封存QA探针哈希恢复

全量Python首次93/94通过，失败为QA probe changed after run：P08新增实例回归先前写入了既有qa-independent-session探针，改变了封存清单哈希。已从本轮修改前的52764b2恢复该文件原始字节，并把新增回归独立放p11-transfer-instance.unit.test.tsx；未改QA执行清单/旧探针hash/202-4-11结论。恢复后完整Python94/94、原探针3+新回归1=4/4通过，ESLint通过。此为测试文件隔离纠正，不回退P08业务修复。

### P04/P05 会话清理的同步重试围栏

将发布重试红例加强为同一个React act内先完成401再释放退避，复现仅靠卸载清理仍多发一次（2次，应1）。创建、编辑餐局和资料编辑现订阅onPrivateStateClear，在会话失效当刻同步reset tracker并清除旧请求快照；卸载同时解除监听。创建页仍保留原有效401的登录gate回流。create/edit、profile、迟到profile和申请/过期草稿合计43/43通过，Web类型及四个修改文件ESLint通过。此切片未改服务端或封存QA探针，未代表P04/P05整体验收完成。

### 当前客户端全量自测切片

业务源码a9cfcf7786bcc62fae0df053f5abd0aa2c8e945e：Web54文件320/320（专属P1.1回放时钟2026-10-23T16:00Z，单worker）；iOS57套406/406（原入口maxWorkers=2）。前次真实时钟/高并发失败及复查过程记录isolation.zh-CN.md，不隐藏失败或放宽断言。新增回放配置的类型、lint和补丁文档验证通过。新消息服务端尚未交回可集成提交，原生UI受Mac锁屏阻挡，后续P13–17和最终跨端验收仍未完成。
