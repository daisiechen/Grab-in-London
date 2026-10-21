# B4 · 加入者认证回流与导航修复复验

## 版本与环境

Web980c8edd634bd212a92cfac46d54cf562c8480e4固定归档；API/临时PG/worker仍8387580156d53eed2936f7650ccc71dbe8319e0f归档以保留本轮合成数据。git diff两SHA的meals/profiles/identity/contracts/db/config为空，F15只涉及AI，本段未运行模型。不称统一新版全仓端到端通过。首次认证回流截图在切换前8387580，非AI认证未变化。IAB专用tab，不读取个人Chrome或凭据；本地TestIDP000000、Places/mail fixture，没有真实付费服务。

## 操作

已有seeded合成加入者qa-f01-9a94365f@example.invalid：游客详情填写73字申请→Send进入认证→登录后原Apply完整保稿且未自动提交、不重复资料→再次Send才Pending。Inbox3张卡分别对应新Saturday dinner、Friday dinner和Saturday brunch，标题/日期/host明确，尚无群席位。原host退出取消/确认/刷新路径也已走查。

同加入者新建合成Sunday meal：Fancy South、2026-10-25 19:00 GMT、18:00截止，初4改2后minimum2，£20–35到店付。改变人数清旧外订确认，重新本人确认才进入Review。条款两返回入口在false/true两状态均回原Review，保留对应勾选与餐厅RAM显示、不自动发布。

明确Publish新meal04ec368a-399f-4c2c-b77e-227580d8fa60，详情Back=/meals?section=HOSTING；avatar/name分别→公开资料→原meal→原Hosting，真实Hosting按钮pressed且新场可见。Edit无修改和改标题为QA fixed navigation Sunday meal revised均回Hosting，Discover来源打开同详情仍Back Discover。发布后同账号再Create餐厅空、时间空、默认4而非已发布2。最后取消退出保持账号，明确退出并刷新仍认证页。

本段未完成审批、首guest锁安排、出席、互选或全部后台；JOURNEY001/002仍NOT_RUN。B3及原R86/R87失败保留。

## 证据

- [结构化逐项观察](browser-b4.json)
- [认证回流保留未发稿](b4-auth-return-unsent.jpg)
- [Pending收件箱](b4-pending-inbox.jpg)
- [修后条款返回Review](b4-terms-return-fixed.jpg)
- [修后公开主页返回原meal](b4-public-profile-origin-fixed.jpg)
- [修后编辑详情回Hosting](b4-edit-hosting-fixed.jpg)
- [退出后刷新](b4-logout-refresh.jpg)
