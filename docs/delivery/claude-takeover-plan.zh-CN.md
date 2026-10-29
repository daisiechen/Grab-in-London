# Claude Code 接手开发计划

日期：2026-10-27（Europe/London）｜负责人：Claude Code｜状态：执行中

## 1. 背景与用户决定

此前由 Codex 实现的 iOS 客户端与已认可的 MVP Demo 视觉和交互对不上，重画 Figma 未获通过，测试长期卡在环境问题。用户决定由 Claude Code 接手主开发，并确认以下四项：

| 决定项 | 结论 |
| --- | --- |
| 开发路线 | 保留现有 Expo / React Native 工程骨架、`packages/contracts`、`packages/client` 与 API 等可用部分；iOS 界面逐屏对照 Demo 重做 |
| 业务口径 | 视觉与交互沿用 `demo/`；业务规则以[主 PRD](../product/PRD.zh-CN.md) r07 与 [MVP 需求](../product/fancy-requirements-baseline.zh-CN.md)为准：不做平台押金、支付、退款和代订位，host 在平台外订位、参加者到店各付 |
| 后端范围 | 第一阶段先用本地模拟数据把 iOS 首发旅程做到与 Demo 一致、可完整点通，第二阶段再接 API 与数据库 |
| 协作规则 | Claude Code 负责 `apps/`、`packages/` 及相关测试与研发文档；Codex 停止并行修改代码；`demo/` 只读 |

## 2. 环境基线

- 项目要求 Node 24 与 pnpm 11.25.0。容器默认的 Node 22 不满足 `engines`，这是此前测试环境反复失败的原因之一。改用 Node 24 后，`pnpm install --frozen-lockfile` 可以直接完成。
- 接手时基线（提交 `ecfb54e`）：`pnpm --filter @fancy/ios test` 54 个套件、379 项通过；`pnpm core:test:unit` 43 个文件、405 项通过。
- 云端容器无法运行 Xcode 和 iOS 模拟器。验证方式是：组件与流程测试（jest + Testing Library），再加上通过 react-native-web 在浏览器渲染 iOS 界面，用 Playwright 截图与 Demo 同一路径的截图逐屏对照。真机与模拟器的最终确认需要用户在 Mac 上执行 `expo run:ios`。

## 3. 范围与顺序

首发 iOS 旅程按依赖顺序交付，每条旅程完成后单独提交并推送：

| 顺序 | 旅程 | Demo 对照路径 |
| --- | --- | --- |
| 0 | 基础：设计令牌、字体、通用组件、底部导航、模拟数据层、Web 预览与截图对照工具 | 入口页、底部导航 |
| 1 | J01 找到并申请饭局 | 发现（地图/列表、筛选）→ 详情 → 成员主页 → 申请 → 申请状态 |
| 2 | J02 发起饭局并管理招募 | 发起饭局 → 发布 → 管理申请（批准/拒绝）→ 订位声明 |
| 3 | J03 赴约前沟通或调整参与 | 我的饭局 → 群聊 → 群设置、退席/取消 |
| 4 | J04 饭后反馈与继续联系 | 过往饭局 → 留下反馈 → 互选 → 私聊 |
| 5 | J05 个人资料与隐私 | 个人页 → 编辑资料 → 设置 |
| 6 | J06—J08 意见、举报、删除账号 | 问卷、举报、注销流程 |

J09（支持）、J10/J11（后台）在 iOS 首发旅程完成后另行安排；J12—J15 为后续版本。

## 4. 每屏验收口径

1. 布局、文案、颜色、字号、间距与 Demo 同一状态截图一致；Demo 中的押金、支付、退款、代订位元素按 PRD r07 替换为预计人均预算与 host 订位声明。
2. 主路径与异常路径可在模拟数据下完整点通，不出现死路。
3. 有对应的组件或流程测试；`pnpm --filter @fancy/ios test`、`typecheck` 与 `pnpm core:test:unit` 全部通过后才提交。
4. 截图对照证据保存在 `docs/reviews/claude/` 下，按旅程分目录。

## 5. 进度记录

| 日期 | 内容 | 提交 |
| --- | --- | --- |
| 2026-10-28 | Web 端恢复设计（用户要求，仅设计不写生产代码）：完成 [Meetup 移动 Web 调研](../design/web/meetup-reference.zh-CN.md)（会话无法直接访问 meetup.com，现为公开资料检索，亲测待补）、[Web 端设计规范](../design/web/mobile-web-design.zh-CN.md)与单文件可点击原型（移动优先，含首页与平板/桌面布局，域名 fancyabite.uk）。推荐 Web 先做“公开分享 + 参加主线”（W1+W2），发起与饭后反馈留在 App；Web 范围、PRD §0.1 表述、已登录首页、主页收录等 8 项待用户决定（规范 §2.3）；`apps/web` 代码未改 | 见 Git 历史 |
| 2026-10-29 | 管理后台（上架 App Store 所需，用户 2026-10-28 决定扩大后台范围，见 §8）：迁移 `0027_moderation`；契约新增 `listModerationReports`、`claimModerationReport`、`getModerationReport`、`getModerationPhoto`、`moderateReport`、`supportCaseAttendance` 与错误码 `ACCOUNT_SUSPENDED`，`getPublicProfile` 改为可选登录；举报自动处理（举报人立即看不到、重复举报自动限制、自动回执、30天自动关闭、每日摘要邮件）；后台新增员工登录页、举报队列与详情、J09 出席纠错与回复；五个分析页对真实 API（种子数据）逐页走通并修复定义版本显示“vv4”；客户端请求/响应类型改为按操作分配，避免操作增多后超出 TypeScript 联合类型上限 | 见 Git 历史 |
| 2026-10-28 | 头像改为成员上传本人照片（用户决定，见 §6）：迁移 `0026_avatar_images`；契约新增 `uploadAvatar`（PUT /me/avatar）、`removeAvatar`（DELETE /me/avatar）、`getAvatar`（GET /avatars/{avatarId}），`Me.avatarUrl` 取代 `Me.avatarRef`，`updateMe` 不再接受 `avatarRef`；iOS 设置资料与编辑资料改为“上传/更换/移除照片”，样例头像三选一及 Web 静态样例图移除；新增原生模块 expo-image-picker、expo-image-manipulator（需在 Mac 上重新构建开发版）；`e2e:real-api` 资料步骤增加真实上传 | 见 Git 历史 |
| 2026-10-27 | 接手：环境基线确认，协作规则更新，本计划建立 | 见 Git 历史 |
| 2026-10-28 | 后端阶段起步：App 首次对真实 API 端到端跑通（`pnpm --filter @fancy/ios e2e:real-api`，18 步：发现→登录→申请→host 批准→座位/群聊→发起与编辑饭局→屏蔽/举报/问卷/通知），修复 3 个 App 问题、2 个 API 问题并让假 API 与真实 API 对齐（`e2e:parity` 可逐项比对）；收件箱按最近活动排序；样例头像三选一（设置与编辑资料）并由 API 发布头像地址 | 见 Git 历史 |
| 2026-10-28 | 整体验收复查与修复：模拟器逐页按自查清单检查（无 P0/P1），发起饭局改为分组卡片与紧凑人数加减器，通知页重做，统一页面标题与文字链接样式，编辑饭局、取消规则页、收件箱头像、屏蔽名单上线 | 见 Git 历史 |
| 2026-10-28 | 第五轮（模拟器复测问题）：Meals 回到标签页自动刷新、Applications 只列未获座的申请、申请状态页审核中每 15 秒刷新；表单页键盘偏移改为实测（iOS 27 导航栏半透明），底部按钮不再盖住输入框；选中标签不再变宽、日历加星期表头；发起饭局各展开面板自动滚入视野、预算占位与即时校验、确认勾选移入底部栏；host 页显示 London time；举报/问卷/删除账号按钮跟随内容、删除为红色、设置信息行去箭头、饭后反馈点选即存 | 见 Git 历史 |
| 2026-10-28 | 第四轮（用户授权自主推进）：申请页、申请状态、登录流程、资料补全、Meals、Inbox、群聊、饭后反馈、个人页、编辑资料、设置、问卷、举报、删除账号、发起饭局、host 管理全部按规范重做；契约新增 `Meal.members`；云端环境装好 PostgreSQL 17，数据库 152/152、API 214/215（唯一失败为需 pg_dump 的恢复演练） | 见 Git 历史 |
| 2026-10-28 | 三轮真机评审修改：版面留白（含根因：全局提示区多出一整条状态栏高度）、筛选就地下拉、卡片点击与照片尺寸、详情页重排、Ask Fancy 下线、发现页两张卡片 | 见 Git 历史 |
| 2026-10-27 | 基础与 J01 前半：网页预览、内存假 API（Demo 种子数据，验证码 000000）、Demo 图标与字体、底部导航、小助手入口；发现页（插画地图 + 片区数字标记 + 卡片翻页 + 列表）、饭局详情、成员主页按 Demo 重做 | 见 Git 历史 |

## 6. 已做的实现决定

- 发现页地图：配置了 `EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY` 的开发版使用 Google Maps 原生地图（配色贴近 Demo 插画，片区数字标记一致）；没有 Key、Expo Go 或网页预览时退回 Demo 的伦敦插画地图，不再出现“Map unavailable”。真机运行见 `apps/ios/README.md` 的 `pnpm ios:preview`。
- 可选分析授权从全局顶部横幅改为登录后一次性底部弹窗，并可在设置页修改；未选择前不采集。
- Ask Fancy（AI 助手）：用户 2026-10-28 决定本版不上线，入口不显示（`apps/ios/src/config.ts` 的 `ASSISTANT_ENABLED=false`），代码和测试保留供后续版本启用。
- 版面密度（用户第 1、2 轮真机评审）：详情页和成员主页不用系统导航栏，内容从安全区顶端开始，左上角为悬浮返回按钮；详情页去掉大图、关键信息压成 2×2 信息格、主操作固定在底部；发现页筛选改为就地下拉。
- 发现页地图固定为屏幕高度的约 26%（最低 190pt），下方为可滚动的紧凑卡片列表：先列选中片区，再以“More nearby”列其他片区。
- 验收方式：界面改动先由本机会话在 iOS 模拟器截图并测量，再请用户查看；网页预览的安全区为 0，不能代替真机检查顶部和底部留白。验收截图只保存在本机，不进公开仓库（2026-10-28 决定：图片体积大、用户无需在仓库查看），结论写入本文件。
- 预览模式：网页构建默认开启；真机通过 `EXPO_PUBLIC_FANCY_PREVIEW=1` 开启，不连服务器、不写钥匙串。
- 头像（用户 2026-10-28 决定，**偏离主 PRD r07 “只用样例头像、不收真实照片”**）：成员可上传本人照片；不上传则显示姓名首字母；界面不再提供三张样例头像。不做预审核，有问题由其他成员通过现有举报流程反馈。实现要点：
  - 存储：先放现有 PostgreSQL（`avatar_images` 表：id、所属成员、`content_type` 固定 `image/jpeg`、bytes、宽高、sha256、创建时间；每人最多一张，`profiles.avatar_image_id` 指向当前照片且必须属于本人）。读写集中在 `apps/api/src/profiles/avatar.ts`，以后迁到对象存储只改这一处，公开地址不变。
  - 接口：`PUT /v1/me/avatar`（JSON `{imageBase64}`，解码后不超过 2 MiB；需要 `Idempotency-Key` 与 `If-Match` 资料版本，成功返回新的 `Me`）；`DELETE /v1/me/avatar`（同样的版本规则，没有照片时不改版本）；`GET /v1/avatars/{id}`（公开，`image/jpeg`，`Cache-Control: public, max-age=3600`、`ETag`（sha256）与 304）。公开地址为 `<API 公开来源>/v1/avatars/<id>`，每次上传换新 id；更换、移除或删号后旧地址立即 404。冻结的接口文档不改，三个操作登记在契约测试的新增操作清单中。
  - 服务端处理：按文件头识别，只收 JPEG/PNG（HEIC、WebP、GIF 等明确拒绝并提示改用 JPEG/PNG）；解码前先读尺寸，每边 32–4096 px 且不超过约 1,680 万像素；用纯 JavaScript 编解码库（jpeg-js、pngjs，无原生依赖）解码后重新编码为 JPEG（质量 85，长边超过 1024 px 时缩小，透明部分铺白），所以 EXIF/GPS 等 APPn 段、注释、ICC 与 PNG 文本块一律不会保存；不读取 EXIF 方向（iOS 端已输出正向图片）。上传每人每小时最多 20 次，另受通用写入限流。
  - 删除：更换或移除时旧图同事务删除；删号在接受删除的同一事务里删除照片（不等后台清理任务），后台清理任务再删一次兜底。
  - iOS：从相册选图（系统方形裁剪），在设备上居中裁成正方形、缩到 512 px、JPEG 质量 0.8（同时去掉 EXIF）后上传；照片单独即时保存，不依赖表单的保存按钮；移除需要二次确认；显示上传中状态与就地错误（格式不支持、过大、离线）。远程照片一律从 App 当前连接的 API 加载（开发环境可为 http）。权限文案：“Fancy uses your photo library so you can choose a profile photo.”／“Fancy uses your camera so you can take a profile photo.”（目前只用相册，不申请麦克风）。

- 上线部署（2026-10-29 用户决定）：正式 API 与 PostgreSQL 部署在既有腾讯云首尔服务器（见 [首尔开发环境迁移](seoul-development-migration-2026-10-25.zh-CN.md)），域名 fancyabite.uk 由 Cloudflare 管理；数据存储在韩国，隐私通知需写明跨境存储（依据英国对韩国的数据充分性认定）。邮件沿用 Resend（mail.fancyabite.uk），登录沿用 Auth0 UK 租户，支持邮箱为本机 `.env` 中的 SUPPORT_EMAIL（不进公开仓库）。
- 举报处理（2026-10-29 用户决定）：运营者为一人，不做人工客服排班；以自动处理为主（多人举报自动隐藏、自动回执、每日邮件摘要、后台一键处置），保留可撤销与审计。
- 移动 Web（2026-10-29 用户补充）：以 Meetup 为参考重启设计，需包含公开首页并认真设计电脑端布局。

## 7. 待补的接口缺口

| 缺口 | 影响 | 计划 |
| --- | --- | --- |
| ~~公开 `Meal` 只有 host~~ | 已解决（2026-10-28）：`Meal.members` 为当前持座成员公开资料，host 在首位 | API、假 API、iOS 已同步 |
| `PublicProfile` 没有生活状态 | 成员主页缺 Demo 的“Making London home”标签 | 结合 J05 隐私选择决定是否公开 |
| ~~`Me` 没有头像~~ | 已解决（2026-10-28）：先为样例三选一，同日按用户决定改为本人上传照片，`Me.avatarUrl` 直接给出当前照片地址；公开评价仍读本人公开资料 | — |
| 头像偏离 PRD r07 | 主 PRD r07 规定只用样例头像；用户 2026-10-28 决定改为上传本人照片（见 §6），PRD 正文未改 | PRD 下次修订时同步此决定；首发前确认隐私说明中写明照片的用途、公开范围与删除方式 |
| ~~`MyMealItem` 没有 `conversationId`~~ | 已解决（2026-10-28）：与 `getMeal` 同规则返回可读群聊 | API、假 API、iOS 已同步 |
| ~~收件箱按会话创建时间排序~~ | 已解决（2026-10-28）：会话按本人可见的最近活动（加入、消息、离开）排序，申请按创建时间 | API、假 API 已同步 |
| 收件箱会话没有对方/host 头像 | 会话行只能显示图标 | 在契约中补头像字段 |
| ~~没有“编辑饭局”页面~~ | 已解决（2026-10-28）：复用发起流程的编辑模式，只提交改动字段 | iOS 已上线 |
| ~~没有屏蔽名单接口~~ | 已解决（2026-10-28）：新增 `listBlocks`（GET /blocks，本人当前屏蔽的 ACTIVE 成员，新到旧分页，不暴露对方选择）；冻结的接口文档不改，登记在契约测试的新增操作清单 | 撤回连接仍只在饭后反馈页操作 |
| ~~收件箱会话没有头像~~ | 已解决（2026-10-28）：`Conversation.avatar` | API、假 API、iOS 已同步 |
| ~~伦敦片区边界数据未接入~~ | 已接入（2026-10-28，用户授权由开发方选定来源）：ONS LSOA 2021 边界（OGL v3.0）加下议院图书馆 MSOA 名称（Open Parliament Licence），覆盖市中心 9 个区共 232 个片区，West End 细分出 soho、fitzrovia、covent-garden、st-jamess、mayfair；范围外仍为 unknown。QA-F24 的外部关口改为“数据已接入，来源待确认”，详见[伦敦片区边界数据](../engineering/london-areas.zh-CN.md) | App 内需加来源说明（建议放在设置页的关于／法律信息），待用户确认位置 |
| ~~host 取消饭局时自己也收到通知~~ | 已解决（2026-10-28，用户决定）：取消通知与邮件只发给其他成员；系统因人数不足自动取消时仍通知 host | API、假 API 已同步 |

## 8. 管理后台与举报处理（用户 2026-10-28 决定）

### 8.1 决定与范围

- 背景：App Store 审核指南 1.2 要求含用户生成内容的 App 提供举报、屏蔽，并由开发者及时处理举报（移除违规内容、清退滥用用户）且公布联系方式。App 内已有举报（成员/饭局/消息）与屏蔽，缺后台处理。
- 范围扩展：原[后台PRD](../product/admin/PRD.zh-CN.md)只建五个分析模块、明确不做客服/内容安全；用户 2026-10-28 要求补齐举报处理与 J09 支持个案，视为已批准的范围扩展。后台PRD正文是冻结快照，未改，以本节为准。
- 用户是独立创始人，不希望手工逐条处理，要求“近乎零操作、全部可撤回、全部留审计”（同日补充）。下列自动规则即按此设计。
- 角色：沿用现有 `support` 角色（与 J09 支持 CLI 相同），没有新增 `moderator`；所有员工接口要求服务端角色 + 身份提供方的 MFA。查看举报详情或处理前需“领取”，领取即写入与 J09 相同的个案授权（`support_case_grants`），并记审计。
- 不做：通用客服工单、批量处理、员工管理页。
- 举报原因（2026-10-29 Owner 决定，替代原单一 `private_concern`）：`safety` 人身安全或威胁、`harassment` 骚扰或仇恨、`scam` 诈骗/垃圾信息/广告、`under_18` 可能未满 18 岁、`other` 其他；iOS 举报页（成员/饭局/消息）必选其一。`safety`、`harassment`、`under_18` 为紧急。旧数据与旧客户端（含 Web 举报面板）的 `private_concern` 仍被接受，后台显示为“其他”。

### 8.2 自动规则（服务端实际执行的内容）

| 规则 | 实现 |
| --- | --- |
| 举报后对举报人立即隐藏 | 被举报的消息对举报人显示为“[Message unavailable]”；被举报的饭局不再出现在其发现页；被举报成员的简介与头像对其隐藏，该成员主持的饭局也不再出现在其发现页。依据就是 `reports` 表，无需额外操作；员工“恢复”不会撤销举报人自己的隐藏。原有屏蔽流程不变 |
| 重复举报自动限制 | 同一对象 7 天内有 ≥N 个不同举报人（`MODERATION_AUTO_HIDE_REPORTERS`，默认 2，范围 1–20）时：消息对所有人隐藏正文；饭局从发现页隐藏、非成员打开详情返回 404、不再接受新申请（不取消）；成员资料的简介与头像对他人隐藏。仅设时间戳遮盖，原文不改，可恢复。相关未关闭个案标记“已自动限制，待复核”，写入 `moderation_actions`（系统）与审计 |
| 自动回执 | 举报人在 `reportStatus` 的公开结果立即看到：已自动限制时 “Thanks — we’ve received this and limited the content while we review.”，否则 “Thanks — we’ve received your report and will review it.” |
| 30 天自动关闭 | 没有任何员工处理（无员工动作、无 `resolveCase`、无出席纠错）的个案在创建 30 天后由 worker 关闭，自动限制保留；举报人看到 “…The content stays limited and this report is now closed.” 或 “…This report is now closed.”；在“已关闭”列表与处理记录中保留 |
| 紧急提醒（2026-10-29） | 紧急原因的新举报在同一事务内写入 outbox（`moderation_alerts` + outbox 行）：`SUPPORT_EMAIL` 邮件（模板 `moderation_urgent`，只含后台链接）和 Ethan 推送（`kind: "urgent"`）。10 分钟内最多一条，期间的紧急举报由 worker 每分钟检查、窗口结束后合并成一条并带累计数量；每个个案最多提醒一次（`support_cases.urgent_alert_id`）。两个目的地都未配置时不排队 |
| Ethan 推送（2026-10-29） | 配置 `ETHAN_MODERATION_URL` + `ETHAN_MODERATION_TOKEN` 后，worker 经 outbox（`channel='ETHAN'`）POST JSON（Bearer 令牌）：`morning` 随每日摘要（08:00 后、有未关闭举报）、`evening`（20:00 后每日一次、有超时或 6 小时内到期）、`urgent`（见上）。只含数量与后台链接；429/5xx 退避重试，其他 4xx 终止并只记日志元数据。字段约定见[举报值守流程 §4](../operations/moderation-runbook.zh-CN.md) |
| 每日摘要邮件 | 配置 `SUPPORT_EMAIL` 后，worker 每个伦敦日 08:00 后最多排队一封摘要（最多 50 条未关闭举报，最旧在前），经现有邮件 outbox 发送；邮件只含后台深链（`ADMIN_URL` + `#moderation/<reportId>`，默认 `WEB_ORIGIN/admin/`），不含举报文字。开发环境 `MAIL_ADAPTER=outbox_test` 只入 outbox 不外发 |

### 8.3 员工操作

- 队列：未关闭举报中紧急原因在前（标“紧急”），其余最旧在前；显示原因、24 小时处理目标（剩余/已超时）、已自动限制、7 天内举报人数、账号状态；列表不含举报文字、姓名、邮箱。可一键“维持 / 恢复 / 停用”（停用需二次确认），使用预设内部备注。`under_18` 举报的详情页显示值守规则“由人先停用待核实年龄”，停用的预设备注改为对应文字；系统不自动停用。
- 详情：举报人匿名编号、举报说明、被举报内容的最小上下文（资料公开字段与头像 / 饭局字段 / 被举报消息及前后各最多 3 条），处理记录。
- 动作（每项必须填写内部备注，If-Match 为个案版本，幂等键防重复）：`UPHOLD` 维持限制并关闭、`RESTORE` 恢复内容并关闭（未违规）、`HIDE_CONTENT` 隐藏、`CANCEL_MEAL` 取消饭局（通知全部成员）、`RESET_PROFILE_TEXT` 清除昵称与简介（成员需重新填写才能继续申请/发起）、`REMOVE_PROFILE_PHOTO` 删除头像、`SUSPEND_USER` 停用账号并关闭、`UNSUSPEND_USER` 恢复账号。关闭时举报人看到员工填写的回复或标准说明。
- 停用：账号状态 `SUSPENDED`，撤销全部会话；登录与 API 调用返回 403 `ACCOUNT_SUSPENDED`（“This account has been suspended for breaking the Fancy community guidelines. Contact Fancy support if you think this is a mistake.”），iOS/Web 显示同一说明；用同一已验证邮箱换登录方式也被拒绝。公开资料按已删除成员处理（资料 404、消息“Former member”、饭局标题遮盖、主持的饭局不进发现页）。恢复后可重新登录，内容随之恢复。停用不自动取消其主持的饭局。
- 审计：每次领取、查看、动作写 `audit_events`（谁、何时、动作、前后状态等标量）；`moderation_actions` 追加保存内部备注与前后状态（含被清除的昵称/简介）。员工查看举报文字不受被举报人停用影响；举报人或被举报成员删除账号后也不立即移除，而是按 8.6 保留 12 个月后清除。
- J09：饭局类个案在详情页可查看开始名单出席事实与有效版本，满 计划结束+7 天后追加支持修订（窗口内、冲突、失败、无权限各有状态），并可“回复并记录处理结果”（`resolveCase`）；与支持 CLI 调用相同接口。

### 8.4 员工登录

- 开发：`FANCY_LOCAL_ACCEPTANCE=1 FANCY_LOCAL_STAFF_FIXTURE=1 node infra/local-acceptance.ts`，后台 Vite 跑在 Web 同源 5174，用 `qa-staff@example.invalid` / `000000` 在后台登录页登录（合成账号，具备 analyst、data_admin、support 与模拟 MFA）。测试身份适配器与固定验证码在 staging/production 由配置守卫拒绝。
- 生产：后台必须与 API 同源部署在 `WEB_ORIGIN` 下（cookie 会话 + Origin/CSRF 校验，与 Web 相同）；员工用自己的邮箱验证码登录，MFA 由 Auth0 的 `amr: mfa` 证明，未带 MFA 的会话访问员工接口返回 `REAUTH_REQUIRED`。角色在 `roles` 表按 userId 授予（目前通过数据库，由创始人执行），没有员工管理页。

### 8.5 待用户决定 / 外部关口

2026-10-29 Owner 已定：24 小时复核由 Owner 承担、托付 Ethan 做摘要提醒（流程见[举报值守流程](../operations/moderation-runbook.zh-CN.md)）；同日改定举报原因分五类、紧急原因立即提醒（邮件 + Ethan）、Ethan 推送接口（早/晚/紧急，见值守流程 §4）；被停用成员删号走支持邮箱；员工 MFA 在部署时于 Auth0 开启；运营者为 Owner 个人。以下为仍未关闭的事项：

- 公开支持邮箱（社区规则草稿与 App 内联系方式）及 `SUPPORT_EMAIL` 的实际值；邮件发送需 Resend 已配置。
- 24 小时目标由谁值守：自动规则保证举报人立即得到回执和限制，但员工复核仍需人看摘要邮件。
- Ethan 侧接收口（Building-Ethan 仓库）上线与端到端核对；`ETHAN_MODERATION_URL` / `ETHAN_MODERATION_TOKEN` 的实际值。
- Web 举报面板仍只提交旧原因 `private_concern`（按“其他”处理）；如需在 Web 选择原因，另行修改。
- Auth0 是否对员工强制 MFA 并在令牌中返回 `amr: mfa`（未确认前生产后台不可用）；员工角色授予流程。
- 后台生产托管位置（同源路径）与 `ADMIN_URL`。
- 被停用成员如需删除账号，目前只能通过支持渠道处理（其无法登录发起删除）。

### 8.6 删除账号后的安全记录保留（Owner 2026-10-29 决定：保留 12 个月后删除）

- 问题：此前成员删号时，worker 会立即抹去与其有关的举报文字、个案说明和处理备注，被调查成员可借删号销毁证据，也与隐私通知“安全记录保留期”不符（非法内容风险评估差距 R1）。
- 现行规则：删号的本地清理（`apps/worker/src/handlers/deletion.ts`）改为调用 `holdSafetyRecords`，把与该成员有关的每个个案登记到 `safety_record_holds`（迁移 0029），角色 `SUBJECT`（被举报的是其资料、其主持的饭局或其消息）或 `REPORTER`（其提交的举报）。保留内容：举报文字、个案说明与状态、`moderation_actions` 备注及前后状态、审计原因；`SUBJECT` 另存被举报内容的副本 `evidence`（资料昵称/简介/语言/兴趣、饭局标题与描述、被举报消息前后各 3 条中其本人的发言），因为清理会替换原文。头像、邮箱、会话、私信等仍按原流程删除或遮盖。
- 可见范围：沿用员工权限，只有领取个案（`support_case_grants`）的 `support` 角色可读；队列列表不含文字。后台详情在被举报成员已删除时从副本显示资料/饭局/消息，只允许“维持 / 恢复”关闭个案（不对已删除成员再做隐藏或停用）。举报人已删除而被举报成员仍在时，所有处理动作照常可用。
- 期限：从“删除受理时间”（`deletion_requests.requested_at`，备份恢复重放不会延长）与“个案最后关闭活动”（自动关闭、员工处理动作或 `resolveCase`，查看不算）两者较晚者起算满 12 个月；未关闭的个案不清除（有举报的个案 30 天无人处理会自动关闭）。期限可由生产配置 `RETENTION_POLICY_JSON.safetyRecordDays` 调整（1–3650 天，其他值按默认 365），沿用既有保留策略配置，不新增环境变量。worker 每小时运行 `purgeExpiredSafetyRecords`：抹去个案与举报文字、备注、前后状态、审计原因、相关幂等响应，删除保留登记。
- 举报人身份：删号者提交的举报保留 `reporter_id`。删号完成后该账号已无邮箱、资料与登录身份，编号只用于“7 天内不同举报人”计数和后台匿名编号，因此不再另行断开。
- 删除回执：状态与时间不变，不逐人显示“有保留记录”，以免向被调查者透露其被举报；iOS 完成状态的说明改为“账号已删除，部分记录按隐私通知限期保留”，`provider_steps.supportText` 记为 `SAFETY_RECORDS_HELD`。`purgeKnownSupportText` 保留为“立即抹除”工具（例如认可的删除请求），删号流程不再调用。
- 隐私通知已填 12 个月（双方账号仍在时随账号保留）；后台 `privacyRedacted` 现在只表示保留期已过、文字已清除。

