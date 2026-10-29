# Fancy Web 端设计规范（移动优先，兼顾桌面）

日期：2026-10-28（Europe/London）｜负责人：Claude Code｜状态：设计候选，待用户确认 §2 的待决事项
可点击原型：[prototype/index.html](prototype/index.html)（单文件，直接用浏览器打开；手机宽度 390px 为主，拉宽窗口可看平板和桌面布局）
参考调研：[Meetup 移动 Web 调研](meetup-reference.zh-CN.md)
业务规则：以[主 PRD](../../product/PRD.zh-CN.md) r07 为准（不做平台支付、押金、退款和代订位；host 在平台外订位，参加者到店各付；伦敦时间；GBP；英文界面；18+）。视觉与交互以 iOS App 当前实现（`apps/ios/src/ui/*`）和 [iOS 界面实现规范](../../engineering/ios-ui-conventions.zh-CN.md)为准，Demo（`demo/`）作为原始基准。

本文只是设计，不包含生产代码；`apps/web` 的现有代码不在本次修改范围内。

## 1. 背景

- 主 PRD §0.1 写的是“移动 Web 和 iOS App，核心业务与权限一致”；之后的[版本计划](../../product/module-version-plan-2026-10-26.zh-CN.md)把移动 Web 移出首发，`apps/web` 的开发随后被用户叫停。
- `apps/web` 曾按完整功能搭过路由（发现、详情、申请、Meals、发起、host 管理、Inbox、群聊、资料、设置、饭后反馈、举报状态），说明之前的范围是“与 App 完全一致”。
- [M10 分享饭局](../../product/modules/m10-sharing-invitations.zh-CN.md)留下一个没解决的问题：朋友收到饭局链接但**没装 App** 时看什么。Web 是这个问题最直接的答案。
- 2026-10-28 用户要求：以 Meetup 为参考，结合 App 端现在的功能和 Demo，把 Web 端设计做起来；同日补充：要有正式的首页，英国很多人用电脑上网，桌面布局要认真做（仍以手机优先），正式域名为 **fancyabite.uk**。

## 2. Web 端的定位（推荐方案与待决事项）

### 2.1 三个方案

| 方案 | 内容 | 优点 | 代价 |
| --- | --- | --- | --- |
| A. 只做分享落地页 | 首页 + 饭局页 + 公开主页，只读；所有操作都引导下载 App | 工作量最小；SEO 和链接预览就有了 | 没装 App 的朋友看完就卡住；英国桌面用户无法参与；与 PRD §0.1 差距最大 |
| **B. 访客主线完整 + 首页（推荐）** | A 的全部，加：发现（列表+地图）、登录/注册、补全资料、申请、申请状态与撤回、我的饭局、轻量收件箱（通知 + 已获座饭局的群聊）、个人资料编辑、分析授权、删除账号申请。**发起与管理饭局、饭后反馈先留在 App**，Web 上给出清楚的“去 App”入口 | 覆盖“收到链接 → 申请 → 获座 → 沟通”整条参加路径；桌面用户也能参与；发起流程（选餐厅、地图、订位声明）复杂，先不做两遍 | 需要服务器渲染饭局页、Web 登录与 Cookie、群聊轮询；host 只能在手机上审批 |
| C. 与 App 完全一致 | 在 B 的基础上再加发起、编辑、host 审批、订位声明、饭后出席/评价/再约、举报状态等 | 完全符合 PRD §0.1；`apps/web` 已有部分代码 | 两端同步开发和测试的成本最高；首发前难以保证质量 |

### 2.2 推荐：方案 B，分三步

| 阶段 | 范围 | 说明 |
| --- | --- | --- |
| W1 公开与分享 | 首页 `/`、发现 `/discover`、饭局页、公开主页、“获取 App”页、404；服务器渲染的 OG/结构化数据；Safari App 横幅与通用链接 | 不需要登录，解决 M10 的“没装 App 怎么办” |
| W2 参加主线 | 登录/注册、补全资料、申请、申请状态/撤回、我的饭局、收件箱（通知 + 群聊读写）、编辑资料、分析授权、删除账号申请、退出 | 与 iOS 共用同一套契约接口和权限 |
| W3（待定） | host 在 Web 上审批申请、发起饭局、饭后反馈 | 视首发后数据决定；若用户坚持 PRD §0.1 的“双端一致”，W3 并入首发 |

参考 Meetup：它的 Web 与 App 功能大体一致，Web 承接搜索和分享流量（调研 §1、§10）。Fancy 团队更小、每桌只有 2–6 人且需要审批，所以先把“参加”这条路做完整，把“发起”留在 App。

### 2.3 用户决定（2026-10-29）

- **D1 / D2：选 C，Web 做完整功能**，与 App 一致（发起、编辑、host 审批、订位声明、饭后出席/评价/再约、举报与举报状态、拉黑、通知、删除账号等）；PRD §0.1“Web 与 App 核心业务一致”保持原文。下文 2.2 的分步推荐作废，W1–W3 合并为首发范围，按开发顺序实施。
- **D5：加可读片段，由系统自动生成**：饭局页网址为 `/meals/{id}/{slug}`，slug 由饭局标题自动生成（小写、连字符、去掉非 ASCII，过长截断），路由只认 `{id}`，片段缺失或过期时 301 到当前规范网址；`<title>` 等页面标题同样自动生成。通用链接仍匹配 `/meals/{id}` 前缀，iOS 忽略片段。
- **D6：群聊与 App 一致**（完整读写，轮询实现）。
- D3、D4、D7、D8 按推荐：已登录打开 `/` 进入 `/discover`；公开主页 `noindex`；分析授权与 iOS 相同、不做 Cookie 横幅；商店链接与 App 横幅上架后开启。

### 2.4 原待决事项（保留记录）

| # | 问题 | 推荐 | 其他选项 |
| --- | --- | --- | --- |
| D1 | Web 范围选 A / B / C | B（W1+W2 首发，W3 以后） | A；C |
| D2 | 是否修订 PRD §0.1“Web 与 App 核心业务一致”的表述 | 选 B 时修订为“Web 覆盖参加主线，发起与饭后反馈在 App”，权限规则仍一致 | 保持原文并选 C |
| D3 | 已登录用户打开 `/` | 自动进入 `/discover`（首页只给未登录访客看） | 做个性化首页（我的下一顿 + 推荐） |
| D4 | 公开主页是否允许搜索引擎收录 | 不收录（`noindex`）：成员现在可以上传本人照片，主页被搜索到的隐私风险大于收益 | 收录主持过饭局的 host 主页 |
| D5 | 饭局页 URL 是否加可读的标题片段（如 `/meals/{id}/easy-friday-supper`） | 不加，保持与 iOS 路径完全相同，便于通用链接 | 加片段，只用于 SEO，路由时忽略 |
| D6 | Web 群聊 | W2 做“能读能发”的轻量版（轮询，无输入中/已读回执） | 只读并引导去 App；W2 不做 |
| D7 | 登录后的分析授权方式 | 与 iOS 相同：首次登录后弹一次底部面板；未登录访客不放任何非必要 Cookie，所以不需要 Cookie 横幅 | 全站 Cookie 横幅 |
| D8 | “获取 App”的商店链接、App 横幅 | App Store 上架后再开启（需要 App ID）；之前隐藏下载按钮，只说明“iPhone App 即将上线” | — |

## 3. 信息架构与网址

### 3.1 站点地图

```
fancyabite.uk
├─ /                         首页（未登录访客）；已登录 → /discover（D3）
├─ /discover                 发现：筛选、地图 + 列表
├─ /meals/{mealId}           饭局页（分享链接）
│  ├─ /apply                 申请（需登录、资料完整）
│  └─ /status                我的申请状态（需登录）
├─ /profiles/{userId}        公开主页
├─ /sign-in                  登录/注册入口（?next= 返回地址）
│  ├─ /sign-in/email         输入邮箱
│  └─ /sign-in/code          输入 6 位验证码
├─ /auth/callback            Google/Apple 登录回跳（已有接口）
├─ /profile-setup            首次补全资料（?next=）
├─ /meals                    我的饭局（Upcoming / Requests / Past）
├─ /inbox                    收件箱：群聊 + 申请进度
│  └─ /inbox/notifications   通知
├─ /chat/{conversationId}    群聊
├─ /profile                  我的资料与设置入口
├─ /profile-edit             编辑资料
├─ /get-app                  获取 App（?why=host 显示发起说明）
└─ 法律与帮助：/privacy、/cookies、/community、/help（静态页，内容待法律文本）
```

### 3.2 网址规则

- 正式域名 `https://fancyabite.uk`，只用 HTTPS；`www.fancyabite.uk` 301 跳到裸域。
- **会被分享或写进邮件的地址与 iOS 路径完全相同**：`/meals/{id}`、`/meals/{id}/apply`、`/meals/{id}/status`、`/profiles/{id}`、`/chat/{id}`、`/post-meal/{id}`（W3）。iOS 现有路由已是这些路径（`apps/ios/app/meals/[mealId]/…`、`profiles/[userId]`、`chat/[conversationId]`）。
- 账号类页面（`/profile-setup`、`/profile-edit`）也沿用 iOS 名称，减少两端差异。
- `mealId`、`userId` 是 UUID，链接里不带任何 token、申请留言或私密信息（M10 规则）。
- 分享来源用 `?src=share`（只在用户同意分析后计入），不影响内容和权限。
- 登录返回地址用 `?next=`，必须通过 `packages/contracts` 的 `isAllowedReturnTarget` 白名单校验（同源路径，不接受完整网址）。
- 无效或无权访问的 `mealId`/`userId` 显示同一个“这桌不可用”页面（HTTP 404），不区分“不存在”和“无权”。

### 3.3 App 交接（深链）规则

| 情况 | 行为 |
| --- | --- |
| iPhone 已装 App，点开 `fancyabite.uk/meals/{id}` | 通用链接直接在 App 里打开同一饭局（需要 iOS 配置 associated domains `applinks:fancyabite.uk`，网站提供 `/.well-known/apple-app-site-association`，路径：`/meals/*`、`/profiles/*`、`/chat/*`、`/discover`） |
| iPhone 未装 App | 打开网页版同一页面，可直接浏览和申请；Safari 根据 `apple-itunes-app` meta 标签显示系统横幅（App 上架后，D8）。**不做自定义全屏弹窗或拦截层** |
| 首页 `/` | 不进入通用链接范围，始终是网页 |
| Android、电脑 | 只用网页；桌面“获取 App”页显示二维码 |
| 网页内“在 App 中打开” | 只在申请状态页、获取 App 页出现，链接到同一路径（已装则通用链接接管，未装去商店）；不打断主操作 |
| 自定义 scheme `fancy://` | 只供 App 内部使用，网页不依赖它 |

## 4. 关键流程

### F1 收到分享链接的未登录访客（核心）

1. 打开 `/meals/{id}` → 看到标题、片区、2×2 关键信息、谁会来、介绍、餐厅、“App 内不收费，到店各付”说明。底部固定 **Apply to join**，上方小字 “Free to ask · Maya reviews every request”。
2. 点 Apply to join → `/sign-in?next=/meals/{id}/apply`；顶部提示“Sign in to send your request to Maya. You’ll come straight back to An easy Friday supper.”。
3. 选邮箱 → 输入邮箱 → 输入验证码（错误时就地提示，保留输入）；或 Google/Apple（跳到提供方页面再回 `/auth/callback`）。新老用户同一流程。
4. 资料不完整 → `/profile-setup?next=…`：名字、简介（20–300 字）、语言、生活状态、兴趣、18+ 确认，必填项标浅色 `*`；保存后回到申请页。
5. 首次登录后弹出一次分析授权面板（Allow analytics / Not now）。
6. 申请页写介绍（20–300 字，计数器），**Send request** → `/meals/{id}/status`：“Your hello is on its way.” + 三步进度 + 饭局摘要卡 + 接下来会发生什么 + “在 App 里即时收到通知”的卡片；底部 Track in Inbox / Withdraw request（二次确认）。
7. host 批准后：邮件通知 → 链接到 `/meals/{id}/status`（“You’re at the table.”）→ Open group chat → `/chat/{id}`。

退出点：任何一步关闭登录（Keep exploring without an account）回到饭局页；申请草稿在本标签页的 sessionStorage 中保留，登录回来后自动填回；关闭标签页后草稿不保留。

### F2 发现

首页 Find a table 或顶部导航 → `/discover`。手机：日期、人数两个就地下拉筛选 + 列表/地图切换；地图约 230px 高，片区数字标记（数字=该片区的饭局数），选中片区为桃色；下面先列选中片区，再列 “More nearby”。桌面：左列表、右地图并排，地图吸顶。筛选条件写进网址查询参数（如 `?dates=2026-10-31&tableSizes=2`），分享和返回都能保留。

### F3 首页

未登录访客打开 `/`：价值主张 → 本周饭局（4 张）→ 怎么用（三步）→ 安全感（四点）→ 发起饭局请用 App（桌面附二维码）→ 页脚。主按钮 Find a table，次按钮 Get the app。

### F4 邮件通知回到网页

所有通知邮件里的链接都用 §3.2 的共享路径；已装 App 的 iPhone 会直接进 App，其他设备进网页；未登录时先登录再回到该页。

### F5 想发起饭局

“Create meal”在 Web 上不是主操作。入口：我的饭局底部 “Host a meal” 行、首页“Host your own table”、桌面顶部 “Get the app”。都到 `/get-app?why=host`，讲清三步（选餐厅、定时间人数、审批申请），商店按钮在上架后开启。若用户自己是某场饭局的 host，饭局页底部主操作改为 “Manage in the Fancy app”。

### F6 删除账号

我的资料 → Delete account → 确认面板 → 重新认证（与 iOS 相同的 `startReauth` → `requestDeletion`）→ 状态页。英国 GDPR 要求删除入口易于找到，所以 W2 必须包含。

## 5. 逐页规格

通用状态规则（所有页面）：加载用骨架屏，不留大片空白；出错显示原因 + Try again，保留已选筛选或已填内容；空状态给出下一步按钮；需要登录的页面对未登录访客显示与 iOS 相同的登录空状态（如 “A good meal is waiting.” + Sign in），网址不变，登录后回到原页。

| 页面 | 内容（自上而下） | 主操作 | 状态 | 桌面（≥1024） | 契约接口 |
| --- | --- | --- | --- | --- | --- |
| 首页 `/` | 手机：字标 + Sign in；大标题 “Meet new people over a meal.”、一句说明、Find a table / Get the app、小字“Free to join · Adults 18+”；品牌图（170px 高）；Tables this week（横滑卡片）；How it works；Made for comfortable first meals；Host your own table；页脚 | Find a table | 本周饭局：加载骨架；为空“本周饭局都满了”；出错给 Discover 链接 | 左文右图的首屏；饭局 4 列；步骤 3 列；安全 4 列；App 区带二维码 | `discoverMeals`（取最近 4 场开放饭局） |
| 发现 `/discover` | PageHeader（tab 尺寸）“Fancy a bite?” / “Meet new people over a meal.”，右侧未登录为 Sign in、已登录为城市；筛选行（日期、人数、列表/地图）；地图；片区列表 | 点卡片进饭局页 | 加载骨架；无结果 “No tables match.” + Clear filters；出错保留筛选 | 左列表 380–440px、右地图吸顶（高度=视口−120px）；不显示列表/地图切换 | `discoverMeals`（bounds、dates、tableSizes 等现有查询参数） |
| 饭局页 `/meals/{id}` | 标题行：返回圆钮 + 标题 + “Soho · A small table” + 分享圆钮；2×2 信息格（日期/伦敦时间、确认人数/人数区间、预计人均/到店付、截止时间）；Who’s coming（头像可点，host 标签，空位 “Your seat?”）；A little about this meal + 标签 + 菜系/饮食说明；The restaurant（照片、名称、片区、订位声明标签、Google Maps 链接、“由 host 报告，Fancy 未核实”）；“App 内不收费”提示 | Apply to join（吸底） | 主操作随状态变化：未申请/开放 → Apply to join；待审 → View your request；已获座 → Open group chat；被拒 → Find another table；截止 → 禁用 “Applications closed” + Find another table；满员 → “This table is full”；已取消 → 顶部红色提示 + Find another table；本人是 host → Manage in the Fancy app | 两栏：左侧内容，右侧吸顶卡片（关键信息 + 主操作），左侧不再重复 2×2 信息格 | `getMeal`（游客可读；登录后带本人进度、`allowedActions`） |
| 分享面板 | 手机先调系统分享（`navigator.share`）；不支持时显示面板：摘要、`https://fancyabite.uk/meals/{id}`、Copy link、Copy invitation text、WhatsApp | Copy link | 复制成功才显示 “Link copied”；失败时显示可选中的链接文本 | 居中对话框 | 无 |
| 公开主页 `/profiles/{id}` | 标题行：返回 + 名字 + 背景；头像、生活状态、语言、兴趣；About；Hosting soon；From past tables（已发布评价）；Report this profile（LinkRow） | 点饭局卡片 | 不存在/已删除 → 不可用页 | 左侧资料卡吸顶，右侧介绍、主持的饭局（两列）、评价 | `getPublicProfile`；举报 `createReport`（需登录） |
| 登录 `/sign-in` | 字标 + 关闭；来自申请时显示 host 头像和返回说明，否则显示品牌图；“Fancy a bite?”；Continue with email（主按钮）/ Google / Apple；“新用户同样步骤，18+”；Privacy & community principles；Keep exploring without an account | Continue with email | 提供方失败就地提示；已登录访问直接跳 `next` | 左图右表单 | `startOAuth`、`oauthCallback` |
| 邮箱 / 验证码 | “Continue with email” / “We’ll send you a 6-digit code”；邮箱 `*`；验证码 `*`（`autocomplete=one-time-code`），重发倒计时、Change email | Send code / Verify & continue | 邮箱格式错误、验证码错误、过期、发送频率限制都就地提示并保留输入 | 居中 440px 单列 | `startEmail`、`verifyEmail`、`getSession` |
| 补全资料 `/profile-setup` | PageHeader “Let people meet you.” / 说明；照片（可选）、名字 `*`、简介 `*`（计数）、语言 `*`、生活状态 `*`、兴趣 `*`、18+ 确认 `*` | Save & continue（吸底） | 提交时逐项就地报错并滚到第一处 | 居中 720px | `getMe`、`updateMe`、`uploadAvatar` |
| 申请 `/meals/{id}/apply` | 返回 + “Pull up a chair.” + 饭局与时间；饭局摘要卡（host 头像）；Your introduction `*`（20–300，计数）；说明：申请免费、不占位，host 同意即获座并开群聊，到店各付 | Send request（吸底） | 少于 20 字就地报错；饭局已截止/满员/取消 → 显示原因并回饭局页；网络失败保留草稿可重试（同一幂等键） | 居中 720px，按钮在内容下方左对齐 | `applyMeal`（`Idempotency-Key`） |
| 申请状态 `/meals/{id}/status` | 返回 + 状态标题（与 iOS 相同的五种文案）；三步进度；摘要卡（状态标签、订位声明）；What happens next；Your introduction；“App 里即时通知”卡片（只在待审/获座时） | 待审：Track in Inbox + Withdraw request；获座：Open group chat；撤回：Apply again；被拒/过期：Find another table | 撤回需确认面板；无申请 → “No application yet.” | 居中 720px | `getMeal`、`listApplications`、`withdrawApplication` |
| 我的饭局 `/meals` | PageHeader “Your next good meal.” / “Good plans, all in one place.”；Upcoming / Requests / Past；卡片带状态行；底部 LinkRow “Host a meal” | 点卡片 | 未登录空状态；各分组空状态带 Discover；Past 说明饭后反馈在 App（W3 前） | 居中 720px，卡片两列 | `myMeals` |
| 收件箱 `/inbox` | PageHeader “A little hello.” / “Before and after the table.” + 通知铃（有未读红点）；群聊行（头像、饭局名、最后一条、时间、未读点）；申请进度行 | 点行 | 未登录空状态；空 “Your next hello starts here.” | 居中 720px | `inbox`、`listNotifications`、`markRead` |
| 群聊 `/chat/{id}` | 返回 + 饭局名 + 人数与时间 + Details 链接；消息气泡（系统消息居中）；底部输入框 + 发送 | 发送 | 无权限 → “This chat opens when you have a seat.”；退群/解散后只读并说明；发送失败可重发（`clientMessageId` 去重） | 居中 720px | `readMessages`、`sendMessage`、`markConversationRead`、`leaveGroup` |
| 我的资料 `/profile` | PageHeader “Your profile” / “How your tables get to know you.”；资料卡；LinkRow：Edit profile、Email notifications、Analytics、Privacy & community principles、Get the Fancy app、Delete account；Sign out | — | 未登录空状态 | 居中 720px | `getMe`、`logout`、`startReauth`、`requestDeletion`、`deletionStatus` |
| 获取 App `/get-app` | 返回 + 标题（访客版/发起版）；三行说明；Get the Fancy app / Not now；桌面二维码 | Get the Fancy app | 上架前隐藏商店按钮（D8） | 居中 720px | 无 |
| 不可用 / 404 | “This table isn’t available.” + 说明 + Discover meals | Discover meals | — | 同手机 | — |

文案原则：主操作和状态标题与 iOS 完全一致（Apply to join、Send request、Your hello is on its way.、You’re at the table. 等）；Web 新增文案保持同样语气，不出现押金、支付、退款、代订位。

## 6. 响应式规则

| 断点 | 布局 |
| --- | --- |
| 360–430px（主） | 单列，左右 16px；一级页面底部 4 项标签栏（Discover / Meals / Inbox / Profile，无中间 Create 圆钮，见 §7）；二级页面用返回圆钮 + 吸底操作栏（`padding-bottom: max(env(safe-area-inset-bottom), 12px)`）；首页不显示标签栏 |
| 431–767px | 同手机布局，内容最大宽 430px 居中 |
| 768–1023px（平板） | 顶部导航（字标、Discover、My meals、Inbox、Get the app、Sign in/头像）替代底部标签栏；内容居中 720px；吸底操作栏改为内容下方的普通按钮；卡片可两列；发现页仍是地图在上、列表在下 |
| ≥1024px（桌面） | 内容最大宽 1120px；首页左文右图、饭局 4 列；发现页左列表右地图；饭局页左内容右吸顶操作卡；主页左资料卡右内容；登录页左图右表单；申请/状态/表单保持 720px 单列（长表单不拉宽） |

其他：不出现横向滚动（原型在 360、390、1024、1280、1440 宽实测为 0）；文字放大到 200% 时卡片换行不截断关键信息；图片都在固定尺寸的框里铺满，不被原图撑开；面板在手机为底部弹出，平板以上为居中对话框。

## 7. 视觉系统复用

- **令牌**：直接使用 `apps/ios/src/ui/tokens.ts` 的颜色（forest `#123f35`、ink `#10241f`、muted `#6c746f`、line `#e4e7e2`、surface `#f5f6f1`、peach `#ffb49b`、danger `#a93b32`、selectedSurface `#e8f0ea`、secondaryBorder `#b8c8bd`）、圆角（7/11/19）、按钮 45px、输入框 43px；字体 Arial/Helvetica，与 App 一致，不额外加载网络字体。实现时建议把令牌抽到共享包，供 iOS 与 Web 共同引用。
- **页面标题**：与 `PageHeader` 相同——大标题 + 下面一行 12px 灰色说明，标签页 27px、二级页 24px；不放全大写眉题。
- **组件对应**：MealCard（照片框 + 标题 + 店名·片区 + 统一 12px 图标列的四行信息，价格用 £ 字形对齐）、Avatar（无照片显示首字母）、Pill/Tag、Notice、Primary/secondary 按钮、TextAction（13px 粗体 forest，无下划线）、LinkRow（圆形浅底图标 + 文字 + 箭头）、FloatingBack（36px 返回圆钮）、Sheet（确认/危险操作）。
- **密度**（iOS 规范 §1、§4）：内容紧贴顶部；不用大头图（饭局页没有封面大图）；关键事实 2×2；主操作在第一屏可见；小节标题 16px，上 18、下 8–10；正文 14/21；辅助 11–12；避免 25px 以上的空白（首页为营销页，区块间距可放宽到 22–32px）。
- **必填项**：标签后加浅灰色 `*`，与 iOS 发起饭局页一致。
- **与 App 的有意差异**：
  1. 没有中间的 Create meal 圆钮（发起在 App，§2）。
  2. 平板以上用顶部导航，不用底部标签栏。
  3. 饭局页多一个分享圆钮（iOS 后续版本补齐，M10）。
  4. 有营销性质的首页和页脚。

## 8. SEO、链接预览与结构化数据

饭局页、公开主页、首页必须**由服务器输出完整 HTML 头部**（WhatsApp、iMessage、Slack 等预览机器人不执行 JavaScript）。

| 页面 | 收录 | `<title>` / description | OG / Twitter |
| --- | --- | --- | --- |
| `/` | 收录 | “Fancy · Meet new people over a meal in London” / 一句话价值主张 | 品牌图 |
| `/discover` | 收录（无筛选参数时）；带参数的地址 `canonical` 指向 `/discover` | “Small-table meals in London this week · Fancy” | 品牌图 |
| `/meals/{id}` | 只收录**开放中且未开始**的饭局；已截止、满员、取消、已结束的页面仍可打开，但输出 `noindex` | `{title} · {area} · Fancy`；description：`{Fri 30 Oct, 19:00} · {The Little Table, Soho} · Table for 4 · £25–35 per person, pay at the restaurant` | 服务器生成的文字卡片图（标题、时间、片区、Fancy 字标，1200×630）；**不用成员头像**，**不用 Google Places 照片**（不可缓存，且需作者署名） |
| `/profiles/{id}` | `noindex`（D4） | `{name} on Fancy` | 通用品牌图（不用本人照片） |
| 登录、申请、状态、收件箱、群聊、我的页面 | `noindex, nofollow`，`robots.txt` 禁止 | — | — |

饭局页 JSON-LD（只在收录时输出）：

```json
{
  "@context": "https://schema.org",
  "@type": "Event",
  "name": "An easy Friday supper",
  "description": "A relaxed Friday dinner with a few new faces…",
  "startDate": "2026-10-30T19:00:00+00:00",
  "endDate": "2026-10-30T21:00:00+00:00",
  "eventStatus": "https://schema.org/EventScheduled",
  "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
  "location": { "@type": "Place", "name": "The Little Table", "address": { "@type": "PostalAddress", "addressLocality": "London", "addressRegion": "Soho", "addressCountry": "GB" } },
  "organizer": { "@type": "Organization", "name": "Fancy", "url": "https://fancyabite.uk" },
  "isAccessibleForFree": true,
  "maximumAttendeeCapacity": 4,
  "url": "https://fancyabite.uk/meals/…"
}
```

说明：`startDate` 用伦敦当地时间带偏移（夏令时 +01:00）；`endDate` 为契约的 `scheduledEndAt`（开始后 2 小时，不代表真实结束）；组织者写 Fancy 而不是 host 本人，避免个人信息进入搜索结果；不写 `offers`（平台不卖票，人均预算写在描述里）。另提供 `/sitemap.xml`（首页、发现、开放饭局）。

## 9. 无障碍

目标 WCAG 2.2 AA。设计已考虑：

- 语义：页面只有一个 `h1`；导航用 `nav`；可点击的整张卡片是一个链接，内部头像在主页等场景可单独点击；按钮和链接都有可读名称（如 “Share this meal”、“View Maya’s profile”）。
- 键盘：所有操作可用 Tab 到达，焦点环为 2px forest；面板打开时焦点移入，Esc 关闭；地图片区标记是按钮，带 “2 meals in Soho” 名称，列表本身包含全部信息，不依赖地图。
- 表单：标签与输入关联；错误在字段下方显示并用 `role=alert` 播报；验证码用 `inputmode=numeric`、`autocomplete=one-time-code`；邮箱 `autocomplete=email`。
- 状态播报：复制成功、发送成功等提示用 `aria-live=polite`；进度条有整体文字说明。
- 触控目标不小于 44×44（标签栏、圆钮 36px 外加 8px 点击扩展）；对比度：muted `#6c746f` 在白底约 4.8:1，满足正文要求；禁用按钮用 50% 不透明度并有文字说明原因。
- 尊重“减少动态效果”（骨架屏动画关闭）；`lang="en-GB"`。

原型只做了上述结构，未做读屏软件实测，见 §12。

## 10. 分析与 Cookie 同意（英国 UK GDPR / PECR）

- 未登录访客：只使用登录与安全所必需的 Cookie（会话、CSRF、登录回跳绑定），不放分析、广告或第三方追踪 Cookie，所以不需要 Cookie 横幅；页面访问量只做服务器日志级的汇总统计（不识别个人）。
- 登录后：与 iOS 一致，首次登录弹一次 “Help improve Fancy?”（Allow analytics / Not now），未选择前不采集；可在 Profile → Analytics 随时更改。授权写入账号（两端共享），版本号沿用 `consentVersions`。
- 分享来源 `?src=share`、首页按钮点击等事件只在授权后通过 `ingestEvents` 上报。
- `/cookies` 页面列出必需 Cookie 的名称、用途和期限（文本待法律审核）。

## 11. 与契约接口的对应和缺口

现有接口已覆盖 W1/W2 的业务操作（§5 各行），游客可读的 `discoverMeals`、`getMeal`、`getPublicProfile`、`getAvatar`、`getVenuePhoto` 都是 `public` 或 `optionalSession`；Web 登录（`startOAuth` 的 `WEB` 客户端回跳 `/auth/callback`、邮箱验证码、Cookie 会话 + CSRF）API 已支持。缺口如下：

| 缺口 | 影响 | 建议 |
| --- | --- | --- |
| Web 是纯前端单页（Vite），饭局页没有服务器渲染 | 搜索引擎和聊天软件的链接预览拿不到标题和图片 | 加一个轻量渲染层（边缘函数或 API 旁的小服务）：对 `/`、`/discover`、`/meals/{id}`、`/profiles/{id}` 调 `getMeal` 等公开接口，输出 meta、JSON-LD 和首屏 HTML，再由前端接管 |
| 没有饭局分享图接口 | OG 图片 | 新增 `GET /v1/meals/{id}/share-card.png`（公开，按饭局版本缓存，只含公开文字信息） |
| 没有 sitemap 数据源 | 收录 | 用 `discoverMeals` 分页生成，或新增只返回开放饭局 id 与更新时间的内部接口 |
| `RETURN_TARGET_PREFIXES` 不含 `/chat`、`/profile-setup`、`/profile-edit`、`/get-app` | 从邮件点群聊链接、登录后无法回到这些页面 | 契约补充前缀（`/profile-setup` 不能靠 `/profile` 前缀匹配，校验要求 `/profile/` 开头） |
| 通知邮件中的链接域名 | 需要统一指向 `https://fancyabite.uk` 的共享路径 | API 配置 `webOrigin=https://fancyabite.uk`，邮件模板改用共享路径 |
| 通用链接 | 已装 App 时直接打开 | iOS `app.json` 加 `associatedDomains: ["applinks:fancyabite.uk"]`（当前 bundle id 为开发占位）；网站提供 AASA 文件 |
| App 横幅、商店链接 | 需要 App Store ID | 上架后补（D8） |
| `PublicProfile` 没有生活状态 | 主页上的 “Making London home” 标签 | 与 iOS 同一缺口（接手计划 §7），一起决定 |
| 群聊实时性 | Web 没有推送 | W2 用轮询（与 iOS 相同的 `poller`），页面不可见时暂停 |
| 申请草稿跨登录保留 | 登录跳转后回到申请页 | 纯前端（sessionStorage），无需接口 |

契约、API 的改动按协作规则由主会话负责；本文只列需求。

## 12. 原型说明与验证

- 文件：[prototype/index.html](prototype/index.html)（约 90KB，内联 CSS/JS，无外部依赖）；图片为 Demo 虚构素材的压缩副本，放在 `prototype/assets/`（共约 165KB）。人物、饭局均为虚构，日期调整到 2026-10-30/31。
- 右侧 “REVIEW STATES” 标签打开评审面板：登录状态（未登录 / 已登录 / 已登录但资料不完整）、数据状态（正常 / 加载 / 空 / 出错）、当前饭局的申请状态与饭局状态、模拟 Safari App 横幅、页面跳转、“host 批准”快捷操作。面板不是产品界面。
- 原型验证码固定为 `000000`；Google/Apple 登录、商店链接、上传照片、举报和删除账号只显示提示，不发生真实操作。
- 已用预装 Playwright Chromium 实测（2026-10-28/29）：390px 下跑通首页 → 发现（筛选、列表/地图）→ 饭局页 → 分享面板 → 成员主页 → 申请 → 登录（含验证码错误）→ 分析授权 → 申请（含校验）→ 申请状态 → 撤回确认 → 收件箱 → 批准后群聊发消息 → 我的饭局 → 我的资料 → 发起说明 → 404；资料不完整时的补全资料（含校验）后回到申请；发现页出错/空/加载；截止饭局与 App 横幅。1280px 下跑通首页、发现（点地图标记切片区）、饭局页（右侧操作卡）、主页、登录、申请、状态；820px 平板截图。360/1024/1280/1440 宽无横向滚动，页面无脚本错误。截图只保存在本机，不进仓库。
- 未验证：真实 iPhone Safari（安全区、键盘、系统 App 横幅、通用链接）；读屏软件（VoiceOver/NVDA）；真实网络下的性能；服务器渲染与链接预览（原型是前端哈希路由，网址带 `#`，正式版不用 `#`）。

## 13. 不做与边界

- 不做平台支付、押金、退款、票务、候补名单和付费优先。
- Web 首发不做发起/编辑饭局、host 审批、订位声明、饭后出席/评价/再约（W3 待定）；这些在 Web 上都有去 App 的明确入口。
- 不做 Ask Fancy（与 iOS 一致，本版关闭）。
- 不做 Android App 相关的横幅或深链。
- 法律页面（隐私、Cookie、社区准则、条款）的正文需法律审核后提供，原型只放入口。

## 14. 实施记录

### 14.1 审计（2026-10-29，`apps/web` 对照本规范 §2.3 与 iOS 当前实现）

`apps/web` 是早期阶段按 Demo 搭的单列 480px 外壳，数据层（`@fancy/client` Cookie + CSRF、`Intent` 幂等键、401 清空私有缓存、`useQuery`、`poller`、分析事件）可直接沿用；界面、路由和若干流程落后于本规范和 iOS。差距清单（状态列在实施过程中更新）：

| # | 范围 | 差距 | 状态 |
| --- | --- | --- | --- |
| G1 | 视觉系统 | 仍是 Demo 早期样式（全大写眉题、顶部细条标题栏、详情大头图、下划线文字链接），未用 iOS `PageHeader` / `FloatingBack` / `MealCard` / `LinkRow` / 必填 `*` 等现行组件与令牌 | 已做（W-P1）：`styles/tokens.css` 与 iOS 令牌一致；`ui/components.tsx` 对应 iOS PageHeader、返回圆钮、MealCard、LinkRow、必填 `*`、ChoiceGroup、Notice；未迁移页面经共享组件先换新样式 |
| G2 | 响应式 | 全站最大宽 480px；无平板顶部导航、无桌面双栏（发现左列表右地图、饭局页右侧吸顶卡、主页左资料卡、登录左图右表单） | 已做（W-P1）：手机底部标签栏（含 Create 圆钮）、≥768 顶部导航与 720px 内容列、≥1024 发现双栏、饭局页吸顶卡、主页双栏 |
| G3 | 首页 | 无首页，`/` 直接跳 `/discover`；无页脚 | 已做（W-P1）：`/` 首页 + 页脚；已登录跳 `/discover` |
| G4 | 发现 | 地图为 Google JS 单点标记 + “Areas”列表；iOS 为插画地图 + 片区数字标记 + 选中片区优先、“More nearby”，列表/地图切换 | 已做（W-P1）：插画地图 + 片区数字标记 + More nearby，列表/地图切换，桌面左列表右地图；筛选、视图、片区写入网址，返回靠浏览历史 |
| G5 | 饭局页 | 无 `/meals/{id}/{slug}` 网址与规范地址跳转；无分享；无 Who’s coming 成员行与空位；无吸底主操作及各状态文案；无撤回/取消座位确认面板、取消条款、举报饭局入口 | 已做（W-P1）：slug 网址与规范跳转、分享（系统分享/面板）、Who’s coming、主操作各状态、撤回/取消座位确认、取消条款页与举报入口 |
| G6 | 公开主页 | 无生活状态标签、无 Report this profile 行；拉黑入口文案与 iOS 不同；未 `noindex` | 已做（W-P1）：noindex、Report this profile、iOS 拉黑确认；生活状态仍缺接口字段（同 iOS） |
| G7 | 路由 | 与 iOS 路径不一致：群聊 `/inbox/:id`（iOS `/chat/:id`）、`/profile/edit`（`/profile-edit`）、无 `/profile-setup`、无 `/meals/:id/status`（申请页兼做状态）、`/inbox/notifications`（`/notifications`）、`/settings/deletion`（`/delete-account` + `/deletion-status`）、举报为面板（iOS `/report` 页）、无 `/blocked-members`、`/cancellation-terms`、`/get-app` | 待做 |
| G8 | 登录 | 邮箱与验证码同页；无 iOS 的 `/email` 分步、来自申请时的 host 说明、Keep exploring；登录后首次分析授权面板需对齐 | 待做 |
| G9 | 资料 | 首次补全资料与编辑共用一页；无头像上传/移除（iOS `uploadAvatar` / `removeAvatar`）；必填项无 `*` | 待做 |
| G10 | 申请 | 无独立状态页（五种状态文案、三步进度、Withdraw 确认）；草稿跨登录保留已有 | 待做 |
| G11 | 我的饭局 | 分组与 iOS（Upcoming / Requests / Hosting / Past）及卡片状态行不一致 | 待做 |
| G12 | 收件箱 | 排序与聚焦（iOS：未读优先、最近活动排序、从通知进入时定位）、通知页重做（分组、已读、深链）未同步 | 待做 |
| G13 | 群聊 | 无消息举报（iOS 长按举报，举报者本地隐藏该消息）；被拉黑成员/已离开状态说明需对齐 | 待做 |
| G14 | 举报 | 仅面板；无 `/report` 页与举报状态页对齐；需为后续“举报原因（5 类）”预留必选下拉 | 部分（W-P1）：`/report` 页与必选原因（5 类，2026-10-29 已合入）；消息举报接入随 W-P3 |
| G15 | 拉黑 | 无“已拉黑成员”列表页与解除拉黑 | 待做 |
| G16 | 发起/编辑 | Web 为旧版单页步骤；iOS 已改为四步（地点与时间 → 介绍 → 费用与人数 → 预览），编辑饭局同样四步、首位客人获批后锁定安排 | 待做 |
| G17 | host 管理 | 审批/拒绝/取消饭局、订位声明的文案与确认面板需对齐 iOS | 待做 |
| G18 | 饭后 | iOS 只有出席确认后才能评价/再约（出席门槛）；Web 未做门槛 | 待做 |
| G19 | 设置与删除 | 删除账号需重新认证（`startReauth` → `requestDeletion`）并显示状态页；`ACCOUNT_SUSPENDED` 文案已有；设置里的法律链接（隐私、条款、社区准则、支持）需与 iOS 一致 | 待做 |
| G20 | SEO | 无每页标题/描述、无 canonical、无 OG/JSON-LD、无 robots/sitemap；纯前端无法给链接预览机器人输出 meta | 已做（W-P1）：前端 `useDocumentMeta`；`apps/web/server/serve.ts` 服务器输出 title/description/canonical/OG/JSON-LD、301 规范网址、robots.txt、sitemap.xml |
| G21 | 无障碍 | 单 `h1`、焦点环、地图标记可读名称、表单错误播报需逐页核对 | 待做 |
| G22 | Ask Fancy | Web 仍显示助手入口；iOS 本版已关闭（`ASSISTANT_ENABLED = false`） | 已做（W-P1）：入口已移除，代码与测试保留 |

已与本规范 §2.3 的决定对齐的新增决定：完整功能下，Web 底部标签栏与 iOS 相同带中间 Create meal 圆钮，平板/桌面顶部导航带 “Host a meal” 按钮（§7 有意差异 1 作废）。

### 14.2 实施决定（W-P1，2026-10-29）

- **返回**：返回圆钮优先用浏览器历史；从分享链接直接进入（无站内上一页）时回到 `/discover`。不再用导航 state 携带返回地址，发现页的筛选、视图（`view=list`）和选中片区（`area=`）都在网址里。
- **网址**：饭局页规范地址 `/meals/{id}/{slug}`（`src/seo/meal-seo.ts`）；slug 与子页面重名（apply/status/host/edit）时加 `-meal`。前端用替换跳转到规范地址；真正的 301 由 `apps/web/server/serve.ts` 给出。
- **服务器头部**：`apps/web/server/serve.ts`（Node 24，无依赖）托管构建产物、代理 `/v1`、为首页/发现/饭局/主页输出头部，并提供 robots.txt、sitemap.xml。Seoul 部署包用 nginx 直接托管构建产物时，需把 HTML 请求转给此服务（或改用同等的 nginx 规则），否则预览机器人拿不到饭局标题；分享图暂用品牌图（缺按饭局生成的文字卡片接口，见 §11）。
- **分析授权**：只在本标签页刚完成登录后弹一次（`lib/freshSignIn.ts`），不在登录、关联、补全资料步骤上弹；之后在资料页的 Analytics preferences 行修改。与 iOS（每次会话未选择时弹）有意差异：网页刷新频繁，避免反复打扰。
- **注册来源**：`lib/attribution.ts` 只在内存中记录落地网址的 utm 参数或“从饭局分享链接进入”，不写 Cookie/存储；注册请求带 `signupSource`（W-P2 接入）。
- **QA 证据路径**：`docs/qa/evidence/2026-10-21/automated-runs.json` 引用了若干 Web 测试文件路径；这些文件保留并改写为新行为的测试，不删除。
