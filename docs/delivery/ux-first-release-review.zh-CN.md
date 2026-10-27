# 首发11旅程UX-r01历史候选（视觉方向未获接受）

> Owner已否定本批视觉方向。文件和证据保留追溯，不可作为研发设计依据。当前按[开发版本r10](development-versions-r10.zh-CN.md)复用原MVP Demo设计，补规范与路径。

输入范围r07，执行r09；仅UX设计，RD/QA未启动。用户已确认PRD和Demo为本轮输入，未提前批准UX输出。各旅程分别由唯一UX作者交付，不合并成一份大模块需求或设计文件。

候选输入提交：`14db53257a2b4bb7610a3afad5e1ecfd735db605`。逐包PRD/Demo修订、SHA256及负责人见[UX派工数据](ux-parallel-dispatch.json)，工作流和停止点见[派工说明](ux-parallel-dispatch.zh-CN.md)。

## 独立Figma入口

以下11份独立UX-r01候选已交回，PJ已逐份读取实际Figma节点、原型连线和代表截图，尚未Owner签收。每包已包含handoff、coverage、manifest和作者证据；[固定产物及PJ复核清单](ux-first-release-review.json)记录精确提交与SHA256。

| 旅程 | UX负责人 | 独立Figma设计入口 | 交付依据 |
| --- | --- | --- | --- |
| J01 找到并申请饭局 | UX-1 | [J01](https://www.figma.com/design/2JKGRfwDoZnM9Ne0b6H4Np?node-id=2-715)  [交接](../design/journeys/j01/handoff.zh-CN.md)／[映射](../design/journeys/j01/coverage.json)／[清单](../design/journeys/j01/artifact-manifest.json) |
| J02 发起饭局并招募 | UX-2 | [J02](https://www.figma.com/design/oxJEKNBSpEbwsmMKLHd7Hv?node-id=3-715)  [交接](../design/journeys/j02/handoff.zh-CN.md)／[映射](../design/journeys/j02/coverage.json)／[清单](../design/journeys/j02/artifact-manifest.json) |
| J03 沟通或调整参与 | UX-2 | [J03](https://www.figma.com/design/WeH78bY3LzZM9eSvGKI4u2?node-id=1-35)  [交接](../design/journeys/j03/handoff.zh-CN.md)／[映射](../design/journeys/j03/coverage.json)／[清单](../design/journeys/j03/artifact-manifest.json) |
| J04 饭后体验与持续联系 | UX-2 | [J04](https://www.figma.com/design/UvgjBArZae7tQuSAXu8cWA?node-id=1-35)  [交接](../design/journeys/j04/handoff.zh-CN.md)／[映射](../design/journeys/j04/coverage.json)／[清单](../design/journeys/j04/artifact-manifest.json) |
| J05 个人介绍、隐私与AI偏好 | UX-1 | [J05](https://www.figma.com/design/PGPxBMvSWo7B2feTEapLow?node-id=1-30)  [交接](../design/journeys/j05/handoff.zh-CN.md)／[映射](../design/journeys/j05/coverage.json)／[清单](../design/journeys/j05/artifact-manifest.json) |
| J06 产品意见问卷 | UX-1 | [J06](https://www.figma.com/design/QtSQYeOiYwVn22lndw8uMz?node-id=1-30)  [交接](../design/journeys/j06/handoff.zh-CN.md)／[映射](../design/journeys/j06/coverage.json)／[清单](../design/journeys/j06/artifact-manifest.json) |
| J07 举报并跟踪处理 | UX-3 | [J07](https://www.figma.com/design/tnrVOL7tRST2d67ZFFSOid?node-id=1-25)  [交接](../design/journeys/j07/handoff.zh-CN.md)／[映射](../design/journeys/j07/coverage.json)／[清单](../design/journeys/j07/artifact-manifest.json) |
| J08 删除账号及确认结果 | UX-1 | [J08](https://www.figma.com/design/uHfMTb0zQWyLHw73eyyUbD?node-id=1-30)  [交接](../design/journeys/j08/handoff.zh-CN.md)／[映射](../design/journeys/j08/coverage.json)／[清单](../design/journeys/j08/artifact-manifest.json) |
| J09 支持处理与出席纠错 | UX-3 | [J09](https://www.figma.com/design/m6kRIdrsctVT63PIN42kwD?node-id=1-25)  [交接](../design/journeys/j09/handoff.zh-CN.md)／[映射](../design/journeys/j09/coverage.json)／[清单](../design/journeys/j09/artifact-manifest.json) |
| J10 转化供需与来源追溯 | UX-3 | [J10](https://www.figma.com/design/skVbc47a4P4ygb4fxBUanJ?node-id=2-544)  [交接](../design/journeys/j10/handoff.zh-CN.md)／[映射](../design/journeys/j10/coverage.json)／[清单](../design/journeys/j10/artifact-manifest.json) |
| J11 分类、统计与可信导出 | UX-3 | [J11](https://www.figma.com/design/IHhXcDFmp4x5eOPrVW88m9?node-id=1-25)  [交接](../design/journeys/j11/handoff.zh-CN.md)／[映射](../design/journeys/j11/coverage.json)／[清单](../design/journeys/j11/artifact-manifest.json) |

## 设计与验证边界

用户端沿用Fancy原生iOS设计方向、Arial/既有色彩、53pt居中Create、安全区与导航；后台沿用既有森林绿、Georgia字标及中英内容字体/响应式。旧文件与PRD/Demo只读。旧本地组件未发布，实际跨文件导入失败，因此在独立新文件中按同值规范建立最小组件/变量，不改旧库或发布新库。

每包交付目录为`docs/design/journeys/jXX/`，包含设计交接、需求/Demo到节点映射、输入和产物清单及作者自检。设计中的交互为固定样本代表路径；不会因此宣称任意输入、身份授权、真实AI、消息/邮件、删除或CSV服务已完成。

Figma文件为UX-r01可编辑候选；当前工具不支持保存原生命名版本，未编造版本ID或冒称已冻结。后续签收/进入RD前需真实固定设计版本，当前RD/QA无启动授权。

## PJ实际复核与本轮修订

PJ逐份访问11个新文件，读回原型起点、实际文字、连线和可编辑结构，并检查每旅程代表截图；11份均有有效起点和真实文本/组件，无缺失跳转目标或整UI截图填充。独立[PJ读回与截图证据](../reviews/evidence/ux-journeys-2026-10-27/)保留当前候选，不以数量作为业务完成阈值。

- J10按钮标签挤窄和指标卡宽度不一：定向修复标签布局与三列等宽；概览保留激活/再赴约，每周指标按采集v4校准为含host的去重出席用户数，同周多场只计一次。
- iOS根页面恢复既有中心53pt Create、实际源码SVG导航与安全区；J07修正误沿用的后台字体/顶栏，回到用户端规范。
- J06移除额外“Choose”演示按钮，代表原型直接点击三态和理由行，未答不默认为No。
- J04单方WAITING不显示已有连接的撤回/私聊动作；只编辑本人选择，真正OPEN才可私聊/撤回。评分无默认值，选分及保存是分别动作。
- J01申请安排和J08删除最终确认不由原型自动代勾；回到原意图仍需本人确认。
- J11产品页移出实现说明，分类受理与统计Ready/失败明确分开；J09保留PM样本原事实，本例追加absent确认后仍不适用，不虚构新造成资格失效。

以上由各原UX作者修改，PJ只做复核/交接，没有改写已确认PRD、Demo或旧Figma。正常业务页面不混入故障注入/外部角色代操作；对方同意与支持执行等合成前置单独说明。

验证边界：已核对原生Figma文件访问、节点/连线、文本与代表截图；未在Presentation中逐点击完整回放所有路径，未验证任意输入、真机键盘/读屏、真实服务或独立QA。Figma访问使用正常已授权账号，未改匿名共享权限。全部UX候选待Owner审阅，RD/QA仍not-started，原真实发布门槛不关闭。

最终仓库检查：227项全部通过，无跳过，30.043s，含既有Chromium回归和28项UX作者检查、2项PJ交付检查。首次总检发现11份设计交接未直接列入文档索引，已补齐后复跑通过；全部本地Markdown链接及索引检查通过。Git同步按三个作者白名单串行进行，未混入原研究或旧QA未提交内容。
