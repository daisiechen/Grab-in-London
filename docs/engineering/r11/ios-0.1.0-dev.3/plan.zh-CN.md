# IOS-0.1.0-dev.3 开发方案候选

本版仅J03赴约沟通、J04饭后体验/联系、J06独立产品问卷，旅程独立页面/目录但形成一个内部迭代。PJ-IOS1独立关闭本版7项设计反例后，本版立即做方案，不等其他版全部Ready。范围不包含移动Web、平台支付/订位、分享/邀请、群提及/系统push、AI私聊代发或J12分析页面。

沿r10实际盘点的原栈和模块化单体/API→DB权威，不重建整项目/认证层，不先做全系统DB再UI。7个小工作包、候选路径、角色和真实registered operationId见work-packages.json；每包签发≤5个精确生产/配套测试文件，assignedPerson/lease未填不可开工。UI/路由同文件交集串行交唯一writer，J06与消息/饭后无干扰部分可并行。现在仅授权方案，implementationAuthorized=false，未写业务代码或跑产品QA。

接口按现有social.ts/meals.ts/assistant.ts与生成客户端；不凭Figma标题另造HTTP。J03当前成员名单需要真实group membership投影：Conversation DTO只有canSend/dissolved/head，没有成员；不能用Meal confirmed名单顶替。I3-C01明确共享RD-CONTRACTS增量提案/隐私/精确签发，只阻断设置名单真实接入，不阻断已有read/send、独立J04/J06。leaveMeal实际在meals/routes.ts，不创建不存在的participation目录；I2 Hosting/Participation writer统一租约。

成员区间与消息seq/读位由API/DB拥有；退席、退群、解散不同。取消/结束不关仍获授权群。重试同clientMessageId；失权/切账号/epoch旧响应不得写入新会话。原生已读仅实际渲染可见序列；通知markRead独立。原型Boolean/STRING只为可审流程守卫，不作为生产鉴权。

J04评分、公评、私密再约分别按原独立operation/版本/幂等写，组合Save是客户端编排/逐项回执，不新建伪原子批量接口；只重试失败对象。OPEN撤回先确认、Keep零写入，窗口外独立撤回仍可用。已存公评不能空白覆盖或静默删除，本版不增用户删除公评API。支持资格修订/账号删除引发撤展沿既有职责/epoch；解除拉黑不复活同意。

J06复用getSurvey/putSurvey与批准七原因字典，nullable again及at-least-one已有schema；Settings本人的最新版本，不挂mealId/出席/7天或评分，不从Profile/聊天推断答案。多选/清除/取消/保存失败和未知结果按测试矩阵闭环。

环境先复用Node/pnpm/lock与隔离Postgres测试fixture、现有iOS构建及生成契约；15分钟或同失败3次交环境owner，不让QA临场安装/漂移。20个独立行为场景均NOT_RUN，分原型/fixture/真实API+DB/真机/跨版/发布证据。真实发布申请批准、支持纠错、删除和分析消费仅阻断对应联调点，其余本包合同/实现准备可继续。

按r11从已核对main开codex/ios-0.1.0-dev3-小包分支或隔离worktree→适用单版/影响回归/独立代码审查/必需CI→PR合main；精确merged SHA、build、接口/迁移、fixture/环境绑定后才部署。回退兼容候选不重新开放已撤写区间或复活已撤回同意，数据库修订保留历史；出错停止外发/新写，按持久记录重放，而不是恢复旧UI权限。根唯一Git索引/推送，本包未操作。

产品仍首发0.1.0，dev.3独立登记build（当前null），首发与其他iOS迭代及最小支持合并不等于准备互等。商店/发布批准未签，不用方案文档合并当已部署/已提审。

## 独立工程复核定向修订

EI3-01：P00只核既有operation/schema/client快照，可独立完成；C01新名单契约明确不属于P00完成条件。其余包不等整个P00，每包只核自己消费的固定合同；C01 open仅卡P02真实成员名单接入，leaveMeal/leaveGroup/dissolveGroup与消息/J04/J06等既有接口及夹具继续。T21做依赖传播反例，不以whole-version阻断代替单点契约门槛。

EI3-02：普通写Unknown保原actor/operation/method/path/body/key/原IfMatch，defineWrite幂等重放；current GET不能证明旧意图是否接受，更不能猜新key。消息以同conversation/clientMessageId与原body资源去重，失权即停止重发；AI用exact requestId/pollAI专用恢复并保费用责任。评分、公评、选择、问卷各对象版本含无记录0来自experience/reviews/connections service/surveys权威，不拿meal或同一Save版本代用。混合成功/未知/409按逐项回执重试原未知对象，冲突需本人复核当前权威，成功项不重写。T22覆盖此反例。

## 独立方案签署记录

独立RD在 `docs/reviews/r11/ios3-engineering-review.json` 将 EI3-01/02 复验关闭，结论为 `plan-approved-with-issuance-gates`。原审精确输入hash保留在该报告 `inputSHA256`；本节仅追加签署元数据，不改变上述方案语义。追加后候选hash登记于本版status。真实owner/精确文件租约、C01对应接入与环境、独立代码审查/CI/build仍按原门槛；本记录不签业务代码、产品QA或发布。
