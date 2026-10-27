# IOS-0.1.0-dev.1 开发方案（独立评审通过，待实施签发）

PJ-IOS1独立负责J01/J05完整用户结果；范围仍IOS-0.1.0首发的内部dev.1。当前是方案准备，设计修复独立复验见[版本状态](../../../delivery/versions/ios-0.1.0-dev.1/status.json)，不启动业务代码或产品QA。r10“7份全部Ready”旧门槛已由[r11流程](../../../delivery/parallel-version-workflow-r11.zh-CN.md)替代，不能据旧架构文字阻断本版准备。

## 1. 版本边界与固定输入

用户能先浏览地图/列表、应用/取消筛选、看公开饭局/host，再从同一Apply意图完成注册或登录、必要公开资料与主动18+/社区确认，回原饭局填写介绍/明确安排后主动申请，看到唯一Pending，撤回/重申可恢复。本人还能独立编辑资料/统计选择、明确确认六偏好、处理版本冲突/删除偏好和退出；可选AI按本人许可/Send→查找解释/草稿→Keep/Replace→原编辑器→主动提交。

不做J02发布审批、J03聊天/退席、J04饭后/再约、J06产品问卷、J07举报或J08账号删除的业务实现，只消费准确授权/导航接口；不做管理后台、移动Web、平台订位/支付/订金/退款或新AI场景。host外订/到店各付保持。首发还需其他iOS迭代与支持能力，dev.1不能单独称商店最小首发。

业务输入固定14db532的J01/J05 PRD及其coverage/Demo；视觉固定MVP v13/app361ab04；设计用I1 UX-r03、DS-0.1.0和独立复验，Logo仍独立候选不自动替换。精确来源hash见input-manifest；可变进度JSON不用作永久输入hash。

## 2. 复用现有架构，按小包交用户结果

保留原生React Native/Expo客户端、Fastify模块化单体、Postgres17事务权威、TypeBox operation registry及生成客户端，沿[既有架构](../../r10/architecture.zh-CN.md)复用，不重搭P1.1整套工程。仓库声明的SDK/RN版本只是输入，不是已测兼容性。iOS不照搬网页DOM/模拟键盘；地图与照片必须用对应原生适配与许可。

[工作包](work-packages.json)列P00—P06。P00仅本版最低契约/环境接缝，不横向重建全部表/API。P01浏览与P03本人设置在契约固定且文件不交叉时可并行；P02身份/资料/申请与P03共享profile时串行写；P04/P05的assistant共享writer串行。P04只依赖P00核定的现有身份本人/资料投影/偏好合同，可用明确已认证fixture推进；不依赖整个P03，P05亦不再经P04传递等待统计缺口。P06完整版本集成仍等待P03自身完成，这是完整性验收，不是偏好或AI开工门槛。每个实际签发组≤4生产文件+对应测试；大包只是完整用户结果的验收集合，不是一条让worker自由展开的大任务。每组有唯一owner/分支/精确白名单/结束条件，当前代码租约均未签发。

PM输入已冻结；UX-r03修复只恢复本人动作与原视觉。不重跑整模块PM/UX，不让RD临时发明需求。发现实质规则差异交原PM，视觉细节回原UX。本版修复作者不能给自己签独立设计通过，方案/代码也保留独立评审。

## 3. 接口、权威与真实差异

[接口清单](interfaces.json)从当前operation registry逐项提取准确method/path与source hash，不按页面另造SDK。身份由服务端session确定；profile、application、AI preference各自版本；普通idempotencyKey写在发出前固定actor/operation/method/path/body/key及原If-Match（没有则保持null）；UNKNOWN保留原意图，明确重试按原封包重放，由服务端幂等记录确认原次结果并重验可见性。当前资源GET只说明当前状态，不能证明原意图成功；不能把新版本If-Match塞回原key，不能为清UNKNOWN生成新key。原次确定409后才读权威新版本，经本人复核建立新的明确意图。公开DTO不含私密资料，服务端锁内DB时钟判断资格/名额。

明确缺口I1-C01：现有MePatch没有可选统计读写，SettingsScreen也没有持久保存；已有analytics_consents表和ingestEvents的consent输入不等于J05独立保存。方案拟议独立本人read/replace choice与version/confirmedAt，需RD-CONTRACTS/DATA唯一writer定型；未把拟议operation冒称已注册。该缺口只影响P03统计真实接入，不使P01/P02/偏好等准备停工。其余沿现有操作，不扩大身份链接/数据平台范围。

AI是只读候选生成器，许可+用户Send方可调用，六偏好只明示确认保存；soft/hard/CLEAR与CNY50预算依现行合同。原AI方案遗留OpenAI/microUSD描述由批准DeepSeek/microCNY决定覆盖，价格/地域/留存/训练及计费事实未批准就关闭真实调用，普通查找/申请与偏好读删不受阻。不能拿模拟草稿清掉真实60样本/四项零容忍/质量延迟/usage门槛。

## 4. 最小环境和证据分层

准备阶段只读检查文件/工具，不启动旧MVP/补丁服务、不安装依赖或连接业务库。实施前环境owner给出candidate SHA、contract hash、migration head、config schema及非敏感hash、fixture ID、实际DB名/端口/PID/CWD/owner marker；每份报告绑定同一候选。密钥不进仓库或聊天。

第一层用现有unit/组件测试，第二层用现有Postgres17 testkit：FANCY_PG_BIN可开本次临时集群；已有FANCY_TEST_DATABASE_URL仅接受已核对隔离本地测试server，每test文件独立fancy_test_库。不能连接旧共享数据库，不能把关闭fsync的本地compose部署生产。API/原生联调沿同一兼容组合一个标准集成环境，不每小包复制整个平台。

环境预检先核Node24/pnpm锁、SDK原生兼容、PG17及锁文件与配置，失败最多15分钟或3次同类重试即转环境owner诊断，不让测试worker现场安装/升框架/清库。当前shell仅发现node、未发现pnpm/Xcode命令：这是该环境预检的局部待办，不阻断文档/契约/fixture准备；iOS签名与设备需指定macOS/Xcode环境，不能拿Linux组件绿代替安装。

Mock、确定性fixture、真实API/数据库、真实提供方、真机分别记证据。I1可用明确合成host未来饭局验证本端；I2未就绪只挂真实发布→审批联调，不要求等I2才实现自己的查找/身份/申请。其他真实配置只阻断对应提供方/设备点，不关掉整个版本推进。

## 5. 测试、回归与恢复

[测试矩阵](test-matrix.json)给12条AC对应28个独立场景，含主体、失败/UNKNOWN/409、同意反例、伦敦时间/日期、跨账号/epoch、软硬/CLEAR、逐字转入、取消与返回。所有未来执行状态NOT_RUN，当前设计证据测试10通过不冒充产品QA。先小包公开接口/组件与DB/API，再本版真实原生完整路径，最后所需跨版接缝；只回归受影响合同消费者，不无理由全量盲跑。

每次合并前适用单版测试+直接回归+独立代码评审+CI；PR绑定base/candidate/test/build/contract/migration/fixture/config。失败修本包，不将无关研究/旧QA带入。兼容扩展先上、客户端切换后再考虑独立收缩；代码回退以已测SHA，迁移回退需独立方案，不能删库或重置历史。旧API/新客户端混合时做明确兼容测试，不能拼两次不同候选的证据。

## 6. 分支、发布与商店归属

实施授权后从核对main开codex/ios-0.1.0-dev1-<package>短分支/独立worktree；contracts/generated、迁移、根配置/导航/SDK各由root登记唯一writer。当前共享工作区Git索引归总PJ，本版本只交白名单；不直接在main开发、不force push、不整枝合入旧P1.1。

单包PR可独立合并main，保留精确候选和测试结果；部署只来自精确合并SHA的已测构建，不因文档提交自动部署。iOS build单独递增登记，目标产品版本仍0.1.0。本dev独立开发测试、真实相关联调后并入明确首发集合；不声称dev.1单独可上架，不重新添加全套设计开工门槛。发布/商店最终批准及真实供应方/隐私/安全/UGC/删除门槛由组合发布负责，不能被本版局部通过清掉。

## 独立RD首评定向修复

R11-EI1-01：删除P04→整个P03依赖，P04复用P00已核定的getSession/getMe/六偏好接口，P05因此不再被I1-C01传递阻塞。C01仅阻P03统计及最终P06的完整性集合，其他小包继续。工作包保留真实文件共享租约，不能把依赖移除误作并发写同一文件授权。

R11-EI1-02：interfaces.unknownRecovery区分普通写、身份凭据和AI resourceKey。普通写UNKNOWN显式重放原method/path/body/key/If-Match；例如原If-Match7成功到8但响应丢失，重放仍是7，当前GET到8或值相同不证明该意图完成。OTP start仅沿现有clientRequestId元数据去重；verifyEmail、OAuth callback、handoff、refresh的单次消费/轮换不得套用普通持久响应重放。丢失凭据响应按现有STATE_CONFLICT/到期/会话协议重新登录或请求新码，保允许的业务意图，不存token响应；退出仍清本机并如实区分远端未知。AI偏好CAS/请求requestId查询保持原专用合同，不造通用幂等结果表。

独立RD已复验关闭R11-EI1-01/02，工程方案状态为 `plan-approved-with-issuance-gates`，依据[独立JSON评审](../../../reviews/r11/ios1-engineering-review.json)及[评审说明](../../../reviews/r11/ios1-engineering-review.md)，签署方不是本方案作者。评审中的inputSHA256保留原送审快照；本次仅追加签收元数据，不改变接口、依赖、测试范围或设计。当前文件及评审证据hash由本版status记录，避免把原送审hash冒称当前稿hash。

实际RD owner与精确共享文件租约尚未签发，环境未预检，I1-C01合同仍拟议未注册（仅阻P03及最终P06完整性），产品QA未启动。独立评审通过只允许后续按小包签发；真实实现、适用单测/原生及提供方联调、独立代码评审、CI/PR合main与部署仍各守原门槛。本作者不自签，不因I4计划PR已合main而宣称本版已实现或部署。
