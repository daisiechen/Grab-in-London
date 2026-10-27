# I2 / J02 独立交叉评审

基线 `6675dc527ab0a0aa586e13e2cc13c2b235ec06bf`；结论：**需修订**。只读评审，原修复负责人 UX-2；未启动 RD 实现、QA 或真实服务。

[设计入口](https://www.figma.com/design/c04Fi5iarZm7gTPw4u2f7f?node-id=1-24)

## R11-I2-01 · P1 · 共享外订/取消弹层改变来源审核、人数与声明事实

Published显示1/4，仅host；点Host booking declaration（1:853）。；进入3:3907，底图却已2/4，Emma Confirmed且关键安排锁定。；从未批准的Applicants点Cancel（1:948）或DeclinedResult点Cancel（6:236），都进同一个已批准2人底图。；从已更新声明3:4021点Cancel，也退回旧Needs update声明底图。

预期：弹层与取消返回均保留来源人数、申请状态、永久锁定与最新声明；只有显式Approve改变成员事实。

复验：从未批准、已批准、已拒绝、声明已更新四种来源进入/Keep/返回；事实不变，只有本人批准才新增成员。

证据：live-native-node-text-and-reactions；节点 1:719, 1:853, 1:880, 1:948, 3:3907, 3:4117, 3:4021, 6:185, 6:236。

## R11-I2-02 · P2 · Review缺少用于核对分店的地址

沿四步进入Review。；Place & time仅The Little Table · Soho与时间；所有原生文本读回均无街道地址。

预期：依PRD§5显式呈现许可地址，不能用区域Soho替代分店地址。

复验：Review/ReviewReady及其恢复态显示与已选placeId对应的完整合成地址；不伪装真实provider已验证。

证据：live-native-text-and-screenshot-1:594；节点 1:594, 3:2365。

## R11-I2-03 · P1 · 取消/拒绝终态的历史BACK可复活旧操作页

Applicants→CancelConfirm→Cancelled；Cancelled的Go back 3:4295为BACK，目的历史是仍可执行取消的确认页。；Applicants→Declined→Back to applications→DeclinedResult；6:245为BACK回Declined，3:4389再BACK回原可Approve/Decline的Pending页。

预期：发生业务终态后返回应指向保留最新事实的详情/列表；不能由历史导航恢复旧业务动作。

复验：取消后返回/拒绝后多次返回始终保留终态，不能重新批准、重新取消或重开已完成草稿。

证据：live-native-BACK-reaction-and-history-sequence-not-Presentation-click；节点 3:4233, 3:4295, 3:4329, 3:4389, 6:185, 6:245。

## 条款与验证边界

- J02-R01：身份复用J01，跨文件未联通；不是本包实际点击通过。
- J02-R02：选店固定样例+搜索恢复合同，许可provider未验证。
- J02-R03：伦敦48半小时/DST/人数/截止合同存在；DST选择原型未连动作，任意输入未验证。
- J02-R04：Introduce标题/描述及可选字段存在，AI保原/替换单独主动。
- J02-R05：Costs默认无Continue动作；显式勾选后可进Review；Review默认无Publish动作。地址缺项见02。
- J02-R06：Failed保稿同意图重试；Unknown先查原意图路径存在；真实幂等未验证。
- J02-R07：公开资料/批准/拒绝/首批准锁定代表态存在；来源与返回缺陷见01/03。
- J02-R08：截止不足取消和开始冻结/迟到合同存在；insufficient示例转通用Host reason终态，原因需保持系统insufficient。
- J02-R09：取消Keep用BACK保返回；成功终态历史返回见03；真实通知不验证。
- J02-R10：AI主动入口/转入/替换/保原/人工Review发布存在；真实模型成本TTL共享合同未运行。

实际读取Figma原生文字、反应、滚动结构，实际查看实时Review截图及仓库原Demo/新稿对照。四步视觉保持原MVP结构；未把服务端矩阵或连线目标存在称作实际点击通过。[Presentation实际点击](https://www.figma.com/proto/c04Fi5iarZm7gTPw4u2f7f?node-id=1-24&starting-point-node-id=1%3A24)已走通四步→本人确认发布→Approve→按2人更新声明→取消代表路径；未登录阻挡。默认Costs Continue与Review Publish点击无效。此代表路径通过不抵消上述来源/终态缺陷。浏览器另观察复选框长句重叠和未确认Publish仍呈深绿，待原生边界核对。

独立核对全部10条J02-R及10条AC消费映射；942条继承sourceUnits只核有映射/哈希，不声称逐条独立生产验收。
静态可编辑原型不运行任意日期、键盘、并发、事务、通知、provider或模型；documented-only与可点击代表态分开。

## R11-I2-04 · P1 · 确认长句重叠

实际Presentation发现Costs与Review复选框说明重叠。原生边界证实：Costs尾句1:563与日期1:560都从x1257/y1066附近开始；Review条款1:693与前句1:690都从x1757/y1415附近开始。本人确认内容不可完整阅读。UX-2应重组正常换行长文和链接，覆盖CostsConfirmed/ReviewReady同类。复验393宽长句无重叠、条款独立打开不勾选、未勾选仍不可发布；Publish禁用反馈沿原规范。
