# P1.1 客户端冻结稿差异盘点（P02）

2026-10-23，Claude Code。依据：用户端Figma `UNNhbMSEbFVxbRPgV3cuiX` CURRENT契约节点565:32377及其「当前精确节点映射」581:32487–32494（只读读取，未改Figma），补丁PRD0.6 §5.3/§11–13，方案plan.zh-CN.md。代码基线 `6c692ba`。

分类：**已符合**＝代码已有对应行为，保留不重写（仍需最终回归）；**待改**＝明确差异，列入切片；**证据不足**＝需画布像素级或真机核对，实施该切片时再逐节点比对，不预先重做。本表只覆盖PATCH001–005/007/008用户端；PATCH006后台不在此范围。

## PATCH-001 身份/资料/设置/删除（AC-001，节点192:16326/17070、493:*、522:*、480:*、489:*）

| 页面/组件 | Web | iOS | 结论 |
| --- | --- | --- | --- |
| 简介trim 20–1000 | ProfileEditPage.tsx `validate` trim+20–1000 | profile/model.ts 同规则 | 已符合 |
| 资料保存409/未知保稿 | Intent保留key，错误统一文案；未区分“Status unknown”与409加载最新 | profile/save.ts 同 | 待改（P04：unknown→回执核对，409→加载权威版并保留草稿对照） |
| 读失败≠空资料 | useQuery错误态 | useQuery错误态 | 证据不足（实施时核对ProfileEdit首屏错误分支） |
| 删除受理/receipt查询 | DeletionPage.tsx receipt本地查询 | DeletionStatusScreen + deletion-receipt-store | 已符合（受理不称完成） |
| NEEDS_SUPPORT/回执丢失公开支持出口 | 无邮箱/复制入口 | 无 | **待改**（P04：mailto+可复制xcheniepaut26@gmail.com，不携receiptToken，取消不称已发送） |
| 登录回流同页 | returnTo.ts/drafts.ts | auth/intent.ts | 已符合（不自动提交） |

## PATCH-002 发现/详情/申请（AC-002，136:16591…、192:16818/17538、195:*、256:*、259:*、580:*）

| 项 | 现状 | 结论 |
| --- | --- | --- |
| 地图/列表/筛选、地图失败切列表 | DiscoverPage/DiscoverScreen、maps/* | 已符合（保留布局） |
| 申请20–300 trim | ApplyPage/ApplyScreen | 已符合 |
| 迟到结果不覆盖当前对象 | useQuery按key；申请Intent | 证据不足（P05核对query generation） |
| 共享服务状态580:*（Places加载/失败） | VenuePicker有失败文案 | 证据不足（逐节点核对文案） |
| 撤回与退席分离、withdraw重试原意图 | MealDetail/HostPage | 已符合（P05回归） |

## PATCH-003 创建/DST/host（AC-003，134:*、136:17895、137:9913、561:*、248:*）

| 项 | 现状 | 结论 |
| --- | --- | --- |
| TIME_AMBIGUOUS→BST/GMT显选，开始/截止分别 | CreatePage.tsx `ambiguity.field` start/close；iOS CreateStepScreen | 已符合（服务端返回choices后选择） |
| 不存在时间报错不顺延 | TIME_NONEXISTENT/INVALID_OFFSET分支 | 已符合 |
| 发布失败保稿、未知不重复创建 | Intent同key重试；网络失败后未查回执 | 待改（小：unknown→reconcileIntent(createMeal)） |
| 首批准后关键字段锁、并发结果表 | EditMealPage/HostPage ARRANGEMENT_LOCKED处理 | 已符合（P05回归） |

## PATCH-004 Meals/Inbox/群/饭后反馈（AC-004a–d，401/404/407/410/418/423/567）

| 项 | 现状 | 结论 |
| --- | --- | --- |
| 单一`Save feedback`、dirty项、Skipped/Saving/Saved/Not saved yet/Failed/Status unknown/Version conflict | Web/iOS为独立“Save reference”按钮+再约复选框即时保存 | **待改（P06主切片）** |
| 空公评无变化零写；已有公评不能空覆盖 | 空正文禁用按钮，无提示 | 待改 |
| OPEN取消再约先确认，Keep零写 | 复选框取消OPEN弹revoke确认（仅单项） | 待改（并入组合保存：确认后串行公评→revoke） |
| 串行、首项失败/未知/409暂停后项，重试仅未成功项 | 无 | 待改 |
| 对象隔离（账号+mealId+subjectId+operation），迟到响应不改当前对象 | 切换成员清空草稿，无隔离记录 | 待改 |
| unknown用P03回执核对；不以当前值相同判成功 | 无 | 待改（依赖P03已交付） |
| revoke不受7天窗口；公评过期组合停在公评 | 窗口关闭时隐藏整个反馈区，OPEN撤回仍可用 | 待改（窗口关闭仍可撤回；组合规则） |
| 群403→授权历史只读 | ChatPage 403→toHistory | 已符合 |
| 退群后群设置隐藏名册/人数/搜索/候选（AC-008n） | 设置页无名册；退群后只读说明 | 部分符合（P07/P17补`Left group`只读态与mute） |
| 聊天可见已读与通知已读分离 | read-ack/markConversationRead；通知markRead独立 | 已符合 |

## PATCH-005 AI转入（AC-005，136:9252/12691、438:*、456:*、136:12021/15537、136:12190/12523）

| 项 | 现状 | 结论 |
| --- | --- | --- |
| 已有人工文字先确认替换，Keep保持原文 | AssistantPanel `Replace your editor text?` keep/confirm；iOS AssistantWidget | 已符合 |
| 失败/过期不清人工草稿；转入后仍须主动提交 | transfer仅写编辑器 | 已符合（P08回归F66/F68） |
| 转入绑定账号+meal/群+编辑器 | context.tsx editor binding | 证据不足（P08核对跨场次迟到） |

## PATCH-007 分享（AC-007a–g，142:*、144:*、186:*、209:*、192:*、206:*、188:*/207:*）

全部**待改（P11/P12新增）**：详情`Share`（可访问名`Share meal`）、自有分享菜单（系统分享/Web Share、WhatsApp wa.me、Copy link for WeChat、Copy link、复制邀请文本）、复制真实成功才`Copied`、失败可选中文本、取消不报成功、终态“View meal”文案、不可用链接。纯函数生成canonical URL（无token/actor）。iOS Universal Link配置仅工程准备，正式域名AASA部署不在本授权。

## PATCH-008 提及/免打扰/提醒（AC-008a–n，153:*、160:*、165:*、175:*、201:*、204:*、174:14336/14403、183:*）

全部**待改（P13–P17新增）**：后端v2消息+mentions、候选接口、notification-settings(If-Match/409)、push订阅、recipient/delivery+epoch REVOKED、worker投递（fake APNs/WebPush）、0027起迁移；客户端@候选/标记、host-only Everyone、mute设置409刷新、横幅/定位、权限引导。真实APNs/WebPush未测不称PASS。

## 共享组件

Screen/Field/AsyncButton(Primary busy)/ConfirmSheet/Sheet/Notice沿用；新增分项状态行与分享菜单作为新组件，不改未受影响页面的共享组件行为。375/390/393/430、44pt、键盘/焦点在各切片实测。
