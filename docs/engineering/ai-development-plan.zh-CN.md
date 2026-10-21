# Ask Fancy真实AI开发方案 v1

输入：[主PRD](../product/PRD.zh-CN.md)FR-13（ce74f80，v0.8/AI增补0.2）及[总方案](core-development-plan.zh-CN.md)P-01—05用户决定；[AI复评](../reviews/ai-development-readiness-2026-10-21.zh-CN.md)保留问题与决策状态。本文是待实施方案，不是模型已接入；最终共同认可版本见[共同审查](collaborative-review.zh-CN.md)。原PRD/Demo不由本轮修改。

## 1. 模块、提供方与隔离

在现有Fastify单体增加`ai-assistance`编排模块，复用核心只读服务和同一身份，不另起自治Agent/微服务。模块只可查找/比较、解释、申请/创建/群消息草稿、待确认偏好提案。禁止调用申请/发布/批准/消息/预约/支付写命令，不持服务角色或任意SQL。最终动作由用户在原编辑器主动提交。AI模块允许读取的业务数据只有专门的AIContextDTO投影，不能传完整Meal/Me对象，更不能读消息、单方再约、评分/问卷、举报或后台表。

默认提供方适配：OpenAI官方Node SDK+Responses API，`store:false`、非background、非流式、关闭SDK自动重试；不用provider Conversations、previous_response_id、向量库、联网/文件/MCP/计算机工具或fine-tuning。候选固定模型`gpt-5.4-mini-2026-03-17`，以官方模型页支持结构化输出/固定snapshot为选型依据，**尚未实测质量、延迟、账户可用性**。A00 spike验证后锁SDK/model版本；不能满足评测则用ADR更换并全量复测，不静默升级昂贵模型或降低验收。

`ModelProvider.generate({schema,input,deadline,maxOutputTokens,callId}) → {parsed,usage,providerRequestId}|typedError`。仅此适配器访问密钥；业务编排代码不依赖供应商原始响应。JSON Schema约束形状不保证事实正确，仍须服务端验证与真实评测。

初期API单副本、异步IO；API进程RAM保存短期对话/回复/草稿，Postgres仅存偏好与无正文元数据，worker不持会话文本。这样会话正文不进数据库WAL/备份/持久缓存；进程重启会话失效，在原面板说明并保留客户端未发文字重新开始，不从日志恢复。API扩容前需ADR引入无持久化/备份的短期context store并验证跨实例删除；不提前引入Redis。RAM有总量/每会话token上限，接近容量拒绝新受理并返回AI_UNAVAILABLE，不静默踢掉未过期会话。

## 2. 一轮管线与检索语义

总deadline从请求受理起30秒，以单调时钟计耗时、DB UTC判断业务时间；解析调用≤8秒，生成用剩余时间、留2秒验证；最多2次模型调用，无工具循环/自动修复调用。处理超过3秒UI保持处理中，最终不返回部分可操作草稿。

1. 核验登录或游客device session、账户可用性、Origin/CSRF、requestId+规范payload hash；原子占主体及会话在途位，保留当日成功轮额度。模型调用之前单独预留该调用全局最大费用/调用数；不持DB长事务跨网络。
2. 最小context：本人显式输入、当前有效会话条件及来源、已应用Discover筛选、本人已确认偏好、sourcePage和**明确**mealId。只有显式要求结合本人介绍才读取昵称/介绍/语言/兴趣；编辑器原文仅该次明确润色上传。状态解释只读本人必要枚举。群草稿先校验write权限但绝不读群正文。游客可公开检索/解释、申请/创建文字候选，不能取私人状态/group草稿。
3. 模型输出受schema约束`QueryIntent{intent,patch,explicitMealIds,language,needsClarification}`；intent白名单SEARCH/COMPARE/EXPLAIN/DRAFT_APPLICATION/DRAFT_CREATE/DRAFT_GROUP/PREFERENCE_PROPOSAL/CLARIFY/OUT_OF_SCOPE。字段patch为SET/CLEAR/UNSET+类型化value+输入来源span；未知标识/字段/任意URL/工具名拒绝，不扩大权限。
4. P-04：本次明确要求>本会话已确认条件>Discover已应用筛选（包括点击Search this area后生效的bounds）构成hard条件；保存偏好**只作soft排序**，不能自动加入WHERE。同字段hard优先；CLEAR写会话tombstone，抑制该字段之前hard及soft偏好，直到显式SET或新会话，不把缺失UNSET当CLEAR。会话确认的条件来自本人明确输入/澄清，不因模型提案就升级hard。
5. 日期和金额在服务器解释：默认London今天起7个日历日、周五/下周五/今晚/周末按FR-13；无效/歧义先问，P-03明确偏移后才生成UTC；预算取meal预算上限比较GBP整数便士；人数含host。Spanish未明确菜系/语言则追问；“便宜些”先给预算建议待确认，不自动放宽其他hard条件。
6. 复用discovery过滤和资格函数：先从完整可见集合按全部hard条件筛，排除host/有效申请/DECLINED/满员/截止/开始/取消。按soft字段命中数降序、startsAt升序、mealId稳定排序，再选前20个投影给模型，不先随机截20再排。每字段1分，未知/未提供0分，不因低soft分排除；同字段多值命中仍1分。菜系/饮食按P-05 host声明、字典和unknown规则，不推断过敏安全。输出卡片最多3个；比较只接受明确选中的≤3个公开可见对象或本轮候选。
7. 生成仅接白名单事实+版本化规则。卡片金额/人数/时间/状态、比较表和状态解释用factRef/规则模板由服务器渲染，模型不重算状态、不自造事实。自由草稿限制资料主张/长度，若出现未知ID、越权字段、虚构身份/业务完成承诺或校验失败，整轮FAILED，不将残缺片段变可提交内容。输出按纯文本，链接仅客户端用获准ID构造。
8. 发布回复前重新锁账户/会话元数据、检查generation、TTL、偏好epoch、目标当前授权；变化则SUPERSEDED并销毁结果；同一轮不再调用模型挽救。业务事实已变则刷新/剔除并说明，不把旧卡片当锁位。SUCCEEDED或有效NEEDS_INPUT扣1成功轮，FAILED/SUPERSEDED不扣，但实际费用始终结算。

例：保存budget≤£35，问“周五Soho”，£45场仍可出现但soft分低；问“£35以内”则£45绝不出现；说“不限预算”清除hard预算且本会话不再恢复保存预算排序，其他条件保留。用户未明确要求更改已应用筛选，AI不修改Discover UI。

## 3. 数据、短期上下文与并发

| 对象 | 字段与约束 |
| --- | --- |
| ai_preferences(user_id) | areas,budgetMaxPence,tableSizes,dietaryCodes,languages,moods；version,confirmedAt；只存允许标准值和本人确认，日期不入长期偏好。删除留version/epoch tombstone、不留旧值审计；不存整段对话 |
| ai_session_meta(id) | owner或guestSessionId,deviceSessionId,generation,preferenceEpoch,lastActivityAt,expiresAt,status,activeRequestId；每device当前generation唯一，无正文 |
| RAM context | 当前generation文字/轮次、query+tombstones+来源、draft/proposal及去重结果；每次访问先DB鉴权/查epoch，并以当前RAM记录的服务端lastActivity判断TTL（DB活动字段只作合并持久元数据），回收器≤1秒清过期，不能靠job晚执行放宽TTL |
| ai_requests(id) | unique(subject,requestId)，session/generation,payload_hmac,state,deadline,sourceVersions,quotaDate,reserved/actualCost,error,times；无input/output/prompt正文，HMAC加密钥避免短文本字典猜测 |
| ai_quota(subject,london_date) | successes,reservedSuccessSlots,activeRequestId,minuteCounter；行锁预留，主体最多1在途，另约束会话最多1在途 |
| ai_budget / ai_calls | 费用period、hardCap、used/reserved、callId unique、priceVersion、providerRequestId、token usage、KNOWN/UNKNOWN；整数microUSD，不与GBP饭局预算混算 |
| ai_audit | requestId/draftId、匿名主体、意图、状态、耗时、版本、tokens/cost/error/times；30天清理，无原文/偏好值，不进现有后台看板 |

固定锁序：user按ID→AI偏好/主体元数据按ID→session按ID→quota按日→budget按period；AI只读核心meal授权时不持AI锁，先读获得version，结果提交再按核心user→meal→AI顺序验证，不能持后级锁反向拿meal。核心账户删除在user UPDATE屏障下使AI元数据失效；AI任何最终提交必须持user SHARE且ACTIVE，因此不会穿过删除屏障。

每轮输入≤2000字符；模型总输入上限16000 tokens、单调用输出≤2000 tokens（含模型适配要求的reasoning上界）。保留结构化显式条件/清除标记与必要最近轮次，超过窗口丢弃旧对话原文而非自动生成长期画像；超限本人文字原样保留并报错，不静默截断正在编辑内容。无依据回答早已移出窗口的事实时澄清。

Web每tab独立device secret，只RAM；sessionStorage仅随机撤销handle用于刷新时bootstrap撤旧，正文/偏好/草稿不持久化。iOS当前安装端会话token保安全存储（不存文字），冷启动先查TTL；API RAM存在且未过期可显式Continue，否则报会话失效，不能通过旧ID恢复；注销/切账号清token。所有请求用AI-Device-Token+当前认证/游客session绑定，sessionId不是访问凭据。

lastActivity由SEND/真实EDIT/EXPLICIT_ACTION记录，activityEventId一次去重，服务器时间，不信客户端时间；EDIT活动最多每秒合并一次向API发送；API立即以接收时刻更新RAM lastActivity，DB活动字段每会话最多30秒合并一次（写RAM记录的实际服务端活动时刻，不用flush时刻续期），提交/后台前立即flush，断网未送按服务端TTL到期。打开、渲染、poll、心跳、重试不续期。now≥lastActivity+30min：新generation、清临时条件/轮次/draft，保留账号偏好和本地未发文字；NEW另外清助手未发文字，均不清业务编辑器。关闭/后台不暂停TTL、停poll，无后台Agent或推送。

偏好替换If-Match CAS，删除/替换同步user+AI元数据version/epoch+1，清本进程引用旧值的RAM、所有相关session旧上下文失效/在途SUPERSEDED，abort provider请求；删除成功才返回。模型已收到的内容无法撤回，迟到结果永不发布；其他设备下次请求/恢复前台先读epoch，离线不继续AI操作，不能承诺远程抹掉离线已显示字样。未发送本人文字保留；模型停用不能阻止偏好读/删除。游客偏好仅RAM，登录不迁入账号；退出只清本地、账号偏好保留，账户删除则同步清AI偏好/会话，最小元数据按政策清理。

重复requestId同payload：PENDING仅查状态，不再次调用；完成且RAM有效重放同结果；payload不同409；正文已清410 AI_RESULT_EXPIRED，不能从元数据重生。超时、断网UNKNOWN或API重启：标FAILED/UNKNOWN成本，释放用户成功轮预留，不从日志恢复文字。旧draft随session过期，不能绕过generation继续转入。

## 4. HTTP和客户端交接

沿用核心envelope、权限/版本错误；AI短期结果不进入普通30天幂等response正文存储。所有写含intent key，匿名主体由受限游客session绑定，不信body.actor。

| operationId / 方法路径 | 请求 → 响应 |
| --- | --- |
| bootstrapAI / POST /v1/ai/sessions | deviceChallenge,previousRevokeHandle? → sessionId,generation,deviceToken,revokeHandle,expiresAt；先撤旧再创建；token不进URL/log |
| activityAI / POST /v1/ai/sessions/:id/activity | generation,activityType,activityEventId → expiresAt；重放不续时，EDIT不传正文 |
| readAI / GET /v1/ai/sessions/:id | 当前device绑定 → 当前RAM轮次/状态；无历史列表，过期410 |
| resetAI / DELETE /v1/ai/sessions/:id | generation,reason NEW/LOGOUT/ACCOUNT_CHANGE →撤generation、abort、销毁；不清业务编辑器 |
| requestAI / POST /v1/ai/sessions/:id/requests | requestId,input,sourcePage,explicitMealId?,queryVersion,preferenceVersion,contextVersion,editorText?仅明确润色 →202 PENDING及deadline；同轮去重；30秒内终结 |
| pollAI / GET /v1/ai/requests/:requestId | device/session →SUCCEEDED/NEEDS_INPUT/FAILED/SUPERSEDED；2秒前台poll不续TTL，关闭停，Continue才显示关闭期完成结果 |
| readAIPreferences / GET /v1/ai/preferences | 本人 →fields,version,confirmedAt；游客只RAM |
| replaceAIPreferences / PUT /v1/ai/preferences | If-Match,fields,confirmation true,proposalId? →version；提案归本人且未过期，模型不调用本接口；普通查询不保存 |
| deleteAIPreferences / DELETE /v1/ai/preferences | If-Match →new version/epoch；独立于provider/AI_ENABLED |
| validateAIDraft / POST /v1/ai/drafts/:id/transfer | editorKind,targetMealId,editorVersion →最新授权和typed fields/text；不创建业务记录；错误码DRAFT_EXPIRED/TARGET_CHANGED/EDITOR_CONFLICT |

AIResponse含request/session/generation、文本、≤3张验证后卡片或1个draft/proposal、sourceVersion/retrievedAt及可恢复error；没有“业务执行成功”。AIDraft含id/type/target/生成时间/版本/候选字段，申请文本技术上限取原申请表单20–300（PRD AI≤500是上限，不需要输出到500），创建标题≤80/描述≤1000，群草稿≤1000，核心发送仍1–2000。

转入前读取最新目标与权限；group草稿生成和转入均需write，最终Send再验。编辑器原文非空比较local editorVersion，使用现有确认路径保留或替换，取消不改原稿；同draft重复转入是同份替换，不重复追加。创建草稿未知placeId留空、日期歧义回原控件，不勾外订/条款/最终Review。登录转换清游客AI上下文：本人可主动保留文本回原编辑器，但重新检查目标，不把旧draft当授权。最终业务提交用核心独立幂等key、版本/截止/名额规则，模型始终没有写入口。

## 5. 成功轮、费用硬闸与停用

FR-13建议值作为本工程可配置基线：游客session每London日10成功轮、user每日50、主体每分钟5、同时1；SUCCEEDED/有效澄清才扣，失败/作废不扣成功轮，所有已发生费用仍核算。quota日固定为受理时London日，即使跨午夜/DST也不重新扣；新conversation不改变同游客session主体，清cookie换session仍可能规避，不称个人绝对额度，IP频控+全局闸防总量失控。

AI_ENABLED默认false；daily/monthly全局费用与调用数上限若未批准配置则fail closed，不填虚构金额。每次内部调用前：精确计数完整input及schema overhead，按锁定价格版本和maxOutputTokens计算保守最大费用，原子锁budget检查used+reserved+本次上界≤cap且调用次数≤cap，预留后才发网络。第2调用也独立预留，不能把解析成本漏计。模型计费项/reasoning无法界定上界就不允许接入。

已知usage结算并释放未用reserve；失败有usage照付；超时/断网UNKNOWN保留最大reserve直到提供方账单核对，不能自动释放造成超支。callId唯一，SDK无重试，不在未知状态再发同调用。应用准入费用上界不等于供应商账户绝对账单封顶；G-AI-COST须核对实际计费/价格版本/预算金额，调价或未知计费项暂停，不以告警替硬闸。金额/合同需要负责人批准，本轮不购额度。人工配置停用停止新调用、终止发布在途结果，允许核心及偏好删除；操作有无原文审计，不加运营后台。

## 6. 上线和验收

G-AI-MODEL：真租户可用、固定SDK/model/prompt/schema版本、JSON/拒答/超时/usage验证；G-AI-DATA：供应商/地域/训练/留存/用户说明审批；G-AI-COST：预算金额及并发预留对账实测。`store:false`不等于零留存，默认滥用监控可能仍留内容；若30分钟内容边界要求覆盖供应商，须获得符合要求的保留控制或重新批准披露，不声称已清第三方数据。自有请求体/APM/log/crash dump禁原文。

A08创建≥60条合成/公开固定数据评测：查找/多轮/比较20，解释10，三草稿10，偏好/生命周期10，权限/注入/失败10；覆盖AC-AI01—15和P-04/P-05。产出输入/预期/实际偏差、来源/模型/prompt/schema版本；合成评测原文可保存，不能拿生产对话建训练库。硬条件违背、越权跨账号、自动业务写、虚构身份/状态四项零容忍；其他意图/字段正确率≥90%、人工可用草稿≥90%、并发5的P95≤10秒且30秒终结，以建议值作为工程门槛，未过则阻塞发布，不降低线换取完成。

必须有真实Postgres并发测试：最后一个用户成功轮、全局最后预算、多实例模拟同requestId、删除偏好与结果提交、账户删除与AI提交、30分钟等号、刷新/新会话迟到结果、API重启UNKNOWN费用；spy证明AI不调用任何业务写命令，不能只检索prompt文字。Web/iOS保留浮动助手交互、原草稿/偏好入口，不重做页面；真provider、原生设备和费用/数据门槛闭合才算AI完成，Mock不替代。完整MVP还须核心所有门槛与AI联合验收，未授权不部署或发布。

## 7. 官方依据（2026-10-21核查）

- [Responses API](https://developers.openai.com/api/docs/guides/migrate-to-responses)与[Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)：选择Responses及schema输出，语义/授权由本服务验证。
- [GPT-5.4 mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini)：支持结构化输出且列出固定snapshot，候选未冒称实测可用。
- [OpenAI数据控制](https://developers.openai.com/api/docs/guides/your-data)：区分application state与滥用监控留存，store设置不能证明零留存；组织审批/地区/例外在G-AI-DATA验证。

故障收敛：每次request状态读取及worker扫无正文ai_requests元数据，都将超过deadline仍PENDING者CAS为FAILED/TIMEOUT，释放主体在途及用户成功轮预留；已创建ai_call若无确定usage则标UNKNOWN并保留费用上界。执行进程恢复不能从该行再次发起模型调用。请求内部只存在最多30秒的内存任务，不产生持久化后台Agent作业；202只是状态查询协议，不把关闭面板转换为后台代办。

## 8. 最终复核修订：游客主体、运行约束、对账

**游客主体（F-01）**：guest_sessions(id,token_hash,created_at,expires_at,revoked_at)，随机256-bit token、24小时固定TTL不滚动，无个人资料。Web POST /v1/guest-sessions（Origin白名单+JSON+IP频控）设置`__Host-fancy_guest` HttpOnly/Secure/SameSite=Lax cookie，只存token hash，响应guest CSRF token；后续匿名写同登录写一样验Origin+CSRF。iOS该端点发opaque guest bearer，SecureStore保存在当前安装标记下；不信客户端自报guestId，游客token不授予任何用户私密权限。配额subject=guest_session.id，而不是AI conversationId；同guest可多tab/AI会话，刷新/NEW不重置当日额度。24h到期或清cookie视为新主体，承认额度可规避；IP/全局闸防总量。登录成功撤游客AI上下文/guest凭据、不迁偏好；logout如需游客AI另建guest session，登录user额度不变。guest不自动与analytics匿名身份关联，仍遵守采集同意契约。A02负责迁移/端点/CSRF/客户端，AI-S07/08验证刷新不重置和清cookie新主体。

iOS安装隔离（F-06）：在应用sandbox保存install marker（不进入备份）；首次启动marker缺失时先清本App Keychain/SecureStore中旧guest/AI token再建新marker。已有当前安装marker才允许TTL内Continue；重装不凭残留Keychain恢复旧对话。server最终仍校验owner/device/generation，客户端marker不是鉴权依据。

**单实例与发布（F-02）**：本阶段整个API实例数固定1（worker可多副本），部署Recreate/先停后启、maxSurge=0，禁止两个承载/v1/ai/*的实例重叠。停止时先不再接新请求、作废全部AI generation并销毁RAM；新API上线对旧会话410，原面板显示失效并保留未发文字。健康检查/部署配置在T27及A09强制验证副本数，横向扩容/滚动/蓝绿必须先完成短期共享context ADR及跨实例删除测试，不只是sticky session。核心可以未来扩容的能力不等于当前允许这样部署。

删除/偏好删除在唯一API进程内执行RAM invalidate作为受理屏障的一部分，先让generation不可发布并清引用，再提交对应撤权事务；RAM清理失败回滚DB且不返回成功，旧RAM失效最多导致重开，不泄露旧数据。若API崩溃RAM自然丢失、未commit事务回滚，客户端幂等/receipt查实际状态。核心账户删除全局锁序明确user→meal→pair→业务conversation→AI偏好/主体→AI session→quota/budget（仅需要时）→privacy_control；privacy_control保持最后一级，AI请求结果验证不得反向加锁。

**依赖（F-03）**：A02须依赖T19已实现核心删除屏障后再扩AI清理，不使用尚不存在的accounts模块；A01可独立做偏好schema/API，直到A02才能声明删除联调完成。

**对账入口（F-04）**：apps/ops-cli提供`ai-budget reconcile --call-id --provider-reference --actual-microusd --reason --expected-version --idempotency-key`，调用POST /v1/ops/ai-budget/reconciliations；专门ai_budget_ops角色+MFA，独立于support个案角色，默认无人拥有。只有从提供方账单/usage取得可核验记录才能将UNKNOWN CAS为RECONCILED并结算/释放差额，附账单引用/hash、操作者、时间、原因，无原文；已结算重复无副作用。无法确认就保留最大费用占用，不猜0、不一键清空预留。A03创建API/CLI/审计/测试，A09检验运行手册与预算告警/人工停用。角色由运维审计配置，不能客户端自授。

F-07活动合并不延长TTL：RAM时间权威不因DB flush更新，自动任务不触发活动；API重启不恢复文本，即使DB活动元数据未flush也只返回会话已失效，不假续期。
