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
