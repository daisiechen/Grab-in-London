# J05 更新个人介绍或隐私选择 · UX-r01候选

唯一作者：UX-1。只交本旅程iOS设计；用户本轮已授权UX，RD/QA未启动。待Owner审阅，不声明独立QA通过、产品发布或Figma原生命名版本冻结。

[打开独立Figma](https://www.figma.com/design/PGPxBMvSWo7B2feTEapLow?node-id=1-30) · [打开原型](https://www.figma.com/proto/PGPxBMvSWo7B2feTEapLow?node-id=1-30&starting-point-node-id=1-30) · [需求对应](coverage.json) · [实际节点/连线读回](figma-readback.json)

## 固定输入与范围

PRD：`PM-r02`，Demo：`PM-r02`，输入提交`14db53257a2b4bb7610a3afad5e1ecfd735db605`。原文件及SHA256见manifest；PM原文、Demo未改。本次设计不改变原需求批准规则；原条款/未决事项仍以同版PRD和PM coverage为准。

不做：不复制注册旅程，不新增头像上传、隐藏画像、账号删除、问卷内容、隐私管理平台或移动Web。

## 视觉、组件与平台

沿用`demo/DESIGN.md`、`demo/UX-CONTRACT.md`与`docs/design/brand-direction.zh-CN.md`的森林绿#123f35、正文#10241f、底色#f5f6f1、peach#ffb49b、Arial字族及原控件圆角/尺度。已只读检查旧用户端Figma `UNNhbMSEbFVxbRPgV3cuiX`。旧组件/变量跨文件导入实际not found，目标库检索无Fancy对应组件，故按原规范建立最小本地Button/Field/Navigation及同值变量/文字样式；没有发布或改写旧库。

画板390×844，顶部安全区44、导航栏56、底部安全区34。适用根页保留Discover/Meals/53pt中心Create meal/Inbox/Profile导航；图标来自原App NavGlyph与现有Radix SVG，不留Unicode占位。跨旅程tab仅保留既有导航表达和目标归属，不在本文件扩展其他旅程。认证、编辑和删除受理后的业务受限页不展示全局导航。

内容用auto-layout，字段/段落按宽度换行；长表单在710pt（有底导航628pt）视口内滚动，安全区与底导航不随内容盖住操作。按钮至少48pt，原新控件44pt触控区域；无为控制工期把长内容裁掉。正式iOS键盘抬升、焦点滚到当前字段、Done/返回与手势按原UX-CONTRACT，未在真机执行。固定样本原型不模拟实际键盘输入或声称全面无障碍通过。

## 对应关系

| PRD章节 | 代表Figma节点 | 证据边界 |
| --- | --- | --- |
| goal | [profile](https://www.figma.com/design/PGPxBMvSWo7B2feTEapLow?node-id=1-30), [profile-saved](https://www.figma.com/design/PGPxBMvSWo7B2feTEapLow?node-id=1-78), [settings](https://www.figma.com/design/PGPxBMvSWo7B2feTEapLow?node-id=1-115) | design-and-representative-prototype |
| profile | [profile](https://www.figma.com/design/PGPxBMvSWo7B2feTEapLow?node-id=1-30), [edit](https://www.figma.com/design/PGPxBMvSWo7B2feTEapLow?node-id=1-45), [profile-saved](https://www.figma.com/design/PGPxBMvSWo7B2feTEapLow?node-id=1-78), [profile-conflict](https://www.figma.com/design/PGPxBMvSWo7B2feTEapLow?node-id=1-94), [save-failed](https://www.figma.com/design/PGPxBMvSWo7B2feTEapLow?node-id=1-285) | design-and-representative-prototype |
| privacy | [settings](https://www.figma.com/design/PGPxBMvSWo7B2feTEapLow?node-id=1-115), [analytics-saved](https://www.figma.com/design/PGPxBMvSWo7B2feTEapLow?node-id=1-137), [signout](https://www.figma.com/design/PGPxBMvSWo7B2feTEapLow?node-id=1-302), [signedout](https://www.figma.com/design/PGPxBMvSWo7B2feTEapLow?node-id=1-317) | design-and-representative-prototype |
| preferences | [preferences](https://www.figma.com/design/PGPxBMvSWo7B2feTEapLow?node-id=1-151), [preferences-saved](https://www.figma.com/design/PGPxBMvSWo7B2feTEapLow?node-id=1-189), [preferences-conflict](https://www.figma.com/design/PGPxBMvSWo7B2feTEapLow?node-id=1-205), [delete-preferences](https://www.figma.com/design/PGPxBMvSWo7B2feTEapLow?node-id=1-226), [preferences-deleted](https://www.figma.com/design/PGPxBMvSWo7B2feTEapLow?node-id=1-241) | design-and-representative-prototype |
| clear | [clear](https://www.figma.com/design/PGPxBMvSWo7B2feTEapLow?node-id=1-257), [clear-next](https://www.figma.com/design/PGPxBMvSWo7B2feTEapLow?node-id=1-272) | design-and-representative-prototype |
| demo | [profile](https://www.figma.com/design/PGPxBMvSWo7B2feTEapLow?node-id=1-30), [settings](https://www.figma.com/design/PGPxBMvSWo7B2feTEapLow?node-id=1-115) | design-and-representative-prototype |
| shared-contracts |  | documented-only-contract |

Demo场景按对应PM coverage逐条引用；技术条款、真实服务和原文documented-only仍属合同，不因为新增画板改称已交互实现。

## 关键交互与恢复

公开资料编辑与AI偏好分开保存。取消回最近确认值，保存失败保稿；冲突先展示权威值和提议，复核后重新确认，不自动覆盖。资料字段长度与必填沿PRD；职业/学校/家乡可选，不索取证明。其他人不看到邮箱、AI偏好、私反馈、问卷或单方再约。

长期偏好严格六字段：区域、预算上限、含host人数、host声明饮食、交流语言、氛围；日期、时刻、菜系不是本版长期偏好。409先读权威值，明确Confirm后才存；删除旧偏好使助手上下文失效，但不删原业务编辑器草稿。偏好表单不发模型请求，模型停用不阻止读取/删除。

CLEAR及下一轮样本明确不恢复旧soft，不改Discover。New conversation清设备临时条件和助手未发文字，保留已确认账号偏好与业务稿；30分钟闲置保留未发文字和偏好但丢旧候选。退出可取消，确认清本机私密内容与旧响应，不等于删账号或删除持久偏好；远端撤销失败不能谎称全部撤销。

## 验证与版本边界

已实际创建并读回该独立文件；检查原型起点、同页目标存在、代表正常路径及恢复跳转、Arial字体、固定宽度和文字横向边界。当前16个代表状态；数量只定位，不作覆盖率。实际截图检查及PNG证据保存在本目录，已发现并修正的导航/按钮/选择控件问题不隐藏。

原型是Figma固定样本状态导航，完整动态校验/异步幂等/跨设备状态不是其执行能力；真实生产状态不得由预设下一屏推断。未执行浏览器中逐个点击的原型回放、任意输入、真实iOS、安全存储、读屏、模型或服务集成。结构和截图验证不是独立QA。

API未提供保存原生命名版本的能力，因此`UX-r01`为仓库候选修订，Figma文件仍可编辑，**不是原生版本ID或已冻结版本**。manifest中的输入hash与`figma-readback.json`快照hash定位本次交付；后续变更需回本owner更新映射/快照，不能静默替换已审稿。Owner未批准，RD/QA仍未启动。
