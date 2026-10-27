# J06 提交或更新一份产品意见 · UX-r01候选

唯一作者：UX-1。只交本旅程iOS设计；用户本轮已授权UX，RD/QA未启动。待Owner审阅，不声明独立QA通过、产品发布或Figma原生命名版本冻结。

[打开独立Figma](https://www.figma.com/design/QtSQYeOiYwVn22lndw8uMz?node-id=1-30) · [打开原型](https://www.figma.com/proto/QtSQYeOiYwVn22lndw8uMz?node-id=1-30&starting-point-node-id=1-30) · [需求对应](coverage.json) · [实际节点/连线读回](figma-readback.json)

## 固定输入与范围

PRD：`PM-r01`，Demo：`PM-r02`，输入提交`14db53257a2b4bb7610a3afad5e1ecfd735db605`。原文件及SHA256见manifest；PM原文、Demo未改。本次设计不改变原需求批准规则；原条款/未决事项仍以同版PRD和PM coverage为准。

不做：不新增问题、长自由文本、公开结果、饭局评分或J12分析页面；不做移动Web。

## 视觉、组件与平台

沿用`demo/DESIGN.md`、`demo/UX-CONTRACT.md`与`docs/design/brand-direction.zh-CN.md`的森林绿#123f35、正文#10241f、底色#f5f6f1、peach#ffb49b、Arial字族及原控件圆角/尺度。已只读检查旧用户端Figma `UNNhbMSEbFVxbRPgV3cuiX`。旧组件/变量跨文件导入实际not found，目标库检索无Fancy对应组件，故按原规范建立最小本地Button/Field/Navigation及同值变量/文字样式；没有发布或改写旧库。

画板390×844，顶部安全区44、导航栏56、底部安全区34。适用根页保留Discover/Meals/53pt中心Create meal/Inbox/Profile导航；图标来自原App NavGlyph与现有Radix SVG，不留Unicode占位。跨旅程tab仅保留既有导航表达和目标归属，不在本文件扩展其他旅程。认证、编辑和删除受理后的业务受限页不展示全局导航。

内容用auto-layout，字段/段落按宽度换行；长表单在710pt（有底导航628pt）视口内滚动，安全区与底导航不随内容盖住操作。按钮至少48pt，原新控件44pt触控区域；无为控制工期把长内容裁掉。正式iOS键盘抬升、焦点滚到当前字段、Done/返回与手势按原UX-CONTRACT，未在真机执行。固定样本原型不模拟实际键盘输入或声称全面无障碍通过。

## 对应关系

| PRD章节 | 代表Figma节点 | 证据边界 |
| --- | --- | --- |
| goal | [settings](https://www.figma.com/design/QtSQYeOiYwVn22lndw8uMz?node-id=1-30), [survey](https://www.figma.com/design/QtSQYeOiYwVn22lndw8uMz?node-id=1-43), [saved](https://www.figma.com/design/QtSQYeOiYwVn22lndw8uMz?node-id=1-156), [settings-saved](https://www.figma.com/design/QtSQYeOiYwVn22lndw8uMz?node-id=1-188) | design-and-representative-prototype |
| survey | [survey](https://www.figma.com/design/QtSQYeOiYwVn22lndw8uMz?node-id=1-43), [selected](https://www.figma.com/design/QtSQYeOiYwVn22lndw8uMz?node-id=1-69), [yes-selected](https://www.figma.com/design/QtSQYeOiYwVn22lndw8uMz?node-id=1-93), [no-selected](https://www.figma.com/design/QtSQYeOiYwVn22lndw8uMz?node-id=1-116), [yes-only](https://www.figma.com/design/QtSQYeOiYwVn22lndw8uMz?node-id=3-88), [no-reason](https://www.figma.com/design/QtSQYeOiYwVn22lndw8uMz?node-id=4-79), [saved](https://www.figma.com/design/QtSQYeOiYwVn22lndw8uMz?node-id=1-156), [saved-yes](https://www.figma.com/design/QtSQYeOiYwVn22lndw8uMz?node-id=1-172), [saved-no](https://www.figma.com/design/QtSQYeOiYwVn22lndw8uMz?node-id=1-140), [saved-yes-only](https://www.figma.com/design/QtSQYeOiYwVn22lndw8uMz?node-id=3-107), [saved-no-reason](https://www.figma.com/design/QtSQYeOiYwVn22lndw8uMz?node-id=4-116), [empty-error](https://www.figma.com/design/QtSQYeOiYwVn22lndw8uMz?node-id=1-203) | design-and-representative-prototype |
| recovery | [save-failed](https://www.figma.com/design/QtSQYeOiYwVn22lndw8uMz?node-id=1-218), [unknown](https://www.figma.com/design/QtSQYeOiYwVn22lndw8uMz?node-id=1-236) | design-and-representative-prototype |
| privacy | [saved](https://www.figma.com/design/QtSQYeOiYwVn22lndw8uMz?node-id=1-156), [settings-saved](https://www.figma.com/design/QtSQYeOiYwVn22lndw8uMz?node-id=1-188) | design-and-representative-prototype |
| demo | [settings](https://www.figma.com/design/QtSQYeOiYwVn22lndw8uMz?node-id=1-30), [survey](https://www.figma.com/design/QtSQYeOiYwVn22lndw8uMz?node-id=1-43), [saved](https://www.figma.com/design/QtSQYeOiYwVn22lndw8uMz?node-id=1-156) | design-and-representative-prototype |
| shared-contracts |  | documented-only-contract |

Demo场景按对应PM coverage逐条引用；技术条款、真实服务和原文documented-only仍属合同，不因为新增画板改称已交互实现。

## 关键交互与恢复

原问题保持again=true/false/null，不默认Yes，未答不是No；七原因company/conversation/coordination/expectations/venue/cost/other多选，至少回答一部分才可存。清除again保reason仍能保存，只答Yes/No且无reason也可保存。取消回最近确认值，不进行自动代答。

代表原型直接点击Yes/No/Not answered与Conversation原控件，不存在额外Choose演示按钮。三态切换保留Conversation，取消该原因不清again；其余六理由的44pt控件及多选契约已设计，任意组合不在本固定样本原型执行。Saved→Settings→View代表重新读最近确认结果；不同预设场景须从目录单独进入，原型不是全局动态持久状态机。

这是用户级产品问卷，任何已登录本人都可作答，无mealId、出席或饭后7天门槛。失败保选择，未知先查原次，按userId最新版本更新且不重复记人。账号失效/切换/删除不得泄露私密答案。后台asOf先取每人最新有效版本，再按submittedAt纳日期；不套饭局区域/预算等筛选，不把再约/单场私评分推为产品态度。

## 验证与版本边界

已实际创建并读回该独立文件；检查原型起点、同页目标存在、代表正常路径及恢复跳转、Arial字体、固定宽度和文字横向边界。当前16个代表状态；数量只定位，不作覆盖率。实际截图检查及PNG证据保存在本目录，已发现并修正的导航/按钮/选择控件问题不隐藏。

原型是Figma固定样本状态导航，完整动态校验/异步幂等/跨设备状态不是其执行能力；真实生产状态不得由预设下一屏推断。未执行浏览器中逐个点击的原型回放、任意输入、真实iOS、安全存储、读屏、模型或服务集成。结构和截图验证不是独立QA。

API未提供保存原生命名版本的能力，因此`UX-r01`为仓库候选修订，Figma文件仍可编辑，**不是原生版本ID或已冻结版本**。manifest中的输入hash与`figma-readback.json`快照hash定位本次交付；后续变更需回本owner更新映射/快照，不能静默替换已审稿。Owner未批准，RD/QA仍未启动。
