# 历史R1原型与模拟交接（非现行研发契约）

2026-10-20：本目录pilot.ts、旧JSON白名单、固定60/45/30/15截止、低人数决定、导出及删除方案均为历史参考，未接入当前App。现行共享业务以[主PRD v0.7](../docs/product/PRD.zh-CN.md)§0为准；当前局部交互使用demo/src/domain.ts、readiness.ts和postMeal.ts。不得直接把旧模型接回App，或以旧测试代替新规则验收。后台需由原负责人按同一规则对齐。

以下保留旧方案原文以便追溯，不是现行范围或权限授权。

# 旧R1方案原文

需求真源：[中文 PRD](../docs/product/PRD.zh-CN.md)。本目录 `pilot.ts` 是单进程、内存、确定性验收模型；客户端可直接调用以演示状态，**不提供生产鉴权、数据库、网络、真实通知或运营处理**。禁止部署时把完整 PilotState 返回客户端。

## 1. 权威对象与读写

| 对象 | 创建 | 读取/展示 | 更新/撤销 | 计算与传输 |
| --- | --- | --- | --- | --- |
| Account/Profile | OTP/OAuth 服务验证后建 userId；Demo seed | projectMember按访客/登录/block投影；本人设置 | profile；delete-account清理；真实会话/认证是服务依赖 | exportAccount仅本人；Analytics只id/joinedAt |
| Meal | publish，新 mealId、hostId、capacity、minimum | 公开摘要；本人主持管理 | edit描述，确认前关键安排可改；cancel不可改为OPEN；replacement新ID | confirmedIds按时点，budget整数便士；Analytics匿名title |
| ApplicationRound | apply 每轮新 applicationId | 申请人自己的轮次/发起人对应饭局 | approve/decline/withdraw；scheduler expire；leave结束确认区间 | 当前轮次按最新记录；人数按confirmedAt/withdrawnAt；不得复用ID |
| Declaration/Checkpoint | declare at/count；scheduler checkpoint | 餐厅声明状态、检查结果 | 截止前重新声明；检查只一次；low-count主办决定 | T−15历史人数，保留全部失败原因；声明不是供应商确认 |
| Membership/GroupMessage | approve开启区间；send带client intent | readableMessages历次区间并集；屏蔽读者隐藏 | 退出饭局/取消只读；结束后继续；独立leave-group/dissolve-group关闭聊天；无消息编辑撤回；账号删除正文 | id、服务端sequence/cursor；禁止读全表再前端过滤 |
| AttendanceRevision | eligible + end≤now<end+7d | 最新本人，否则发起人补缺，unknown保留 | 自报可改，来源与序列历史保留；不人工核实 | 有效present控制反馈/互选私聊；Analytics保留self/host最新及时间 |
| ExperienceRevision | 本人有效present，评分/again无默认 | 仅本人原始反馈；后台统计 | 窗口内upsert，保留修订；资格失效退出有效统计 | 原因可[]；不是公开个人评分 |
| Connection/Block | 同桌互选/随时拉黑 | 单方仅自己；双方合格才显示connected | 撤回任意时点且清actor→目标人全部饭局同意，对方选择独立保留；新选择仍验七天窗口；block清双方同意；unblock不恢复 | canDirect每次发送重算；不导出单方选择 |
| ReportCase | 私密提交、自动case receipt | 本人回执；创始人allowlist后台 | received→in_progress→resolved需依据；Demo用户侧只received | 不进入统计正文；无人员管理/出席核实 |
| NotificationDelivery | 事件×收件人×channel | 本人站内Inbox | read cursor；邮件/push状态独立重试 | Demo只站内，实际投递待服务 |
| Export/Deletion/Consent | 自助请求/再次认证 | 本人请求状态 | 删除撤会话、联系及应用控制内个人内容；撤同意停可选采集 | 原始行为90天，最小业务审计12月暂定；不是保存聊天正文依据 |

## 2. 命令与错误

建议生产接口：`POST /v1/meals`；`PATCH /v1/meals/:id`；`POST /v1/meals/:id/applications`；`POST /v1/applications/:id/{approve,decline,withdraw}`；`POST /v1/meals/:id/{leave,cancel,declaration,continue}`；`GET /v1/conversations/:id/messages?cursor=...` 与 `POST .../messages`；`PUT /v1/meals/:id/{attendance,experience,connections/:userId}`；`PUT /v1/blocks/:id`；`POST /v1/reports`；`POST /v1/account/{export,delete}`。这是研发接口设计，当前没有HTTP实现。

actor从服务端session取得；请求不能通过actorId选择别人。写入带 `Idempotency-Key`、对象 `If-Match` version、schemaVersion。生产幂等比较应采用稳定序列化及抗碰撞摘要（当前内存模型的非密码hash仅用于演示）；key按actor+operation作用域，保留至少覆盖重试期。相同key同参数重放原结果，相同key异参数409，先检查已完成意图再检查旧version。不得在audit存原始消息/报告/申请正文作fingerprint。

服务端统一事务：鉴权→生命周期补齐→对象归属/版本→字段和状态→写结果与outbox→提交。读同样基于当前生命周期快照，分页cursor绑定actor/object/filter/snapshot；改筛选重置cursor。消息sequence与revision版本由服务端产生，不能用客户端同毫秒时间排序。

错误形状建议 `{code,message,field?,retryable,requestId,currentVersion?}`：401 SESSION_EXPIRED，403 FORBIDDEN，404 NOT_FOUND（无权对象可遮蔽），409 VERSION_CONFLICT/INTENT_REUSED/CLOSED/FULL，422 VALIDATION，429 RATE_LIMITED，503 UNAVAILABLE。Demo `PilotError`保留code/status，但错误文案归类不是完整HTTP层。真实实现必须用显式错误代码，不能依赖英文字符串鉴权。

查询加载、空、失败分开；401回登录并保留原意图；403撤销输入与私密可见数据；404展示不可用并回发现；409刷新状态保留可重填输入；503/离线保留同intent和draft，不重复乐观确认。全局acceptance version用于单进程冲突示例，生产按对象事务，不用全局锁串行所有用户。

## 3. 时间与历史

UTC ISO规范化后比较。T−60发布等号可，T−45申请/T−30批准/T−15声明截止等号不可。advanceLifecycle按计划时点处理到期；tick重放无重复通知。延迟执行不以任务到达时间替代checkpoint时间。

成员区间 `[confirmedAt,withdrawnAt)`：人数退出时刻即移出，开始资格要求confirmedAt<startsAt且withdrawnAt缺失或>startsAt。消息显示使用已授权区间的并集；同毫秒事件使用confirmedSequence/withdrawnSequence与message.sequence区分先后，当前内存模型采用命令版本序列；生产须使用服务端持久单调序列。退出后同毫秒消息不可读。

低人数继续决定保留minimum、lowCountActual、lowCountDecidedAt；lowCountHistory追加每次pending/continue及人数/时刻/序列。再次减员要求重新决定时，清空当前lowCountActual/DecidedAt，不混用旧决定。开饭未决定记录lowCountUnresolvedAtStart与unresolved-at-start历史、一次通知；不自动取消或推定同意，开始后仅只读事实、没有新的待办。不能篡改原minimum来伪造达标。R15阶段观察startsAt+24h；7天封窗按scheduledEndAt。

## 4. r1-1 JSON白名单（业务投影，无实时传输）

`projectAnalytics`导出：

- root：contractVersion=`r1-1`，demo=`true`，asOf，users/meals/applications/attendance/feedback数组，events=`[]`。
- users：id、joinedAt。fixture普通用户在该虚构数据集内部默认regular，operator排除；**demo标记环境与账号分类不同**，不混为真实用户证据。后台未知额外字段必须拒收；当前投影不传accountType，后台可兼容regular/test/staff显式分类，不影响demo环境标记。
- meals：id、匿名占位title、hostId、startsAt、endsAt、publishedAt、area、language展示值、capacity、minimum、budget（GBP换算自budgetMax便士）、source、cancelled、cancelledAt、cancelReason/cancelReasons固定枚举、peakConfirmed、checkpoint、lowCountDecision。
- 取消原因允许insufficient/booking/host/host_changed/other/unknown；内部account-deleted或自由描述只映射other，不传正文。replacementFor、lowCountDecidedAt/Actual、declaration留业务模型/审计，r1-1未导出；如后台需要应显式升级契约，不偷偷加字段。
- applications：id/userId/mealId/appliedAt/decidedAt/decision/confirmedAt/withdrawnAt/expired，不传介绍与授权消息列表。
- attendance：mealId/userId/self/host/updatedAt，仅开始时有效参与者。unknown以字段缺失表达。差异保留两来源，无verified。
- feedback：mealId/userId/score/again/reasons/at/issue=`none`，只投影当前有效present整场反馈。
- events：r1-1必须空，真实SDK另外验收；不伪造发现/曝光数据。姓名、bio、申请/群聊/举报正文、单方互选均不传。

手工验收：review模式Settings导出JSON→后台Dataset导入→parseHandoff校验版本/大小/白名单/对象关系/时间→确认应用快照→比较asOf及人数/反馈。导出导入是一份不可变模拟快照，用户端后续变化不会自动传后台；重导入才更新。导入失败不得覆盖现有数据。`demo/tests/pilot.test.ts`覆盖用户规则；跨端roundtrip需与后台最终parser一起验证。

## 5. 研发前置与Demo未实现

必须补真实Identity/4 OAuth providers、通知邮箱验证/投递、数据库事务/定时任务/outbox、消息分页/限流、内容检测/安全联系、allowlist鉴权、report处置、真实删除作业、备份清理、consent SDK、iOS原生实现与平台验收。本地 checkbox“再次认证”、角色切换和连接失败控件都是验收模拟，不能作为生产方案。

UI普通界面移除开发备注；验收模式记录上述限制。旧预付/代订只在 `?scope=future`，旧测试继续证明其独立领域行为，不证明R1后端已就绪。

取消命令只接受host/host_changed/other；自动取消的insufficient/booking和删除内部原因由系统产生。自由文本不得作群发reason，私密note不入通知；收件人仅host+当时CONFIRMED/PENDING。删除账号只取消未开始主持桌、退出未开始参与；已开始桌保留生命周期、开始时成员关系与他人出席/反馈资格，个人内容去标识，不创造开饭后低人数任务。apply/publish均要求adult===true；缺失与false不能提交。attendanceStatus仅present/absent/unknown，无conflict结果。

低人数未决定的r1-1传输保持原枚举：`lowCountDecision: "pending"`，连同既有`startsAt`、`cancelled`、root `asOf`。不新增unresolved枚举；内部历史与lowCountUnresolvedAtStart不进入当前白名单。后台须派生可操作条件 `pending && !cancelled && asOf < startsAt`；已开饭pending仅是未决定历史，不是待办，不能推定host同意。已增加该状态的实际导出→parseHandoff往返测试。

## 2026-10-19 已确认的体验规则

人数为发起人自选整数区间 `2 <= minimum <= capacity <= 6`，历史缺值按旧规则推定。群聊退出 `chatLeftAt/chatLeftSequence` 与解散 `groupClosedAt` 不改变参与退出 `withdrawnAt`、历史出席或统计，均排除在 r1-1 投影外。饭后保持群聊开放；不新增二次入群审批。

创建只接受 `venues.ts` 中核验的真实地点身份，不能自由填写虚构名称/地址。当前是固定真实目录，并非实时 Google Places 搜索；Google Maps/官网链接是餐厅身份来源，不代表预约或库存。用户端不提供保存草稿或 Export my data。
