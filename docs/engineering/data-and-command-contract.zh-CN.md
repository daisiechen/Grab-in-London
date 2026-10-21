# 核心数据与命令契约 v1

本文件与[方案](core-development-plan.zh-CN.md)、[接口](api-and-client-contract.zh-CN.md)共同构成待实施规范，不表示已建表。Postgres READ COMMITTED+显式行锁；所有ID为UUID，时间为timestamptz/UTC，金额为GBP整数便士，版本为bigint；对客户端输出字符串序号，避免JS精度丢失。JSON字段不用于绕过核心约束。业务事件只追加，隐私清理例外有独立审计。

## 1. 表、约束与查询

| 表/主键 | 必需字段、约束与索引 | 权威与可见性 |
| --- | --- | --- |
| users(id) | status ACTIVE/DELETING/DELETED，version，privacy_epoch；公开资料独立profile表；email在private_contact | 身份状态每次请求检查，公开DTO白名单，不序列化整行 |
| identities(id) | unique(issuer,subject)，user_id；verified claims摘要、linked_at | 邮箱不是唯一业务身份键；同邮箱不自动合并 |
| sessions(id) | user_id,family_id,token_hash unique,kind,expires_at,last_used_at,revoked_at,auth_time,amr；refresh_tokens哈希唯一和rotation parent | refresh重用撤销family；cookie/refresh明文不落库 |
| auth_transactions(id) | kind,challenge_hash,state_hash,nonce_hash,return_target,attempts,expires_at,consumed_at | OTP/OAuth/link/handoff均一次消费，保存最少关联数据 |
| roles(user_id,role) | role analyst/data_admin/support，授予来源 | 后台与支持MFA；业务DB角色不能由客户端写 |
| meals(id) | host_id,venue_ref,starts_at,closes_at,scheduled_end_at,local_time,utc_offset,minimum,capacity,budget_min_pence,budget_max_pence,languages,mood,area_code,cuisine_code nullable,dietary_codes nullable,title,description,status,cancel_reason,version,head,arrangement_locked_at | CHECK 0<budget_min_pence≤budget_max_pence；languages非空去重；CHECK 2≤minimum≤capacity≤6；end=start+2h；截止≤start−30m；发布校验future不能用静态CHECK系统时钟 |
| booking_declarations(id) | meal_id,revision,reported_by,declared_count,reported_at,status,arrangement_hash；unique(meal_id,revision) | 发起人自报；人数或安排改变使旧声明stale；不冒称平台订位 |
| applications(id) | meal_id,user_id,round,state,message,created_at,decided_at,version；unique(meal,user,round) | partial unique(meal,user) WHERE state IN(PENDING,CONFIRMED)；DECLINED历史使该人本场永久不能重申，须锁内查历史 |
| seat_events(meal_id,seq) | user_id,application_id nullable,type HOST_CONFIRMED/GUEST_CONFIRMED/LEFT,effective_at,recorded_at,command_id；unique(command_id,event_type,user_id) | meal.head锁内递增；历史重建人数，不用现有application状态倒推 |
| start_roster(meal_id,user_id) | source_revision_hash,starts_at,created_at；lifecycle_marks unique(meal_id,kind,due_at) | 开始名单缓存可重算；不一致报警，普通命令不能修改过去成员事实 |
| conversations(id) | kind GROUP/DIRECT,meal_id unique nullable,pair_id unique nullable,head,dissolved_at,version | 行锁保护序号分配及提交顺序；禁止global bigserial当拉取游标 |
| conversation_events(conversation_id,seq) | kind JOIN/LEAVE/DISSOLVE/MESSAGE，actor_id,effective_at | 每种边界都占同一序号；事务回滚不留已发布空洞 |
| membership_intervals(id) | conversation_id,user_id,join_seq,leave_seq nullable；CHECK leave>join；partial unique(conversation,user) WHERE leave_seq IS NULL | JOIN时开区间，LEAVE/解散关区间；union授权历史，不能读取空档 |
| messages(id) | conversation_id,seq,sender_id,body,client_message_id,created_at,redacted_at；unique(conversation_id,seq)，unique(sender_id,client_message_id) | 正文只在专用消息接口；重用client ID不同body=409；不进入分析或支持默认结果 |
| user_pairs(id) | low_user,high_user,consent_epoch,version；CHECK low<high；unique(low,high) | 阻止重复pair；撤回/拉黑/资格撤销与发送共用pair锁 |
| pair_consents(id) | pair_id,user_id,epoch,basis_meal_id,selected_at,revoked_at；同epoch每方唯一 | 单方不可见；共同饭局资格和7天提交窗口；撤回/拉黑将epoch+1清空双方 |
| blocks(blocker,blocked) | created_at；CHECK blocker≠blocked | 解除只删有效block投影，审计保留，双方同意不恢复 |
| attendance_revisions(id) | meal_id,subject_id,source SELF/HOST/SUPPORT,value present/absent（未报告投影unknown）,version,reason,actor_id,created_at；unique(meal,subject,source,version) | SELF高于HOST；授权SUPPORT裁定修订为显式override，不与普通来源混算；UNKNOWN不当缺席 |
| experience_revisions(id) | meal_id,user_id,score 1..5,revision,created_at；unique(meal,user,revision) | 按user+meal取最新且当前合格；纠错使其退出有效统计，原修订保留 |
| public_review_revisions(id) | meal_id,author_id,subject_id,body,revision,created_at | 互评均提交或end+7d才公开；双方当前出席资格仍须成立 |
| product_survey_revisions(id) | user_id,revision,again bool nullable,reasons enum[],created_at | 不含meal_id；每用户取最新，空值不算否；字段枚举直接引用采集契约 |
| reports(id),support_cases(id) | reporter_id,target_type,target_id,reason,status,receipt,version；case access关联support actor | 报告内容仅本人状态和个案支持可读；不提供常规出席核实队列 |
| deletion_requests(id) | user_id unique,receipt_token_hash,status,requested_at,completed_at,provider_steps,policy_version | 删除受理后仅receipt可读最小状态；不保留明文receipt token |
| notifications(id),outbox(id) | event_id,recipient_id,channel,template,status,attempts,next_attempt_at,provider_id；unique(event,recipient,channel) | 站内同事务；邮件异步至少一次，UNKNOWN需provider查询或人工核对 |
| idempotency(actor,operation,key) | request_hash,state,response_status,response_json,resource_id,created_at,expires_at | 唯一原子声明；30天后旧意图不重放。永久资源约束另保messages/deletion |
| jobs(id) | kind,resource_id,due_at,state,attempts,lease_until；unique(kind,resource_id,due_at) | SKIP LOCKED领取有租约，重试领域命令仍幂等；不把领取等同完成 |
| business_events(id),audit_events(id) | aggregate_id,aggregate_seq,kind,effective_at,recorded_at,actor,revision,allowlisted_payload | 只由服务端写权威成功事件；审计无OTP/token/chat body，禁止私密再约标签进普通分析 |
| analytics_events(id) | event_id unique,anonymous_id,user_id nullable,session_id,type,occurred_at,received_at,schema_version,environment,consent,classifications | 严格schema白名单；事件时间/接收时间/同意/环境按采集契约，不信客户端自报业务成功 |
| identity_links(id),classification_revisions(id) | 匿名关联证据、consent时点；actor,reason,revision,effective_at | consent撤回影响后续采集/关联；分类只有data_admin维护且新快照生效 |
| snapshots(id),snapshot_rows(snapshot_id,row_id) | as_of,created_at,input_manifest,classification_revision,metric_version,privacy_epoch,status SEALED/REVOKED；行事实和修订来源 | 一致性输入而非实时重算；后台DTO脱敏，禁止私密正文；缓存键带snapshot+过滤+角色 |

所有外键显式ON DELETE策略：业务历史RESTRICT或受控去标识，不级联删除他人席位/消息；私有会话凭据CASCADE清理。常用索引：(meals.status,starts_at)、applications(meal,state)、seat_events(meal,effective_at,seq)、intervals(user,conversation)、messages(conversation,seq)、revisions(meal,subject,revision DESC)、outbox(status,next_attempt_at)、analytics(received_at,type)。迁移必须实际验证partial unique/CHECK/FK，允许Drizzle中显式原生SQL，不靠TS类型代替DB约束。

## 2. 事务算法与失败行为

统一锁顺序：user按ID→meal按ID→pair按ID→conversation按ID→revision。涉及的其他user只在需要防止删除并发时FOR SHARE，涉及任一方同意/消息写入要锁双方。支持纠错需要发现相关pair/conversation后按顺序加锁，再重读当前状态；发现集合扩大则回滚重试完整集合，禁止持有后级锁再逆序补前级锁。用户pair可能尚不存在，先INSERT ON CONFLICT再锁；同一唯一pair的创建与使用不分开。所有命令重跑账户状态、版本和授权；不能用锁外读取作业务判断。

| 命令 | 锁内顺序、写入与拒绝 |
| --- | --- |
| publishMeal | 校验资料/18+/社区、confirmed placeRef、时间、人数、外订模式；插meal+HOST_CONFIRMED+GROUP/JOIN+作业+事件；host占1席；草稿不占席 |
| updateArrangement | expectedVersion；arrangement_locked_at非空拒绝；变更后全量校验截止/预约声明并重排唯一作业；首guest批准即永久写locked_at |
| apply | advanceLifecycle；t<closesAt、未cancel、人数<capacity、本人非host、无DECLINED历史/有效申请；新round PENDING；同一intent重试不加round |
| approve/decline | host本人且申请人的user行FOR SHARE并为ACTIVE、申请PENDING；t<closesAt、未cancel；approve重数席位防超售，CONFIRMED+seat event；群未解散且本人无open interval则JOIN，已经在群不重复JOIN；decline→DECLINED |
| withdraw/leaveMeal | pending→WITHDRAWN，confirmed仅t<start→CANCELLED并LEFT；不关群；截止通过后若人数跌破min立即取消；host不能以普通leave代替cancel |
| cancelMeal | host且t<start或系统不足人数；终态不可恢复；关闭pending EXPIRED，给当前申请者/确认者及host通知；不改历史确认事件，不关群；同一cancel不重复 |
| advanceLifecycle | 按closesAt、startsAt、end升序补齐；截止用seat历史at closesAt检查，pending EXPIRED；不足人数写effective_at=closesAt取消；已取消停止后续；开始建名单，结束COMPLETED；延迟worker与在线命令同函数 |
| declareBooking | host+expectedVersion，报告状态/人数/时间；只改声明，不隐含meal cancel、群关闭或平台预约成功 |
| groupLeave/dissolve | conversation锁；LEAVE占序号并关闭本人区间；dissolve仅host，占序号关闭全部区间；席位不变。重复幂等；解散永不重开 |
| sendGroup | 当前open interval、群未解散、双方账户状态校验（发送者必须ACTIVE）；conversation锁分配MESSAGE序号；即使meal cancel/end仍可发 |
| attendance | 名单内且窗口[end,end+7d)；SELF只写本人、HOST写本场成员；current projection SELF优先；support仅t≥end+7d、被更正者在开始名单且场次未取消，需case、reason、expectedVersion、MFA，否则409 CORRECTION_WINDOW_OPEN；资格变化更新依赖投影，不修改旧业务事实 |
| feedback/review/reconnect | 自助窗口和当前present资格；有效reconnect还须对方present/未block；单方consent不泄露；体验/公评/私密选择分别存储，不合成一个问卷 |
| revoke/block/unblock | pair锁；撤回和block将consent_epoch+1，使双方旧选择无效；block不关共享群；unblock不恢复选择；历史私聊仍按既有参与授权只读 |
| sendDirect | 锁双方user、相关basis meals、pair、conversation后重读：无block、当前epoch双方consent、至少一个仍有效共同出席依据；不要求发送时仍在7天选择窗口。纠错使一场无效但另一场有效则保留发送；否则403，旧历史保留只读 |
| supportCorrection | 仅effectiveNow≥end+7d且名单内未取消；与普通命令共用服务函数、case授权、reason/expectedVersion；记录覆盖来源和前后版本，重算体验/公评/再约资格；不读聊天或单方选择，不允许SQL直改 |

开始名单：confirmedAt < startsAt，且leftAt为空或leftAt > startsAt；等于开始退出者排除。普通用户start之后退出被拒绝；删除/支持/迁移同样不得改变他人名单。截止人数要求confirmedAt < closesAt且leftAt为空或leftAt > closesAt，等号退出排除。单个命令的effectiveNow是所有锁取得后DB取的时钟；定时事实effective_at用计划时点，recorded_at用此次时钟。补齐事实后业务409仍commit补齐；schema/auth失败不进入业务事务。

群历史过滤：任一interval满足join_seq < message.seq，且leave_seq为空或message.seq < leave_seq。退群后允许历史API查询已授权区间，**只停止新消息轮询/发送**，不得403抹掉原PRD承诺的历史。重入的消息列表可跨多个区间，cursor扫描至head并跳过未授权空档，返回scannedThroughSeq防止反复扫描；响应不暴露隐藏消息正文/发送人/数量。解散后用相同历史路径。DIRECT会话历史访问由曾被授予会话参与身份决定，当前发送权限另算；无会话参与身份的人即使知道ID也404。

## 3. 删除、隐私与恢复

`requestDeletion`经5分钟reauth。同步事务取得本人user FOR UPDATE，然后按顺序锁其所有未开始的主持/确认参与/仅PENDING申请meal、相关pair与conversation；PENDING申请同步WITHDRAWN，不等worker。取得锁后取t，补齐生命周期；t<start的主持场取消、参与场退出；t≥start保留开始事实与他人资格。账户转DELETING，撤销全部session，清双方consent、关闭其group区间、公开投影立刻不返回身份/内容，通知与purge jobs同时提交。**事务未成功不返回202**；失败可用同intent重试。长事务超时回滚重试，不能先202再让延迟worker决定是否赶在开饭前退出。其他命令持user SHARE因此不会检查完状态后穿过删除屏障。

客户端在发送删除请求前生成并安全保存256-bit receiptToken，服务端仅存其哈希；202确认受理后，响应丢失仍可凭预存token查结果，不依赖已撤销session重放。后续凭receipt只读PENDING/PROCESSING/COMPLETED/NEEDS_SUPPORT，不返回个人数据。后续worker幂等执行：Auth0身份/refresh清除；Apple授权撤销（G-AUTH验证提供方token和撤销流程）；公开及私有正文删除或去标识；匿名关联断开、原始事件清理、快照正文/预生成CSV物理清理（撤销屏障已同步完成）；仅保留政策批准的争议最小记录，support按case访问。每步失败可恢复，不能把部分完成标最终成功。provider token若为撤销所需须加密独立vault、最小scope、清理后销毁，绝不进分析表。

快照正常不可变；删除例外采用**整份受影响快照撤销**：删除受理事务同步锁privacy_control单例并epoch+1，撤销受影响已发布snapshot且使旧导出失效后才202；privacy_control为删除与快照发布的最后一级全局短锁，任何事务拿到它后不再获取user/meal/pair/conversation锁。后台读、下钻和导出先检查snapshot.status及privacy epoch，受影响旧snapshot一律410 SNAPSHOT_REVOKED（包括聚合），不以同ID悄悄重算。新快照重新生成，**删除者全部用户级业务/行为贡献退出新快照的用户及参与分子/分母**，不保留可关联匿名参与行；已发生meal本身和其他人出席仍保留并可计场次数，不以host删除抹去他人事实。受影响集合按snapshot_subjects(snapshot_id,user_id)内部索引追踪：包含该用户的贡献或以该主体划分的维度即受影响；索引只供删除，不向分析角色开放。此策略比仅屏蔽下钻更保守，避免小样本旧聚合继续关联。历史已下载文件无法远程撤回，导出仅脱敏并no-store；不公开管理员统计。复原备份后先重放独立删除/撤销台账，再开放流量。上线前G-PRIVACY批准保留期/审计与备份清理，未批准不得接真实用户。

## 4. 分析一致性

小时worker在Postgres REPEATABLE READ事务取asOf，读取在该MVCC视图内已提交的业务事件/修订、SDK事件、分类、身份关联；剔除effectiveAt/occurredAt晚于asOf及receivedAt晚于asOf的数据。构建开始读取privacy epoch，发布短事务仅锁privacy_control并比较epoch；若期间任何删除使epoch变化，丢弃该构建并重算，不能让删除前MVCC数据在删除后重新发布。结果、输入行ID+revision摘要/哈希和指标版本一起密封；不能用`max(bigserial)`假定之前全已提交。并发创建snapshot只发布完整SEALED，不发布半份。迟到/纠错/分类改变写入新snapshot，旧的普通数值不变。

全部算法、母集、窗口、null/unknown、去重和来源优先级逐条实现[采集契约](../product/admin/measurement-contract.zh-CN.md)；不另造公式。关键例：申请按applicationId，参与按user+meal，截止/开饭历史名单，结果成熟asOf≥end+24h，体验仅有效present最新分数，Survey按用户最新且独立于meal；再约只输出契约允许的脱敏聚合。服务端拒绝前端业务success事件伪造。所有后台过滤、下钻、分页及导出携带同snapshotId+canonicalFilterHash；翻页不换快照，分类更新提示切新快照。

## 5. 字段与采集契约映射（C-01）

| 正式业务字段 | 来源及后台投影 |
| --- | --- |
| budgetMinPence/budgetMaxPence | 发起人Costs区间，整数便士且0<min≤max；后台budget=budgetMaxPence/100，不取平均价；旧fixture未知单列，生产新场不得缺预算 |
| languages:string[] | 业务语言字典稳定BCP47：English=en、Chinese/Mandarin/中文=zh、Spanish=es、French=fr，其余沿用现有完整选项一一映射；当前单选UI发送单元素数组，历史双语以明确字典映射，禁止运行时拆任意字符串猜测；后台English/en与中文/zh过滤按包含，双语各命中但同集合去重 |
| mood | 发起人Introduce现有氛围选项字典code；API返回code+英文label，不接受未登记枚举；T01从现有选项生成版本化字典测试 |
| areaCode | 服务器按已确认Places坐标与版本化伦敦区域polygon点包含映射，边界按固定areaCode排序取首项；地址文字仅辅助展示，不随意NLP猜区；无匹配为unknown，不能默认Soho，区域字典/GeoJSON来源与许可在G-PLACES证据记录 |
| cuisineCode/dietaryCodes | 依据P-05由host可选声明；cuisineCode null、dietaryCodes null/非空去重数组，null表示未提供，不能将空数组视为无任何饮食限制保证。对具体菜系/饮食hard条件unknown不命中；Any/No preference不排除unknown；偏好soft未知为0命中。不从Google/店名推断，页面注明host-reported / not an allergy guarantee；编辑遵守首guest后关键安排锁，变更需取消重建 |
| publishedAt/cancelledAt/decision/confirmedAt/leftAt | 服务端事件/修订记录的有效时间与接收时间，字段名显式映射采集契约；申请出席只归开始前有效确认轮次 |
| classification | 正式API/DB统一regular/test/staff；旧PRODUCTION/TEST/STAFF仅一次导入映射regular/test/staff，客户端不能自报 |

公开读路径用DB一致性读视图的history和同一readNow运行projectLifecycle，不获取FOR UPDATE、不写状态；列表先按索引/过滤候选限制每页≤100，cursor扫描限制500条，过滤掉过期/取消时继续查至页满或扫描上限，返回nextCursor而不谎报所有结果。单场详情也纯投影；approved/apply等写命令及worker才持锁持久advanceLifecycle，读到的allowedActions只是提示。DB readNow不信客户端时钟；状态过期不因worker停机重新可申请。

身份链接分支：已有issuer/sub直接登录原账户；新身份email匹配现有账户时只产生短期LINK_REQUIRED ticket，不创建第二业务user，要求现有身份reauth和新身份proof；取消只回登录。遗留第二业务user若仅初始化空profile、无资料确认/偏好/申请/席位/meal/message/consent/block/report/deletion/role/分析关联等事实，视为provisional空壳；双proof后按ID锁双方，迁移identity映射、撤空壳全部session、墓碑化空壳并审计（不迁业务数据）。任一非上述空壳事实都拒绝ACCOUNT_LINK_CONFLICT，保留原两账户/提示使用原登录或自主删除不需的账号；首期没有支持合并承诺，也不允许拿支持SQL迁历史。无相同邮箱不能凭字符串搜别人的账户，链接仍须已登录本人双proof。

## 6. P-05声明字典与删除统计补充

字典由packages/contracts的版本化常量生成host选项、发现筛选与AI校验，最初复用现有UI/assistant已定义值：cuisine EUROPEAN=European、JAPANESE=Japanese、SPANISH=Spanish、CHINESE=Chinese；dietary VEGETARIAN_OPTIONS=Vegetarian options、VEGAN=Vegan；mood EASY_CONVERSATION、FOOD_DISCOVERIES、TRAVEL_CULTURE映射现有英文。可选Unknown/Not provided写null，不写字符串“unknown”伪枚举；新增词汇必须显式登记/测试，不把seed当餐厅范围白名单。用户只说Spanish不确定语言或菜系则AI追问；未登记菜系/饮食要求作为未支持条件明确说明/澄清，不伪称匹配。host两项放既有Introduce相关字段位置，只由原会话补Demo，研发生产版依批准规格实现；不自动勾选或从旧sample填入。

删除后的新快照：删除者从参与/用户及所有按人头派生的分析贡献排除，包含peakConfirmed/招募达标等在新快照按剩余regular成员事件重新计算；例如原peak3/min3、删1人，新分析peak2/未达标。**业务原成团检查、取消原因、开始名单事实仍不重写**，这是隐私清理后统计口径变化，后台注明privacyExcludedCount/coverage limitation；其余成员资格和meal存在不受影响。此规则不同于“仍保留可关联匿名席位行”，不留该行。S25须验证新旧数值与业务事实分开。
