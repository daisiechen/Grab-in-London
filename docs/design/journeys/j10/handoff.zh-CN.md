# J10 · UX-r01 设计交接

**候选待Owner审阅，未命名版本冻结；RD、QA未启动。**

[独立Figma入口](https://www.figma.com/design/skVbc47a4P4ygb4fxBUanJ?node-id=2-544)。文件可继续变化；本次可审阅基准是节点表和`figma-readback.json`的SHA256，不伪造Figma版本号。

## 固定输入

- 输入提交：`14db53257a2b4bb7610a3afad5e1ecfd735db605`；PRD `PM-r01`，Demo `PM-r02`。
- [PRD](../../../product/journeys/j10/requirements.zh-CN.md)、[Demo](../../../../demo/journeys/j10/index.html)、[PM映射](../../../product/journeys/j10/coverage.json)。未修改这些输入。
- 采用既有Fancy用户端/后台规范。先检索Code Connect（无匹配），只读检查旧Figma；旧本地组件跨文件导入不可用，库搜索无匹配Fancy资产，按既有值建立本文件最小本地组件和绑定变量，未扩设计系统或改旧文件。

## 画板与对应

| 状态 | 节点 | 尺寸 |
| --- | --- | --- |
| overview · 从约饭到真实见面 | [2:544](https://www.figma.com/design/skVbc47a4P4ygb4fxBUanJ?node-id=2-544) | 1440×1211 |
| filters · 筛选与日期 | [2:611](https://www.figma.com/design/skVbc47a4P4ygb4fxBUanJ?node-id=2-611) | 1440×729 |
| metric · 出席记录覆盖 · 口径 | [2:650](https://www.figma.com/design/skVbc47a4P4ygb4fxBUanJ?node-id=2-650) | 1440×552 |
| sources · 脱敏来源记录 | [2:679](https://www.figma.com/design/skVbc47a4P4ygb4fxBUanJ?node-id=2-679) | 1440×622 |
| meal · M-102 · 出席依据 | [2:726](https://www.figma.com/design/skVbc47a4P4ygb4fxBUanJ?node-id=2-726) | 1440×747 |
| history · U-101 · 相关业务历史 | [2:777](https://www.figma.com/design/skVbc47a4P4ygb4fxBUanJ?node-id=2-777) | 1440×620 |
| journey · 申请推进 | [2:817](https://www.figma.com/design/skVbc47a4P4ygb4fxBUanJ?node-id=2-817) | 1440×585 |
| supply · 饭局与供需 | [2:853](https://www.figma.com/design/skVbc47a4P4ygb4fxBUanJ?node-id=2-853) | 1440×981 |
| definitions · 数据与定义 | [2:929](https://www.figma.com/design/skVbc47a4P4ygb4fxBUanJ?node-id=2-929) | 1440×466 |
| error · 统计快照已失效 | [2:957](https://www.figma.com/design/skVbc47a4P4ygb4fxBUanJ?node-id=2-957) | 1440×406 |
| empty · 没有符合条件的记录 | [2:981](https://www.figma.com/design/skVbc47a4P4ygb4fxBUanJ?node-id=2-981) | 1440×406 |
| narrow · 饭局与供需 | [2:1005](https://www.figma.com/design/skVbc47a4P4ygb4fxBUanJ?node-id=2-1005) | 390×757 |

完整场景映射见[coverage.json](coverage.json)，原型读回见[figma-readback.json](figma-readback.json)。没有将来源/权限/任务等documented-only条款假称可执行。

## 共享状态与交付契约

### 查询与表现契约

日期默认最近28个London自然日，7/28/90快捷范围沿用；草稿不改变已应用查询，必填且from≤to≤asOf。多选同字段OR、跨字段AND、空选全部；语言并集去重；人数2/3/4/5/6/7+，预算[0,20]、(20,30]、(30,40]、(40,+∞)、未填写。来源/新老分群/快捷日期在PM Demo为documented-only；设计筛选控件明确这些需求，但Figma固定样例不执行任意查询。日期/业务筛选/语言持URL；本页搜索、排序保持；六条分页、切搜索/排序/筛选回第一页，边界禁用。

每周确认出席为该周有效present的去重userId（含host、同周多场一次），不是场次或人次；样例2/2/5人。14天激活：先取全历史首次申请，再按申请日入组，观察满14天，首次申请后14天内有效出席；当前0/1且2人观察中。30天再赴约：全历史首次有效出席，另一mealId且(0,30天]，观察中不当流失；当前0/0显示—、3人观察中。覆盖率明确present+absent/应确认人次，本人优先、host补缺，unknown不计分子。曝光/详情非严格嵌套；取消/拒绝/撤回留适用分母。其他审核P50/P90、创建attemptId、招募peak、来源质量和小时快照按PRD与采集v4，不由示意数替代算法。

### 状态、响应式与语言契约

主要可点击样例是覆盖率→口径→伪名来源→M-102→U-101→逐层返回；其他指标不误链到覆盖率。各指标专属定义使用同一口径容器，公式以PRD为准。无效日期错误组件放画布交接区2:646，避免在有效日期页同时显示错误。410代表页清旧图/明细/票据，恢复前重验；401认证回原查询；403清受限数据不继续读；429遵守等待；503保查询人工重试。角色每次查询/下钻重验，前端隐藏不当授权。

沿用admin断点：1440完整侧栏，1024/864图标侧栏/内容收缩，640以下横向导航；长表只在自身容器滚动、页面无横溢。当前Figma给1440主要路径及390代表表格，1024/864不重复绘五页；布局/焦点/Escape/遮罩/关闭还焦点为共享契约。中文默认、English切换保持当前路由、日期、业务筛选、搜索/排序及局部操作；本候选未制作全量英文复制稿或真实键盘交互，这不删除语言要求。

禁止读取姓名邮箱、聊天/申请留言、公评正文、单方再约等；分析者无分类/纠错写入口。J12专门体验留存页及AI因果分析不在本包。

## 作者实际验证与限制

- Figma工具实际创建、读回全部节点/文字/字体/原型目标：12个代表状态、63条读回导航；目标缺失0，整UI图像填充0。数量仅为定位证据，不作为完成阈值。
- 读取字体：Noto Sans SC, Georgia；J07为用户端Arial，后台正文沿既有中文Noto Sans SC与Georgia字标。
- 实际获取并查看本目录evidence截图。修复过自动布局、标签换行/卡宽和作用域说明等问题，当前可见稿为修后候选。
- 本轮检查是设计作者自检与PJ设计复核，不是独立QA。未在Figma Presentation真实点击全部路径，未验证任意输入/真实键盘、读屏、真机、服务端鉴权、生产数据、真实通知或下载。不能用原型连线当作这些能力通过。
- Figma打开与节点访问已通过工具读回及截图确认；用户的浏览器登录/权限仍依赖其正常Figma账号。没有创建公开匿名访问或更改共享权限。
- 每份目录唯一作者UX-3；交回PJ复核后停止写入。没有自动启动RD/QA或J12—J15。
