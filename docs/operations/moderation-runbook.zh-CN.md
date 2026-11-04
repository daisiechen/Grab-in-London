# 举报值守流程（24 小时复核）

2026-10-29 Owner 决定：条款保留“aim to review reports of objectionable content within 24 hours”，由 Owner 承担，日常提醒与预读托付给她的助理 Ethan。系统规则见[接手计划 §8](../delivery/claude-takeover-plan.zh-CN.md)；本页只写人要做什么。

## 1. 不需要人的部分（系统自动）

- 举报人提交后立刻看不到被举报内容，并在 App 里收到自动回执。
- 7 天内 2 名不同成员举报同一对象：对所有人限制（消息正文隐藏、饭局撤出发现页并停止接受申请、资料简介与头像隐藏），可撤回。
- 30 天没人处理的个案自动关闭，限制保留。
- 举报必须选一个原因（2026-10-29 Owner 决定）：人身安全或威胁 `safety`、骚扰或仇恨 `harassment`、诈骗/垃圾信息/广告 `scam`、可能未满 18 岁 `under_18`、其他 `other`。其中 `safety`、`harassment`、`under_18` 为“紧急”：在后台队列排最前并标红，且立即发出紧急提醒（见第 2、4 节）。2026-10-29 之前的旧举报原因是 `private_concern`，后台显示为“其他”。

所以夜里或周末来不及看时，内容已经先被挡住；人复核是为了决定“维持还是撤回”和“要不要停用账号”。

## 2. 每日节奏

| 时间（伦敦） | 谁 | 做什么 |
| --- | --- | --- |
| 任何时间 | 系统 | 收到紧急原因（`safety` / `harassment` / `under_18`）的新举报时，立即给 `SUPPORT_EMAIL` 发一封只含后台链接的邮件，并推送 Ethan（`kind: "urgent"`）。10 分钟内最多一条，期间新到的紧急举报合并到下一条并带累计数量；每个个案最多提醒一次 |
| 任何时间 | Ethan | 收到 `urgent` 推送后立即在 Telegram 提醒 Owner（原因类别、数量、后台链接） |
| 08:00 后 | 系统 | 有未关闭举报时生成每日摘要（只有数量、剩余时间和后台链接，不含举报文字或姓名），发到 `SUPPORT_EMAIL`，并推送 Ethan（`kind: "morning"`） |
| 08:30 | Ethan | 摘要非空时在 Telegram 告诉 Owner：几条新举报、几条已自动限制、最早一条还剩多少小时，附后台链接；为空则不打扰 |
| 当天 | Owner | 打开后台“举报”队列（紧急的排最前），逐条“领取 → 看详情 → 一键处理”，通常每条 1 分钟内 |
| 20:00 后 | 系统 → Ethan | 若有已超时或剩余不足 6 小时的举报，推送 Ethan（`kind: "evening"`，每个伦敦日最多一次），Ethan 再提醒一次 |

Ethan 只看摘要（编号、数量、时限），不看举报文字、聊天内容或成员资料，也不在后台做任何处理：停用账号等决定必须由人作出（条款与 UK GDPR 第 22 条），且举报内容不交给 Ethan 所用的 AI 服务，避免隐私通知之外的数据处理。

## 3. 怎么判（按预设按钮）

| 看到的情况 | 按钮 | 说明 |
| --- | --- | --- |
| 没有违规（误报、不喜欢对方） | 恢复 `RESTORE` | 解除对所有人的限制；举报人自己仍看不到 |
| 违规但不严重（不当文字、无关广告、头像不合适） | 维持 `UPHOLD`，或针对性“隐藏内容 / 清除昵称简介 / 删除头像” | 内容保持隐藏 |
| 饭局本身违规（假饭局、收费引流、违法地点） | 取消饭局 `CANCEL_MEAL` | 会通知全部成员 |
| 威胁、性骚扰、仇恨、诈骗 | 停用账号 `SUSPEND_USER` | 社区准则写明立即清退；需二次确认 |
| 疑似未满 18 岁（原因 `under_18`） | 停用账号 `SUSPEND_USER`，待核实 | 由人先停用并核实年龄（系统不会自动停用）；确认未满 18 岁则关闭账号，否则恢复。后台在此类举报上显示这条规则，“停用账号”预填内部备注“Suspended pending age checks…” |
| 有人身安全风险 | 停用 + 视情况报警（紧急 999，非紧急 101） | 在内部备注写明，必要时保留记录 |

每次处理都要写内部备注（可用预设），会进入审计。拿不准时先“维持”，限制本来就可撤回。

## 4. 推送给 Ethan（接口约定，2026-10-29）

Fancy 侧已实现（worker 经 outbox 发送，失败按退避重试）；Ethan 侧接收口在 Building-Ethan 仓库实现。

- 配置：`ETHAN_MODERATION_URL`（部署环境必须是绝对 https 地址）与 `ETHAN_MODERATION_TOKEN`（密钥，两者同时设置才启用）。令牌由 Owner 在服务器上录入，不进仓库、不进日志；Fancy 侧的密钥扫描会拦截源码里写死的令牌。开发/测试环境用内存适配器，不发网络请求。
- 请求：`POST <ETHAN_MODERATION_URL>`，请求头 `Authorization: Bearer <token>`、`Content-Type: application/json`，另带 `Idempotency-Key: <outbox id>`（重试时不变，Ethan 可据此去重）。
- 请求体（只有这些字段）：

```json
{"kind":"morning|evening|urgent","sentAt":"2026-11-05T08:00:12.345Z","open":3,"autoLimited":1,"overdue":0,"dueWithin6h":1,"oldestHoursLeft":4.5,"urgentOpen":1,"reason":"safety|harassment|under_18|null","count":1,"adminUrl":"https://…/admin/#moderation/<reportId>"}
```

| 字段 | 含义 |
| --- | --- |
| `kind` | `morning`：伦敦 08:00 后随每日摘要，仅当 `open>0`；`evening`：伦敦 20:00 后每日最多一次，仅当有已超时或 6 小时内到期的举报；`urgent`：紧急原因的新举报 |
| `sentAt` | 发送时间（ISO 8601）；数量在排队时统计 |
| `open` / `autoLimited` | 未关闭举报数 / 其中已自动限制数 |
| `overdue` / `dueWithin6h` | 已超过 24 小时目标 / 6 小时内到期（不含已超时） |
| `oldestHoursLeft` | 最早一条距 24 小时目标还剩的小时数（保留一位小数，超时为负数；无未关闭举报时为 `null`） |
| `urgentOpen` | 未关闭的紧急举报总数 |
| `reason` | 仅 `urgent` 有值；一条提醒覆盖多条举报时取最严重的：`safety` > `under_18` > `harassment` |
| `count` | `urgent`：本轮紧急提醒的**累计**举报数——同一轮（上一条紧急提醒在 20 分钟内）的后续提醒在前一条的数量上累加，只增不减；安静超过 20 分钟后重新从本条计起。`morning` = `open`；`evening` = `overdue + dueWithin6h` |
| `adminUrl` | 后台深链：只有一条紧急举报时指向该举报（`#moderation/<reportId>`，不透明编号），其余指向队列（`#moderation`） |

- 不含举报文字、姓名、邮箱或用户编号。
- 合并规则：10 分钟内最多一条 `urgent`；期间到达的紧急举报由 worker 在窗口结束后（每分钟检查）合并成一条。Ethan 侧在 10 分钟窗口内只在 `count` 比上一条通知增加时才再次提醒（2026-10-29 Ethan 侧约定）。
- 重试：2xx 视为送达；429、5xx、网络错误按指数退避（30 秒起，最长 1 小时）重试，最多 8 次或 24 小时；其他 4xx 视为终止，只记录 `ethan_push_dead`（outbox 编号、错误码如 `HTTP_401`、次数），不记录令牌、地址或内容。
- 上线后用一条测试举报端到端核对一次。

## 5. 例外

- 被停用成员要求删除账号：只能经支持邮箱处理（其无法登录），在后台核对身份后由 Owner 发起。
- 举报原因分级：2026-10-29 Owner 改为五个原因（见第 1 节），紧急原因立即提醒（邮件 + Ethan）。旧版 App 和 Web 仍可能提交旧原因 `private_concern`，按“其他”处理，不触发紧急提醒。
