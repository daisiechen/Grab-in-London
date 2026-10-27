# IOS-0.1.0-dev.2 · 发起饭局完整旅程开发方案候选

PJ-IOS-DEV2独立负责本版J02。原四类反例已有独立公开原型实点回执，晚到Costs滚动遮挡R11-I2-05也经原作者修复、独立截图/live bbox与原生行为复验关闭；05没有冒称Presentation滚动已测。本候选绑定最终设计manifest和独立评审快照；工程方案已获独立RD签收为plan-approved-with-issuance-gates，非作者自签；尚未签发代码、产品QA、供应商调用或部署。原Figma、PRD及Demo未由本PJ修改。

## 用户结果与范围

Create入口保留同一创建草稿，未登录/资料不全时消费J01身份合同，完成后返回原意图。Arrange选真实可识别餐厅、时间与人数，Introduce填写介绍，Costs确认host自行外订、到店各付，Review主动核对发布。发布成功后进入Meals的Hosting父级与本场详情，查看公开申请资料、批准/拒绝、核对名额/锁定/外订声明，最后保持招募或进入取消/截止终态。群沟通、饭后记录通过J03/J04交接，不在本版再展开。

不恢复平台订位、支付/退款、商家库存、自动审批、自动发布、分享邀请、移动Web或群push。视觉沿原MVP v13；必要确认、错误与长内容复用既有控件，不由开发重新设计。

## 真实源与接口边界

[工作包及29个既有operation清单](work-packages.json)固定真实registry来源、method、`/v1`路径、写协议与If-Match。API统一由`apps/api/src/http/routes.ts`加`/v1`并执行`defineWrite`，不是另造一套API。类型/SDK生成只由RD-CONTRACTS独立writer维护，当前本版未提出新服务端端点；需要改变schema时先写契约差异，再原子生成兼容客户端。

现有可复用方向：Expo/React Native iOS，模块化Fastify API，PostgreSQL/Drizzle，持久jobs/outbox和已有Auth0/Places/DeepSeek/邮件适配。版本声明不是兼容构建证据；不重新安装整套平台，不合并旧P1.1整枝，不借本版更换供应商。Hosting父级需核MyMealsScreen当前默认UPCOMING，不能只传未消费的section参数就声称进入Hosting。P02的API、Create编辑、Meals父级与route注册分四个具体提交组，各最多3个候选生产/测试文件；逐文件writer优先于包牵头角色。

原r10全套等待门槛已由[r11工作流](../../../delivery/parallel-version-workflow-r11.zh-CN.md)替代。

已读源码明确三处局部实施差异，均落入对应小包，不是等待其他版本的总阻塞：

| 差异 | 已有代码事实 | 本版落点 |
| --- | --- | --- |
| I2-C01 | `create/model.ts`默认minimum=2，PRD默认3；换店只失效声明但未清日期时间 | P01改为3/4，换店清时间/offset/声明/Review，保其余稿并补反例 |
| I2-C02 | 发布仅replace详情，未形成Hosting父级；现有EDIT合同缺专门编辑界面 | P02用既有editMeal与最小新增EditMealScreen/route，文件明确not-created；获准后不显示可编辑假入口 |
| I2-C03 | HostScreen后续声明提交capacity；declareBooking锁版本但未保证人数是最新已确认party | P04补当前确认人数与seat watermark下锁重验，避免人数往返后旧声明复活 |

初次发布的声明是host对**计划容量**的外订自报，当前已确认人数此时仅host一人；两者不得混为一项。后续人数变化，旧声明显示Needs update，host联系餐厅后主动按**当前已确认party含host**重新声明；UI不能照搬capacity，API也不信客户端旧人数。失败或取消外订不自动取消饭局。保留`arrangementHash`的seat事件水位，不能只比人数相等恢复旧声明。

## 独立小包与并行

| 包 | 可交结果 | 协作与收口 |
| --- | --- | --- |
| P01 | 四步草稿、选店、伦敦时间/DST、人数预算、显式声明/核对 | 可在固定身份/Places合同下先做纯规则与原生组件，provider真实验收另记 |
| P02 | 一次发布一场及host席位、Hosting返回、获准前编辑 | API与P01组件在不交文件时并行；CreateStepScreen集成归同writer |
| P03 | host本场申请列表/资料/原子批准拒绝 | 使用明确合成申请前置完成局部验证；真实I1→I2联调另闭环 |
| P04 | 当前party外订声明、取消/Keep/终态 | HostScreen与P03同writer串行文件租约；独立规则/夹具可先准备 |
| P05 | 截止/开始/结束、人数历史、关键站内/邮件 | 复用生命周期/持久outbox，不把迟到执行时刻当历史资格 |
| P06 | AI创建草稿、Keep/Replace、再次人工Review/Publish | 固定CREATE editor合同，既有assistant唯一writer，手动路径不被provider门槛阻断 |
| P07 | 同版端到端及跨版真实交接候选 | 仅最终集成依赖P01—P06；不是前六包彼此等全版完成 |

每包角色是负责人槽位，**不是写入许可**。实际人选、精确文件租约、父SHA、接口/迁移、配置与数据尚未签发。工作包给既有候选与明确not-created文件，签发时每次最多5个生产/配套测试精确文件，含验收与回退。跨包的commands/routes、HostScreen、CreateStepScreen各由唯一writer串行提交；ownerRole是包牵头角色，不能覆盖这些逐文件租约。contracts、迁移、生成SDK、根导航/配置分别由全局对应writer持有，其他人提交差异请求。

## 数据、未知结果与回退

服务端会话/资料、权限、DB锁内时钟、资源版本、席位事件是权威；`allowedActions`只是提示。批准锁内重新验证host、Pending、Open、now<close及容量，末位不能超售；首guest批准永久锁定关键安排。`decideApplication`的If-Match来自**申请版本**，edit/declare/cancel来自**meal版本**。获准前编辑撞上另一端批准，409加载权威锁态并保稿，不能把草稿偷写回去。

普通写包括confirmVenue/createMeal/editMeal/decideApplication/declareBooking/cancelMeal：响应未知固定actor、operation、method、path、body、原key及原If-Match（无则null），显式重放同一原操作；服务端仍重新鉴权后回放已封存结果。不能用getMeal/myMeals的当前相同事实证明旧意图，不存在新的`GET /commands`。不因refresh读到新版本就把原If-Match7改成8。确定409后本人核对才形成新意图。create的attemptId与同一未知发布意图保留，失败保稿；成功才清稿，不能另造第二场。

身份凭据协议沿I1：OTP start的clientRequestId、一次性verify/OAuth callback/handoff与轮换refresh各用现有恢复，不套普通写盲重放；退出/换账号清私密草稿和迟到结果。AI沿requestId/session generation及pollAI，转入按editorVersion/CAS校验，既不保存业务也不自动勾选确认。人民币50/月硬闸、最小数据与30分钟TTL仍保留真实验收。

代码回退与业务事实分开：可回退兼容客户端/服务端候选，不删除已发布meal、席位事件、已封存意图、通知、锁定或群历史。取消不重开、不搬成员到新场；新场须重新申请。发生共享契约/迁移冲突停止该集成点，不重置数据库绕过。

## 版本测试、环境和发布

[测试矩阵](test-matrix.json)逐条覆盖10个J02-AC及边界，每项明确层级/预期，产品执行均NOT_RUN；本轮测试只验证方案/证据一致性，不宣称真实发布或iOS验收。后续先纯规则/契约、API事务与原生组件，再本版完整路径，最后真实I1发布→申请→审批→I3群交接与后台允许事件。夹具能证明本端合同，不能替代真实跨版联调。

复用现有Node/锁文件、隔离数据库与唯一端口/PID/CWD；最小预检API schema、DB版本/owner marker、iOS工具链/签名、fixture时钟。环境owner最多15分钟或3次同类失败即给精确命令、错误与下一步，其他纯规则/合同工作继续，不让QA临场搭环境。真实Places照片/署名、OAuth、AI预算与邮件收件箱各留真实证据门槛，不要求重建已存在账户或在文档存凭据。

每包从核定main开`codex/ios-0.1.0-dev2-<package>`短分支/worktree；适用单版检查、受影响回归、独立代码评审和必需CI通过后PR合main，再以精确merged SHA、迁移、接口与已测build部署。文档合并不部署业务。内部dev.2 build记入合并首发0.1.0；不代表本包单独可上架。后续每次iOS迭代都登记build及目标商店版本，可合并发布而不能漏账。

## 独立工程签收与实施前置

独立[工程评审](../../../reviews/r11/ios2-engineering-review.md)及[签署记录](../../../reviews/r11/ios2-engineering-review.json)已通过，未要求修改业务范围。其原送审SHA保留在manifest与版本台账；work-packages.json仍保留原送审候选快照，实时方案状态以版本status及独立评审为准，不据旧snapshot状态再等待一次评审。实际RD人选、逐文件≤5租约、共享commands/routes/assistant writer、PLATFORM路由注册、C01/C03定向实现、环境与真实联调/CI仍须分别签发；所有29项产品场景保持NOT_RUN，文档签收不启动业务部署。
