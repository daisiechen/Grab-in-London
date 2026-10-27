# J08 删除账号并确认处理结果 · UX-r01候选

唯一作者：UX-1。只交本旅程iOS设计；用户本轮已授权UX，RD/QA未启动。待Owner审阅，不声明独立QA通过、产品发布或Figma原生命名版本冻结。

[打开独立Figma](https://www.figma.com/design/uHfMTb0zQWyLHw73eyyUbD?node-id=1-30) · [打开原型](https://www.figma.com/proto/uHfMTb0zQWyLHw73eyyUbD?node-id=1-30&starting-point-node-id=1-30) · [需求对应](coverage.json) · [实际节点/连线读回](figma-readback.json)

## 固定输入与范围

PRD：`PM-r01`，Demo：`PM-r02`，输入提交`14db53257a2b4bb7610a3afad5e1ecfd735db605`。原文件及SHA256见manifest；PM原文、Demo未改。本次设计不改变原需求批准规则；原条款/未决事项仍以同版PRD和PM coverage为准。

不做：不执行真实删除、发信、供应方、DB/清库，不新增匿名支持写API、客服后台、账号恢复或移动Web。

## 视觉、组件与平台

沿用`demo/DESIGN.md`、`demo/UX-CONTRACT.md`与`docs/design/brand-direction.zh-CN.md`的森林绿#123f35、正文#10241f、底色#f5f6f1、peach#ffb49b、Arial字族及原控件圆角/尺度。已只读检查旧用户端Figma `UNNhbMSEbFVxbRPgV3cuiX`。旧组件/变量跨文件导入实际not found，目标库检索无Fancy对应组件，故按原规范建立最小本地Button/Field/Navigation及同值变量/文字样式；没有发布或改写旧库。

画板390×844，顶部安全区44、导航栏56、底部安全区34。适用根页保留Discover/Meals/53pt中心Create meal/Inbox/Profile导航；图标来自原App NavGlyph与现有Radix SVG，不留Unicode占位。跨旅程tab仅保留既有导航表达和目标归属，不在本文件扩展其他旅程。认证、编辑和删除受理后的业务受限页不展示全局导航。

内容用auto-layout，字段/段落按宽度换行；长表单在710pt（有底导航628pt）视口内滚动，安全区与底导航不随内容盖住操作。按钮至少48pt，原新控件44pt触控区域；无为控制工期把长内容裁掉。正式iOS键盘抬升、焦点滚到当前字段、Done/返回与手势按原UX-CONTRACT，未在真机执行。固定样本原型不模拟实际键盘输入或声称全面无障碍通过。

## 对应关系

| PRD章节 | 代表Figma节点 | 证据边界 |
| --- | --- | --- |
| 用户目标、入口与完成结果 | [settings](https://www.figma.com/design/uHfMTb0zQWyLHw73eyyUbD?node-id=1-30), [review](https://www.figma.com/design/uHfMTb0zQWyLHw73eyyUbD?node-id=1-43), [completed](https://www.figma.com/design/uHfMTb0zQWyLHw73eyyUbD?node-id=1-201), [support](https://www.figma.com/design/uHfMTb0zQWyLHw73eyyUbD?node-id=1-229) | design-and-representative-prototype |
| 正常路径与取消 | [review](https://www.figma.com/design/uHfMTb0zQWyLHw73eyyUbD?node-id=1-43), [reauth](https://www.figma.com/design/uHfMTb0zQWyLHw73eyyUbD?node-id=1-58), [reauth-error](https://www.figma.com/design/uHfMTb0zQWyLHw73eyyUbD?node-id=1-77), [confirm-unchecked](https://www.figma.com/design/uHfMTb0zQWyLHw73eyyUbD?node-id=5-71), [confirm](https://www.figma.com/design/uHfMTb0zQWyLHw73eyyUbD?node-id=1-95), [pending](https://www.figma.com/design/uHfMTb0zQWyLHw73eyyUbD?node-id=1-143), [processing](https://www.figma.com/design/uHfMTb0zQWyLHw73eyyUbD?node-id=1-156), [completed](https://www.figma.com/design/uHfMTb0zQWyLHw73eyyUbD?node-id=1-201) | design-and-representative-prototype |
| 同步受理屏障：不允许延期执行的内容 | [barrier-failed](https://www.figma.com/design/uHfMTb0zQWyLHw73eyyUbD?node-id=1-113), [pending](https://www.figma.com/design/uHfMTb0zQWyLHw73eyyUbD?node-id=1-143) | design-and-representative-prototype |
| 最小回执、失败与恢复 | [unknown](https://www.figma.com/design/uHfMTb0zQWyLHw73eyyUbD?node-id=1-128), [query-failed](https://www.figma.com/design/uHfMTb0zQWyLHw73eyyUbD?node-id=1-171), [needs-support](https://www.figma.com/design/uHfMTb0zQWyLHw73eyyUbD?node-id=1-186), [receipt-unavailable](https://www.figma.com/design/uHfMTb0zQWyLHw73eyyUbD?node-id=1-276) | design-and-representative-prototype |
| 公开支持出口与返回 | [support](https://www.figma.com/design/uHfMTb0zQWyLHw73eyyUbD?node-id=1-229), [support-copied](https://www.figma.com/design/uHfMTb0zQWyLHw73eyyUbD?node-id=1-246), [support-return](https://www.figma.com/design/uHfMTb0zQWyLHw73eyyUbD?node-id=1-261) | design-and-representative-prototype |
| 权限、平台与不做 | [pending](https://www.figma.com/design/uHfMTb0zQWyLHw73eyyUbD?node-id=1-143), [completed](https://www.figma.com/design/uHfMTb0zQWyLHw73eyyUbD?node-id=1-201), [support](https://www.figma.com/design/uHfMTb0zQWyLHw73eyyUbD?node-id=1-229) | design-and-representative-prototype |

Demo场景按对应PM coverage逐条引用；技术条款、真实服务和原文documented-only仍属合同，不因为新增画板改称已交互实现。

## 关键交互与恢复

删除影响可滚动读完，Keep my account未提交不写。重新认证属于原身份；错误/超过5分钟返回同删除意图，不能自动发送。认证返回`confirm-unchecked`，原确认控件勾选后才到可Request的样本；不以页面到达当作同意。

同步屏障全成功才202：撤全部业务会话/联系和群区间、未开始主持取消/参与退出/待审撤回、公开投影隐藏、privacy epoch及旧快照/导出撤销、AI偏好/上下文失效、删除作业同事务。失败全部回滚且明确未受理；不删已经开始饭局的其他人资格。字段/锁/256-bit receipt安全存储为技术合同，画布不冒充已实现。

受理后只凭预存私密receipt显示最小Pending/Processing/Needs support/Completed，不返回业务登录。Check progress仅为预设服务状态，不保证某次查询就完成；真实状态由后台决定。丢202先查原次，查询失败保凭据，丢receipt仍可未登录找支持；完成步骤不回滚，未批准真实保留/恢复政策不得宣称完成。

支持地址沿原PRD；Copy/Open mail composer均为原型结果示意，不执行真实剪贴板/发信。mailto正式只带邮箱，不能带receipt/验证码/私密资料。公开reference只定位，不授权读写。回支持/状态不声称已发送或已解决，所有状态不恢复账号。

## 验证与版本边界

已实际创建并读回该独立文件；检查原型起点、同页目标存在、代表正常路径及恢复跳转、Arial字体、固定宽度和文字横向边界。当前18个代表状态；数量只定位，不作覆盖率。实际截图检查及PNG证据保存在本目录，已发现并修正的导航/按钮/选择控件问题不隐藏。

原型是Figma固定样本状态导航，完整动态校验/异步幂等/跨设备状态不是其执行能力；真实生产状态不得由预设下一屏推断。未执行浏览器中逐个点击的原型回放、任意输入、真实iOS、安全存储、读屏、模型或服务集成。结构和截图验证不是独立QA。

API未提供保存原生命名版本的能力，因此`UX-r01`为仓库候选修订，Figma文件仍可编辑，**不是原生版本ID或已冻结版本**。manifest中的输入hash与`figma-readback.json`快照hash定位本次交付；后续变更需回本owner更新映射/快照，不能静默替换已审稿。Owner未批准，RD/QA仍未启动。
