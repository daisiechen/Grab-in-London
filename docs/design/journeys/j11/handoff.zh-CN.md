# J11 · UX-r01 设计交接

**候选待Owner审阅，未命名版本冻结；RD、QA未启动。**

[独立Figma入口](https://www.figma.com/design/IHhXcDFmp4x5eOPrVW88m9?node-id=1-25)。文件可继续变化；本次可审阅基准是节点表和`figma-readback.json`的SHA256，不伪造Figma版本号。

## 固定输入

- 输入提交：`14db53257a2b4bb7610a3afad5e1ecfd735db605`；PRD `PM-r01`，Demo `PM-r02`。
- [PRD](../../../product/journeys/j11/requirements.zh-CN.md)、[Demo](../../../../demo/journeys/j11/index.html)、[PM映射](../../../product/journeys/j11/coverage.json)。未修改这些输入。
- 采用既有Fancy用户端/后台规范。先检索Code Connect（无匹配），只读检查旧Figma；旧本地组件跨文件导入不可用，库搜索无匹配Fancy资产，按既有值建立本文件最小本地组件和绑定变量，未扩设计系统或改旧文件。

## 画板与对应

| 状态 | 节点 | 尺寸 |
| --- | --- | --- |
| edit · 让统计回到正确的人群 | [1:25](https://www.figma.com/design/IHhXcDFmp4x5eOPrVW88m9?node-id=1-25) | 1440×827 |
| unknown · 保存结果尚不确定 | [1:59](https://www.figma.com/design/IHhXcDFmp4x5eOPrVW88m9?node-id=1-59) | 1440×445 |
| pending · 分类已接受，统计更新中 | [1:80](https://www.figma.com/design/IHhXcDFmp4x5eOPrVW88m9?node-id=1-80) | 1440×445 |
| failed · 分类已接受，统计暂不可用 | [1:101](https://www.figma.com/design/IHhXcDFmp4x5eOPrVW88m9?node-id=1-101) | 1440×445 |
| ready · 新统计已就绪 | [1:122](https://www.figma.com/design/IHhXcDFmp4x5eOPrVW88m9?node-id=1-122) | 1440×804 |
| export · 聚合导出已生成 | [1:154](https://www.figma.com/design/IHhXcDFmp4x5eOPrVW88m9?node-id=1-154) | 1440×531 |
| downloaded · CSV可供下载 | [1:178](https://www.figma.com/design/IHhXcDFmp4x5eOPrVW88m9?node-id=1-178) | 1440×618 |
| oldexport · 导出记录 | [1:215](https://www.figma.com/design/IHhXcDFmp4x5eOPrVW88m9?node-id=1-215) | 1440×471 |
| revoked · 此导出已失效 | [1:237](https://www.figma.com/design/IHhXcDFmp4x5eOPrVW88m9?node-id=1-237) | 1440×445 |
| privacyready · 已切换有效快照 | [1:258](https://www.figma.com/design/IHhXcDFmp4x5eOPrVW88m9?node-id=1-258) | 1440×415 |
| conflict · 分类已由其他管理员修改 | [1:280](https://www.figma.com/design/IHhXcDFmp4x5eOPrVW88m9?node-id=1-280) | 1440×603 |
| unchanged · 没有保存新的分类 | [1:307](https://www.figma.com/design/IHhXcDFmp4x5eOPrVW88m9?node-id=1-307) | 1440×415 |
| denied · 你没有修改分类的权限 | [1:327](https://www.figma.com/design/IHhXcDFmp4x5eOPrVW88m9?node-id=1-327) | 1440×415 |
| narrow · 分类已接受，统计暂不可用 | [1:347](https://www.figma.com/design/IHhXcDFmp4x5eOPrVW88m9?node-id=1-347) | 390×399 |

完整场景映射见[coverage.json](coverage.json)，原型读回见[figma-readback.json](figma-readback.json)。没有将来源/权限/任务等documented-only条款假称可执行。

## 共享状态与交付契约

### 保存与恢复契约

只让data-admin按稳定userId核对regular/test/staff和expectedVersion；非空原因必填，无变化不产生新修订，取消恢复确认值。每次操作绑定actor+subject+原意图+expectedVersion。Unknown先查原次，保对象/原因，不重复classify；已接受/Pending显示统计待更新，阻断旧图表/明细/导出；Failed明确分类已接受而统计失败，仅重试统计，不回滚分类、不重复保存。Ready必须覆盖该subject已接受revision，不能用别人的更大revision或全局最新快照代替。409读当前合法分类/版本，保原因，核对后新意图；普通确定失败保输入；429等待，503不清查询。

分类投影排除test/staff事件/申请/参与/反馈及其主持场次；正式host场的测试成员排除且从正式席位事件重建peak。不改变真实业务/账号权限，保原历史、操作者/理由/时间/版本。实现与真实任务/MFA/幂等/事务不由Figma证明。

### 统计、下载与撤销契约

页面/下钻/导出同snapshotId、asOf、definitionVersion、过滤、角色及隐私epoch。普通分类/纠错生成新快照，不改旧字节；隐私删除才撤销相关旧snapshot/票据。旧记录可追踪但每次读/下载重验；新快照可用也不复活旧票据；已下载磁盘字节无法远程撤回。

CSV仅允许聚合指标、分子分母、单位及快照/口径/筛选元数据，防公式注入；不含姓名邮箱、消息、评价正文、留言、单方意愿或原始个人明细。票据生成≠下载成功；Figma到“CSV可供下载”为静态反馈，未创建/下载真实CSV。PM Demo已实现合成下载，真实服务留RD/QA；不把Figma按钮当完成证据。

日期草稿/应用/非法校验、URL/分页/locale/焦点沿J10共享契约。侧栏在固定状态原型中为静态定位，不能借跳转回旧Ready来绕过Unknown/Failed/撤销；所有真实返回仍须按当前状态重新校验。分析者只读，失权清旧结果/下载；403状态无编辑导航动作。不扩分类自动化、员工权限、财务或客服系统。

## 作者实际验证与限制

- Figma工具实际创建、读回全部节点/文字/字体/原型目标：14个代表状态、19条读回导航；目标缺失0，整UI图像填充0。数量仅为定位证据，不作为完成阈值。
- 读取字体：Noto Sans SC, Georgia；J07为用户端Arial，后台正文沿既有中文Noto Sans SC与Georgia字标。
- 实际获取并查看本目录evidence截图。修复过自动布局、标签换行/卡宽和作用域说明等问题，当前可见稿为修后候选。
- 本轮检查是设计作者自检与PJ设计复核，不是独立QA。未在Figma Presentation真实点击全部路径，未验证任意输入/真实键盘、读屏、真机、服务端鉴权、生产数据、真实通知或下载。不能用原型连线当作这些能力通过。
- Figma打开与节点访问已通过工具读回及截图确认；用户的浏览器登录/权限仍依赖其正常Figma账号。没有创建公开匿名访问或更改共享权限。
- 每份目录唯一作者UX-3；交回PJ复核后停止写入。没有自动启动RD/QA或J12—J15。
