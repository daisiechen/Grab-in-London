# r11 独立评审：DS 与 IOS-0.1.0-dev.1

结论：需要修正，暂不通过本轮设计Ready。评审者UX-2不是DS/I1作者；唯一修复Owner为UX-1。没有改原设计、PRD、Demo或Git。

原v13视觉方向在已看Discover及DS控件/导航/助手中延续；当前阻碍主要是主动同意、偏好保存和真实可返回路径。冻结PM的J01 991条、J05 813条源单元逐项按自身PRD节/原处置映射，完整清单在JSON；未把源单元数量当交互通过，也未把真实后端未开发列作一概阻断。

## R11-I1-01 · P1 · Selecting a portrait automatically supplies adult/community consent

依据：J01 §3 / J01-AC03。唯一修复Owner：UX-1。

复现：From email verification enter Complete public introduction 10:236. → Its only forward reaction is portrait 10:272 → 10:375. → Ready screen shows checked 18+/community label; Take your seat goes directly to 11:753.

实测原生反应/文本：10:359 and 10:500 consent labels have no reaction. Portrait transition supplies description and prechecked consent; user never explicitly agrees. Screenshot 10:375 shows the check.

预期：Filling/selecting an identity sample must preserve unchecked adult/community consent. Only explicit consent enables completion.

关闭条件：Separate a visible populated-but-unchecked state from explicit-consent checked state, wire toggle/cancel, verify no route to application from portrait alone.

证据：[10:236](https://www.figma.com/design/CS9oRCq8h3Clg09up2aISj?node-id=10-236)，[10:272](https://www.figma.com/design/CS9oRCq8h3Clg09up2aISj?node-id=10-272)，[10:359](https://www.figma.com/design/CS9oRCq8h3Clg09up2aISj?node-id=10-359)，[10:375](https://www.figma.com/design/CS9oRCq8h3Clg09up2aISj?node-id=10-375)，[10:500](https://www.figma.com/design/CS9oRCq8h3Clg09up2aISj?node-id=10-500)，[10:508](https://www.figma.com/design/CS9oRCq8h3Clg09up2aISj?node-id=10-508)

## R11-I1-02 · P1 · Optional analytics cannot be changed, and saved settings is a dead end

依据：J05 §3 / J05-AC02。唯一修复Owner：UX-1。

复现：Open Profile → Settings. → Optional analytics switch has no reaction. → Save privacy choice goes directly to saved-Off 12:882.

实测原生反应/文本：Saved-Off frame has zero descendant reactions, including visible Back. No draft On/Off → Save/Cancel representative route; returning or continuing is impossible in graph.

预期：Show distinct editable draft and saved value; explicit Save persists representative choice, cancellation returns previous confirmed state, saved page remains navigable.

关闭条件：Wire one meaningful On/Off draft + Save/Back/Cancel roundtrip with correct confirmed value on reentry; graph/screenshot check plus Presentation when accessible.

证据：[11:1753](https://www.figma.com/design/CS9oRCq8h3Clg09up2aISj?node-id=11-1753)，[11:1820](https://www.figma.com/design/CS9oRCq8h3Clg09up2aISj?node-id=11-1820)，[12:882](https://www.figma.com/design/CS9oRCq8h3Clg09up2aISj?node-id=12-882)

## R11-I1-03 · P1 · Saving blank preference example introduces two unconfirmed fields

依据：J05 §4 / J05-AC03。唯一修复Owner：UX-1。

复现：Open My preferences: No saved preferences yet. → Textarea displays source placeholder Soho, budget £35, table for 4, English and has no input reaction. → Click Save preferences.

实测原生反应/文本：Save jumps directly to saved six-field summary including Vegetarian options and Easy conversation, absent from visible proposal. No pending parsed six-field confirmation exists. Screenshot initial and saved states corroborate.

预期：Natural-language input must produce a visible pending proposal of allowed fields and explicit user confirmation; no unstated dietary/mood values may be remembered.

关闭条件：Show the exact six-field proposal before Save/Confirm, with meaningful input sample/confirmation transition; no new field after confirmation and delete/Keep returns correct confirmed state.

证据：[11:1854](https://www.figma.com/design/CS9oRCq8h3Clg09up2aISj?node-id=11-1854)，[11:1974](https://www.figma.com/design/CS9oRCq8h3Clg09up2aISj?node-id=11-1974)，[11:1976](https://www.figma.com/design/CS9oRCq8h3Clg09up2aISj?node-id=11-1976)，[11:1982](https://www.figma.com/design/CS9oRCq8h3Clg09up2aISj?node-id=11-1982)

## R11-I1-04 · P2 · Main authentication/application recovery controls are inert

依据：J01 §3–4 / J01-AC02/04/05。唯一修复Owner：UX-1。

复现：Enter returning login → email and try Back in sign-in. → On arrangement-confirmed application try Go back. → On Pending try Go back or Track in Inbox.

实测原生反应/文本：These visible controls have no reactions. Google/Apple buttons likewise have no reactions; provider-owned real screens may be specified-only, but representative cancel and return routes are not executable.

预期：Necessary Back/cancel and post-success history return must preserve original meal and state; optional system provider UI may stay a specified contract without pretending it was tested.

关闭条件：Wire Back in returning login/email, checked application Back, Pending Back/Inbox to valid same-state destination; clearly classify provider system boundary, do not claim its clicks passed.

证据：[13:107](https://www.figma.com/design/CS9oRCq8h3Clg09up2aISj?node-id=13-107)，[13:174](https://www.figma.com/design/CS9oRCq8h3Clg09up2aISj?node-id=13-174)，[12:474](https://www.figma.com/design/CS9oRCq8h3Clg09up2aISj?node-id=12-474)，[11:978](https://www.figma.com/design/CS9oRCq8h3Clg09up2aISj?node-id=11-978)

## R11-I1-05 · P2 · AI transfer silently drops a sentence from an in-range draft

依据：J01 §5.3 / J01-AC07。唯一修复Owner：UX-1。

复现：Review candidate 12:295. → Edit application → Replace with draft. → Compare transferred editor with candidate.

实测原生反应/文本：Candidate ends Is there anything I should know before joining?; both transferred variants omit that sentence though candidate is below 300 characters. No explicit edit/summarize action explains the change.

预期：Transfer preserves candidate verbatim; if target limit exceeded, require shortening rather than silent truncation.

关闭条件：Read back exact equality of candidate and transferred editor sample; Keep preserves manual text, replacement stays unchecked until consent, Send remains independent.

证据：[12:97](https://www.figma.com/design/CS9oRCq8h3Clg09up2aISj?node-id=12-97)，[12:295](https://www.figma.com/design/CS9oRCq8h3Clg09up2aISj?node-id=12-295)，[12:574](https://www.figma.com/design/CS9oRCq8h3Clg09up2aISj?node-id=12-574)，[15:212](https://www.figma.com/design/CS9oRCq8h3Clg09up2aISj?node-id=15-212)，[15:308](https://www.figma.com/design/CS9oRCq8h3Clg09up2aISj?node-id=15-308)

## R11-I1-06 · P1 · First permission page already displays a completed AI response

依据：J01 §5.1–5.2 / J01-AC06。唯一修复Owner：UX-1。

复现：From public meal detail click Ask Fancy. → Arrive at first Assistant data permission before Allow and continue.

实测原生反应/文本：Permission frame already contains a user request Find a meal for Friday in Soho, any budget and Fancy No available tables response. The graph requires no prior Allow or Send to reach this generated-result state.

预期：Before permission and explicit request, show disclosure/manual alternative and no fabricated completed assistant turn. Provider/legal facts can remain a configuration gate for real calls; no invented provider details required here.

关闭条件：Remove/fence preconsent result/history from this first-use route; Allow alone should not imply a new user request. Demonstrate permitted explicit Send → sample response/draft and refusal → manual original meal.

证据：[5:195](https://www.figma.com/design/CS9oRCq8h3Clg09up2aISj?node-id=5-195)，[5:339](https://www.figma.com/design/CS9oRCq8h3Clg09up2aISj?node-id=5-339)，[12:313](https://www.figma.com/design/CS9oRCq8h3Clg09up2aISj?node-id=12-313)，[12:440](https://www.figma.com/design/CS9oRCq8h3Clg09up2aISj?node-id=12-440)，[12:447](https://www.figma.com/design/CS9oRCq8h3Clg09up2aISj?node-id=12-447)，[12:451](https://www.figma.com/design/CS9oRCq8h3Clg09up2aISj?node-id=12-451)

## 已核对与未测

实际读回两旅程全部根节点/反应与DS组件；截图查看10:375、12:882、11:1854、11:1982及DS7:4/7:43、Discover5:17，与原compare-discover核对。申请安排确认→Send、撤回Keep/Withdraw、AI Keep/Replace与转入后再次本人Send、退出Stay/Sign out具分离动作；同一代表饭局标题/时间/host保持，但这不是运行时mealId持久化验证。

已发起真实Figma Presentation浏览器走查，报告采样时尚未返回可确认业务点击，故点击通过数为0。原生图连线不能冒称Presentation已点通。真实服务、任意自由输入、系统OAuth/键盘、VoiceOver/动态字体、并发、跨设备和模型费用关口未测；这些本身不构成本轮所有UI阻断。

该报告描述修复前证据。原作者修复后必须定向独立复验，不能仅改测试计数或文档称已关闭。

## Presentation最终回执补充

[公开J01原型](https://www.figma.com/proto/CS9oRCq8h3Clg09up2aISj?node-id=5-17&starting-point-node-id=5%3A17)实际走Discover→详情→Apply→账号→email；Google/Apple点击无目的。浏览器未输入个人资料，也未点合成Send code，故不能把后续未到达称真实认证失败。

[J05原型](https://www.figma.com/proto/CS9oRCq8h3Clg09up2aISj?node-id=11-1513&starting-point-node-id=11%3A1513)实际走资料编辑→Save→主页，及Save privacy choice→saved-Off；统计开关不变，保存后Back/Sign out无目的，支持R11-I1-02。AI偏好/删除未从该浏览器实际到达，不因此新增“删除入口缺失”问题；其原生反例仍按03处理。前文报告时pending描述由本回执覆盖。
