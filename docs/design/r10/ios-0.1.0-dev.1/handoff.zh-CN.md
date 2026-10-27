# IOS-0.1.0-dev.1 · J01 + J05 UX-r03候选

[Figma J01入口](https://www.figma.com/design/CS9oRCq8h3Clg09up2aISj?node-id=5-17) · [J05入口](https://www.figma.com/design/CS9oRCq8h3Clg09up2aISj?node-id=11-1513) · [DS](../system/handoff.zh-CN.md) · [逐项覆盖](coverage.json) · [状态与恢复](states.zh-CN.md)

本候选忠实复用原MVP v13的地图、餐厅实图、头像、欢迎插画、卡片密度、五项底导航、浮动助手、sheet和表单。业务依据确认的J01 PM-r01/Demo PM-r02与J05 PM-r02/Demo PM-r02；不恢复支付/平台订位/移动Web。旧UX-r01候选已被否定，不是本版基线。DS-0.1.0副本来源见manifest；未发布组件库，不假称live同步。

## 1. 可点击的代表路径

J01在0:1页面：Discover5:17→整卡详情5:195→Apply→账号10:65→邮箱5:355→验证码10:134→资料10:236→选择已填代表值10:375（未勾）→本人明确同意27:132→同mealId申请11:753→本人勾安排12:474→主动Send→Pending11:978→撤回确认11:2510→Withdrawn11:1191→可重新申请。登录模式13:107→邮箱13:174→验证码13:220直接回原申请，不重复资料。欢迎10:17既可注册也可先浏览。验证码失败10:184保留改邮箱/重发入口；过滤sheet11:2590复用原日期面板。

AI从详情原浮动入口到许可12:313，拒绝转手动申请；允许进入未发送的原助手home33:152→本人准备输入33:285→主动Send才展示原助手真实源草稿12:97，点击Edit application→Keep/Replace12:574。Keep保留原人工稿；Replace到15:212原申请编辑器，安排仍未勾选；本人勾选→15:308，最后手动Send才到Pending。生成/转入均不创建申请，不自动同意安排。

J05在9:17页面：本人Profile11:1513→编辑11:1611→Save回确认投影；Back取消。Settings11:1753含原隐私边界与新增同样式可选统计草稿/独立Save，确认值终点12:882。原Ask Fancy→home11:2113→My preferences11:1854→明确可见六字段提议31:257→本人Confirm才到11:1982→Delete确认13:355，取消保值、确认回无偏好。原自然语言输入/六字段summary继续沿用，不改成六个新下拉表单。退出11:2408可取消，确认回本页guest15:410。

Figma只允许同页NAVIGATE，两个旅程保持独立页面和起点；跨旅程请从上述对应入口切换，未假装跨页可连通。资料和偏好文字在Design文件可编辑，代表原型通过预置状态表达；任意输入/任意筛选组合、网络、OAuth提供方系统页、真实保存和权限不是Figma可执行服务。coverage明确区分interactive-representative与specified，不称每条规则都被可点击模拟。

## 2. 与原MVP的必要差异

| 差异 | 原因与保留样式 |
|---|---|
| 详情去订金/退款/平台预约文案，改host外订/到店各付 | 当前批准业务范围；保留原restaurant/cost信息行和notice |
| 申请显式安排checkbox、待审撤回确认 | PRD要求用户主动同意和可取消；沿原create-consent与原Sign out bottom-sheet |
| AI使用前数据许可、Keep/Replace | 业务权限/稿保护；沿原helper consent与确认sheet；保留人工提交 |
| 偏好明确账号持久、保存不重置当前搜索 | J05确认合同；沿原My preferences文本框/summary/Save，不沿旧session-only/reset-copy |
| 统计选择有草稿和单独保存、失败不称成功 | 沿原Settings行、toggle和Save link；细节见状态表 |
| CSS伪元素toggle thumb与分拆inline文本还原 | 源DOM到原生节点的必要恢复，不改原设计；实际截图纠正了窄标签/重叠 |

其余设计按原规范；源样本固定23Oct是v13演示内容，不宣称当前仍可申请，生产资格在每次详情/转入/提交按伦敦时间重验。场景间是设计样例，不发生真实业务。

## 3. 可审状态及验证

已实际打开原Demo正常旅程取图，三屏同态对照获PJ方向认可；最终截图核对申请checkbox与手动Send、许可、Keep/Replace、撤回/删除确认和六字段偏好，修复长文案、浅分隔线与箭头方向。evidence/final-readback.json是停止画布后实际节点/原型读回；图片仅允许原6个内容资产hash，无整屏UI截图填充。

状态表覆盖各关键权限、失败保稿、409权威版本、UNKNOWN、AI hard/soft/CLEAR、取消/生命周期；未把这些全量组合机械画屏。本轮是完整设计候选待Owner审阅，未获最终冻结/Logo替换批准。真实iOS、后端、邮件/OAuth、AI供应方/费用和独立QA由后续阶段验证，本轮未启动；不得把本轮作者检查当真机/服务验收。

本版r11独立评审修复详见[r11定向修复](r11-repair.zh-CN.md)：统计draft/save/cancel/重入、Pending返回与Inbox找回等现行节点以该记录为准。作者不自签；各版独立推进，不再以全套Figma Ready为本版方案前提。

独立复验结果：PJ-IOS2已在r11独立评审记录签署design-scope-recheck-passed（01/02/03/04/05/07关闭，06原可见性指控撤回），版本现已进入本版方案准备。现行推进状态见版本工作台；原作者manifest保留交复验时快照，不把其requested字段误作现行状态。
