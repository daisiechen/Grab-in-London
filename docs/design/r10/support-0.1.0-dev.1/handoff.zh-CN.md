# SUPPORT-0.1.0-dev.1 · UX-r02交接

**原MVP视觉复用候选，待PJ/Owner签收；未命名版本冻结，未启动RD实现或QA。**

[独立Figma入口](https://www.figma.com/design/mCBDxN4qzTbCGCx9UIPbwW?node-id=3-430)。被Owner否定的UX-r01只留历史，不作为本轮视觉输入或开发依据。

## 固定输入与规范

- 业务输入提交`14db53257a2b4bb7610a3afad5e1ecfd735db605`；J09 PRD `PM-r01` / Demo `PM-r02`，逐文件SHA见manifest。
- 规划采用r10稳定投影[planning-input-projection.json](planning-input-projection.json)，不hash含状态/链接的整个可变计划JSON。
- 视觉真源为原产品`admin/`源码与DESIGN/UX-CONTRACT，不是`apps/admin`实现、PM简化Demo或UX-r01。原admin最近变更提交为`a396397dddf010b6ab3c555176b5cd25732eb53a`；精确当前源SHA见[视觉源清单](../admin-0.1.0-dev.1/visual-source-manifest.json)。
- 共享[DS-0.1.0](../system/)与[Figma规范文件](https://www.figma.com/design/yUMVg2xpLXQHKPr2ZWpkO3)沿用通用语义，后台独立既有排版/字号/布局依[后台复用规范](../admin-0.1.0-dev.1/admin-standards.zh-CN.md)，不把手机组件强套后台。
- Code Connect无匹配；旧本地组件未发布、不能跨文件导入，因此按真实源码捕获层级/控件/图表SVG构造本文件原生组件与绑定token。原captured参考整页已清理，不作最终入口。

## 原生状态与原型入口

| 状态 | 节点 | 尺寸 |
| --- | --- | --- |
| case | [3:430](https://www.figma.com/design/mCBDxN4qzTbCGCx9UIPbwW?node-id=3-430) | 1440×1000 |
| active | [3:526](https://www.figma.com/design/mCBDxN4qzTbCGCx9UIPbwW?node-id=3-526) | 1440×1000 |
| correction | [3:610](https://www.figma.com/design/mCBDxN4qzTbCGCx9UIPbwW?node-id=3-610) | 1440×1000 |
| window | [3:707](https://www.figma.com/design/mCBDxN4qzTbCGCx9UIPbwW?node-id=3-707) | 1440×1000 |
| impact | [3:781](https://www.figma.com/design/mCBDxN4qzTbCGCx9UIPbwW?node-id=3-781) | 1440×1000 |
| reply | [3:867](https://www.figma.com/design/mCBDxN4qzTbCGCx9UIPbwW?node-id=3-867) | 1440×1000 |
| replied | [3:936](https://www.figma.com/design/mCBDxN4qzTbCGCx9UIPbwW?node-id=3-936) | 1440×1000 |
| replyonly | [3:1037](https://www.figma.com/design/mCBDxN4qzTbCGCx9UIPbwW?node-id=3-1037) | 1440×1000 |
| replyonlydone | [3:1104](https://www.figma.com/design/mCBDxN4qzTbCGCx9UIPbwW?node-id=3-1104) | 1440×1000 |
| conflict | [3:1150](https://www.figma.com/design/mCBDxN4qzTbCGCx9UIPbwW?node-id=3-1150) | 1440×1000 |
| denied | [3:1239](https://www.figma.com/design/mCBDxN4qzTbCGCx9UIPbwW?node-id=3-1239) | 1440×1000 |

[场景/原条款映射](coverage.json)覆盖本旅程PM全部场景ID，[最终节点/文字/字体/原型读回](figma-readback.json)记录精确候选；没有将documented-only改称运行通过。

## 完整路径、字段、状态与权限

### 一次个案操作

经内部身份/MFA及caseId范围授权的support打开指定事项，核对最小事实→开始处理→适用逾期支持纠错或仅回复→检查资格/新统计→提交者可见结论与审计。正式能力可由受限CLI/API实现，Figma只是最小个案工具示意，不新增客服导航、全量队列或任意用户搜索。源admin没有此案业务屏，因此视觉对照为原Panel/字段/NativeSelect/38px按钮和顶栏规范，不声称复刻已有支持页面。

逐次重验case授权/角色/MFA；analyst、失权或未取得本案权限拒读拒写并清受限内容，知道caseId不授予读取权。支持只看本案必要报告/名单/场次/版本，不看全量聊天、公评正文或单方意愿。普通举报/删除支持可以仅回复，删除执行归J08；仅回复路径终点只有REPLY，不制造CORR。

### 精确纠错字段及窗口

以权威scheduledEndAt，窗口[scheduledEndAt,scheduledEndAt+7天)，按连续UTC时长；前1ms拒绝，恰满7天可逾期支持修订。对象在开始名单、场次未取消，名单含host及开始前确认且未提前或恰好开始退出者。核mealId/subjectId、原本人/host报告、名单、取消事实、期望版本；present/absent明确值、非空reason、case/actor/time/revision/幂等关联，追加SUPPORT修订，不覆盖原报告、不设verified第四状态、不SQL直改。

本例与PM Demo一致：self absent、host present，原有效absent；支持核对仍absent，影响继续不适用，不能虚构这次从可用变失效。有效支持修订优先，其后self、host、unknown。适用absent使公评不公开、体验排除，仅依赖本场的联系暂停新发送但历史保留；其他有效共同场次及双方有效同意维持，恢复不复活已撤回/拉黑同意。普通纠错新snapshot，旧asOf保持；隐私撤销归J08/J11。

### 取消、失败与回复

取消不写；409加载合法当前revision和事实、保原因/选择，本人确认新意图；确定失败保稿明确未执行；Unknown先查原幂等结果不追加第二条。publicOutcome非空、纯文本、仅提交者可见最小结论/下一步，失败不标Replied；受理/开始/修订/实际回复分开。父源报告/操作者/原因/时间/原意图审计保留。真实MFA、锁/事务、可靠跨服务传播、时钟与跨场恢复留后续候选验证，命令退出0不能当传播验收。

支持界面按原后台紧凑字段/Panel/焦点/长文规则；移动断点顺序堆叠字段，表格自身滚动。主路径、精确窗口拒绝、409和失权有固定状态，其余必要恢复用共享状态契约，不复制每页每错误。

## 同态视觉核对与必要差异

- 原admin概览/口径抽屉已真实打开并截图，与新稿同视口对照；PJ已实际查看这组PNG并确认视觉方向保留原信息密度、侧栏、筛选、图表及抽屉层级。对照位于dev.1/evidence的source-overview、figma-overview、source-drawer、figma-drawer。
- 228px浅侧栏、69px顶栏、三指标卡及1.85:1趋势/覆盖布局、SVG图表/图标、14px面板和紧凑原生控制保留；Support最小个案按相同字段/Panel/38px按钮规范，不生成客服产品。
- 规则补全仅补当前版本必要的快照/asOf/口径/查询元信息、分类原因/subject版本/原次结果和状态禁用。J10 dev.1导出入口保留原位置但不提前启用；J12专门页未签发。
- 字体转译差异已记录：Linux源浏览器Arial用临时Liberation Sans度量兼容回退；Figma拉丁Arial、中文Noto Sans SC、字标Georgia。中文H1略粗于源，PJ确认可记录字体回退，不另换系统。捕获日期值缺字、花形emoji及CSS遮罩已按源补回；没有整UI截图贴图。

## 实际验证、未测与Ready核对

- 真实Chromium运行原admin纯前端临时副本，已打开概览/指标抽屉/供需/伪名饭局及用户历史；无真实API、provider或账号数据。原日期应用、中英保查询及1440/1024/864/390无整页横溢已做设计作者检查，见dev.1/source-interaction-check.json。
- 实际读回各新稿节点、文字、字体、原生组件、向量和原型目标；缺失NODE目标0。逐包截图已实际查看。原型采用固定样例，未在Figma Presentation真实点击全部分支，未执行任意输入、真机、读屏或新字段四宽度运行检查。共享响应式/键盘/状态规则仍有效，不宣称上述全部已通过。
- 截图证明可见状态、图层读回证明原生结构、原型目标读回证明连线存在；均不证明真实后端、MFA、任务、CSV下载、隐私传播或独立QA通过。
- Ready待核：PJ/Owner对本UX-r02版本签收；DS-0.1.0与本轮全部迭代设计集共同Ready核对；锁定命名Figma版本或明确可审阅节点快照/文件hash。当前文件仍可变、namedVersionId为空，不伪造冻结。
- 全套初始设计门槛及精确模块owner/文件租约/接口和隔离环境预检齐备前，不启动任何RD实现（含共享骨架）；QA与发布未获本轮启动。真实服务门槛属于后续相应专业证据，不借设计自检关闭。
- 唯一作者UX-3，白名单为本目录及tests/test_ux_r10_admin_support.py；不改PM/原Demo/旧Figma/UX-r01/业务代码/全局管理文件，不操作Git索引。

## r11 定向恢复修订（候选）

S01：3:1150保留当前revision2、本地absent与原因→14:360本人核对self absent/host present、有效absent、7天/权限等→主动确认14:430追加CORR-2/expectedVersion2→revision3；取消14:395保持revision2。原报告不覆盖、仍absent继续不适用；新分支止于修订回执，回复尚未保存，不串回CORR-1旧回复。

原生读回见evidence/r11-recovery-readback.json；已实际截图核对新筛选/新意图/新回执。最终独立Presentation复验由PJ完成；本作者不签收自己。文件仍可变、未Owner冻结，未启动实现或QA。
