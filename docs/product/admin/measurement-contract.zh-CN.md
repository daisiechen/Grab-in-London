# R1指标、共享投影与后台API契约

版本：r1-v3｜2026-10-19。属于[后台PRD](PRD.zh-CN.md)研发附录；共享业务规则以[主PRD](../PRD.zh-CN.md)为准。历史v2中的人工出席核实、公评/平台收费、结束后24h、直接重算旧快照不是现行规则。

## 1. 数据粒度与时间

- 所有业务时间ISO UTC传输，伦敦时间显示/归日归周，周一开周；UTC连续14天/30天用毫秒，不用日历天相减。`asOf`是数据截止，不是浏览器当前时钟。
- 事件eventId、申请applicationId、饭局mealId；参与/反馈按(userId,mealId)，人按稳定userId。一次真实撤回/确认后退出再申请产生新applicationId；幂等重试不产生新轮次，被拒不可同场重申。分母按轮次时不能按人去重；出席不能把两次申请当两个人次。
- 首期发布恰好T-60min可接受，申请在T-45min及以后拒绝，批准T-30min及以后拒绝。T-15min检查最低人数及host外订声明，声明人数须等于当时确认人数；不足/未订好位可同时成为取消原因。检查通过后减员由host决定继续/取消，允许低于minimum继续，不补员、不再次自动取消。
- 人数上限2–6含host，minimum双人2、其余3；预算必填，按人均上限GBP显示；共享投影将源budgetMax整数便士÷100映射budget，不能当平台收费。餐厅人工录入，平台不查供应商库存、不收费。
- scheduledEndAt映射后台endsAt，首期默认startsAt+2h。出席/私密整场体验/互选在结束时可提交，结束+7天及以后不可提交修改；互选撤回和拉黑随时可做。出席不设运营核实。

## 2. 原始来源与统计

| 指标/ID | 公式、入组与获取 | 边界/用途 |
|---|---|---|
| 每周确认出席/weekly | 按meal.startsAt伦敦周，有有效present的去重userId，含host；参与表+报告 | 同周多场1人，未知不计；部分周明确标记 |
| 首次申请后14天内出席/activation | 历史首笔提交appliedAt在范围且+14天≤asOf为分母；其中历史首个出席在首次申请起[0,14天]为分子 | 纯host看创建流；先取完整提供历史首次再筛日期；未观察满不算失败，后续出席可跨范围/饭局 |
| 首次出席后30天内再赴约/retention | 历史首次出席在范围且+30天≤asOf为分母，其中(0,30天]内另一mealId出席为分子 | 未成熟不算流失，当前界面写观察中；后续不限入组区域/语言/来源；非App打开留存 |
| 出席结果覆盖/coverage | (present+absent)人次/已结束未取消的应报告人次 | host+开始前确认且未在开始时或之前退出的成员；latest self优先、host补缺；未知保持未知，来源差异单列而非冲突待办 |
| 首次申请→出席阶段/applicationAttendance | 期内申请关联startsAt+24h≤asOf场次为分母，有有效present的申请为分子 | **不是结束后24h**；24h只阶段观察，7天窗口仍可回补；同时显示stageWindowOpen，不作最终失约判断 |
| 浏览阶段 | discovery_results/有效meal_impression/detail_view分别去重访客标识（含匿名） | 不保证嵌套、不跨单位相除；注册人、匿名标识、未知session不冒称同一真人 |
| 发现无结果/discovery | resultCount=0有效成功请求/全部有效成功请求 | 必须非负整数；报错/缺数量隔离，不当0结果；空采集源为未接入而非0请求/0使用 |
| 发现7天申请/discovery7 | 有成熟发现请求且任一次请求后7天内成功申请的去重身份/有至少一次观察满7天请求身份 | 同一明确映射userId；注册前后会话映射，不猜跨会话/跨设备；后续可跨结束日期至asOf |
| 曝光后7天未申请 | 成熟曝光身份中未在任一成熟曝光后7天内申请的身份/成熟曝光身份 | 曝光卡片50%可见+连续1000ms、前台、当时可申请；同sessionId+mealId首次有效曝光 |
| 申请推进 | 范围内appliedAt的每个applicationId，跟踪approved/confirmed/withdrawn/expired至asOf | 提交≠批准≠席位≠出席；线下付款R1批准即确认。过期不计待审，撤回重申保留两轮 |
| 审核用时/approval | (首次有效decidedAt−appliedAt)小时，最近秩P50/P90 | 仅已处理，待审数量/当前等待单列；expired/withdrawn不冒充仍等待；禁止负耗时 |
| 创建流/功能 | create_started按identity+attemptId，安排后发布按同attempt时间关联；地图/筛选/资料/群聊为有效使用身份 | form_error固定step/field/errorCode不带输入值；没有SDK返回未接入，不补fixture；无尝试分母不造完成率 |
| 开始前招募达标/formation | 已到开始时间的发布场次中，开始前有效确认峰值≥minimum场次/同范围场次 | 从确认/退出区间重建峰值，多轮同userId去重；统计分类后可重算，不等于T-15业务检查通过或实际举行 |
| T-15检查/checkpoint | 记录passed数/有checkpoint的场次；insufficient、booking、both、检查前取消、缺事实、名单对账差异分列 | 依据业务checkpoint.at/passed/count和cancelReasons，不从当前名单或峰值猜当时结果；cancelledAt缺失不能推断检查前取消 |
| 检查后低人数/lowCount | passed后开始时人数低于minimum；continue/开饭前pending/已开饭未决定unresolvedAtStart/cancelled/缺决定互斥分列 | pending仅asOf<startsAt；asOf≥startsAt派生unresolvedAtStart，仅作历史观测，不是可操作待办。不自动第二次取消；不把人工继续当数据失败；原minimum不改写 |
| 取消/cancellation | 取消场次/已到开始时间的发布场次；固定原因分别计份数 | 多原因合计可超过取消数，重复code只计一次；host/insufficient/booking/host_changed/other/unknown，不能用自由文字或account-deleted作为分析code |
| 体验/feedback、again | 最新有效1–5评分人次/present人次；明确again=true份数/明确回答again的有效整场反馈 | 不是公评，也不是想再见某人的单方互选；出席更正absent则移出统计，原版本保留 |
| 评分与reasons | 1–5分布，原因固定多选按评分切片；未填为空数组单列 | company/conversation/coordination/expectations/venue/cost/other；不读取举报/消息/公开文字推断原因 |
| 后续机会 | 满30天用户在首次出席后30天有效曝光另一未来可申请饭局的比例 | 只是看到机会代理，无曝光不证明无供给；SDK未接入则不可用 |
| 质量 | 缺必填、去重、测试/员工排除及接收延迟P90，全快照范围 | 不受业务筛选影响；业务结果与客户端事件各自权威，不接受客户端自报业务成功 |

通用：零分母null显示—，比率带分子分母；同页、下钻、CSV复用同一snapshotId/asOf/definitionVersion/factVersion。若historyCoverageStart或完整历史保证缺失，称“可观测首次”，不能宣称终身首次。Demo输入的production环境标记只模拟采集范围，不证明真实数据。

## 3. App入口与权威来源

- 账户服务提供稳定去标识userId、joinedAt与服务端统计分类；邮箱/OAuth只是登录凭据，不做分析主键。账号分类不改用户业务权限。
- 发布/申请/审核/确认/退出/过期/取消/检查点来自业务服务的事务事件或可靠outbox/增量查询，保留状态版本、时间和完整席位日志。客户端只表达意图，不由点击代替成功。
- Discover成功结果有requestId和请求真实筛选；曝光由客户端可见性定时触发，详情实际呈现，创建步骤/校验成功及失败有attemptId。SDK尚未实现时sourceStatus.events=not_connected。
- Meals→Past/已完成饭局→本人报告，host逐人补缺；服务端校验资格、结束时间及7天窗口。host/self分开版本化，当前本人值优先；不接收verified覆盖，也不需要人工出席流程。
- 私密整场体验1–5+明确是否愿再参加Fancy，原因可选多项；同人同场更新保留版本。权限/统计读取与用户端同一出席事实；公评后续，互选不可用于again。
- 举报走独立服务返回caseId自动回执，后台仅按需处理个案。消息正文、举报正文、单方互选不进入分析投影。告警/通知由站内+邮件服务处理，iOS推送补充；不需要全职后台日常维护。

## 4. R-16可执行筛选与身份规则

同字段OR、跨字段AND。请求没有mealId时用实际请求属性；有mealId的具体饭局事件按该场属性匹配。宽请求不能用响应中第一场饭局属性代填。

| 输入 | 查询 | 预期 |
|---|---|---|
| 请求areas=[Soho,Camden]、预算[20,35]、sizes=[2,4]，发生9月22、想约11月1 | 发生期9月+Camden+(30,40] | 计1个请求；预算交集非空，目标日期不改变发生日期入组 |
| 同请求 | Soho或Camden、(20,30]或(30,40] | 仍1个请求，不因命中两维多个选项重复 |
| 未限定area/字段缺失 | 全部区域 | 计入总量；选具体Soho时不擅自归属 |
| 范围请求无预算上下界 | 全部/未填写预算 | 保留未知；选具体预算桶不猜范围 |
| 匿名anon=A，session=s1映射u，s2未映射 | 全部用户 | s1归u，s2保持匿名；不猜同设备/同真人 |
| u事后标test | 新快照 | u及明确会话映射事件排除，s2未明确归属不能猜测排除；历史快照不变 |
| 首次出席在10月1，筛10月3之后 | 首次队列 | 不把10月后续参与误当首次；后续结果不裁掉跨期出席 |

请求预算桶采用相交匹配，端点遵循[0,20]、(20,30]、(30,40]、(40,+∞)；最大值正好20不命中第二桶。单值旧request.budget为其记录的预算上限，按上限所在桶兼容，不伪装完整区间。可选request.dates只作上下文；当前全局日期是发生日期，不是目标开饭日期。无稳定匿名ID时只可报告session代理标识，不宣称已注册人数。

这些用例在`admin/tests/r1-boundaries.test.ts`手算执行；SDK正式接入需同样夹具验证客户端→接收端→模型→页面/CSV。

## 5. 共享脱敏Demo投影与导入

唯一App出口为`shared/pilot.ts::projectAnalytics(s)`，当前contractVersion=r1-1，demo:true。后台入口`parseHandoff`白名单仅收asOf、users、meals、applications、attendance、feedback、events；禁止消息/举报正文/互选/verified/邮箱/名字/介绍。users仅允许id与joinedAt，拒绝accountType；统计分类仅由后台授权命令维护，导入保留已人工分类，新用户默认为regular。固定标题仅作饭局识别。预算便士转GBP、scheduledEndAt→endsAt、语言code→规范语言字符串；多轮申请保留每个applicationId。源使用固定取消code，删除账号引发的取消account-deleted映射other类，原内部审计不混入原因枚举。

严格校验：UTF-8≤512KiB、每数组≤5000；唯一ID和关联，host不能申请自己饭局；ISO有效日期与时间顺序、发布/申请/审核截止；确认与批准配对；capacity2–6、minimum2/3（统计分类regular/test/staff不属于导入字段）；出席/反馈资格和7天窗口；原因/评分/显式again。禁止unknown字段，不能宽松吞掉原始个人数据。契约版本是schema版本，本地factVersion/分类version另管并发，不虚构App未提供的记录版本。生产接口必须提供业务版本/receivedAt/完整历史覆盖元数据。

导入失败保持事实、快照、选择和审计不变；成功经白名单授权追加导入审计，生成新快照，清空旧详情与列表cursor，保留旧快照。输入events=[]不是“功能没人用”，sourceStatus.events=not_connected，相关图表—/未接入，业务结果仍可显示。不能用已有fixture补进导入数据。

本地手动JSON验收不等于线上采集联通；正式SDK/业务API输入与demo导入分开，生产不提供此静态导入入口。`?review=1`仅控制验收工具显示，不是安全授权。

## 6. 后台生产最小API与错误

所有接口服务端校验稳定userId+创始人白名单；TLS/会话由实现方案落地，不在静态Demo伪造。规范请求/响应包含requestId，写入带Idempotency-Key和expectedVersion；重试同意图同key，同key不同意图409。JSON数值/枚举/长度由服务端重验。

| 资源/动作 | 最小契约 |
|---|---|
| GET /admin/snapshots?cursor | 授权范围内ready/pending/failed元数据，snapshotId/asOf/definitionVersion/factVersion/sourceStatus/historyCoverageStart；opaque cursor最多200条 |
| POST /admin/analytics/query | snapshotId+规范filters+cursor+pageSize；返回聚合/下钻只读投影及同一元数据。cursor绑定snapshot/filters/scope，不可跨快照复用 |
| POST /admin/exports | snapshotId+filters+definitionVersion；生成聚合CSV，返回受权限约束的短期下载定位。不导出原始用户/消息/个案依据；重复同请求内容一致 |
| PATCH /admin/account-classifications/{userId} | to+reason(1–200)+expectedVersion+幂等key；回classVersion/factVersion/auditId，pendingRebuild=true |
| POST /admin/snapshot-jobs | expectedFactVersion+key；202回jobId，GET job轮询pending/ready/failed与nextSnapshotId；显式切换后新数据才进入页面 |
| GET /admin/audit?cursor | 当前审计分页；actor/action/subject/from/to/reason/version/at，权限与保留过滤。不给未授权客户端整个事实图 |
| GET /admin/cases?status&cursor | 最小caseId/subjectId/reasonCode/status/receivedAt/version，按需读取；正文在独立受控存储 |
| PATCH /admin/cases/{id} | to/basis/expectedVersion/key，received→in_progress→resolved；回caseVersion/receiptVersion/auditId，并可靠更新用户回执 |
| GET /me/reports/{caseId} | 仅提交者读取自己的受理状态和可告知结果，不泄露内部依据或其他案 |
| 出席核实API、员工账号CRUD | 不提供；App本人/host报告服务负责出席，白名单由部署端安全配置维护 |

401会话失效回登录并清除敏感视图；403白名单/对象越权不返回数据；404未知资源不泄漏存在；409版本或幂等冲突保留输入、取当前版本显式重试；410快照/游标已过期或隐私撤销不回退替代；413导入过大；422字段/状态/时钟错误逐字段反馈；429保留意图按Retry-After重试；503保留已选snapshotId与恢复入口，不能冒称写成功。写失败不产生审计业务成功；同一可靠事务追加事实与审计。事件接收只接客户端行为，业务成功来自业务服务可靠事件。

## 7. 历史稳定、删除与数据政策（R-14/21）

常规写入永不改旧快照，定义升级新ID/版本；原CSV按相同快照与筛选可复现。权限撤销/账号删除与法定处理是显式隐私例外，不承诺旧快照永久保留。

原始行为暂定90天，业务/审计暂定12个月，最终政策另审，不宣称法律合规。删除账号后，删除/去标识任务传播到业务、事件身份映射、服务控制的历史快照、缓存、导出暂存及备份恢复流程：含身份的历史快照标记revoked不可再查/导出（410），生成去标识新版本或按政策清理；不可复用旧ID把已变化内容冒充原件。可保留不再能回链个人的聚合及必要受控审计，具体合法保留依据由责任人审定。

已由用户下载的CSV副本不受服务控制，不能承诺远程擦除；限制原始导出、最小化聚合、提供删除说明。事件consent状态由用户端SDK附带且服务端校验；撤回后停新采集、撤销当前身份关联并运行删除传播。备份恢复先重放删除/撤销清单，不能让已删标识重新出现。Demo仅演示内存快照与源校验，没有生产隐私清理作业。

## 8. 验收证据与未接入边界

`analytics.test.ts`及`r1-boundaries.test.ts`覆盖粒度/时间/身份/宽范围/自报优先/阶段；`governance.test.ts`覆盖权限、理由、版本、审计与冻结快照；`handoff.test.ts`运行**真实shared导出→parseHandoff**及字段/大小/FK/时间/窗口/私密字段拒绝。浏览器覆盖门禁、写后待重算、生成/旧快照CSV对账、409、个案回执、导入失败不污染、成功新快照、无采集源、中英和390px。

生产身份、数据采集、存储、小时作业、可靠通知、删除传播与iOS交付均未实现；它们是可拆分研发目标，不是当前原型验收通过即可宣布上线的能力。

### 申请时点与轮次补充
待审核按所选snapshot.asOf计算：已提交、尚无生效审核/退出且早于startsAt−30分钟。等于或晚于截止即过期；当前expired布尔不得泄漏到更早快照。有cancelledAt且已生效的整场取消也结束待审，无取消时刻不推断历史取消。未来decidedAt/withdrawnAt不提前改变状态。拒绝后不得对同一mealId重申；前轮必须已退出才可新申请，多轮不可重叠；每个confirmedAt时点含host的有效席位不得超过capacity。
