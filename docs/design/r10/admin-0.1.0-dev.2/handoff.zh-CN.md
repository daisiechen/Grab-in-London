# ADMIN-0.1.0-dev.2 · UX-r02交接

**原MVP视觉复用候选，待PJ/Owner签收；未命名版本冻结，未启动RD实现或QA。**

[独立Figma入口](https://www.figma.com/design/gin01YJX9boaVymXsm1zJg?node-id=6-430)。被Owner否定的UX-r01只留历史，不作为本轮视觉输入或开发依据。

## 固定输入与规范

- 业务输入提交`14db53257a2b4bb7610a3afad5e1ecfd735db605`；J11 PRD `PM-r01` / Demo `PM-r02`，逐文件SHA见manifest。
- 规划采用r10稳定投影[planning-input-projection.json](planning-input-projection.json)，不hash含状态/链接的整个可变计划JSON。
- 视觉真源为原产品`admin/`源码与DESIGN/UX-CONTRACT，不是`apps/admin`实现、PM简化Demo或UX-r01。原admin最近变更提交为`a396397dddf010b6ab3c555176b5cd25732eb53a`；精确当前源SHA见[视觉源清单](../admin-0.1.0-dev.1/visual-source-manifest.json)。
- 共享[DS-0.1.0](../system/)与[Figma规范文件](https://www.figma.com/design/yUMVg2xpLXQHKPr2ZWpkO3)沿用通用语义，后台独立既有排版/字号/布局依[后台复用规范](../admin-0.1.0-dev.1/admin-standards.zh-CN.md)，不把手机组件强套后台。
- Code Connect无匹配；旧本地组件未发布、不能跨文件导入，因此按真实源码捕获层级/控件/图表SVG构造本文件原生组件与绑定token。原captured参考整页已清理，不作最终入口。

## 原生状态与原型入口

| 状态 | 节点 | 尺寸 |
| --- | --- | --- |
| edit | [6:430](https://www.figma.com/design/gin01YJX9boaVymXsm1zJg?node-id=6-430) | 1440×1000 |
| unknown | [6:775](https://www.figma.com/design/gin01YJX9boaVymXsm1zJg?node-id=6-775) | 1440×1000 |
| pending | [6:1032](https://www.figma.com/design/gin01YJX9boaVymXsm1zJg?node-id=6-1032) | 1440×1000 |
| failed | [6:1287](https://www.figma.com/design/gin01YJX9boaVymXsm1zJg?node-id=6-1287) | 1440×1000 |
| ready | [6:1544](https://www.figma.com/design/gin01YJX9boaVymXsm1zJg?node-id=6-1544) | 1440×1000 |
| export | [6:1840](https://www.figma.com/design/gin01YJX9boaVymXsm1zJg?node-id=6-1840) | 1440×1000 |
| download | [6:2127](https://www.figma.com/design/gin01YJX9boaVymXsm1zJg?node-id=6-2127) | 1440×1000 |
| oldexport | [6:2418](https://www.figma.com/design/gin01YJX9boaVymXsm1zJg?node-id=6-2418) | 1440×1000 |
| revoked | [6:2675](https://www.figma.com/design/gin01YJX9boaVymXsm1zJg?node-id=6-2675) | 1440×1000 |
| privacyready | [6:2932](https://www.figma.com/design/gin01YJX9boaVymXsm1zJg?node-id=6-2932) | 1440×1000 |
| conflict | [6:3187](https://www.figma.com/design/gin01YJX9boaVymXsm1zJg?node-id=6-3187) | 1440×1000 |
| cancelled | [6:3479](https://www.figma.com/design/gin01YJX9boaVymXsm1zJg?node-id=6-3479) | 1440×1000 |
| denied | [6:3732](https://www.figma.com/design/gin01YJX9boaVymXsm1zJg?node-id=6-3732) | 1440×1000 |

[场景/原条款映射](coverage.json)覆盖本旅程PM全部场景ID，[最终节点/文字/字体/原型读回](figma-readback.json)记录精确候选；没有将documented-only改称运行通过。

## 完整路径、字段、状态与权限

### 分类字段与角色

入口沿原“数据与定义”的统计账号分类Panel。仅data-admin核对稳定userId、确认分类regular/test/staff及expectedVersion；新分类只能合法枚举，非空理由必填，无变化不产生修订，取消恢复确认值。设计用U-203、regular/revision1→test/revision2；理由为“排除试点测试账号”。分析者只读，失权后受限入口/结果/下载重验，界面隐藏不当服务端授权。

每次修改绑定actor+subject+原意图+expectedVersion。Unknown显示INTENT-1、保对象/原因，先查询原次，不重发新的分类催结果。409必须读同subject的合法当前值/版本，理由与选择保留，本人核对后新意图；不借其他用户更大revision或全局最新快照推断本次成功。确定未受理失败保稿，429遵守等待，503保查询。

### 分类、统计与导出的状态

READY可核对并主动保存；UNKNOWN停旧统计/下钻/导出并查原次；ACCEPTED/PENDING明确分类已接受但统计未完成；FAILED不回滚已接受分类、仅重试统计，不重复保存；READY新快照必须覆盖该subject已接受revision并仍具角色/隐私权限；REVOKED清旧缓存和票据。顶部原“导出指标”与下方入口同门槛，Unknown/Pending/Failed/Revoked均不可执行，不只禁一个按钮。

test/staff事件、申请、参与和反馈不计正式统计，其host场次整场排除；正式host场测试成员不计，招募peak按正式席位事件重建，不改业务权限/成团/取消事实。保操作者、原因、时间、版本、原意图审计。小时任务、MVCC、MFA/epoch/事务不由原型执行。

页面/明细/CSV同snapshotId、asOf、definitionVersion和已应用范围。普通分类/纠错生成新快照不改旧字节；隐私删除才撤销受影响旧snapshot与旧导出。旧记录可追踪，但每次读取和下载重验；新快照可用也不复活旧票据，已下载磁盘字节无法远程撤回。

CSV仅当前允许聚合指标、分子/分母、单位与快照/口径/筛选元数据，防公式注入；不含姓名邮箱、消息、评价正文、留言、单方意愿或原始个人明细。票据生成≠真实下载完成：Figma终点明确为“CSV可供下载”，没有假装后台任务或本地文件已产生。实际PM合成下载与后续真实服务分别取证。取消/日期草稿/非法校验/URL/locale/分页/焦点沿dev.1共享契约。

### 原型与共享变体

主路径edit→Unknown→查原次→Pending→统计失败→仅重试统计→Ready新快照→生成票据→可下载；另有旧导出→撤销→新有效快照→旧票据仍拒读。409/分析者禁写/取消有固定状态；普通失败、任意输入与完整错误矩阵使用共享控件/状态表，不误称全可运行。不扩分类自动化、员工权限系统、财务/客服或个人全量导出。

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
