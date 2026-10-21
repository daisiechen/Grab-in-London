# B3 · 固定源码实际浏览器走查

被测8387580156d53eed2936f7650ccc71dbe8319e0f，从git archive导出至临时隔离目录，Web/API均该归档；共享依赖，不使用并行F15源码。IAB本任务专用tab，临时真实PG/API/worker，本地TestIDP、Places、邮件fixture；000000仅本地合成码，无真实邮件/OAuth/地图/模型/原生验收。旧QA rig两个已确认PID经协调停用，新API44860由本轮启动。

## 操作和界限

游客空发现页可达、Create进入登录门禁；非法邮箱拒绝、123456错误码拒绝，000000本地码成功返回资料门槛。资料缺项逐项就地拒绝，完整保存返回Create；最初London life未选的拒绝经重新选择正常，不立丢字段缺陷。

四步输入：Fancy North fixture，2026-10-24 19:00 London，18:00截止，minimum3/capacity4，English/Chinese，£20–35。选店高亮不算确认；倒置预算、不勾外订及不勾Review分别拒绝。Review返回Arrange及介绍/费用保留。查看条款再Back to review实际重回Step1（F16）；重复三步后显式确认成功发布，仅合成本地饭局，没有真实订位。

饭局adadcda5-970a-41f5-9460-70d04611d992，host公开页9c7a22ea-d577-44c7-a849-d57189995880。金额/外订/人数详情与输入一致，公开nickname/bio/English/Food一致；新发布详情及host公开页Back都错误指Discover（F17）。没有完成审批/出席/互选/管理后台；不能据此授完整用户路径通过。

## 可核验记录

- [逐项状态及步骤](browser-b3.json)
- [资料确认门槛](b3-profile-confirmation-gate.jpg)
- [条款错误返回Arrange](b3-terms-return-arrange.jpg)
- [实际发布详情](b3-published-meal.jpg)
- [公开资料及错误返回来源](b3-public-profile-origin.jpg)

浏览器console error/warn读取为空（资料保存后该点）；未据此声称整段所有网络成功。没有读取cookie/localStorage凭据或个人Chrome页面；所有可见账号及内容为合成。
