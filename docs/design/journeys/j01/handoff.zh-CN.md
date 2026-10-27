# J01 找到并申请一场合适的饭局 · UX-r01候选

唯一作者：UX-1。只交本旅程iOS设计；用户本轮已授权UX，RD/QA未启动。待Owner审阅，不声明独立QA通过、产品发布或Figma原生命名版本冻结。

[打开独立Figma](https://www.figma.com/design/2JKGRfwDoZnM9Ne0b6H4Np?node-id=2-715) · [打开原型](https://www.figma.com/proto/2JKGRfwDoZnM9Ne0b6H4Np?node-id=2-715&starting-point-node-id=2-715) · [需求对应](coverage.json) · [实际节点/连线读回](figma-readback.json)

## 固定输入与范围

PRD：`PM-r01`，Demo：`PM-r02`，输入提交`14db53257a2b4bb7610a3afad5e1ecfd735db605`。原文件及SHA256见manifest；PM原文、Demo未改。本次设计不改变原需求批准规则；原条款/未决事项仍以同版PRD和PM coverage为准。

不做：不设计发起审批、付款/订位、群私聊、分享J13、系统提醒J14/J15、移动Web或真实服务后台。

## 视觉、组件与平台

沿用`demo/DESIGN.md`、`demo/UX-CONTRACT.md`与`docs/design/brand-direction.zh-CN.md`的森林绿#123f35、正文#10241f、底色#f5f6f1、peach#ffb49b、Arial字族及原控件圆角/尺度。已只读检查旧用户端Figma `UNNhbMSEbFVxbRPgV3cuiX`。旧组件/变量跨文件导入实际not found，目标库检索无Fancy对应组件，故按原规范建立最小本地Button/Field/Navigation及同值变量/文字样式；没有发布或改写旧库。

画板390×844，顶部安全区44、导航栏56、底部安全区34。适用根页保留Discover/Meals/53pt中心Create meal/Inbox/Profile导航；图标来自原App NavGlyph与现有Radix SVG，不留Unicode占位。跨旅程tab仅保留既有导航表达和目标归属，不在本文件扩展其他旅程。认证、编辑和删除受理后的业务受限页不展示全局导航。

内容用auto-layout，字段/段落按宽度换行；长表单在710pt（有底导航628pt）视口内滚动，安全区与底导航不随内容盖住操作。按钮至少48pt，原新控件44pt触控区域；无为控制工期把长内容裁掉。正式iOS键盘抬升、焦点滚到当前字段、Done/返回与手势按原UX-CONTRACT，未在真机执行。固定样本原型不模拟实际键盘输入或声称全面无障碍通过。

## 对应关系

| PRD章节 | 代表Figma节点 | 证据边界 |
| --- | --- | --- |
| goal | [discover](https://www.figma.com/design/2JKGRfwDoZnM9Ne0b6H4Np?node-id=2-715), [pending](https://www.figma.com/design/2JKGRfwDoZnM9Ne0b6H4Np?node-id=2-1045) | design-and-representative-prototype |
| discovery | [discover](https://www.figma.com/design/2JKGRfwDoZnM9Ne0b6H4Np?node-id=2-715), [filters](https://www.figma.com/design/2JKGRfwDoZnM9Ne0b6H4Np?node-id=2-741), [filters-clear](https://www.figma.com/design/2JKGRfwDoZnM9Ne0b6H4Np?node-id=2-785), [results](https://www.figma.com/design/2JKGRfwDoZnM9Ne0b6H4Np?node-id=2-809), [detail](https://www.figma.com/design/2JKGRfwDoZnM9Ne0b6H4Np?node-id=2-826), [host](https://www.figma.com/design/2JKGRfwDoZnM9Ne0b6H4Np?node-id=2-845), [unavailable](https://www.figma.com/design/2JKGRfwDoZnM9Ne0b6H4Np?node-id=2-1092) | design-and-representative-prototype |
| identity | [account](https://www.figma.com/design/2JKGRfwDoZnM9Ne0b6H4Np?node-id=2-858), [email](https://www.figma.com/design/2JKGRfwDoZnM9Ne0b6H4Np?node-id=2-877), [code](https://www.figma.com/design/2JKGRfwDoZnM9Ne0b6H4Np?node-id=2-895), [code-error](https://www.figma.com/design/2JKGRfwDoZnM9Ne0b6H4Np?node-id=2-916), [oauth](https://www.figma.com/design/2JKGRfwDoZnM9Ne0b6H4Np?node-id=2-938), [profile](https://www.figma.com/design/2JKGRfwDoZnM9Ne0b6H4Np?node-id=2-955), [profile-error](https://www.figma.com/design/2JKGRfwDoZnM9Ne0b6H4Np?node-id=2-991) | design-and-representative-prototype |
| application | [apply-unchecked](https://www.figma.com/design/2JKGRfwDoZnM9Ne0b6H4Np?node-id=6-197), [apply](https://www.figma.com/design/2JKGRfwDoZnM9Ne0b6H4Np?node-id=2-1009), [unknown](https://www.figma.com/design/2JKGRfwDoZnM9Ne0b6H4Np?node-id=2-1032), [pending](https://www.figma.com/design/2JKGRfwDoZnM9Ne0b6H4Np?node-id=2-1045), [withdraw](https://www.figma.com/design/2JKGRfwDoZnM9Ne0b6H4Np?node-id=2-1061), [withdrawn](https://www.figma.com/design/2JKGRfwDoZnM9Ne0b6H4Np?node-id=2-1076), [unavailable](https://www.figma.com/design/2JKGRfwDoZnM9Ne0b6H4Np?node-id=2-1092) | design-and-representative-prototype |
| ai | [ai-permission](https://www.figma.com/design/2JKGRfwDoZnM9Ne0b6H4Np?node-id=2-1107), [ai-clarify](https://www.figma.com/design/2JKGRfwDoZnM9Ne0b6H4Np?node-id=2-1122), [ai-results](https://www.figma.com/design/2JKGRfwDoZnM9Ne0b6H4Np?node-id=2-1142), [ai-explain](https://www.figma.com/design/2JKGRfwDoZnM9Ne0b6H4Np?node-id=2-1161), [ai-draft](https://www.figma.com/design/2JKGRfwDoZnM9Ne0b6H4Np?node-id=2-1178), [ai-transfer](https://www.figma.com/design/2JKGRfwDoZnM9Ne0b6H4Np?node-id=2-1193), [ai-unavailable](https://www.figma.com/design/2JKGRfwDoZnM9Ne0b6H4Np?node-id=2-1210) | design-and-representative-prototype |
| demo | [discover](https://www.figma.com/design/2JKGRfwDoZnM9Ne0b6H4Np?node-id=2-715) | design-and-representative-prototype |
| acceptance | [discover](https://www.figma.com/design/2JKGRfwDoZnM9Ne0b6H4Np?node-id=2-715), [pending](https://www.figma.com/design/2JKGRfwDoZnM9Ne0b6H4Np?node-id=2-1045) | design-and-representative-prototype |
| shared-contracts |  | documented-only-contract |

Demo场景按对应PM coverage逐条引用；技术条款、真实服务和原文documented-only仍属合同，不因为新增画板改称已交互实现。

## 关键交互与恢复

注册登录属于同一次申请旅程。资料表展示完整有效样本，不将已填样本解释为正式默认值；姓名/简介/生活状态/语言/兴趣及18+、社区规则按PRD逐项校验，正式初始确认未勾选。邮箱错误、过期、重发冷却和供应方取消按同版PRD；不存在真实OTP或OAuth调用。

申请返回同一饭局后先在`apply-unchecked`勾选原Arrangements控件，才到可发送样本；认证、AI生成、Keep/Replace都不发送。Pending不占席位/不授群权；未知结果先查原请求，拒绝、满员、截止等保持原稿。Keep/Replace两条为原编辑器的固定样本状态，不能据此宣称原型实现了任意文字替换、幂等事务或真实权限重验。

AI只表达本旅程的查找/澄清/结果解释与比较/申请草稿。长期偏好仅soft，本次hard和CLEAR不得暗改Discover。真实提供方地域、训练和留存披露尚需批准，许可页为承载位置而非已批准法律正文；正式披露不完整时禁止真实调用。500字候选仍受原申请20–300字限制，原稿保留、迟到响应/账号/目标失效、30秒终结和50元/月全局硬闸均为有效合同，不画成额外产品平台。

## 验证与版本边界

已实际创建并读回该独立文件；检查原型起点、同页目标存在、代表正常路径及恢复跳转、Arial字体、固定宽度和文字横向边界。当前27个代表状态；数量只定位，不作覆盖率。实际截图检查及PNG证据保存在本目录，已发现并修正的导航/按钮/选择控件问题不隐藏。

原型是Figma固定样本状态导航，完整动态校验/异步幂等/跨设备状态不是其执行能力；真实生产状态不得由预设下一屏推断。未执行浏览器中逐个点击的原型回放、任意输入、真实iOS、安全存储、读屏、模型或服务集成。结构和截图验证不是独立QA。

API未提供保存原生命名版本的能力，因此`UX-r01`为仓库候选修订，Figma文件仍可编辑，**不是原生版本ID或已冻结版本**。manifest中的输入hash与`figma-readback.json`快照hash定位本次交付；后续变更需回本owner更新映射/快照，不能静默替换已审稿。Owner未批准，RD/QA仍未启动。
