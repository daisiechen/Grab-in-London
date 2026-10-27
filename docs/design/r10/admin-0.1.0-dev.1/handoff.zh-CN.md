# ADMIN-0.1.0-dev.1 · UX-r02交接

**原MVP视觉复用候选，待PJ/Owner签收；未命名版本冻结，未启动RD实现或QA。**

[独立Figma入口](https://www.figma.com/design/EwpDxDGeTJEF3PYMYLH8eP?node-id=9-2)。被Owner否定的UX-r01只留历史，不作为本轮视觉输入或开发依据。

## 固定输入与规范

- 业务输入提交`14db53257a2b4bb7610a3afad5e1ecfd735db605`；J10 PRD `PM-r01` / Demo `PM-r02`，逐文件SHA见manifest。
- 规划采用r10稳定投影[planning-input-projection.json](planning-input-projection.json)，不hash含状态/链接的整个可变计划JSON。
- 视觉真源为原产品`admin/`源码与DESIGN/UX-CONTRACT，不是`apps/admin`实现、PM简化Demo或UX-r01。原admin最近变更提交为`a396397dddf010b6ab3c555176b5cd25732eb53a`；精确当前源SHA见[视觉源清单](../admin-0.1.0-dev.1/visual-source-manifest.json)。
- 共享[DS-0.1.0](../system/)与[Figma规范文件](https://www.figma.com/design/yUMVg2xpLXQHKPr2ZWpkO3)沿用通用语义，后台独立既有排版/字号/布局依[后台复用规范](../admin-0.1.0-dev.1/admin-standards.zh-CN.md)，不把手机组件强套后台。
- Code Connect无匹配；旧本地组件未发布、不能跨文件导入，因此按真实源码捕获层级/控件/图表SVG构造本文件原生组件与绑定token。原captured参考整页已清理，不作最终入口。

## 原生状态与原型入口

| 状态 | 节点 | 尺寸 |
| --- | --- | --- |
| overview | [9:2](https://www.figma.com/design/EwpDxDGeTJEF3PYMYLH8eP?node-id=9-2) | 1440×1407 |
| definition | [9:900](https://www.figma.com/design/EwpDxDGeTJEF3PYMYLH8eP?node-id=9-900) | 1440×1407 |
| supply | [17:830](https://www.figma.com/design/EwpDxDGeTJEF3PYMYLH8eP?node-id=17-830) | 1440×1560 |
| meal | [21:1309](https://www.figma.com/design/EwpDxDGeTJEF3PYMYLH8eP?node-id=21-1309) | 1440×1000 |
| user | [21:1843](https://www.figma.com/design/EwpDxDGeTJEF3PYMYLH8eP?node-id=21-1843) | 1440×1000 |
| revoked | [21:2375](https://www.figma.com/design/EwpDxDGeTJEF3PYMYLH8eP?node-id=21-2375) | 1440×1000 |
| recovered | [22:2620](https://www.figma.com/design/EwpDxDGeTJEF3PYMYLH8eP?node-id=22-2620) | 1440×1407 |

[场景/原条款映射](coverage.json)覆盖本旅程PM全部场景ID，[最终节点/文字/字体/原型读回](figma-readback.json)记录精确候选；没有将documented-only改称运行通过。

## 完整路径、字段、状态与权限

### 用户路径与字段

产品分析者经内部读取授权进入概览，默认最近28个London自然日（本设计视觉样例为09/21—10/18、asOf 2026-10-18T12:00Z）；日期草稿→主动应用，非法日期不得覆盖有效结果。7/28/90快捷日期；区域/来源/新老用户/交流语言/人数/预算多选，同字段OR、跨字段AND、空选全部，双语取并集去重。人数2/3/4/5/6/7+；预算[0,20]、(20,30]、(30,40]、(40,+∞)、未填写。来源/新老分群/快捷日期在PM Demo明确documented-only，设计沿用原后台实际控件补足规范，不删除这些条款。

概览保留weekly去重userId含host、同周多场一次，14天激活和30天另一场再赴约；观察中单列、零分母—。激活先取全历史首次申请再按申请日入组，观察满连续14天；再赴约先取全历史首次有效出席，再看另一mealId在(0,30天]。本人出席优先、host补缺，unknown不是absent；来源差异保留。浏览/曝光/详情非严格嵌套；申请轮次/人数/场次/事件单位分开，适用成熟窗口及取消/拒绝/撤回分母按PRD与采集v4。

正常原型：概览weekly→同一口径抽屉→来源供需列表→首行M-062→U-002业务历史→返回原饭局/来源。M-062/U-002从原admin实际浏览器逐层读回，含host及相关饭局，不将PM简化Demo里的M-102/U-101与原视觉样例硬拼同一条记录。设计样例数值来自原Demo；业务规则、角色与数据投影以冻结PRD为准，样本数值不要求两个独立fixture相同。

### 读取、返回与恢复

snapshotId/asOf/definitionVersion/已应用查询在原小字元信息及抽屉位置补齐，不能把不同快照/分母拼在一起。搜索与真实日期排序为本页状态，6条分页、切查询回第一页、边界禁用；仅待补列表过滤不改上方聚合分母。日期/业务筛选/语言持URL；中英切换保页面/日期/业务筛选/搜索/排序。关闭/Escape回触发控件，逐层返回保原查询。

401认证回原查询并重验；403清受限数据；410清旧图/明细/票据，恢复必须新有效快照（原型01→02，旧页不复活）；429按等待后人工重试，503保查询。来源缺失显示未就绪，不用fixture填真实缺口。分析者无出席纠错/分类写权限，也不读姓名邮箱、聊天/留言、公评正文或单方再约。导出实现归dev.2/J11；dev.1保留原按钮位置但禁用，不提前冒称可导出。

### 场景表达与不做

完整正常路径及410恢复有可点击固定状态；任意筛选、全错误矩阵、locale和各指标定义复用原控件与状态契约，不复制五页×四宽度×每种错误。原Source/新老分群、全生产算法、创建attemptId/审核分布、真实身份和采集仍为有效规范。J12专门体验留存页后置；原侧栏可见历史位置没有本轮原型动作，不称已交付该页。不扩因果AI、财务、商家或移动Web。

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

A01：9:744打开38:2745筛选草稿，39:3724应用当前代表28天范围、38:3319取消，回9:2后口径/来源沿同一查询。代表日期为09/21—10/18与全部筛选；任意输入与其它值组合仍为合同，不伪造任意筛选已运行。snapshot02经22:2640/22:2643读取38:3328口径，关闭回22:2620；尚无02来源明细，因此禁用此项，不返回01。

原生读回见evidence/r11-recovery-readback.json；已实际截图核对新筛选/新意图/新回执。最终独立Presentation复验由PJ完成；本作者不签收自己。文件仍可变、未Owner冻结，未启动实现或QA。

A01选择步骤补充：38:2745初始应用禁用；点击28天/日期→42:3547已选择态，42:3683应用回9:2。该代表选择当前28天范围，任意范围仍属实现合同。
