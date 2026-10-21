# 核心API与客户端契约 v1

[总方案](core-development-plan.zh-CN.md)与[数据命令](data-and-command-contract.zh-CN.md)定义事务权威。本文件是T01生成JSON Schema/OpenAPI与SDK的规范来源；以下端点为待建设，当前Demo没有真实服务。前缀`/v1`，JSON UTF-8；禁止未知写字段；actor只来自session。

## 1. 通用协议

成功`{data,meta:{requestId,serverNow,version?,snapshotId?}}`；列表`{data:[...],page:{nextCursor,hasMore,scannedThroughSeq?},meta}`。错误`{error:{code,message,fieldErrors?,retryAfterSeconds?,currentVersion?,choices?},meta:{requestId,serverNow}}`。英文业务message供App，后台按code本地化，不回SQL/provider私密错误。

- 400格式；401未登录/失效；403无当前动作权限；404对象不存在或不能证明可见；409版本/状态/幂等冲突；410快照撤销或过期receipt；422字段/时区校验；429限流；503提供方不可用。统一codes：AUTH_REQUIRED、PROFILE_INCOMPLETE、REAUTH_REQUIRED、FORBIDDEN、NOT_FOUND、VERSION_CONFLICT、IDEMPOTENCY_CONFLICT、INTENT_IN_PROGRESS、DEADLINE_PASSED、MEAL_FULL、MEAL_CANCELLED、APPLICATION_DECLINED_FINAL、ARRANGEMENT_LOCKED、TIME_AMBIGUOUS、TIME_NONEXISTENT、INVALID_OFFSET、CONNECTION_NOT_AUTHORIZED、SNAPSHOT_REVOKED、PROVIDER_UNAVAILABLE、LINK_REQUIRED、ACCOUNT_LINK_CONFLICT、CORRECTION_WINDOW_OPEN、PRECONDITION_REQUIRED、LINK_TICKET_INVALID。
- 所有写请求（OTP start除外也有challenge requestId去重）带`Idempotency-Key: UUID`；同用户+operation+key原子声明。请求hash按规范化JSON、路径、If-Match计算；重试沿用key。不同body409；旧响应重放仍先验证当前可见/授权，撤销后不能借幂等取私密数据。业务拒绝稳定响应也存；意外5xx不封为成功。超时查询原资源再同key重试；超过30天不自动重放，UI要求重新确认新意图。
- 编辑/审批/退出/撤回/支持操作带`If-Match: "version"`；缺少428 PRECONDITION_REQUIRED，版本旧409返回currentVersion但不泄露他人数据。发送以clientMessageId防重复，不需head版本；发布/申请新建也无If-Match。同一次操作HTTP重试先查idempotency结果，再判断旧If-Match；新意图才重验版本。
- cursor不透明、服务端HMAC签名，绑定actor或游客投影、resource、filterHash、权限epoch、snapshotId、lastSortKey，最长24h；篡改/换actor422，权限撤销403/404或410。默认20/max100，稳定排序(createdAt,id)，消息用seq字符串，不能offset翻页。用户目录不提供枚举私密字段。所有授权页面Cache-Control private,no-store，退出/删除清客户端query cache/持久草稿。
- 写API每user每分钟60（消息30）、poll每会话每user每分钟40，短突发10；OTP每email/IP 5次/15min和30s重发、验证每challenge5次；后台导出每actor5次/小时。阈值是可配置工程默认，429带Retry-After，不能因退避重发新intent；G-HOST压测后调参并记录。

时间输入`{localDate:"2026-10-25",localTime:"01:30",timeZone:"Europe/London",utcOffsetMinutes:60}`，offset可省略仅当唯一；歧义422返回`choices:[{utcOffsetMinutes:60,label:"BST",instant:"...Z"},{utcOffsetMinutes:0,label:"GMT",instant:"...Z"}]`；不存在422，无静默修正；错误offset422。服务端用IANA时区库候选往返验证，不用浏览器Date猜测。存UTC+local+offset，响应同时给UTC与显示zone。开始和截止都走同一算法；日历/7天窗口按UTC连续时长。预算budgetMinPence/budgetMaxPence整数，0<min≤max、currency固定GBP，不生成付款对象。

公共DTO：`PublicProfile{id,displayName,avatarUrl,bio,interests,languages,background?}`；`Meal{id,version,host:PublicProfile,venue,startsAt,closesAt,scheduledEndAt,minimum,capacity,confirmedCount,budgetMinPence,budgetMaxPence,languages,mood,areaCode,cuisineCode?,dietaryCodes?,currency,status,cancelReason,bookingDeclaration,allowedActions}`。其他人的申请留言/联系方式/完整行程不得混入Meal。`Me`仅本人包含资料门槛/私人联系/同意版本；`Application{id,version,round,state,createdAt,decidedAt?,applicant?,message?}`仅host/本人适当投影。`Message{id,seq,sender:PublicProfile,body,createdAt,redacted}`正文上限2000字符，纯文本显示，拒绝HTML执行；群名等长度沿用PRD/设计既有规则，T01中明确schema并不擅自增加产品限制。

## 2. 身份、资料和地点

| operationId / 方法路径 | 请求 → 响应与权限 |
| --- | --- |
| startEmail / POST /auth/email/start | email,client WEB/IOS,returnTarget白名单 → challengeId,expiresAt,resendAfter；不暴露邮箱是否已有账户 |
| verifyEmail / POST /auth/email/verify | challengeId,code,appChallenge? → Web cookie或iOS handoffCode；失败计数/到期。验证码不进日志 |
| startOAuth / POST /auth/oauth/start | provider GOOGLE/APPLE,client,returnTarget,appChallenge? → authorizationUrl,stateTransactionId；state/nonce/PKCE服务端绑定 |
| oauthCallback / GET /auth/oauth/callback | provider code+state → 校验issuer/aud/nonce/PKCE；Web安全回跳或iOS一次性handoff；不允许任意URL |
| exchangeHandoff / POST /auth/handoff | code,appVerifier → opaque access/refresh及expiresAt；单次60秒；Web不返回可JS读取会话 |
| refreshSession / POST /auth/refresh | iOS refreshToken → rotation；重复消费撤销family；Web cookie滚动在服务端完成 |
| getSession / GET /auth/session | →本人、csrfToken、authTime、amr、profileGate；未登录401 |
| logout / POST /auth/logout | 当前family撤销→204；清Web cookie/iOS storage及全部私人cache |
| startReauth / POST /auth/reauth | provider/邮箱challenge → 按原身份再次认证；完成更新session.authTime，绝不接受客户端自报时间 |
| linkIdentity / POST /auth/links | 5分钟reauth+第二身份一次proof → linked identities；分支按数据契约§5；新同邮箱LINK_REQUIRED，provisional空壳双proof迁identity/撤session；两边非空409 ACCOUNT_LINK_CONFLICT，不提供不存在的支持合并流程 |
| getMe / GET /me；updateMe / PATCH /me | 本人 → Me；修改白名单displayName,bio,languages,lifeStatus,interests,background,avatarRef,age/community接受版本；If-Match；email只来自已验证identity |
| getPublicProfile / GET /profiles/:id | 游客→PublicProfile及已公开reviews分页；不含联系方式/行程/私密选择 |
| searchVenues / GET /venues | q或bounds+cursor → place候选、attribution、photo refs；游客可查，provider限流；不默认为已确认 |
| confirmVenue / POST /venues/confirm | placeId → venueRef、当前允许的名称/地址/坐标显示及缓存到期；登录；服务器向provider确认，不信客户端传地址 |

Google Places字段许可表在G-PLACES冻结：长期存placeId和自有声明；提供方名称/地址/坐标/照片引用的保存、刷新、删除逐字段按许可配置，拒绝无限期快照。餐厅暂时下架/查询失败显示不可验证，不用手填绕过；已发饭局保留自有ID/安排，提供方显示用许可缓存/刷新，无有效数据则显示“Restaurant information temporarily unavailable”并保留报告入口。真地图使用合规Google组件、照片和署名；fixture模式显式标识且生产启动禁止fixture provider。列表/地图同筛选查询，Search this area只更新bounds，不改变已选restaurant。

## 3. 饭局、群聊与饭后

| operationId / 方法路径 | 请求 → 响应与权限 |
| --- | --- |
| discoverMeals / GET /meals | bounds/dates/timeOfDay/areaCodes/budgetMaxPence/tableSizes/languages/moods/keyword筛选（详见下表） → 公共Meal页；纯投影到期状态不写库/不争行锁；结果稳定排序startsAt,id |
| getMeal / GET /meals/:id | 游客公共DTO；本人/host附自己进度/host动作，不附别人的私密字段 |
| createMeal / POST /meals | venueRef,title,description,start:TimeInput,close:TimeInput,minimum,capacity,budgetMinPence,budgetMaxPence,languages,mood,cuisineCode?,dietaryCodes?,bookingMode EXTERNAL_PAY_AT_VENUE,attemptId,bookingDeclarationConfirmed,termsVersion,reviewConfirmed →201 Meal；profileGate |
| editMeal / PATCH /meals/:id | 同创建的局部字段+If-Match；关键安排锁定后409；不可通过patch改状态/host/已成团事实 |
| declareBooking / POST /meals/:id/booking-declarations | status REPORTED_CONFIRMED/NEEDS_UPDATE/FAILED/CANCELLED,count，If-Match → declaration+Meal新version；host |
| cancelMeal / POST /meals/:id/cancel | reason host/booking/other,If-Match → cancelled Meal；仅host开始前；系统insufficient不对外接受 |
| applyMeal / POST /meals/:id/applications | message →201 Application；本人资料齐全；原draft回来须主动提交 |
| listApplications / GET /meals/:id/applications | host全部或本人单项；支持仅case特定结果，非全表 |
| decideApplication / POST /applications/:id/decision | APPROVE/DECLINE,If-Match → Application+mealVersion+conversationId?；host，事务名额 |
| withdrawApplication / POST /applications/:id/withdraw | If-Match → WITHDRAWN；本人PENDING |
| leaveMeal / POST /meals/:id/leave | If-Match → 自己席位CANCELLED+Meal；guest开始前；不退群 |
| myMeals / GET /me/meals | section UPCOMING/APPLICATIONS/HOSTING/PAST/CANCELLED → 本人列表、allowedActions；不是公开主页行程 |
| inbox / GET /inbox | 本人会话及申请进度；仅授权lastMessage摘要，退群不显示空档内容 |
| readMessages / GET /conversations/:id/messages | cursor/afterSeq,mode HISTORY/LIVE → 授权区间Message页+scannedThroughSeq；LIVE无当前资格403，HISTORY保留原授权区间 |
| sendMessage / POST /conversations/:id/messages | body,clientMessageId →201 Message；group/direct各自事务鉴权，客户端不传sender |
| leaveGroup / POST /conversations/:id/leave | If-Match+确认 →区间关闭；席位不变；重申获准可新JOIN |
| dissolveGroup / POST /conversations/:id/dissolve | If-Match+确认 →全体只读；仅host；不能重开 |
| postMealState / GET /meals/:id/post-meal | 本人合格名单、窗口、本人填写状态、公评发布状态；不泄露对方单方reconnect |
| reportAttendance / PUT /meals/:id/attendance/:subject | value present/absent,If-Match（首填版本0）→ 当前source与version；SELF本人/HOST本场；support走专用API |
| rateExperience / PUT /meals/:id/experience | score 1..5,If-Match →本人最新修订；当前present且7天内 |
| reviewPerson / PUT /meals/:id/reviews/:subject | body,If-Match →本人修订、publishAt/visibility；合格共同出席，互评或7天后公开 |
| selectReconnect / PUT /meals/:id/reconnect/:subject | selected bool,If-Match →本人选择状态+connection OPEN/WAITING/CLOSED；WAITING不得指示另一方是否选择 |
| revokeConnection / POST /connections/:subject/revoke | If-Match →双方清空同意、旧聊天只读；不把对方私密状态返回 |
| block / PUT /blocks/:subject；unblock / DELETE /blocks/:subject | If-Match →当前本人block；清双方consent，不关group；解除不恢复 |
| getDirect / GET /connections/:subject/conversation | 当前双方允许则conversationId；历史曾有会话仍可只读；无参与授权404 |
| getSurvey / GET /me/product-survey；putSurvey / PUT /me/product-survey | again bool/null,reasons company/conversation/coordination/expectations/venue/cost/other（去重、可空，两者不能全空）,If-Match →本人最新版本；不接受mealId |

预约声明、饭局、申请、会话版本分别输出对应对象版本；决定申请If-Match指Application.version，锁内另外校验meal可用性，不能让客户端猜另一个对象版本。群leave/dissolve版本指Conversation；attendance/review/survey首次version0，随后各自revision。UI显示409后刷新相关对象、保留未发送文字，不自动执行已变化的决定。

## 4. 通知、支持、删除与后台

| operationId / 方法路径 | 请求 → 响应与权限 |
| --- | --- |
| listNotifications / GET /me/notifications；markRead / POST /me/notifications/:id/read | 本人站内消息页/幂等read；别人ID404 |
| createReport / POST /reports | targetType, targetId, reason,details →201 receipt,status；本人；不默认为允许支持读取完整chat |
| reportStatus / GET /me/reports/:id | 本人受理状态和可公开结论；不含内部调查/他人私密信息 |
| requestDeletion / POST /me/deletion | reauth证明、确认、receiptToken（客户端提前生成并保存256-bit secret）、If-Match →202 status；成功即撤销当前会话，响应丢失用receipt查状态 |
| deletionStatus / POST /deletion-status | receiptToken（不放URL/log）→ 最小状态；频控；无用户凭据复活 |
| supportCase / GET /support/cases/:id | support+MFA+case授权→ 最小报告事实；记录访问审计 |
| correctAttendance / POST /support/cases/:id/attendance-corrections | mealId,subjectId,value,reason,expectedVersion → 修订；effectiveNow≥end+7d且名单内未取消，否则409 CORRECTION_WINDOW_OPEN；每次case授权与审计；不开放任意SQL/群消息 |
| resolveCase / POST /support/cases/:id/status | status,publicOutcome,reason,If-Match →case状态；support+MFA |
| listSnapshots / GET /admin/snapshots | analyst/data_admin+MFA →已密封快照元信息，默认最近；不泄露输入私密行 |
| adminPage / GET /admin/:page | page overview/journey/supply/retention/quality；snapshotId+契约filters →指标DTO；名称/页映射对齐后台五页，不凭新名字增加页 |
| adminDrilldown / GET /admin/drilldowns/:metric | snapshotId+相同filterHash+cursor →脱敏来源明细，度量分子/分母标签；角色/隐私epoch逐次检查 |
| adminExport / POST /admin/exports | snapshotId,metric,filters →短期exportId；GET /admin/exports/:id检查同角色+epoch再流式CSV，防公式注入；不发长期公开签名URL |
| classifyUser / PUT /admin/classifications/:user | regular/test/staff,reason,If-Match →revision+新snapshot任务；data_admin；旧快照常规不改 |
| ingestEvents / POST /analytics/events | schemaVersion,events[{eventId,type,occurredAt,properties}] →逐项accepted/duplicate/rejected；同意/环境服务端补验，不能传任意成功事实 |

后台`:page`固定为既有overview（概览）/journey（旅程）/supply（供需）/retention（留存）/quality（数据质量），与`admin/src/App.tsx`导航一致，不新增页面。支持CLI使用浏览器一次认证+MFA得到短期受限session，`case show`、`attendance correct --case --reason --expected-version --idempotency-key`、`case resolve`，命令调用上述API且输出脱敏，不给原始DB credentials。

关键渠道清单（用户P-02）：批准/拒绝申请→申请人站内+邮件；截止过期→申请人站内+邮件；整场host/booking/other/insufficient取消→host+当前pending/confirmed成员站内+邮件，已撤回/已退出不再邮件；新申请→host站内；撤回/退出→host站内；预约声明变更→当前成员站内；群/私聊新消息→站内未读，无邮件/推送；删除受理/结果→receipt状态及可用verified email邮件（删除后无站内登录）。禁止邮件包含申请留言、chat正文、单方再约或举报细节。无法投递邮箱不阻塞站内与业务，状态显示渠道失败供support；重试最多8次/24h后dead-letter告警，provider UNKNOWN先查询/同provider幂等ID再重发，不承诺跨provider exactly-once。

## 5. 客户端实现与AI接缝

| 客户端路径 | 数据/动作与必须覆盖的状态 |
| --- | --- |
| Web Discover/地图/Detail/Profile | 游客公共投影、筛选/返回位置、Places加载/失败/署名；申请登录回流保留draft，profileGate补齐再返回待提交 |
| Web Create/Host detail/Meals | TimeInput歧义选偏移、非法时间报错、预览/主动发布、原子审批、满员/截止/锁定409、预约声明stale、取消确认 |
| Web Inbox/群/私聊 | LIVE前台2秒、后台停、错误退避2/4/8/16/30s并jitter；401清登录缓存，403停发送转HISTORY；无授权空档不得进cache |
| Web Post-meal/Settings | UNKNOWN与缺席分开、SELF优先解释、窗口关闭、互评隐藏、单方私密；Survey独立；举报receipt/删除reauth及离线receipt保存提示 |
| iOS同业务路径 | 原生导航/键盘/安全存储、系统浏览器回流、前后台补拉、断网不伪造成功；草稿可本地最小保存且logout删除；消息无离线自动发送队列 |
| 管理后台既定五页 | 同snapshot/filter贯通图表/明细/导出；快照更新提示、分类后新快照、410清旧cache并选新快照、语言/筛选返回保持 |

AI只读查询/生成草稿与偏好提案，完整接入按[AI方案](ai-development-plan.zh-CN.md)、FR-13及P-04/P-05；最终业务写由人类在原页面提交。共享接缝为operationId、typed DTO、allowedActions、requestId、经服务端验证的draftId关联审计，不给模型业务写token或DB/service-role。不读取单方再约/举报/聊天正文；AI专用context白名单不能用整个Me/Meal响应替代。核心API权限、版本、截止和幂等不因带draftId而放宽。

## 6. 发现筛选和本人分区补充（C-01/C-06）

| 字段 | 语义 |
| --- | --- |
| dates | YYYY-MM-DD数组，不连续日期OR；Any date=[]，和其他维度AND；London日边界转换UTC查询，不用24h代替DST日 |
| timeOfDay | any/lunch(当地小时<16)/dinner(当地小时≥16)，复用当前demo/src/domain.ts已有时段定义，作为工程映射（PRD未另定小时值）；自定义AI时段按P-04接只读查询，不改当前UI |
| areaCodes/bounds | 已应用区域内OR，和已应用地图bounds AND；Search this area确认后才把新bounds生效，拖动本身不改条件；区域未知不命中具体区 |
| budgetMaxPence | meal.budgetMaxPence≤筛选上限，整数便士；后台£20/30/40用≤分档和互斥上下界；unknown单列 |
| tableSizes/languages/moods | 各自内部OR，跨维度AND；tableSize含host；language按规范数组交集并去重；不把人数当剩余位 |
| keyword | 去首尾空格，匹配公开title/description及许可可查venue名称；参数化查询、分页上限和索引控制；不得检索私密留言 |
| cuisineCode/dietaryCodes | 按P-05/数据契约§6的host声明字典过滤；unknown不命中特定条件，Any不排除；同一字典服务host表单/发现/AI，响应显示来源与未提供 |

本人分区：UPCOMING=本人host或当前CONFIRMED且未取消/未计划结束；APPLICATIONS=本人各轮状态（含WITHDRAWN/DECLINED/EXPIRED）按提交倒序；HOSTING=本人所有主持场含终态；PAST=已计划结束且本人在开始名单的未取消场；CANCELLED=整场取消且本人host/曾申请或个人已退出的相关记录。分区允许有意交集，进度以applicationId区分，不将EXPIRED当整场取消。UI沿用现有五分区和相应空态。

核心字段长度/提交：名字2–40、介绍20–1000、meal标题5–80/描述20–1000、申请留言20–300（AI草稿转入仍受此核心校验）、公评≤500、message去空白后1–2000；现有头像选项走自有已批准assetRef白名单，不新建上传流程。资料生活状态字段名lifeStatus，不能让PATCH profile的status修改users.status。Create开始半小时时段；closesAt按独立TimeInput校验、默认为T−60且≤T−30；外订声明和Review确认必须由本人勾选，不接受默认true。预约声明reportedAt由服务端接收时钟记录，不信客户端伪造历史。

## 7. 身份链接的HTTP分支（D-1）

verifyEmail/OAuth成功可能返回`{outcome:"AUTHENTICATED",...正常会话}`或`{outcome:"LINK_REQUIRED",linkTicket,expiresAt}`；只有provider确认verified email匹配才进入后者。LINK_REQUIRED不签发业务session，不泄露旧身份列表/资料，ticket有效10分钟、一次消费、绑定原浏览器cookie或iOS app challenge、server保存哈希。用户以原有身份完成登录+5分钟reauth后，POST /auth/links提交`{linkTicket,originalChallengeProof}`，同时证明新身份及现有账号，锁双方user再应用数据契约空壳/冲突分支；票据过期/重放409 LINK_TICKET_INVALID。取消回登录，不创建重复账户。iOS该分支返回受app challenge保护handoff结果，票据不放任意URL。

邮件OTP/session/handoff/refresh响应含凭据，不能把明文响应存通用idempotency.response_json；challenge原子消费或refresh rotation使用专用token协议，网络丢包导致消费后token未知则重新认证/重新start，不重发原token。匿名auth操作按challenge/session/IP限流和clientRequestId防连点，不依赖尚不存在的actorUserId。

支持CLI认证使用client=SUPPORT_CLI（startOAuth允许的第三种客户端），OAuth仍经核心回调；仅向已登记loopback回调127.0.0.1随机端口返回60秒app-challenge绑定handoff，不接受任意host/路径。CLI凭PKCE verifier兑换15分钟opaque session，无refresh/不写shell history/配置文件；每次支持API独立验证support+MFA+case。Web/iOS session不能通过自报client获得support角色。若本地浏览器回调失败重新认证，不让用户复制长期token。
