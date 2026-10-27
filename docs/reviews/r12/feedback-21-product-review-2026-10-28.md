# r12 · 21条截图反馈的产品范围与地图组件核对

日期：2026-10-28。独立核对：PJ-ADMIN。根PJ已接受以下范围决定；本文件仅冻结产品边界与官方组件依据，未改原PRD、Demo、合同或生产代码，未启动业务实现或产品QA。具体21条截图问题由原UX分包修，逐项截图/实际点击验收另记feedback-21-independent-review，不由本产品核对冒称已通过。

## C12 · 界面语言与交流语言

事实：主PRD FR-12（当前第420行）明确App language为English只读说明，不提供假语言切换；交流语言走Edit profile。J05 §2要求至少一种交流语言，属于公开资料字段，而不是应用locale。

根PJ决定：本轮维持English-only，不伪造全站中英切换。App language行必须有明确可点击反馈，解释当前界面语言为English；同时提供真实可达的Edit profile交流语言入口。说明层可关闭，返回保留原页面；交流语言编辑继续沿原草稿/保存/取消语义，不把打开说明当保存或切换。

后续验收：点击语言行实际出现说明；关闭回原Settings；点击交流语言入口实际进入原Profile编辑；不能出现点了无反应的假选择器，也不能以改交流语言冒充全站UI切换。此项独立推进，不等待C20需求增量。

## C20 · 拒绝申请的原因是本轮明确增量

核对事实：J02 §6现要求host批准/拒绝及本场状态；现decideApplication为POST /applications/{applicationId}/decision，正文只有decision(APPROVE/DECLINE)。Application DTO无拒绝原因，现API拒绝写入只更新状态/版本/时间。既有整场取消reason与拒绝申请不是同一字段，不能借用或假称真实API已保存原因。

根PJ决定：新增最小可选预设原因，含“不说明”；仅本场host和该申请人可见。确认前可切换或取消；不强制自由文本，不发给其他申请人或群，不夹带其他成员资料。用户已授权该最小原型改动，无须再次请求批准，也不阻塞C01–19/C21。

原J02 PM是该需求增量的唯一PRD/Demo产出负责人，由根PJ召回更新主PRD消费规则、J02、通知矩阵与待实现contract delta。预设清单/字段code/空值语义须在原PM包明确，不由UX静默发明正式字典。合同delta需区分请求中的可选原因、host/本人申请人许可投影及通知内容；未填写/不说明必须可确认拒绝，不能新增强制输入门槛。生产API当前不改，后续契约writer与实现另签发。

后续原型验收：打开拒绝确认→无强制默认原因；选择/切换预设→取消保原Pending；确认→Declined与所选原因可按权限查看；“不说明”也完成；原型不宣称真实通知已送达或服务端已持久保存。明确与满员/截止/取消等服务端权威失败分开，不泄露他人申请或群内容。原既有禁止本场重申、名额与首批准锁定规则不被此增量改写。

## C14 · Google Maps iOS现成marker与信息气泡

结论：Google Maps SDK for iOS已有marker及默认信息气泡，无须为了常规选店pin/店名地址提示从零造一套地图组件。GMSMarker提供位置和标题，默认pin可直接使用，必要时才沿品牌调整icon；选中marker可显示title/snippet，一个地图同时只显示一个info window，点另一marker切换。依据：[官方Markers](https://developers.google.com/maps/documentation/ios-sdk/marker)、[官方Info windows](https://developers.google.com/maps/documentation/ios-sdk/infowindows)。

组件限制：自定义info window的UIView会被渲染成图像，并非live view；不能仅因它看起来有按钮，就认为内部多个子按钮各自可交互。地图/marker/info-window事件由GMSMapViewDelegate处理。若Fancy需要“Use this restaurant”等独立操作，建议将店名/地址保留在标准气泡或选中态，确认动作放原生底部候选卡；这是基于官方行为的设计建议，不新增业务范围。依据：[官方Info windows自定义窗口说明](https://developers.google.com/maps/documentation/ios-sdk/infowindows#custom_info_windows)、[官方Marker events](https://developers.google.com/maps/documentation/ios-sdk/marker-gestures)。

后续验收：pin、选中气泡与候选卡不重叠/裁切；名称与地址能读，选另一marker时只更新当前选择预览；明确Use后才写入选店；取消或返回保留原确认店。现Figma合成地图只能证明代表交互与布局，不证明已接真实Google地图、Places分店资料/照片或许可署名。SDK接入/API key/计费/真实服务另验，不在本轮启动。

## 后续独立验收分工与签收边界

C01–13原UX1/I1，C14–20原UX2/I2，C21原UX2/I3。候选就绪可分包并行验收；输入hash冻结后再签新候选，不重写旧独立签署。截图审核要逐项标注文字/布局/裁切/选态/点击目标；实际点击必须另有真实记录，不把测试绿、节点存在或native反应读回叫click PASS。产品范围确认不等于21项已修完。

当前状态：C12/C20范围已由根PJ明确；C14官方组件依据已核；21项具体设计候选与点击复验待后续独立review。本文件冻结后释放执行位，原PM可立即处理C20，其他反馈继续，不建立全组等待门槛。

## 本次只读输入SHA256

|文件|SHA256|
|---|---|
|docs/product/PRD.zh-CN.md|47f6cc2d0314b486c762852f2f61c18eab1e6f6fd63245d852b216527703c305|
|docs/product/journeys/j05/requirements.zh-CN.md|50a482a514dbb17b75b9e1baf7c174f24a6d7e155c3d2e48fa1e72bcd5d03e6b|
|docs/product/journeys/j02/requirements.zh-CN.md|6a6211922d649a12899803721b709cb67f2e37e6bea428d804cee399d3df4299|
|packages/contracts/src/operations/meals.ts|85cc4d40187cd64db22e39b350cf2a778fbcf259e3ab9e422a0f457a160df00e|
|packages/contracts/src/dto.ts|ef5f0f88cbf3adb317ffb73e313d97529ea0ceef74876b9c7d084035788b7388|
|apps/api/src/meals/commands.ts|cdf2d324b2962685fda793559550e14e561da4fb7a646d677df5868fd4479bb9|

官方文档访问日期：2026-10-28。未引用非官方实现博客；未调用真实地图/邮件/账号服务。
