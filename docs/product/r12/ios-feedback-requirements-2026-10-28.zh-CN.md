# r12 iOS截图反馈需求增量：拒绝说明与既有边界

版本：PM-DELTA-r01｜基线：main `ecfb54e`｜状态：根PJ已授权产品/原型增量，服务实现未授权、未实现。唯一需求作者：原J02 PM（PM-2）。本文件与[结构化增量](ios-feedback-requirements-2026-10-28.json)成对交付；UX原作者据此制作本轮可点击候选，不重写冻结J02/J01 PRD、Demo或manifest。

## 1. 效力、来源与本轮边界

原[主PRD](../PRD.zh-CN.md)§0.3/FR-04、[J02](../journeys/j02/requirements.zh-CN.md)§6/7、[J01](../journeys/j01/requirements.zh-CN.md)§6及[通知合同](../../engineering/api-and-client-contract.zh-CN.md)继续有效。本增量只覆盖与C20新增“可选拒绝说明”直接冲突的呈现/数据需求；未冲突规则不变。根PJ范围决定见[21条反馈产品核对](../../reviews/r12/feedback-21-product-review-2026-10-28.md)。这不是拒绝原因已经通过API/数据库/真实通知验收的证明。

C20所属用户目标仍是J02“处理本场申请”，申请人在J01/J03查看本人的处理结果；不新增独立业务模块。用户批注问“拒绝是否该说明原因”，根PJ采用最小决定：原因可选、预设且可不说明；不强制自由文本，不默认替host挑原因，不扩群聊/隐私或反复申诉流程。本轮不启动RD或QA。

C12保留首发App English-only：App language行点按后给出可关闭说明“Fancy’s app interface is currently available in English.”，并给实际可达的“Edit conversation languages”入口进入原Edit profile；关闭回Settings，保留原草稿。修改交流语言不是修改全站界面语言，不造locale切换或假保存。

C15只合并人数范围的呈现/操作：2≤minimum≤capacity≤6，均含host，默认3–4；第一位guest批准后原关键安排锁不变。单个范围UI不能丢掉minimum或把capacity当剩余名额，也不改变招募截止、成团或取消规则。C12/C15不等待C20，也不借本轮扩大语言或人数范围。

## 2. C20字典与未选择语义

字段候选名为`declineReasonCode`，与整场取消reason、举报reason均不同，不复用其他对象的字段或枚举。

| code | English显示文案 | 含义 |
| --- | --- | --- |
| `PLANS_NOT_ALIGNED` | The plans aren’t quite a fit. | host对本次安排的主观说明，不是系统判断申请人不合格 |
| `KEEPING_GROUP_SMALL` | I’m keeping this group small. | host表达本次组织选择，不声称系统已满员 |
| `null` | No reason | 不说明；不是“其他”自由文本入口 |

首次打开拒绝确认：三个原因项均不预选，UI态`reasonTouched=false, value=null`；不选择也能确认拒绝。主动点No reason后`reasonTouched=true, value=null`；二者提交语义相同，不把reasonTouched发送为业务字段、行为画像或“拒绝了说明”的统计。无默认选中的安全preset，不因第三项存在就强行预选No reason。

只选一个preset，可在确认前改选或清回null，不提供自由文本、其他成员姓名/资料、聊天引用或自动AI生成原因。两条文案不能用于掩盖MEAL_FULL、DEADLINE_PASSED、MEAL_CANCELLED等权威失败；这些仍是原业务错误而非“拒绝理由”。

## 3. Host选择、取消、确认与结果未知

1. 本场host在本轮PENDING申请点Decline，进入“Decline this application?”确认；显示可选原因和“Cancel / Decline application”。原申请、席位、名单、群均未改变。
2. 改选只改本申请的局部原因草稿。Cancel/返回在提交前关闭确认，丢弃本次未提交原因草稿，原申请仍PENDING；再次打开不预选，不携带上个申请/账号的原因。
3. 点击Decline application才创建一个拒绝意图，绑定账号、mealId、applicationId、expectedVersion、decision=DECLINE及该刻原因code/null；保存中防重复，不能边发送边改原因。服务端将来仍须核验host、原申请PENDING、时间和meal状态。
4. 明确成功后，本轮成为DECLINED，host卡片显示“Declined”及本条原因或“No reason provided.”；申请人对应本轮页显示“Application declined.”，有preset时加“Host’s reason: {exact preset label}”，null或旧记录无reason时加“No reason provided.”。不推断旧拒绝曾选过某原因，不自动补造。
5. 结果UNKNOWN：显示“Decision status unknown. Check this application before trying again.”，原拒绝意图及原因/version完整保留；先查原意图/资源的权威结果，必要重试沿同key、同规范payload。确认未知期间不允许改原因另造第二个拒绝。关闭等待只离开可见等待，不代表撤回已提交请求；返回同申请先核对原结果，不显示“已取消拒绝”或“拒绝已完成”。
6. 明确失败保留合适原因草稿并说明真实失败，允许返回或本人重试；409加载最新申请/版本供核对，不能用过期原因请求覆盖已批准/已终结状态。只有核清原意图确定未执行且最新状态仍允许，才可经本人改选产生新的意图。换申请/换账号丢弃旧可见草稿，迟到结果不填新对象；原未决记录仍按原对象查证。

拒绝终态不可通过此增量修改理由、重新审核或重新申请。本场DECLINED不可重申；Pending不占位，拒绝不加席位、不建名单、不授群权限，也不触发首次“批准”锁。确认/取消原因不改2≤minimum≤capacity≤6及原生命周期。

## 4. 可见性与通知矩阵

原因只对本场host及该申请人的授权投影可见。不能出现在公开Meal/主页、群消息、当前成员页、其他申请人的卡片、普通分析看板、公开日志或外部分享。仅由本场host看到其他人的申请卡不代表申请人能读彼此理由；其他host也无权读取。

保留P-02原渠道：拒绝只通知该申请人站内+其原合法邮件渠道；host通过本次操作回执及本申请卡查看，不新增群/其他申请人通知，也不增加一条host邮件。通知只可使用固定`application_declined`结果、原mealId/applicationId refs及本次选中的安全preset；不带申请留言、自由私文、其他成员或聊天资料。安全preset需来自服务器已接受的本次拒绝结果，而非客户端临时草稿。

本轮产品允许通知正文携带选中的preset英文文案；null/旧reason缺失时省略原因句，不擅自补一个preset。站内/邮件不得以“还有名额/已经满员”代替正式选项或最新权威事实；正文为“Application declined.”及可选“Host’s reason: …”，原meal/application入口仍需本人授权。无新增push/短信/营销或拒绝原因分析维度。

原未知邮件结果、稳定事件+收件人+渠道去重、渠道失败不回滚业务及有限重试仍保留。入队/provider接受不等于实际送达，更不等于申请人已读。原型仅本地合成展示，不发送真实通知。

## 5. proposed-not-implemented合同增量

核对现状：`decideApplication`正文只有`decision`，Application DTO无reason，API当前拒绝写入只有状态/版本/时间；现站内refs为mealId、邮件payload为mealId/applicationId。以下均为后续独立签发RD后才可建设的增量，当前合同/代码没有修改。

| 层 | 待建设内容 | 当前状态 |
| --- | --- | --- |
| Request DTO/API | DECLINE可选`declineReasonCode`为两枚举/null，省略规范化为null；APPROVE不允许非null原因，未知code/自由文本拒绝；身份、If-Match及幂等hash含原因 | proposed-not-implemented |
| Store/迁移 | 原申请轮次/决定记录持久原因nullable及原因字典版本；历史缺失保null，不补造；与DECLINED状态/版本/时间原子一致 | proposed-not-implemented |
| Read DTO/serializer | 仅本场host/申请人可读；非拒绝结果不附非null理由；脱敏公开投影不含；查UNKNOWN能核对同次原因结果 | proposed-not-implemented |
| Notifications/outbox/adapter | 固定安全preset和原meal/application refs的白名单投影、模板省略null；原稳定事件/收件人/渠道去重与未知回执恢复 | proposed-not-implemented |
| 客户端接线/契约兼容 | 在真实reason-capable服务、版本化SDK/迁移及模板可用后才启用真实原因提交，旧接口不消费该新字段 | proposed-not-implemented |

本轮UX可在隔离候选内用合成内存状态表达上述正常/失败/未知分支，必须在交付说明与评审渠道标为模拟。不得把reason传给当前只接受decision的API，不得静默丢reason只提交DECLINE后显示“原因已保存”，也不得在provider/数据库没有新字段时显示真实持久化或真实通知成功。实现契约版本/迁移/adapter由未来唯一writer另签，不把本产品JSON当生成schema或线上兼容承诺。

## 6. 精简验收及UX可点样例

| ID | 观察标准 |
| --- | --- |
| C20-AC01 | 从PENDING打开确认，两个preset及No reason均未预选；不说明也可确认，无自由文本强制输入。选A→改B→取消，原申请仍PENDING；重开未预选。 |
| C20-AC02 | 各自用A、B、未选择/null确认：只本轮DECLINED，host/本人申请人显示对应文案；另一个申请/群/第三账号不见原因。历史无reason明确无说明，不补造。 |
| C20-AC03 | 确认前取消不改状态；确认后重复操作同意图只一次结果。UNKNOWN保原reason/version/intent，先查询或同key同payload，不可改原因重造拒绝；409/截止/取消分别反馈。 |
| C20-AC04 | 原不可重申、容量/名单/群及首次批准锁均不变；“保持小组”不伪装MEAL_FULL，“安排不合适”不伪装系统资格判断。 |
| C20-AC05 | 仅该申请人站内/原邮件渠道，preset正文只来自已接受结果且null省略；无自由私文/其他成员、群或新增渠道。合成通知不冒称真实送达。 |
| C20-AC06 | 当前严格API/DTO/store未实现reason，原型与真实服务边界明确；没有旧接口静默丢reason的假成功。未来合同writer需完成DTO/迁移/投影/adapter再启用。 |
| C12-AC01 | 点击App language实际出现English-only说明，可关闭回Settings；交流语言入口到原Edit profile，保存/取消沿原语义，不伪造locale切换。 |
| C15-AC01 | 单一人数范围UI仍表达独立minimum/capacity，满足2≤min≤cap≤6且含host；首次批准后锁定和原成团/截止不变。 |

可点样例：Mia的PENDING申请→Decline→全部原因未选→选PLANS_NOT_ALIGNED→改KEEPING_GROUP_SMALL→Cancel，仍Pending；重开无预选→保持未选→Decline application，Mia本人看到No reason provided。另一PENDING申请用第一个preset确认，只有该申请人看到原样原因。对第三个申请用第二preset确认但模拟丢响应，仍保同intent/原因→Check application status→读到同一Declined结果，不重复写或改原因。原UX独立呈现本轮候选并记录实际点击证据；本文件结构检查不是点击或业务实现验收。

## 7. 交付与后续输入

本轮只新增本MD、成对JSON及结构边界测试。原主PRD、J02/J01 PRD与Demo、既有manifest、API/DTO/DB/通知实现均保持原版。root维护文档索引及现行版本指针，将本增量与原规则一起交给后续worker；若未来改变字典、可见性、渠道或状态，应由本需求作者先更新增量，不由UX或RD静默发明。真实模型/身份/邮件/政策、UX其他21项及旧QA门槛均不被本增量关闭。
