# MVP补丁增量开发方案 P1.1（待受影响范围复评）

日期：2026-10-23 Europe/London。工程标识 `MVP-PATCH/P1`，不是产品发布号。方案/实施协调负责人：开发-MVP补丁版。产品发布号待PM确认；未确认不阻塞方案评审，但阻塞正式构建命名与交付。

本文件只新增补丁技术方案，不更改当前MVP PRD、Demo、旧core/AI方案或封存运行。用户授权顺序：方案→PM与相关UX独立评审→关闭B03隔离准备→功能开发。当前状态为第一步，尚无功能实施许可。评审固定同一Git提交及本文件SHA256，意见记入[评审记录](review.zh-CN.md)；作者自检不代替独立签收。

## 1. 精确输入及继承

- 父基线：annotated tag `mvp-freeze-2026-10-23`，tag object `a6322c588bc2782e713ab6043cdf1f872cb87117`，peeled commit `2e33ca2bbdc838c85a36d2e3bbd9b5fe216478ae`。本轮fetch和远端标签逐值一致；实施checkout从该SHA建，再串行带入已审方案提交，不从未来main漂移。标签不移动。
- [封存及测试继承](../../delivery/mvp-freeze-2026-10-23.zh-CN.md)为继承真源。归档SHA不是当时运行二进制：API/Web为`89dc5414bf0f9e91327075216ce0830d2b51d060`＋F66 `2ac8f7738eca4fec015627f765c41abcf2466ce9`精确overlay（d91517…实际加载1次）＋QA observed-clock适配；原生为正常签名F67组合，构建清单见该文引用的收尾历史。补丁必须从源码重新构建，不复制旧overlay或QA适配成生产行为。
- F68 `385665c411bbdb61d7e9006abc0dd49bbb95d4d6`在封存Git历史内，独立源码验证通过，当时运行未包含。补丁构建须证明包含该修复并重验原数值场景。F66源码在父历史内仍需最终构建回归；F67定向真机证据可复用，不冒称整体旅程通过。
- [补丁PRD0.6](../../product/mvp-patch-PRD.zh-CN.md)：来源`a7bb686bc64d75b0f0a85c8eca1bd53ef764d09e`，SHA256 `13d323089a5f34038cdc07b4edcb7552331c8e452eac22cad0fec0a1bc522748`。主PRD SHA256 `47f6cc2d0314b486c762852f2f61c18eab1e6f6fd63245d852b216527703c305`。历史“当前MVP继续测试/尚未封存”是当时记录，以最新封存决定为准；不由本方案代改PRD。
- [用户端冻结](https://www.figma.com/design/UNNhbMSEbFVxbRPgV3cuiX?version-id=2413486392119001938&node-id=213-18759)：`MVP patch PRD0.6 · Client + Mobile Web · Frontend handoff · 2026-10-23`，CURRENT契约565:32377；PATCH001–005/007/008独立设计复核可进入方案设计。浏览器代表路径通过不等于全API/设备验收；历史初评报告不覆盖最新复核。
- [后台冻结](https://www.figma.com/design/vod4UhtqdehUxR5D9PmRqI?version-id=2413485940620627528&node-id=208-7349)：`Fancy Admin · PATCH-006 · AF-RC1 · Design freeze · 2026-10-23`，映射208:7372。[AF-01～05正式关闭记录](../../reviews/admin-figma-patch-readiness-2026-10-23.zh-CN.md)适用；B03单列。
- 复用[core](../core-development-plan.zh-CN.md)、[数据](../data-and-command-contract.zh-CN.md)、[API](../api-and-client-contract.zh-CN.md)、[AI](../ai-development-plan.zh-CN.md)与现有apps/packages实现；旧文档的“待创建目录/默认模型”不是当前实施事实。[人民币预算](../decisions/ai-cny-budget.md)及[DeepSeek准备](../decisions/deepseek-readiness.md)覆盖已变更供应商边界，后者不是外呼批准。

## 2. 架构、责任与切片原则

保留模块化单体、Postgres事务+持久outbox、API/worker、HTTP轮询、Web/iOS/admin三端、生成式contracts/client。无新自治Agent、WebSocket/presence、Redis或服务拆分。PATCH001–006先对现有实现做差异核对，能复用即复用，不重建整套页面或业务。

开发-MVP补丁版是本方案及下述实施切片唯一写入owner；PM负责需求决定，用户端UX负责用户端冻结设计解释，后台UX负责PATCH006解释。评审者只读，不直接改工程文件。若分配其他实施owner，先在任务表逐项接受并交接文件，不默认已分派。共享`packages/contracts/**`、`packages/client/**`、`packages/db/**`、根lockfile/构建配置由本owner串行修改；每片只stage本片文件。PRD/Demo/Figma变更回原负责人，不能在工程中暗改产品规则。

## 3. 各PATCH增量及验收边界

| PATCH | 页面/组件及现有边界 | API/数据/权限差异与必须验证 |
| --- | --- | --- |
| 001 | apps/web、apps/ios身份/资料/设置/支持删除；493/522/480/489节点族 | 复用auth/people/support/receipt；简介trim20–1000。资料pending/409/未知/读取失败保留稿，账号变更清私密稿。删除受理不等完成，原requestId/receipt恢复，不重发新请求；仅本人/受限支持权限。真实身份/邮件/删除门槛继承 |
| 002 | 发现地图/列表、筛选、Meal详情及申请；192/195/580 | 复用meals/venues；请求绑定query/mealId/actor及generation，迟到结果不覆盖当前对象。Places失败保留草稿，地图失败可切列表；地址坐标由服务端验证。申请20–300且名额/截止/角色在写锁内重验，失败保稿，登录回流仍主动提交 |
| 003 | Arrange→Introduce→Costs→Review、host审批及安排；134/137/248/561 | 复用创建/修改及审批命令；本地时间+IANA Europe/London+显式offset传输。开始/截止各自处理重叠与不存在时间，服务端未来时间和主PRD截止约束优先；无静默平移。首个批准后关键字段锁、最后名额/截止/已处理/角色变化保持事务权威。P05为空不推断、非过敏保证 |
| 004 | Meals/Inbox/通知、群/私聊、饭后反馈；401/404/410/418/423/567 | 无跨接口原子保存；反馈状态机见§4。退席≠退群；群403进入授权历史只读，退群设置隐藏名册/人数/搜索/候选，不生成历史名册快照；聊天可见位置已读与通知已读分开。单方再约不进DTO/AI/日志 |
| 005 | Ask Fancy与原申请/创建/群消息编辑器；136/438/456/460/461 | 沿现有assistantContextDTO白名单；生成→选择→Keep/Replace→编辑器校验→人工提交。服务端draftId与actor/context/entity绑定，失效不自动重发；生成长度不等目标提交长度，过长带回须明确校验不截断。F68、软排序/hard/CLEAR回归；不新增AI业务写权限 |
| 006 | apps/admin五页、快照选择、筛选/明细/分类/导出；208/209/217 | 复用adminPage/Drilldown/Export/classifyUser及既有snapshot/exports迁移，不另建分析系统。增量见§5。1440/1024/864/390、locale/长文本/表内滚动/焦点验收 |
| 007 | Meal Share/落地/回流；142/144/192/206/207 | 新分享适配与链接路由，不建邀请券/占位/收件人表；§6约定公开投影、HTTPS及iOS链接、渠道降级。真实外部App验收独立，不向第三方自动发送 |
| 008 | 群composer提及选择、settings、横幅/通知定位；147/148/174/201/204 | 新版本化消息提及DTO、成员候选、设置revision、订阅、outbox/delivery；§7定义。仅群不含私聊@，host Everyone仍需canSend；服务端和客户端都校验，不靠隐藏按钮 |

视觉tokens复用冻结组件/开放字体。共享Screen/Field/AsyncButton/Recovery/ReadOnly/Overlay先做差异表，避免统一组件误改变未受影响路径。iOS393与Web390及375/430代表宽度、44pt、safearea/键盘、可访问名称/错误关联/live提示、Escape/焦点恢复纳入真实客户端验收。

## 4. 反馈及未决写入契约

scope=(accountId,mealId,subjectId,operation)，保存最近权威公评revision和再约/连接revision；draft与confirmed独立。dirty比较trim正文及布尔值。首次空公评跳过；已有公评清空报不能空覆盖，绝不隐式删除。两项均无变更只提示No changes，无HTTP写。

OPEN且取消连接：任何写前先确认；取消确认整次零写。确认后串行公评→choice/revoke；每项独立Idempotency-Key、If-Match、规范payload。无公评改变跳过。Skipped/Saving/Saved/Failed/Unknown/Conflict/Not saved yet逐项显示；第一项失败/409/未知暂停后项；成功不回滚、不重交。撤回按人对权限与revision，不能复用mealId/七天/出席gate；组合公评过期仍先失败并保留独立撤回入口。

未知先按原key+body+If-Match重放同意图（重新鉴权后），或读取权威资源对账；权威资源值相同不单独证明某原写成功，需原幂等回执才能清除未决意图。必要最小新增受认证GET `/me/command-receipts/{operation}/{key}`，仅白名单操作、原actor访问，返回pending/succeeded/rejected及脱敏原响应/资源版本；没有receipt不代表确定失败，不自动换key再写。409区分payload冲突/进行中/版本过期：进行中继续查询；确定版本冲突加载最新，保留新旧稿显式确认，创建新意图。此回执能力同时供分类/设置使用，不返回他人选择、正文或凭据。

账号切换清草稿和回执本地副本；同账号会话过期可加密设备安全存储最少未发草稿（沿现有隔离策略），不能把secret写普通Web存储。保留原intent与后来编辑的新draft分开，迟到结果只进入原scope记录，当前页面不串写；重返原scope先核未决状态。无自动发送/自动撤回。

## 5. 后台snapshot/分类/导出

复用`operations-admin.ts`、`apps/api/src/admin/{snapshots,exports}.ts`、`apps/admin/src/features/{snapshot,classification,exports}`。先核对现有schema/返回体：分类成功须返回accepted revision及该意图回执；统计job关联requestedClassificationRevision，查询readySnapshot必须classificationRevision>=本次接受revision（不可只用最新时间猜）。若现有分类响应/查询缺关联，则增补`GET /admin/statistics-refresh/{requestId}`，返回pending/ready/failed、acceptedRevision、snapshotId，data_admin且同请求权限；job结果不得回滚分类。

分类Save→Unknown仅查原意图；已Accepted只重试统计，不重新classify。409加载最新并重新确认；403/404停止相关操作。统计Pending/Failed隐藏过时实时图表、明细与导出；Ready之后采用同snapshotId+canonicalFilterHash。数据缓存key加account/role/privacyEpoch/snapshot/filter/locale；locale只改文案，不重置查询/搜索/排序。切对象/账号abort并拒绝迟到结果。

410撤销旧snapshot所有缓存与export ticket，清选中并提示选新快照；不把旧数据作为成功降级。429绝对Retry-After，503保留appliedQuery重试；401回原route/query重新授权；403不得继续旧缓存读取。export创建与下载都重验角色、snapshot/epoch；捕获生成时snapshot/filter，Ready变化不自动下载另一份；失效须显式重发。CSV沿防公式注入、脱敏、no-store，不增加公开URL。coverage本人优先、host补缺，不一致仍按本人明确值计分子；unknown排除，不增加冲突队列，固定输入手算回归。

## 6. 分享与链接

canonical URL由配置的HTTPS origin和公开mealId生成，不含token/actor/私密参数。复用公开MealDTO，只选title/startLondon/offset/公开餐厅区域/status；前端纯函数格式化，无新增分享写端点。私有/草稿/删除不可预览，服务端OG页面也走公开授权投影，无内容缓存泄漏。

iOS Universal Link的AASA只列应用与`/meals/*`，app校验host/path/id；Web同路由可浏览。auth returnTarget只允许内部meal详情+草稿引用，验证state/PKCE，不接受外部returnTo、不自动申请。回流重新GET最新状态，满员/截止/取消等可View meal，删除显示不可用；旧预览不保证刷新。

用户点击才调用原生Share/Web Share，取消无发送成功；能力不足→复制，失败→可选中文本。WhatsApp只用官方wa.me预填，微信Copy link for WeChat及系统可用目标；不读通讯录、不SDK代发、不推断收件。开发测试用合成公开meal和隔离域名/本机HTTPS映射；正式域名AASA部署及外部账号测试另列具体操作，不因本方案自动改DNS或部署。

## 7. PATCH008增量协议与数据

### 7.1 消息与提及

旧`sendMessage`保持纯文本接口；新增`sendGroupMessageV2 POST /v2/conversations/{conversationId}/messages`，body={body(1–2000),clientMessageId,mentions:[{kind:user,userId,start,end}|{kind:everyone,start,end}],draftId?}。start/end以Unicode code point的半开区间定义，必须边界合法、不重叠、对应实际显示标记；最多100个标记及body长度双重限额，重复user接收去重。发送者/群权限由会话得出，不接受actorId/recipientIds。普通成员伪造everyone整条403，私聊调用拒绝；合法用户标记发送时已退群则降纯文本，返回droppedMentionIds供解释，其余继续。host变化/失去canSend整条失败保完整稿。

同事务锁与现有消息路径一致，记录message、有效mention entities、去重接收人、提及站内notification及outbox；唯一(conversationId,senderId,clientMessageId)且规范payload hash，变body/mentions复用id为409。消息响应v2增加有效mentions及warnings；v1只返回body的旧DTO，旧消息无mentions，文本@不触发。新增v2读取路由用于富文本，旧客户端读取旧投影；分页/授权历史区间完全沿用readMessages，不额外读退群期间内容。

`GET /conversations/{id}/mention-candidates?q&cursor`仅当前有写权限群成员，稳定userId+公开名/头像分页；everyone仅host，列表不含已退群/从未加入者，退席仍在群可选。退出后settings不再拉候选/名单。读取403按授权历史只读或不可访问，不能保留实时名册。

### 7.2 设置、已读及订阅

`GET/PUT /conversations/{id}/notification-settings`：{muted,version}，PUT {muted}、If-Match+幂等键；以actor+conversation唯一，无他人设置。仅当前群成员可更改。默认false；普通失败恢复最近确认值，409刷新服务端最新并提示，失败显示未同步；不旧值覆盖。消息throughSeq已读复用markConversationRead，只有真实渲染可见最高连续位置可提交；通知markRead独立，浏览通知列表不等已读所有聊天。

新增`POST /me/push-subscriptions`与`DELETE /me/push-subscriptions/{id}`，注册{installationId,platform:apns|webpush,tokenOrEndpoint,keys?,environment,appBuild}，服务端生成subscriptionId/version，绑定当前actor+sessionFamily。token/endpoint/keys加密存储、不日志、不入公开QA；webpush仅HTTPS且拒绝内网/重定向目标以免worker SSRF，长度/来源策略在适配测试锁定。退出/账号删除撤销sessionFamily订阅，账号切换先注销旧订阅再新绑定；同安装新token原子替换，不能双账号共用token。APNs开发/生产分环境，400/410失效注销；WebPush404/410注销，429遵Retry-After且不越TTL。权限状态是本机事实，不把订阅成功当系统已授权。

### 7.3 提醒、队列与去重

普通群消息只群未读，不逐条站内通知；提及按(messageId,recipientId,template)唯一站内一条。系统文案通用，不含正文/姓名/私密资料，payload仅opaque notification/event引用及允许路由标识；点击先重新鉴权，再定位历史许可messageSeq，无权限不展示正文。

每接收人持久outbox eventId，每订阅deliveryId唯一(eventId,subscriptionId)，重放不造新event。投递前重验ACTIVE账户、订阅绑定/环境、当前群成员/未解散、该消息可读、最新mute、throughSeq/notification read；普通消息mute抑制，提及例外。截止=message.createdAt+1h，DB now>=expiry不再向供应商发，保留授权站内提及/未读。队列恢复不补轰炸。供应商请求超时UNKNOWN不无条件自动重发；保留delivery状态，平台支持可用collapseId=eventId降低重复，但不宣称exactly-once。已交供应商无法撤回。

前台本机若当前群且消息已可见只高亮；查看旧消息用定位提示，不强制滚动；其他页面横幅可关闭。渲染前刷新/使用最新已知mute及本机notificationId去重，不引入presence；另一设备可收到系统提醒，不保证全端零重复。普通push无站内notification时用event/message引用鉴权定位，不制造逐条通知行。

### 7.4 迁移、兼容、回滚

新迁移编号在实施checkout读取现有最大号后串行分配，不预占旧MVP编号。新增message_mentions、message_notification_recipients、conversation_notification_settings、push_subscriptions、push_deliveries及必要outbox扩展；主外键/唯一约束与索引覆盖上述查询，继承删除用户及隐私清理规则，不持久化额外消息正文副本。旧消息不回填mentions/提醒；settings缺省false，不追送历史；订阅初始空。

API先部署向后兼容schema与关闭的v2/投递开关，再上支持客户端；可用capabilities返回mentionsV2/pushConfigured，未支持不能假称提及成功，保留纯文本提示。功能回滚先关入队/投递与v2入口并保留日志/旧消息；旧代码须容忍新表与旧outbox未识别类型（跳过不消费）。若旧worker不具备跳过契约，禁止直接回滚到它，使用兼容禁用版。无破坏性down/drop，修复迁移前向执行。当前仅隔离测试，生产迁移/部署另行批准。

## 8. 外部能力与失败恢复

### P1.1独立评审修订：本段约束优先于§5/§7的概括

- 分类revision是目标user自身版本，禁止跨用户比较。统计作业及Ready快照必须绑定targetUserId、原intent/requestId、acceptedRevision；密封输入清单包含该user的接受revision或同一user更晚revision，不得用全局最大revision或最新时间猜。P09先核现有返回体再决定最小新增端点。
- 发送事务为recipient/delivery捕获membershipAuthorizationEpoch及群epoch。退群、移出、撤权或解散事务沿同一锁序推进授权代际，并将旧代际尚未交供应商的recipient/delivery永久标为REVOKED。重入分配新epoch，禁止重置旧终态或将旧event重绑新epoch。
- worker恢复及外呼前须同时检查原epoch、当前合法代际和不可复活终态；仅当前membership=true或退出前历史仍可读不能放行旧push。领取与撤权通过条件更新及同成员锁序串行化。已经越过供应商边界的在途请求保留审计，不能承诺撤回。
- 退出空档不生成本人接收人/新提醒；新epoch合法新消息正常提醒。上述作废不删除退出前授权历史或原站内记录，不合并通知已读与聊天已读。
- §7.4迁移须加入成员/群epoch、recipient/delivery捕获epoch及REVOKED状态。P14验收发送时捕获代际；P16必须测试暂停队列→退出→重入→恢复旧排队push零投递、空档无提醒、新epoch正常提醒；P17验证历史和站内记录保留。以上为UX-P1-01的最小修订，不改PRD/Figma。

| 依赖 | 实施/本地可验证 | 真实关闭证据及授权边界 |
| --- | --- | --- |
| APNs/Web Push | mock适配+订阅/权限/注销/TTL/UNKNOWN/去重；默认供应商off | 受控账号、签名构建/HTTPS、用户主动授权、锁屏/离线/失效订阅与双端证据；凭据读取和真实投递按具体准备单，非方案批准即允许 |
| AI | 复用禁外网fake、本地预算/UNKNOWN/F66/F68回归 | 原模型质量/数据/实账门槛及人民币50元/月上界；旧剩余次数/钟许可不继承 |
| Places/照片 | 合成placeId、迟到/错配/失败/署名矩阵 | 任意真实餐厅、地址坐标/署名许可缓存双端；复用现有账号配置，不重注册 |
| Auth/邮件/支持删除 | 合成身份/收件箱/删除fixture与回执 | 原真实方式、邮件入箱、webhook/政策/删除屏障/恢复负载未闭门槛；不向旧QA或真实账号发删除 |
| 外部分享 | copy/取消/能力检测/回流合成链接 | WhatsApp及微信真实接收链接、iOS/Web平台能力；不以系统回调称朋友收到 |

真实能力未启用时显示可解释失败/不可用，不能以mock绿替换继承blocker，也不要求写方案前先关闭全部发布门槛。

## 9. B03隔离方案与负向核验

方案评审前只读和文档，不建服务。评审通过后由本owner建立分支候选`codex/mvp-patch-p1`与专用managed worktree（从父SHA，不复用旧Claude目录），记录root/HEAD与方案提交。独立node_modules及workspace realpath；可共享不可变下载缓存，不链接封存源码/依赖。env、缓存、dist、DerivedData、Metro及测试输出全部落新root/专属临时根。

候选Web64174/admin64175/API64176/PG64177，Metro64178；必须当时检查占用、strictPort、进程CWD后登记，空闲不等预留。独立PG dataDir/角色/DB仅合成数据；不连接、复制封存QA库/控制通道/clock/session/账本。API/worker只读专用env，供应商默认off，绝不加载封存secret或绕过no-provider默认。端口不隔离cookie，专用浏览器上下文/存储；不使用现行设备，原生先独立构建/模拟器，真机另明确交接。

运行前出具manifest：父/当前SHA、root、依赖realpath、输出路径、测试URL安全标识、PG实例/dataDir、API origin、监听PID/CWD、浏览器上下文、原生bundle/build标识及外呼开关。负向核验逐项与封存保护清单不相交，扫描所有配置无旧地址/PG/控制通道引用；测试runner启动PG机制必须改为本补丁专属参数后才运行。只停止本root创建且登记的PID，不动封存进程/数据库/设备/时钟。隔离核验未PASS不得业务实施。

迁移只在新库演练向前/兼容回滚及合成数据恢复。若未来要求复制真实数据或生产部署，单独列明数据/目标/费用/风险申请，不纳入当前授权。产品发布号由PM确认，工程标识足以评审；最终构建交付必须同时有版本号/commit/build/环境/证据。

## 10. 验证、任务与独立签收

[任务表](tasks.json)为本补丁唯一实施状态，旧tasks不改。切片顺序：方案独评→B03→契约→按纵向路径实施→双端/后台回归→独立QA→发布决定。每片owner均本会话；文件超过5个或不同子系统时在实施前细分子任务，不能一次改全部apps/packages。数据迁移/生成契约串行，评审者不共享写权。

[继承映射](inheritance.json)逐ID保持15条原状态及缺陷，不修改旧execution。测试新增于对应模块，文档验证脚本只检查本方案映射/依赖/引用，不启动业务服务。实施以后在隔离root执行适用`pnpm core:check`、unit、api/db、web/admin/ios、build；DB/API命令仅B03测试参数核证后运行，不在封存checkout运行。浏览器与原生真实路径按PATCH/AC记录commit、build、OS、宽度、mock/live及截图，不把组件测试当设备通过。

必须覆盖：反馈两项所有顺序/部分/409/unknown/换对象/七天撤回；DST开始和截止各BST/GMT/不存在；AI Keep/Replace/失效/长度/满员/截止；后台分类unknown/Accepted统计失败/Ready同快照导出/410/429及coverage手算；分享跨设备登录回流/取消/复制失败/不可用Meal；提及同名/Everyone伪造/退群降级/重试/跨端mute409/已读/TTL/暂停队列权限变化/账号换绑；四档后台与两端键盘/焦点/只读隐私。未影响路径复用有明确版本适用性的证据，不重跑全部历史无关测试。

独评：PM签范围/发布号/继承规则；用户端UX签001–005/007/008交互与状态；后台UX签006，三者评同一提交/哈希，给PASS或具体blocker+证据+最小关闭条件。变更后仅受影响范围复评，但最终记录统一同一版；PM/UX未通过不开始功能代码。独评通过≠真实服务验收，B03与发布门槛各自独立关闭。
