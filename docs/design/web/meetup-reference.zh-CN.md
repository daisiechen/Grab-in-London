# Meetup 移动 Web 调研（Fancy Web 设计参考）

日期：2026-10-28（Europe/London）｜作者：Claude Code｜状态：公开资料部分已完成；亲测部分待补
用途：为 [Fancy 移动 Web 设计规范](mobile-web-design.zh-CN.md) 提供参考基准。只记录 Meetup 的做法和对 Fancy 的取舍，不改变主 PRD r07 的业务规则。

## 0. 证据边界（先读）

- 本次云端会话**打不开** `www.meetup.com` 和 `help.meetup.com`（域名不在会话允许的网络范围内，DNS 解析失败）。所以没有直接看过 Meetup 页面，也没有截图。
- 下面标为 **[官]** 的内容来自 Meetup 帮助中心、官方博客和新闻稿，但是通过搜索引擎的检索摘要读到的，没有打开原文。标为 **[三方]** 的来自第三方教程或工具文档，可能过时。**[推断]** 是我们根据事实做的判断。**[待亲测]** 表示需要在真实浏览器里确认。
- 用户已在 Mac 的 Chrome 里登录 Meetup（付费订阅），另一个本机会话正在用手机网页视图亲测。亲测结果到达后填入 §9，并逐条更新下面的 [待亲测] 标记。
- 仓库已有的 Meetup 竞品条目见[竞品证据 C07](../../research/competitor-evidence.zh-CN.md#c07-meetup)（定位、商业模式），本文不重复。

## 1. 信息架构与导航

| 观察 | 级别 | 来源 |
| --- | --- | --- |
| 2025 年 9 月改版：间距、层级更清楚，导航简化，“核心的活动规划逻辑不变”；新设计先在 Web 上线，移动端随后 | [官] | [新闻稿](https://www.businesswire.com/news/home/20250930663024/en/Meetup-Unveils-Fresh-New-Design-as-Gen-Z-and-Millennials-Crave-More-In-Person-Interactions)、[博客 new-design-2025](https://www.meetup.com/blog/new-design-2025/) |
| 新 App 可以直接从首页进入个人资料和群组，与改版后的网站一致 | [三方] | [Engadget](https://www.engadget.com/mobile/meetups-new-mobile-app-is-designed-to-make-it-easier-to-meet-people-irl-150000920.html) |
| 2020 年旧版 App 底部为 Home / Explore / Notifications / Messages，Profile 在右上角 | [三方，已过时] | 检索摘要（orientatech 评测） |
| 登录后首页单独设计（“new logged-in home”），与未登录首页不同 | [官] | [博客](https://www.meetup.com/blog/meetup-new-logged-in-home/) |
| 手机网页当前的顶部/底部导航项目、菜单位置 | [待亲测] | — |

[推断] Meetup 是“群组 → 活动”两层结构，Web 与 App 功能大体一致，Web 承担大量来自搜索引擎和分享链接的首次访问。Fancy 没有“群组”这一层，饭局本身就是可分享的单位。

## 2. 发现活动

| 观察 | 级别 | 来源 |
| --- | --- | --- |
| Find 页面顶部筛选：日期范围、类型（线上/线下）、距离（2 到 100 英里）、群组类别；另有按时段（上午、下午等）筛选；可以任意组合 | [官] | [帮助：Find 页筛选](https://help.meetup.com/hc/en-us/articles/39235072484109)、[博客：新筛选](https://www.meetup.com/blog/new-search-filters-on-meetup/) |
| 排序有“相关度/最近”两种（来自第三方接口参数，不是确认的界面文案） | [三方] | [Apify](https://apify.com/maximedupre/meetup.md) |
| 2025 进展报告提到 AI 推荐与语义搜索 | [官·自报] | [2025 进展报告](https://www.meetup.com/blog/2025-meetup-progress-report/) |
| 手机网页是否有地图视图、列表卡片的具体字段、默认城市如何确定 | [待亲测] | — |

## 3. 活动详情页结构

| 观察 | 级别 | 来源 |
| --- | --- | --- |
| 新排程格式：独立议程区、格式化描述、主办方提供什么/参加者带什么，以及更清楚的“联系主办方”入口 | [官] | [博客：新的排程方式](https://www.meetup.com/blog/a-new-way-to-schedule-meetup-events) |
| 报名前只显示大致位置和费用，报名后才显示准确地址或线上链接 | [官] | 同上 |
| 参加者名单改版：标出第一次参加的人、更清楚地区分主办方和来宾、展示成员兴趣 | [官] | [产品更新日志](https://www.meetup.com/blog/meetup-product-release-notes/) |
| RSVP 邮件可以自动在 Google 日历里建活动并随活动更新 | [官] | [16 项改进](https://www.meetup.com/blog/16-recent-meetup-improvements-you-might-have-missed/) |
| Web 上有三处分享入口：发布后弹窗、活动页 Share 按钮、活动图片；可发到 Facebook/X/LinkedIn 或复制链接；私密群的链接可能落到群首页 | [官] | [帮助：分享活动](https://help.meetup.com/hc/en-us/articles/360002882691) |
| 活动页带 schema.org `Event` JSON-LD（名称、起止时间、图片、地址、组织者） | [三方] | [Apify 抓取工具说明](https://apify.com/klondikeking/meetup-events-scraper) |
| 首屏顺序、RSVP 按钮位置（是否吸底）、OG 图片内容 | [待亲测] | — |

## 4. 报名（RSVP）与何时要求登录

| 观察 | 级别 | 来源 |
| --- | --- | --- |
| 旧教程：在活动页右侧面板点 “Yes”（Are you going?），回答主办方问题，确认后显示成功；之后用同一位置的 Change 改为不去 | [三方，可能过时] | [GCF Global](https://edu.gcfglobal.org/en/meetup/attending-meetup-events/1) |
| 已经报名的记录不能完全删除；未来活动可以改成 Not going | [官] | [帮助：修改出席](https://help.meetup.com/hc/en-us/articles/4444295515789-Changing-my-event-attendance) |
| 活动满员时 RSVP 按钮换成 “Join waitlist”；只有设了人数上限的活动有候补；收费活动不能设候补（避免自动扣款） | [官] | [帮助：候补](https://help.meetup.com/hc/en-us/articles/41229648295181-How-to-Join-an-Event-Waitlist-on-Meetup) |
| Meetup+ 订阅者在候补中优先转正，组织者能看到优先标记 | [官] | [博客：Meetup+ 2024-10](https://www.meetup.com/blog/new-to-meetup-plus-october-2024) |
| 加入群组可能需要组织者审批，并先回答入群问题；审批前为 Pending | [官] | [帮助：加入群组](https://help.meetup.com/hc/en-us/articles/39234752483853-Joining-a-Meetup-group)、[入群问题](https://help.meetup.com/hc/en-us/articles/360002878091) |
| 注册可在手机浏览器、电脑或 App 完成，邮箱或 Google/Apple/Facebook | [官] | [帮助：注册](https://help.meetup.com/hc/en-us/articles/39232700471181-How-do-I-sign-up-for-a-Meetup-account) |
| 有用户反映未登录时看不到 RSVP 按钮（个别群组设置所致，不是平台政策） | [三方] | 检索摘要（Alteryx 社区帖） |
| 未登录点 RSVP 时是弹窗还是跳转、登录后是否回到原活动、是否同时要求加入群组 | [待亲测] | — |

## 5. 群组页面

| 观察 | 级别 | 来源 |
| --- | --- | --- |
| 群页有组织者、成员数等统计，中间是群介绍和即将举行的活动，加入按钮在右上 | [三方，较旧] | 检索摘要（第三方指南） |
| 私密群的相册和讨论区对非成员与搜索引擎隐藏 | [三方] | [Comparably FAQ](https://www.comparably.com/companies/meetup/faqs) |
| 加入失败常见原因是广告拦截插件；可换设备或改用 App | [官] | [帮助：无法加入](https://help.meetup.com/hc/en-us/articles/32239060430861-I-m-unable-to-join-a-group) |
| 当前群页标签（About / Events / Members / Photos / Discussions 等） | [待亲测] | — |

## 6. 通知与消息：Web 与 App

| 观察 | 级别 | 来源 |
| --- | --- | --- |
| 通知渠道：邮件、推送、站内信箱；推送开着的类型不再重复发邮件，可选“两者都发” | [官] | [帮助：通知如何工作](https://help.meetup.com/hc/en-us/articles/40705340432525-How-Meetup-notifications-work)、[可发送的通知](https://help.meetup.com/hc/en-us/articles/40708711818637-What-notifications-Meetup-can-send) |
| 可以直接回复邮件来回复站内消息，回复同时出现在网站和 App | [官] | [帮助：邮件回复](https://help.meetup.com/hc/en-us/articles/360002863492-How-do-I-reply-to-messages-via-email) |
| Web/手机网页的设置路径：菜单 → Settings → Email Updates | [官] | 同上（检索摘要） |
| 活动内置聊天：RSVP “Going” 即入群；改为 Not going 后不能再发言但可读历史；候补转正自动入群；也可链接 WhatsApp/Discord/Telegram，邀请链接只给已确认者 | [官] | [帮助：加入活动聊天](https://help.meetup.com/hc/en-us/articles/48377254200589-Joining-event-chats-and-third-party-messaging-on-Meetup)、[设置活动聊天](https://help.meetup.com/hc/en-us/articles/48377081479693-Setting-up-event-chats-and-third-party-messaging-on-Meetup) |
| 组织者功能已并入主 App，过渡期有功能缺口 | [官] | [帮助：成为组织者](https://help.meetup.com/hc/en-us/sections/39489451050637--Become-an-Organizer) |
| 手机网页能否发消息/进活动聊天，哪些功能只在 App | [待亲测] | — |

[推断] Meetup 的“确认即入群、退出后历史只读”与 Fancy PRD §0.4（获准即入群、退群只读历史）高度一致，可以直接借鉴文案和状态设计。

## 7. Web 引导用户使用 App、未登录访客

- 没有找到 Meetup 手机网页是否使用 Safari Smart App Banner、自定义下载弹窗或通用链接的公开资料。[待亲测]
- 通用机制 [官·Apple 机制，非 Meetup]：Safari 根据 `<meta name="apple-itunes-app" content="app-id=…, app-argument=…">` 在页面顶部显示系统横幅，已安装显示 OPEN、未安装显示 GET；通用链接（Universal Links）在已安装 App 时直接打开 App。
- [推断] Meetup 的 Web 功能完整，App 推广主要依赖推送通知、群聊等 App 体验，而不是挡住网页内容。

## 8. 信任与安全、无障碍与性能

| 观察 | 级别 | 来源 |
| --- | --- | --- |
| 社区准则：尊重边界，禁止冒充和假账号，禁止用新账号绕过封禁 | [官] | [社区准则](https://help.meetup.com/hc/en-us/articles/360002897532) |
| 屏蔽会阻止对方发消息，屏蔽流程内可直接举报；举报由 Trust & Safety 人工审查 | [官] | [帮助：屏蔽](https://help.meetup.com/hc/en-us/articles/360001673551) |
| 线下骚扰：平台无法管理站外行为，建议联系当地警方，同时仍可在站内举报 | [官] | [帮助：线下骚扰](https://help.meetup.com/hc/en-us/articles/360001673631-Harassment-and-bullying-offline) |
| 群组和活动可以从页面上举报，处理结果不对举报人公开 | [官] | [帮助：举报群组或活动](https://help.meetup.com/hc/en-us/articles/39257846459789-Reporting-a-Meetup-group-or-event) |
| 无障碍声明（2021-05 更新）承诺数字无障碍，24–48 小时回复反馈；摘要未写 WCAG 等级 | [官] | [无障碍声明](https://help.meetup.com/hc/en-us/articles/360061603392-Statement-on-accessibility) |
| 曾计划使用无障碍浮层（overlay），2022 年已撤下 | [三方] | [WordPress 社区](https://make.wordpress.org/community/2022/11/23/meetup-com-accessibility-overlay-update/) |
| 页面性能、首屏加载、对比度与键盘可达性 | [待亲测] | — |

## 9. 亲测记录（待补）

由本机会话在用户登录的 Chrome 手机视图中完成后填写。建议逐项记录：页面地址、登录状态、视口、截图文件名（截图不进公开仓库，见接手计划 §6）、观察结果、与上文哪一条对应。

| # | 场景 | 登录状态 | 观察 | 对应条目 |
| --- | --- | --- | --- | --- |
| 1 | 未登录打开活动分享链接 | 未登录 | 待补 | §3、§4、§7 |
| 2 | 活动详情首屏与 RSVP 位置 | 两种 | 待补 | §3 |
| 3 | RSVP 到确认前一步（不提交） | 已登录 | 待补 | §4 |
| 4 | Find 页筛选、列表/地图 | 两种 | 待补 | §2 |
| 5 | 群组页、入群问题 | 两种 | 待补 | §5 |
| 6 | 消息、活动聊天在手机网页的可用性 | 已登录 | 待补 | §6 |
| 7 | App 横幅、打开 App 的提示 | 未登录 | 待补 | §7 |
| 8 | 付费订阅的额外功能 | 已登录 | 待补 | §4 |
| 9 | 举报、屏蔽、安全提示 | 已登录 | 待补 | §8 |

## 10. 对 Fancy 的取舍

| Meetup 做法 | 是否适合 Fancy | 理由与做法 |
| --- | --- | --- |
| Web 与 App 功能大体一致，Web 承接搜索和分享流量 | **部分适合** | Fancy 首发团队小，Web 先做“看、登录、申请、跟进”这条主线；发起和管理饭局先留在 App（见设计规范 §2 的待决事项） |
| 公开活动页 + Event 结构化数据 + 分享按钮 | **适合** | 饭局页是 Fancy 最主要的分享单位；只对开放中的未来饭局做索引，成员照片不进 OG 图片 |
| 报名前只显示大致位置 | **不照搬** | PRD 允许游客看餐厅名称和片区（公开饭局信息），而且餐厅是公共场所；保持与 iOS 一致 |
| 一键 RSVP、满员候补 | **不适合** | Fancy 每桌 2–6 人，需要申请留言并由 host 审批；没有候补名单（PRD r07 未规定），满员显示“这桌已满” |
| 候补优先等付费特权 | **不适合** | 基础发现、申请免费，付费身份不代表人更优质（PRD §1.4、§1.5） |
| 入群问题 + 组织者审批 | **适合（已有）** | 对应 Fancy 的申请留言 + host 批准；文案沿用 iOS |
| 确认即入群聊、退出后历史只读 | **适合（已有）** | 与 PRD §0.4 一致 |
| 邮件回复即可回消息 | **以后再看** | 首发 Web 只发通知邮件，不做邮件回信 |
| 屏蔽流程内带举报、人工审查、处理结果不公开、站外问题建议报警 | **适合** | 与 PRD §0.6 一致；英国紧急电话写 999 |
| 收费活动、票务、会费 | **不适合** | r07 不做平台支付、押金与退款，到店各付 |
