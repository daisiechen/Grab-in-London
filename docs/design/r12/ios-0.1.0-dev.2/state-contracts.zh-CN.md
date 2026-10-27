# r12 范围与拒绝原因状态合同

|场景|状态/权限|取消/恢复|深度|
|---|---|---|---|
|人数range选择|2…6均含host；min≤max；默认3–4|picker只改草稿，Cancel不写当前值；Use改创建/编辑草稿|原生条件/变量，可点；实际click另报|
|已发布编辑|无人获准可编辑；首位批准锁不变|每步Cancel回未改已发布snapshot；本人Save才commit；409载入权威锁定不提交旧改动|正常原型可点，真实409沿原合同|
|公开profile|只当前公开字段，普通32头像独立入口|Back按源返回，禁止申请私文|固定public sample|
|Decline初开|Pending/current host；code=null、touched=false，radio都未选|Cancel/返回不决定；重开无预选，不携带旧申请/账号草稿|原型可点|
|可选原因|PLANS_NOT_ALIGNED / KEEPING_GROUP_SMALL / null；不选也可确认，无自由文本|确认前改选或No reason；touched只UI不传业务|原型可点|
|Declined成功|确认刻冻结账号/meal/application/version/decision/code意图；不可重申，不增加席位/名单/群权限|终态不能改原因/再审核；历史无reason=No reason provided|正常合成回执可点；真实服务未实现|
|UNKNOWN|Decision status unknown. Check this application before trying again. 保原reason/version/key/payload，不改原因另造意图|先查权威结果或同key同payload；离开等待不代表撤销/成功|documented-only，本包没有网络模拟器|
|明确失败/409/截止/取消|真实失败分别反馈，不用主观preset冒充MEAL_FULL/资格失败|保合适草稿；409加载权威，已终结不得覆盖；核清未执行且允许才本人新意图|documented-only，沿产品delta|
|私密投影/通知|仅本场host与该申请人；站内/原合法邮件仅本人，safe preset来自已接受服务结果，null省略|旧记录不补造；群/他人卡/公开/analytics不含原因；provider未知不称送达|两只读角色样例+proposed API契约；不是真实身份/通知测试|

所有原型local variables只是代表交互；生产鉴权/幂等/DTO/持久化/通知需独立建设与真实验收。

Final public-profile data is the known domain Alex sample, not missing-data fallback. C20 radios are fixed native circles, not text glyphs. The3 shadow/error range projections remain originally inert; do not infer source-return operations that did not exist.

Final caption delta:90:641 source header is bound to UI-only title137:376. Create open90:380/381 sets Create a meal, Edit open90:391/392 sets Edit meal beside the existing context BOOL. Removing that one SET makes before/after actions exactly equal. Use90:705/Cancel90:667/Save56:1194/Publish3:2447 unchanged; no new scalar or business branch. Recheck Edit title by entering from Edit56:290, not direct starting at an empty-context sheet.

Author Figma/package writes stopped; I2 and I3 status files now root-only writers. Root independent click acceptance stays separate from author BrowserUse blocked history.
