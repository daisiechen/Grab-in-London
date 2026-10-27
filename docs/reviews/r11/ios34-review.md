# r11 · I3/I4 独立设计评审

结论：需要原UX-2定向修正。基线6675dc5，业务14db532，视觉旧MVP v13。只读核对五份PRD/coverage、实际五页Figma文字与连线、关键截图；未把节点存在当作流程已真实点击完成。

[I3 Figma](https://www.figma.com/design/mKXV0NvBavRb6fnmQ2g2xV?node-id=13-14) · [I4 Figma](https://www.figma.com/design/TxashjRfQDvnc4jQieeaWu?node-id=2-4) · [结构化记录](ios34-review.json)

视觉对照保留了原聊天气泡/头像/表单/sheet及独立问卷结构，设备外壳、时钟、指针与emoji豁免。以下是设计/代表原型缺陷，不是未开发服务的产品QA缺陷。Presentation已实际打开：群退群取消/确认/授权历史、饭后出席/评分/回执、互选私聊/撤回和问卷Company保存/返回重开。群顶部Back实际重开旧确认；问卷Yes/No实际点击未注册。未点私聊Send，未宣称任意输入或服务验证。

## R11-I34-01 · P1 · 群聊终态文档把饭局取消/结束误作群撤写

需求：J03 §3/4/7; AC04/AC06。节点：6:562。

复现：对照J03 PRD §3/4和I3 state-contracts只读/失败行 → 再读I3 coverage.stateContracts.J03[1]及画布合同6:562

实际：仓库两处均称“离群/饭局终态不发新消息、不展示实时名册”；画布却正确写cancellation/end does not close the group。

影响：RD可能依交接错误地在取消或结束后关闭仍获授权群，与原需求直接冲突。

原作者修正：统一文档、coverage和画布：只退群/解散/撤权关闭写区间；取消/结束不自动关群。

复验：检查取消和结束两种仍在群成员；仍可发送/查看当前授权名单；离群和解散仍只读。

## R11-I34-02 · P1 · 举报填稿后Cancel没有原型动作

需求：J07 正常与取消路径2/3; J07-S02。节点：4:78, 4:151（初记4:152错误，复验已按实际实例更正）。

复现：成员2:4→举报4:2 → 选择Reason进入已填稿4:78 → 点击可见Cancel

实际：4:78截图清晰显示Cancel；该帧仅Send4:150有reaction，Cancel没有reaction。初始4:2的Cancel4:76反而有BACK。

影响：必需取消路径在填稿后断开，无法核对保稿回原对象且零提交。

原作者修正：给已填稿Cancel显式回原对象并保适用草稿；不以提交完成替代取消。

复验：从初始和填稿两状态分别Cancel；回Maya，报告数不变，重入仍有适用草稿。

## R11-I34-03 · P1 · 删除支持返回把已知NEEDS_SUPPORT倒退为PENDING

需求：J08 最小回执/公开支持出口与返回; S04/S06。节点：5:275, 5:304, 5:307, 5:343, 5:345, 5:182。

复现：以外部worker前置打开NEEDS_SUPPORT5:275 → Contact support5:304→未登录支持5:307 → 选择Back to deletion status5:345，或Retry saved receipt5:343

实际：两操作均固定NAVIGATE到PENDING5:182，不保持原NEEDS_SUPPORT。支持页为所有来源共用，没有来源状态条件。

影响：进入/退出支持改变了已知业务状态；掩盖仍需支持的结果，违背只查原receipt、不改变worker事实。

原作者修正：保存来源状态/查询状态，Back回原NEEDS_SUPPORT，Retry反映权威状态而非无条件Pending；COMPLETED来源同理。

复验：从PENDING/NEEDS_SUPPORT/COMPLETED各自进入并返回，状态不倒退；仅外部worker前置才能改变进度。

## R11-I34-04 · P1 · 离群/撤联系终态的通用BACK可回到旧写态

需求：J03 §4/7; J04 §5/7; AC04/AC07。节点：6:252, 6:264, 6:174, 6:248, 6:129, 7:907, 7:919, 7:850, 7:903, 7:766。

复现：正常进入群设置→确认离群→Left group6:252 → 顶部Back6:264使用BACK，回离群确认6:174；再Keep6:248用BACK可回旧当前群设置6:129 → J04互选私聊→Withdraw→只读7:907；Back7:919回旧确认，Keep7:903可回旧OPEN私聊

实际：终态所有返回为无条件BACK，旧页面仍具有正常名册/发送原型动作；未发现membership/connection状态条件防止历史栈恢复写态。

影响：代表原型把后退做成恢复已撤权限，不能作为只读终态/撤销交互的可审证据。此结论仅指设计原型，不断言未开发服务越权。

原作者修正：终态Back显式去终态所属入口或用状态guard；历史返回始终只读。取消只适用于尚未确认的操作。

复验：真正点击确认后连续Back/Keep/设置，不可重新出现活跃发送/名册；J04不能靠Back恢复OPEN。

## R11-I34-05 · P1 · 填写公评同时隐式选择再约

需求：J04 §3/4; AC02/AC03/AC06。节点：7:228, 7:304, 7:310, 7:311, 7:334, 7:417, 7:418, 7:425, 7:440。

复现：已保存私评分7:228，reconnect checkbox7:311为白底未选 → 只点公评字段7:304→公评draft7:334 → 检查再约checkbox7:418及其reaction，再Save feedback

实际：公评字段跳转后checkbox由白底变forest选中；原checkbox/行均无reaction供用户主动选择或取消。Save进入private choice waiting7:440。

影响：公评编辑代替本人私密再约同意，三对象独立要求被代表路径绕过。固定示例也不应以输入公评自动给独立同意。

原作者修正：将公评draft与再约选择独立；只点checkbox才能选再约；公评only可保存且不创建选择，保持原布局。

复验：公评only、再约only、两项dirty三条代表反例；未点再约时checkbox始终未选、保存不称已选择。

## R11-I34-06 · P1 · 进入问卷更新自动选Yes，未保留原again=null

需求：J06 §2/3; AC02/AC03。节点：8:203, 8:277, 8:279, 8:306, 8:335, 8:350。

复现：reason-only已存8:203，again为null → 点Update answers8:277→8:279 → 未点Yes，检查8:306选中色及Save路径

实际：Update直接到Yes+Company选中样例；Yes/No控件本身无reaction，Save即去Yes已存8:350。

影响：导航进入编辑成为自动代答；未主动选择Yes就能改原null答案。

原作者修正：Update先带原确认值；Yes/No/null由实际选择控件触发，保留reason-only更新，不用进入编辑自动填Yes。

复验：reason-only→Update→无选择→取消/Save不把null改Yes；主动Yes、Clear再保存均按本人动作。

## R11-I34-07 · P1 · 独立问卷未保存状态没有取消/返回出口

需求：J06 §1/2; AC01/AC02。节点：8:63, 8:133, 8:279。

复现：Settings8:14打开未答8:63 → 选择Company到8:133，或从已存进入8:279更新 → 寻找取消/返回Settings以保留最近确认答案

实际：三帧均无Cancel/Back控件reaction；截图顶部没有返回箭头，只有保存后帧有Back to Settings。

影响：可选问卷变成保存前无法退出的死端，无法审查取消恢复确认值/首次取消零写入。

原作者修正：沿原返回模式补可点击取消/返回；首次空白回Settings，编辑取消恢复已存值。

复验：未答、reason草稿、已有答案改稿三状态Cancel均可回Settings；重入读取原确认值，草稿未误保存。

## R11-I34-08 · P2 · 群AI草稿转入时静默丢失末句

需求：J03 §5; AC07。节点：6:349, 6:423, 6:498, 6:500, 6:544。

复现：原助手草稿6:423包含Please let the host know if your plans change. → Review→Replace with draft6:498→原消息框6:500 → 比较完整候选与转入文字

实际：候选为“Hi everyone! Shall we meet at The Little Table at 19:00? Please let the host know if your plans change.”；转入6:544仅保留第一问句，远低于2000限制。

影响：用户批准的草稿被无提示截短，无法核对转入等于已审内容；代表Send继续发送缩短版。

原作者修正：完整转入候选；如要展示人工修改，必须增加明确本人编辑动作，不能把转入本身当修改。

复验：逐字符比较候选→Replace→未发框；不自动发送；本人手动Send后内容一致。

## R11-I34-09 · P1 · J03退席与host解散缺少可执行设计位置和结果表达

需求：J03 §2/4/7; AC04/AC05/AC06。节点：6:129, 6:560, 6:562。

复现：逐读J03-R04/R05/R06映射 → 检查整个J03原生帧与交接/state-contracts → 定位guest开饭前退席和host当前群解散的真实用户动作/确认/返回

实际：只有独立Leave group整段路径。退席/解散/重入仅在大段合同提及；Group settings无host解散变体，View meal也无连线/目标设计说明；未给退席后仍在群、解散后全员只读的明确界面落点。coverage却把这些规则归入representative-native-prototype-and-state-contract。

影响：后续worker无法据此区分三种操作的入口/确认/取消/结果，有回到把退席、退群、取消混为一谈的风险。

原作者修正：不需做全矩阵；用原meal action/Group settings的最小角色变体及清楚交互规格补退席和host解散，或精确指向同版本已有目标节点；修正coverage深度。

复验：guest只能退席且开始前；确认后Seat Cancelled但群仍可写。host只能显式解散，确认后全员只读、席位不变；取消两者均无写入。

## 已确认的正确边界

- Left-group screen hides current members and explains unchanged meal participation.
- Read-only private history contains no composer.
- Three feedback objects visually separated; private score has no default and is independently saved.
- Single-sided WAITING has no Open private chat promise.
- Survey is independent Settings entry, no mealId/attendance/window gate and initial again has no default.
- Deletion final confirmation starts unchecked; Pending says accepted not completed; support email exact and mailto contains only address.
- Report Received explicitly distinguishes receipt from completed investigation.

本评审唯一写入本报告两文件，未改设计、需求、Demo、管理或Git。完整输入hash、方法和限制见JSON；修复由原UX-2执行，PJ串行复验。

## I4 独立定向复验

R11-I34-02/03已由原UX-2修复，经UX-1实际画布读回及三张截图独立复验通过。Cancel4:151→Maya15:72→原稿4:78；NEEDS_SUPPORT支持14:97返回5:275，COMPLETED支持14:138返回5:348；Pending原路径保持5:182。I4可独立进入开发方案，不等I3；不是Owner终审或服务QA。

## I3 独立定向复验

原UX-2修复后，01/04/05/06/07/08/09均由UX-1独立复验通过。重点实际检查6个顶层条件各自的真实actions，而非兼容字段reaction.action：四个Cancel×六个确认态共24个独立分支，none首次取消回未答Settings，不默认Yes；实际前景退席Confirm才SET状态，host不会走guest退席；撤回后编辑保持未选。公评only/private-only/both、AI逐字转入和最新终态Back均核对。四张新角色/问卷/只读图实际看过。

I3可独立进入本版开发方案；I3/I4均为design-scope-recheck-passed，不等于业务代码、QA、全自由输入、修后Presentation逐点全走或Owner发布批准。原始问题与修正历史保留，当前关闭状态与证据见JSON。
