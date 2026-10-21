# B1 · 独立浏览器执行记录

时间：2026-10-21；应用来源：固定交接代码`8bc1e92` / 文档交接`8ba6fc7`，沿用已启动的本地Web5174/API3000/worker。Chrome页面顺序切换两个合成账户，不是两个独立设备。后续页面有开发热更新可能；首批截图在`071ecd7`修复前取得。餐厅、身份、邮件均为本地fixture，未验证Google、真实收件或外部模型。

## 合成数据

- 主持人：QA Host；加入者：QA Guest；均为`example.invalid`合成邮箱。
- 饭局：“Independent QA Friday supper”，2026-10-23 18:00 London，17:00截止，minimum=capacity=2，预算£20–35，English，Easy conversation。
- 餐厅：[Fixture] Fancy North Kitchen。场次ID `6efcb272-52ab-4d9e-9bd2-c9064d811924`，群ID `9715b86b-2bae-4d65-b994-d09b8626095c`。

## 实际操作与观察

1. 游客Discover空态 → Create门禁 → 邮箱认证 → 完善合成个人资料 → 回到Create。没有自动创建饭局。
2. 创建四步：搜索Fancy、选择候选、明确Use；日期/人数/时间；标题/描述；预算与外订声明；Review再次确认后Publish。未勾外订确认时Continue被阻止，并出现“Confirm your restaurant reservation to continue.”。
3. 发布详情显示1/2 confirmed including host；Pay at restaurant、无应用内付款；餐厅是host报告、未经app核实；菜系/饮食Not provided，非过敏保证。[截图](web-created.png)。
4. 主持人Settings → Sign out → Stay signed in保持会话，再次Sign out确认后为游客。没有将此观察扩张为多设备注销或缓存全清验证。
5. 游客打开同一场次并填写申请留言 → Send触发认证及资料填写 → 回流同场Apply，留言逐字保留，没有自动提交。[截图](web-draft-return.png)。
6. 主动Send后PENDING；Inbox Chats没有该场群；Applications出现1条pending。卡片缺场次标题/日期/主持人，登记QA-F01。[截图](web-pending-inbox.png)、[文字快照](web-pending-inbox.txt)。
7. 切换回主持人；Manage guest list看见同一留言、Round1、1/2 confirmed。Approve后2/2 confirmed；无待审条目；显示QA Guest；关键安排锁定；餐厅声明变成Host to update reservation。
8. Open meal group可达同一饭局；输入`<b>QA synthetic greeting</b>`并Send，正文以包含尖括号的纯文本显示，编辑器清空；未把这一次发送冒充全部长度、幂等、历史区间或多设备送达测试。[截图](web-approved-group.png)、[文字快照](web-approved-group.txt)。

## 明确未走完

没有在浏览器中跨真实时间等待饭局结束、完成出席/评分/公评/再约/问卷并追溯后台；没有双设备、iOS原生、真实地图、邮件或模型验收。对应底层既有自动化复跑记录单列，不能替代本条端到端后半程。原计划以Demo为目标的场景也没有自动改写为生产实现PASS。

## B2 · QA-F01修复后定向复验

被测提交`04cb601c5486b33acb2d7968642bab209806ce91`。开发负责人在QA保存B1后重启其临时rig；新数据库不继承B1数据，Web5174使用修复版本。使用显式开启的`scripts/qa-inbox-fixture.mjs`经本地API创建两个不同主持人、标题、日期时间的饭局及同一加入者的PENDING申请，仅合成资料；登录与页面检查使用Chrome UI。

- 新用户通过邮箱fixture登录后回流Inbox；Chats不出现待审饭局群。
- Applications有两张卡片：“QA Friday dinner verification” / QA Friday Host / Fri23Oct18:00 London，以及“QA Saturday brunch verification” / QA Saturday Host / Sat24Oct12:30 London。
- 独立DOM断言两张卡片数量、标题、主持人、时间和London标识；View application的href逐一匹配该场mealId；申请私人留言marker不出现于卡片。
- 分别实际点击两张卡片的View application，目标页各自呈现对应主持人、标题、时间和Application pending，没有串场。
- 新API夹具脚本另核对每条摘要对应其本人申请且无conversation字段。删除主持人遮罩及字段白名单由R7真PG API断言复验，不冒充浏览器中执行过账号删除。
- QA独立复跑R7（API4 + Web12）共16项及R8（iOS Inbox Jest9项），均通过；iOS仍仅组件测试，无原生设备结论。
- 浏览器登录首次遇邮箱30秒冷却；按提示稍后重试成功，未绕过限流。

证据：[修后截图](qa-f01-fixed.png)、[完整页面文字](qa-f01-fixed.txt)、[两场DOM断言结果](qa-f01-fixed-checks.json)。QA-F01在此最小验收范围关闭；B1失败证据保留。完整加入者出席/反馈/后台路径仍未完成，不把QA-JOURNEY-001改为PASS。
