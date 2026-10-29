# 管理后台运营分析能力评审：上线后 3 个月够不够用

日期：2026-10-29（Europe/London）｜评审人：Claude Code｜状态：P0 已实施（2026-10-29，口径 v5，见 §8）；P1 为建议，待 Owner 决定

范围：判断现有管理后台（五个分析页、下钻、举报处理）和它背后的数据字段，能否支撑一人运营的 MVP 在上线后头 3 个月做运营分析。依据：[后台PRD](../product/admin/PRD.zh-CN.md)（v1.4，指标字典 v4）、[管理端指标与采集修订](fancy-admin-measurement-review.zh-CN.md)、[管理端可用性审查](fancy-admin-usability-review.zh-CN.md)、[接手开发计划 §8](claude-takeover-plan.zh-CN.md)、[主PRD](../product/PRD.zh-CN.md) §0.5 与“上线后建议观察的指标”，以及代码：`apps/api/src/admin/{metrics,snapshots,pages,drilldown,ingest,routes}.ts`、`apps/worker/src/main.ts`、`packages/contracts/src/dictionaries.ts`（`ADMIN_PAGE_KEYS`、`CLIENT_EVENT_TYPES`）、`apps/ios/src/analytics/*`、`apps/web/src/api/telemetry.tsx`、`packages/db/migrations/0006/0008/0011/0012/0014/0018/0024/0027`、`apps/worker/src/handlers/deletion.ts`。没有用生产数据验证，结论只针对设计和代码本身。

## 1. 结论

**不够用。** 后台对“申请 → 出席 → 30 天再赴约”这条结果链定义得很严谨。但上线头 3 个月最常问的几件事，后台基本答不了：每周多少人注册、从哪个平台或渠道来、卡在哪一步、哪些片区和时段供给不够、举报是否在 24 小时内处理了。这些问题的数据其实大多已经在数据库里，不需要分析授权就能统计，只是没有放进快照和页面。另有两个上线前必须处理的风险：快照存储没有上限；依赖分析授权的指标没有标出样本偏差。

### 现状速览

- 五个分析页共 22 个指标卡和 13 组图表，来自 `ADMIN_PAGE_KEYS`。worker 每小时把**截至当时的全部历史事实**做成一份 JSON 快照写入 `analytics_snapshot_facts`，页面和下钻都基于选定的快照计算，口径版本为 v4。
- 客户端事件共 11 类：发现结果、曝光、详情、创建三步、表单错误、筛选、地图、资料查看、群聊打开。iOS 和 Web 都已接入。所有事件都要求明确授权，且授权**只对当前登录会话有效**。iOS 只在登录后弹窗征求授权，所以 iOS 游客从不采集。
- 业务事实全部来自服务端，不依赖授权：成员（users）、饭局（meals）、申请（applications）、席位事件（seat_events）、出席与评分的各次修订、产品问卷，都会进入快照。以下数据库里有但**没有进入快照**：公开评价、互选（pair_consents）、屏蔽、举报与处置记录、邮件发送与回执、登录验证码记录、资料完成状态、登录平台（session_families.kind）、菜系（cuisine_code）。
- 举报处理页可以逐条看到 24 小时剩余时间或已超时，但没有任何汇总数字。

## 2. 覆盖矩阵

图例：✅ 能回答且口径可靠；⚠️ 有数据或部分展示，但缺维度、口径有偏差或被门槛挡住；❌ 没采集或没展示。“需授权”指只有选择允许分析的会话才有数据。

| 运营问题 | 数据来源（是否需授权） | 后台位置 | 状态 | 说明 |
|---|---|---|---|---|
| **供给**：每周新发布饭局数 | `meals.created_at`、`status`（服务端） | 无 | ❌ | 供需页只统计**已到开始时间**的场次，按 `starts_at` 归日；还没开始的场次（供给的先行指标）看不到 |
| 供给按片区、时段、预算、菜系拆分 | `area_code`、`starts_at`、`budget_max_pence`、`cuisine_code`（服务端） | 供需页“区域比较”只显示招募达标率；筛选支持预算、人数、语言 | ⚠️ | 没有时段维度（午餐/晚餐、工作日/周末）；`cuisine_code` 没进快照 |
| host 再次发起比例 | `meals.host_id`（服务端） | 无 | ❌ | 一人运营时 host 是最稀缺的资源，这项应当可见 |
| 成团与取消 | `formation`、`cancellation`、`cancellation.reasons` | 供需页 | ✅ | 定义扎实：开始前曾达最低人数；取消场次仍留在分母里；原因分为 host、订位、其他、人数不足 |
| **需求**：访客数 | `discovery_results`、`meal_impression`（需授权） | 旅程页“浏览人数” | ⚠️ | 只是授权样本；iOS 游客为 0；不能当作访客总数 |
| 每周注册数 | `users.created_at`（服务端） | 无 | ❌ | 最基本的数字缺失 |
| 资料完成 | `profiles` 各字段（服务端），**没有完成时间** | 无 | ❌ | 没有时间戳就算不出注册到资料完成用了多久、有多少人流失 |
| 首次申请 → 获准 → 出席（按人） | `applications`、`seat_events`、出席修订（服务端） | 概览/留存页“首次申请后 14 天内出席率”；旅程页 `funnel.join` | ⚠️ | 缺少按注册周入组的逐人漏斗。`funnel.join` 是按申请记录计的，而且**写在 `telemetryReady` 条件里面**（metrics.ts）：没设置 `ANALYTICS_COVERAGE_START` 时，这组纯服务端漏斗也不显示 |
| 按平台（iOS/Web）拆分 | `session_families.kind`（服务端）；事件里没有平台字段 | 无 | ❌ | 数据库已有，不需要新增采集 |
| 获客来源、活动、推荐、分享链接 | 完全没有采集；产品里也没有分享功能 | 筛选栏有“来源”，但 API 直接返回 `PROVIDER_UNAVAILABLE` | ❌ | 上线后无法补回，见 P0-3 |
| **匹配**：每场申请数 | `applications`（服务端） | 只有申请总数 | ⚠️ | 看不到每场分布和“0 申请”场次的占比 |
| 获准、拒绝、撤回、过期比例 | `applications.state`（服务端） | 申请列表里有状态列；“获准”和“确认”两张卡数值永远相同 | ⚠️ | 首期获准即确认，两张卡重复；拒绝、撤回、过期没有汇总 |
| 审核耗时 | 申请时间到获准或拒绝的时间 | 旅程页 P50/P90、待审数、最久等待 | ✅ | 待审单列，口径正确 |
| 席位填充率 | `seat_events` 中开始时的持座人数 / `capacity` | 无（招募达标率只和最低人数比） | ⚠️ | 计算简单，快照里已经有所需字段 |
| 未出席 | 出席修订里的 absent | 供需页出席分布 | ⚠️ | 依赖本人或 host 的报告覆盖率，unknown 不算失约（正确），但结论可能偏少 |
| **结果**：每周确认出席人数 | 出席事实 | 概览页 `weekly` 和周趋势 | ✅ | 最接近北极星的指标，同周去重、包含 host |
| 饭后评分 | `experience_revisions` | 留存页覆盖率和 1–5 分分布 | ✅ | 与产品问卷分开统计，正确 |
| 公开评价（references） | `public_review_revisions`（服务端） | 无 | ❌ | |
| 互选／再约率 | `pair_consents`（服务端） | 无 | ❌ | 主PRD用“满意的真实见面、愿意再见及关系延续”衡量价值，这正是“愿意再见”的直接事实 |
| 重复赴约 | 首次出席后 30 天再赴约 | 概览页、留存页及按周队列 | ✅ | 未满 30 天的单列，不算流失 |
| W1/W4/W8 队列留存 | 同上 | 只有 30 天这一个窗口 | ⚠️ | 头 3 个月需要更早的信号（4 周）和持续性信号（8 周） |
| 产品问卷（是否愿再参加） | `product_surveys` | 留存页 | ✅ | |
| **安全**：举报数（按原因、对象） | `reports.target_type`、`reports.reason`。已提交代码只有 `private_concern` 一种原因；同日另一项在途改动（迁移 0028，尚未提交）把原因扩为 safety / harassment / scam / under_18 / other，并对紧急原因即时提醒 | 举报队列（逐条） | ⚠️ | 没有汇总。原因分级上线后，按原因计数就能直接从服务端得到 |
| 自动限制、停用、恢复 | `moderation_actions`（AUTO_HIDE、SUSPEND_USER 等） | 逐条处理记录 | ⚠️ | 没有计数 |
| 24 小时内处理率 | `reports.created_at` 加首个 SUPPORT 动作或领取审计 | 队列逐条显示剩余时间或已超时 | ⚠️ | 没有达标率和耗时中位数；主PRD把“举报处理时效”列为上线后要观察的指标 |
| 屏蔽 | `block_revisions` | 无 | ❌ | 低优先级 |
| **地理**：伦敦片区 | `area_code`（9 个区共 232 个片区，范围外为 unknown） | 区域筛选、区域比较 | ⚠️ | unknown 占比不可见；片区太细，小样本下需要合并到区一级 |
| **通知与邮件**送达 | `outbox.status`、`mail_provider_messages` 的送达和退信时间 | 无 | ❌ | 申请、取消等通知全靠邮件和站内消息（没有推送），退信等于用户收不到 |
| 登录完成率 | `auth_transactions`：验证码发出 vs 已使用 | 无 | ❌ | 邮箱验证码送不到会直接压低注册数 |
| **App 质量**：错误、崩溃 | 没有崩溃 SDK；`form_error` 只覆盖创建流程；`discovery_failed` 来自服务端 | 质量页只看采集管道本身的质量 | ❌ | 先用 App Store Connect 自带的崩溃统计，见 P1 |
| 北极星 / 核心指标 | 后台PRD三项核心：每周确认出席、14 天激活、30 天再赴约 | 概览页 | ⚠️ | 三项都依赖出席报告，概览页已经并列显示出席覆盖率（正确）。“愿意再见”（互选）缺失 |
| 数据质量 | 投递记录、重复、排除、延迟 | 质量页 | ✅ | |

## 3. 上线前必须补（P0）

> 实施状态（2026-10-29）：P0-1 至 P0-5 全部完成，实现说明与偏差见 §8。

原则：优先补**上线后补不回来**的数据，再补会让人**看错**的口径。新增内容一律基于服务端已有事实，不新增第三方追踪。

### P0-1 快照存储加上限，并写明原始数据保留期 ✅ 已完成

- 问题：worker 每小时把截至当时的**全部历史**（包括所有分析事件及其属性）存成一份新 JSON（`snapshots.ts`），没有任何删除机制。按小规模试点估算（每天几千条事件），一个月后每份快照可能就有几十 MB，每天 24 份，首尔服务器的磁盘会在几周内被占满。页面每次请求也要读整份 JSON。
- 改法（只改 worker，不改页面）：保留最近 48 份按小时的快照，之后每个伦敦日只保留一份（取当天最后一份），保留 120 天；更旧的连同 `analytics_snapshot_subjects` 和对应导出一起删除。PRD 写的是“每小时更新”，不变。
- 保留期（UK GDPR 存储限制原则，需要写进隐私说明）：建议原始分析事件 `analytics_events` 保留 13 个月；`analytics_discovery_requests` 只在接收事件时用来校验，保留 30 天；`analytics_deliveries` 保留 90 天。保留期必须长于最长观察窗（30 天）加上对比期，否则清理后 30 天指标会断档。

### P0-2 概览页加一行“本周运营”，全部用服务端事实，不需要授权 ✅ 已完成

在快照中补充以下事实，并在概览页三个核心结果卡**上方**加一行。每张卡都按伦敦时间、周一起算的周统计，显示本周和上周；点开可以下钻到 userId 或 mealId（只显示伪名 ID）。

| 新指标 ID | 定义 | 来源 |
|---|---|---|
| `signups` | 本周新注册成员：`users.created_at` 落在该伦敦周，排除 test/staff；同时按平台拆分（见 P0-3） | users、account_classifications |
| `mealsPublished` | 本周新发布饭局：`meals.created_at` 落在该周，**包括还没开始的场次**；排除测试 host | meals |
| `firstApplications` | 本周首次申请的成员：全历史第一条 applicationId 落在该周 | applications |
| `mealsHeld` | 本周已开始且未取消、并有出席证据的场次 / 本周计划开始的已发布场次 | meals、出席 |
| `weekly`（已有） | 每周确认出席人数，移到这一行 | 已有 |

同时修一个阻断问题：把 `series['funnel.join']` 移到 `if(facts.telemetryReady)` 外面（`apps/api/src/admin/metrics.ts`）。它只用申请和席位事实，不应该被分析授权的就绪门槛挡住。“获准”和“确认”两张卡数值相同，合并为一张“获准（即确认）”。

### P0-3 上线后补不回来的三个字段 ✅ 已完成（Web 端采集由另一负责人按 §8.3 契约实现）

1. **`profiles.completed_at timestamptz`**：昵称、简介、年龄确认、社区规范确认四项首次全部满足时，由服务端写入，之后修改资料**不更新**。不加这个字段，“注册 → 资料完成”这一步永远算不出来。迁移只需要一列，并在 `updateMe` 的事务里写一次。
2. **注册平台**：不新增采集。快照里取该成员**最早**一条 `session_families.kind`（WEB 或 IOS），记为 `signupPlatform`。需要注意：删号清理时会删除 session_families；停用时会撤销会话，但记录保留。
3. **获客来源 `users.signup_source text`**（可空，≤40 字符，只接受固定格式 `^[a-z0-9_-]+(:[a-z0-9_-]+)?$`）：
   - Web：落地页 URL 上的 `utm_source` 和 `utm_campaign` 规范化为 `source:campaign`，只放在内存或登录回跳 URL 里，**不写 cookie 或本地存储**，账号创建时写入一次；从饭局链接进入的记为 `meal_link`。
   - iOS：App Store 不传参数，一律记为 `ios_app`。不做设备指纹，也不接入第三方归因 SDK。
   - 这是活动层面的粗粒度信息，按正当利益处理，在隐私说明里写明。有了它就能启用现有的“来源”筛选，只对成员相关指标生效；在此之前隐藏这个筛选，避免点了就报错。
   - Owner 每个推广渠道使用一条带 utm 参数的链接即可。

### P0-4 依赖授权的指标要标成“授权样本”，并显示授权覆盖率 ✅ 已完成

- 受影响的指标：发现后 7 天申请率（`discovery7`）、有曝光但 7 天未申请（`impressionNoApply`）、浏览人数（`browse.people`）、功能使用（`features.usage`）、表单错误（`formErrors`、`form.errors.*`）、发起漏斗（`funnel.create`）、后续机会曝光（`laterOpportunity`）、发现无结果率（`discovery`）。在这些卡的脚注统一加上“仅含同意分析的会话”。
- 新增 `consentCoverage` 指标，放在质量页，同时在受影响卡片的脚注里引用：期内有授权记录（`analytics_consents` 中 `family:` scope 已授权）的不同 userId / 期内有登录会话（`session_families.created_at` 在期内）的不同 userId。iOS 游客不在分母中，需要注明。
- 读数规则写进字典：授权样本只用来看趋势或做内部对比，**不要和服务端分母相除**。例如 `discovery7` 的分子是全量申请，分母却只是授权用户，结果会系统性偏高。

### P0-5 上线当天的运维步骤（不改代码） ✅ 已写成清单：[上线当天的运营数据步骤](../operations/launch-day-analytics.zh-CN.md)

- 第一位真实用户进来之前，用“数据与定义”页把 Owner 本人、所有 QA 账号、**App Store 审核演示账号**、种子数据的 host 标记为 test 或 staff，并写明原因。测试 host 的场次会整场排除。
- 按 [infra/README](../../infra/README.md) 在生产环境实际核对 Web、iOS 和 API 的采集后，再设置 `ANALYTICS_COVERAGE_START`。不设置时，曝光和发起类指标会一直显示“未就绪”。
- 在[举报值守流程](../operations/moderation-runbook.zh-CN.md)或[接手开发计划](claude-takeover-plan.zh-CN.md)的进度记录中写下上线日期，作为基线起点；前 2–4 周只核对采集是否完整，不定目标（与后台PRD §7 一致）。

## 4. 上线后 1 个月内补（P1）

均基于已有表，不新增客户端事件。

| 编号 | 内容 | 定义与位置 |
|---|---|---|
| P1-1 | 按注册周入组的成员漏斗 | 旅程页新增一节：注册 → 资料完成 → 首次申请 → 首次获准（首个 GUEST_CONFIRMED） → 首次出席（present）。每一步显示人数和相对上一步的转化，观察 14 天，未满 14 天的单列；按平台和来源拆分。host 路径单独一条：注册 → 首次发布 → 首场成团 |
| P1-2 | 供给细分 | 供需页：`mealsPublished` 按片区（合并到区一级）、时段（以伦敦时间 16:00 为界分午餐/晚餐；工作日/周末）、预算档、菜系拆分，快照需补 `cuisine_code`。新增 `hostRepeat`：首次发布后 30 天内再次发布的 host / 首次发布已满 30 天的 host |
| P1-3 | 匹配细分 | `applicationsPerMeal`：申请已截止的场次中，每场申请数的中位数和“0 申请”占比。`applicationOutcomes`：申请已截止的申请按 CONFIRMED / DECLINED / WITHDRAWN / EXPIRED / CANCELLED 分布。`seatFill`：已开始且未取消的场次，开始时持座人数 / capacity 的平均值 |
| P1-4 | 关系结果 | 留存页：`mutualRate` = 同场双方都有有效 present 的成员对中，双方都选择再约的对数 / 合格对数（只显示汇总，不显示单方意愿，符合后台PRD §2）；`referenceCoverage` = 已发布公开评价的合格对数 / 合格对数 |
| P1-5 | 队列延长 | 首次出席队列表在 30 天之外增加 28 天（W4）和 56 天（W8）两列，同样只统计已满窗口的成员 |
| P1-6 | 安全汇总 | 举报页顶部显示近 7 天和 28 天：举报数（按用户、饭局、消息拆分；原因分级上线后再按原因拆，旧的 `private_concern` 归入 other）、紧急提醒次数（moderation_alerts）、自动限制数、停用和恢复数、**24 小时内首次员工处理率**和处理耗时中位数（举报创建到首个 SUPPORT 动作或领取）、30 天自动关闭数（即无人复核，应为 0）、屏蔽次数。全部来自 reports、moderation_actions 和 audit_events |
| P1-7 | 邮件与登录送达 | 质量页：近 7 天按模板统计邮件的已发送、已送达、退信、死信（outbox 加 mail_provider_messages）；登录验证码完成率 = 已使用的验证码交易 / 已发出的验证码交易（只统计数量，不显示邮箱哈希或 IP 哈希） |
| P1-8 | 发现无结果改为全量匿名统计 | 发现接口在服务端按伦敦日累计“请求数 / 0 结果数”，按所选片区拆分，**不记录任何身份**。这样不需要授权，可以替代现在只有授权样本的 `discovery` 指标 |
| P1-9 | 排除说明 | 质量页显示“因账号状态（停用、删除中、已删除）被排除的成员数”，用来解释历史数字为什么回落（见 §6） |
| P1-10 | App 质量 | 不接入 SDK。每周看一次 App Store Connect 或 Xcode Organizer 的崩溃和卡顿统计；API 的 5xx 比例从服务器日志按天统计，写进值守记录。真正出现稳定性问题再考虑 Sentry 这类工具 |

## 5. 可以不做

- A/B 实验平台、自动归因、自动写周报的经营 Agent、实时看板：样本太小，每小时一份快照已经足够（后台PRD §1.1、§3.2 已排除）。
- 第三方分析 SDK、广告像素、设备指纹、IDFA 或 ATT 授权弹窗：合规成本高，而且与“分析需授权”的原则冲突。
- 访客到注册的跨设备身份拼接：PRD 明确不猜测身份。游客阶段接受只有授权样本，注册之后全部用服务端事实。
- DAU/MAU、停留时长、App 打开留存：主PRD写明这些不代表成功。
- 举报原因之外的再细分（如严重程度评分、自动分类模型）：举报量小，直接读原文即可。原因分级本身已在推进中，见矩阵。
- 推送送达分析：目前没有推送。
- 每场明细热力图、地图可视化、自定义报表构建器：需要时导出 CSV 就够了。
- 独立的客服工单系统、员工管理页（§8.1 已排除）。

## 6. 数据口径风险

| 风险 | 现状 | 影响与读法 |
|---|---|---|
| **授权偏差** | 授权只对当前会话有效；iOS 只在登录后询问；游客只有 Web 端可能授权 | 授权样本偏向愿意配合的人；iOS 游客浏览为 0。凡是能用服务端事实的都用服务端事实（P0-2、P0-3、P1-8）。授权样本不跨平台比较，不与全量分母相除 |
| **出席报告覆盖** | 三项核心结果都依赖本人或 host 报告；unknown 不计入 | 覆盖率低时，激活和再赴约会被低估。先看覆盖率再看结果；建议（非达标线）覆盖率明显偏低时只看趋势，不下结论 |
| **测试账号** | 分类按 userId、有版本，只有修改之后生成的快照才生效；测试 host 的场次整场排除 | 上线前必须完成 P0-5 的分类。App 审核账号和 Owner 自测账号最容易被漏掉；种子数据不能进入生产环境 |
| **时区** | 归日归周都用 `Europe/London`、周一起算；观察窗按连续的 24 小时计算；有夏令时边界测试 | 口径正确。首尾周不完整，概览页已有“周数据不完整”提示，不要拿不完整的周做环比 |
| **停用与删除成员** | 快照只取 `status='ACTIVE'` 的成员（snapshots.ts），停用、删除中、已删除成员的申请、席位、出席、评分都会从**新快照**里消失；饭局只按分类排除，所以他们主持过的场次还在 | 历史周数据会**往回变小**；被停用者的行为恰好是安全分析最需要的，却看不到。建议每周导出一次聚合 CSV（只有聚合数，不含个人数据）作为 Owner 的固定周记录；加上 P1-9 的排除计数。不建议为了统计保留已删除成员的身份数据 |
| **删除导致快照撤销** | 删号时会撤销所有包含该成员的快照和导出，并清除其快照事实 | 旧数字无法复现，下钻会提示“快照已撤销”，需要换一份新快照。这是隐私设计的正常结果，周记录要靠导出的聚合 CSV |
| **保留期清理** | 目前没有按时间清理原始分析事件和快照的机制；另按提交 b38fa72（迁移 0029），已删除账号的安全记录保留 12 个月后清除，所以举报类统计在删号后一年内仍可回看 | 落实 P0-1 后，事件类指标的可追溯起点会后移，需要同步更新 `historyCoverageStart` 并在质量页说明 |
| **快照不是历史重建** | 只能在“现在”这个时间点做快照，不支持任意时间点重算 | 修正和补报只影响新快照；比较两周时用同一份快照，不要拿不同快照的数相除（后台PRD §5.3） |
| **“会话”含义** | 事件里的 `session_id` 实际是登录会话族 ID，不是 30 分钟无操作就过期的会话；同一会话族对同一饭局只保留第一次曝光 | 曝光数接近“每次登录看过的不同饭局数”，不等于浏览次数 |
| **申请计数单位** | 截止前重新申请会生成新的 applicationId | `applications` 是申请次数，不是人数；按人统计看 P1-1 |
| **小样本** | 伦敦试点初期每个片区只有个位数场次 | 比例必须同时看分子分母；样本少于 10 的片区不排名，先合并到区一级 |
| **隐私最小化** | 下钻只显示伪名 userId 和 mealId，不显示姓名、联系方式、正文 | 新增的 `signup_source` 和 `completed_at` 都是粗粒度、服务端写入的字段，需要在隐私说明（数据存放在韩国、依据充分性认定）中补充用途和保留期；不采集 IP、设备或自由文本 |

## 7. 后续

本节为评审当时的原文；P0 的实施记录见 §8。评审本身只给建议，没有修改代码。P0 各项需要 Owner 确认后，交由主开发按[Agent 协作说明](../agent-collaboration.md)明确文件负责人后实施：契约（`ADMIN_PAGE_KEYS`）、快照 worker、迁移、页面、字典和测试需要在同一个变更里一起改，口径版本升到 v5，并同步更新后台PRD §4 和[采集契约](../product/admin/measurement-contract.zh-CN.md)。

## 8. P0 实施记录（2026-10-29）

负责人：Claude Code（主开发）。口径版本升为 **v5**（契约常量 `ADMIN_DEFINITION_VERSION`，迁移 `0030_ops_analytics.sql` 放宽 `analytics_snapshots.definition_version` 为 v4/v5）；旧 v4 快照仍可读，但不能按来源筛选，两个版本的数字不直接比较。v5 的指标定义以本节和后台“指标字典”（`apps/admin/src/dictionary/metrics.ts`）为准；[后台PRD §4](../product/admin/PRD.zh-CN.md)与[采集契约](../product/admin/measurement-contract.zh-CN.md)受需求追溯台账（`tests/test_requirements_traceability.py`）逐行固定，需按台账流程复核范围后再同步，本次未改动。

### 8.1 做了什么

| 项 | 实现 | 位置 |
|---|---|---|
| P0-1 保留期 | 最近 48 份快照全留；更旧的每个伦敦日只留当天最后一份**未撤销**快照，保留 120 天；其余快照连同 facts、subjects、导出元数据在一个事务里删除。原始分析事件 13 个月（按接收时间）、发现请求 30 天、投递记录 90 天，分批删除。worker 每小时与安全记录清理一起执行；`RETENTION_POLICY_JSON` 可用 `analyticsHourlySnapshots`、`analyticsDailySnapshotDays`、`analyticsEventMonths`、`analyticsDiscoveryRequestDays`、`analyticsDeliveryDays` 覆盖（非法值回到默认）。快照的 `historyCoverageStart` 取声明起点、台账安装时间与事件保留下限三者最晚。隐私通知保留期表已更新（其余占位符不变），网页已重新生成 | `apps/api/src/admin/retention.ts`、`apps/worker/src/main.ts`、`docs/policies/privacy-notice.draft.en.md` |
| P0-2 本周运营 | 概览新增一行：`signups`、`mealsPublished`、`firstApplications`、`mealsHeld`、`weekly`，脚注显示本周起始日、上周同口径（`ops.previousWeek`）和注册平台拆分（`signups.platform`），点卡片可下钻到伪名 userId/mealId。`funnel.join` 移出 `telemetryReady` 条件，阶段改为 applications → confirmed → attended；“获准”卡删除，“席位已确认”改称“获准（即确认）” | `apps/api/src/admin/metrics.ts`、`apps/admin/src/pages/pages.tsx`、`packages/contracts/src/dictionaries.ts` |
| P0-3 字段 | `profiles.completed_at`：`updateMe` 在资料闸门首次完整时写一次；**存量资料不回填，保持 NULL**（真实完成时间未知，补一个时间会把他们放进错误的注册→完成区间）。注册平台：快照取成员最早一条 WEB/IOS `session_families.kind`，不新增采集。`users.signup_source`：见 8.3；iOS 在 `startEmail`/`startOAuth` 发送 `{ entry: 'ios_app' }`。删号时清空 `signup_source`（资料行本身被删除）。后台“来源”筛选：v5 快照的 `dimensions.sources` 来自 `signup_source` 第一段；没有来源数据时隐藏筛选，v4 快照仍返回 `PROVIDER_UNAVAILABLE` | 迁移 0030、`apps/api/src/profiles/routes.ts`、`apps/api/src/identity/{signup-source,routes,flows,resolve}.ts`、`apps/admin/src/features/filters/FilterBar.tsx`、`apps/ios/src/features/auth/{oauth,otp}.ts` |
| P0-4 授权样本 | `ADMIN_CONSENT_SAMPLE_KEYS` 列出的卡片和图表加“仅授权样本 · 授权覆盖 x%”；质量页新增 `consentCoverage`，并在其他三页随页面数据返回（仅用于脚注，不画卡片）；质量页写明“不与服务端总数相除” | `apps/admin/src/pages/pages.tsx`、`apps/admin/src/dictionary/metrics.ts` |
| P0-5 上线清单 | 新增运维文档，写明分类面板、SQL 兜底、采集核对 SQL 与基线记录表 | [上线当天的运营数据步骤](../operations/launch-day-analytics.zh-CN.md) |

### 8.2 与评审原文的差异

- **资料完成的定义**用产品现有的资料闸门（`profileGate.profileComplete`：昵称、简介、语言、伦敦生活状态、兴趣、年龄确认、社区规范确认七项），而不是评审写的四项，保证后台与 App 的“资料完成”是同一件事。
- **“本周”**固定为快照所在的伦敦周，不跟随日期筛选；`weekly` 卡仍取最近可见周，它的“上周”是该周之前的一个日历周。
- **`mealsHeld` 的分母**只含已到开始时间的本周场次（未开始的不算“计划但未成局”）。
- **来源值格式**：`source:medium:campaign`（缺 medium 时为 `source::campaign`），比评审的 `source:campaign` 多保留 utm_medium；数据库约束 `^[a-z0-9_-]{1,40}(:[a-z0-9_-]{0,40}){0,2}$`。
- **授权覆盖率**按“期内创建登录会话的成员”计，授权状态取快照时点；撤回授权的会话不计入分子。
- **来源筛选的作用范围**：只作用于成员相关指标（含 userId 的申请、出席、问卷、事件），筛选值等于完整来源或其第一段即命中；匿名事件在来源筛选下排除；饭局类指标（成团、取消、区域比较、新发布饭局）不受影响。
- **投递类质量指标**（缺字段、重复）在保留期生效后只覆盖最近 90 天；分析事件类指标的可追溯起点不早于 13 个月前。

### 8.3 注册来源契约（给 Web 负责人）

`apps/web` 由另一负责人实现，本次未改动。服务端与契约已就绪：

- 请求字段：`POST /v1/auth/email/start`、`POST /v1/auth/email/verify`、`POST /v1/auth/oauth/start` 的 body 均接受可选 `signupSource`（契约 `SignupSource`，`packages/contracts/src/operations/auth.ts`）：

  ```json
  { "signupSource": { "utmSource": "instagram", "utmMedium": "social", "utmCampaign": "launch", "entry": "meal_link" } }
  ```

  四个键都可选；`utmSource`/`utmMedium`/`utmCampaign` 为 1–100 字符的原始字符串，`entry` 只能是 `meal_link` 或 `ios_app`（Web 只用 `meal_link`）。不允许其他键，非法值返回 422，所以客户端应先丢弃空值、截断到 100 字符。
- 服务端处理：小写，非 `[a-z0-9_-]` 字符换成 `-` 并合并，每段截到 40 字符；有 `utmSource` 时记 `source[:medium[:campaign]]`，否则记 `entry`；清洗后为空就不记录，**不会因此让登录失败**。只在这次登录**创建新账号**时写入一次，老账号再登录不改。verify 带的值优先于 start 带的值；OAuth 只看 start。
- Web 采集要求（评审 P0-3）：从落地 URL 读取 `utm_source`、`utm_medium`、`utm_campaign`；从分享的饭局链接（`/meals/{id}`）进入且没有 utm 时用 `entry: 'meal_link'`。只放内存或登录回跳 URL，**不写 cookie、localStorage 或 sessionStorage**，不做设备指纹，不接第三方归因 SDK。
- 隐私通知已写明这类标签及其合法利益依据；Web 不需要额外的同意弹窗。
