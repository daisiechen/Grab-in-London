# J07 · UX-r01 设计交接

**候选待Owner审阅，未命名版本冻结；RD、QA未启动。**

[独立Figma入口](https://www.figma.com/design/tnrVOL7tRST2d67ZFFSOid?node-id=1-25)。文件可继续变化；本次可审阅基准是节点表和`figma-readback.json`的SHA256，不伪造Figma版本号。

## 固定输入

- 输入提交：`14db53257a2b4bb7610a3afad5e1ecfd735db605`；PRD `PM-r01`，Demo `PM-r02`。
- [PRD](../../../product/journeys/j07/requirements.zh-CN.md)、[Demo](../../../../demo/journeys/j07/index.html)、[PM映射](../../../product/journeys/j07/coverage.json)。未修改这些输入。
- 采用既有Fancy用户端/后台规范。先检索Code Connect（无匹配），只读检查旧Figma；旧本地组件跨文件导入不可用，库搜索无匹配Fancy资产，按既有值建立本文件最小本地组件和绑定变量，未扩设计系统或改旧文件。

## 画板与对应

| 状态 | 节点 | 尺寸 |
| --- | --- | --- |
| member · Alex | [1:25](https://www.figma.com/design/tnrVOL7tRST2d67ZFFSOid?node-id=1-25) | 390×844 |
| form · Tell us what happened | [1:44](https://www.figma.com/design/tnrVOL7tRST2d67ZFFSOid?node-id=1-44) | 390×844 |
| unknown · Check your report | [1:72](https://www.figma.com/design/tnrVOL7tRST2d67ZFFSOid?node-id=1-72) | 390×844 |
| received · Received | [1:89](https://www.figma.com/design/tnrVOL7tRST2d67ZFFSOid?node-id=1-89) | 390×844 |
| list · Your reports | [1:109](https://www.figma.com/design/tnrVOL7tRST2d67ZFFSOid?node-id=1-109) | 390×844 |
| progress · In progress | [1:132](https://www.figma.com/design/tnrVOL7tRST2d67ZFFSOid?node-id=1-132) | 390×844 |
| reply · Reply available | [1:151](https://www.figma.com/design/tnrVOL7tRST2d67ZFFSOid?node-id=1-151) | 390×844 |
| validation · Choose a reason | [1:170](https://www.figma.com/design/tnrVOL7tRST2d67ZFFSOid?node-id=1-170) | 390×844 |
| failure · Your report wasn’t sent | [1:194](https://www.figma.com/design/tnrVOL7tRST2d67ZFFSOid?node-id=1-194) | 390×844 |
| otheraccount · Your reports | [1:213](https://www.figma.com/design/tnrVOL7tRST2d67ZFFSOid?node-id=1-213) | 390×844 |
| signedout · Sign in to report | [1:229](https://www.figma.com/design/tnrVOL7tRST2d67ZFFSOid?node-id=1-229) | 390×844 |

完整场景映射见[coverage.json](coverage.json)，原型读回见[figma-readback.json](figma-readback.json)。没有将来源/权限/任务等documented-only条款假称可执行。

## 共享状态与交付契约

### 正常路径与状态契约

英文iOS App，从当前可见成员/饭局/会话的举报入口消费稳定对象；此稿以成员U-TARGET为样例，不另做完整支持后台。未登录消费J01身份回流到原对象、须本人再次主动发送。原因批准枚举harassment/safety/other；原因必选、说明可空，无新最小字数/收费；只保本对象/账号草稿，不附全量聊天。取消回对象、无报告创建。发送中防重；确定失败保原因/正文，人工重试原意图；Unknown先查同次请求，不新建报告。

Received仅受理，不称调查完成。本人列表→同reportId回执→In progress→Reply available，后两者需实际支持进度/回复；固定原型把已发生外部变化作为前置，不在用户页放支持改状态按钮。刷新不重发。ID是定位参考而非访问凭据；列表/单条/重放均重新鉴权，换账号清旧草稿/响应和迟到数据；新账号无旧记录。正文纯文本，必要支持按case授权，用户读不到内部材料。

### 视觉、输入与返回契约

沿用用户端白底、Arial、森林绿主操作和淡色信息面板，fancy用Arial Bold；不混用后台Georgia品牌。390×844视口，状态安全区44、导航54、可滚动正文712、底部安全区34；正文滚动不使发送/取消永久不可达。触控≥44、字段标签/错误关联，Reason选择和Details多行遵循原生输入；键盘出现时安全区和可视高度跟随、滚动到活跃字段，关闭键盘后草稿保留。当前Figma未模拟系统键盘或读屏，因此不宣称真机/无障碍已通过。

返回从表单取消回原对象；回执/更新回本人列表，Unknown返回不重发；未登录取消回对象。紧急危险仅指当地紧急服务，不承诺平台应急响应或新SLA。禁止公开举报/自动惩罚/举报者改出席；真实投递、保留政策、支持处理及iOS行为仍需后续真实证据。

## 作者实际验证与限制

- Figma工具实际创建、读回全部节点/文字/字体/原型目标：11个代表状态、32条读回导航；目标缺失0，整UI图像填充0。数量仅为定位证据，不作为完成阈值。
- 读取字体：Arial；J07为用户端Arial，后台正文沿既有中文Noto Sans SC与Georgia字标。
- 实际获取并查看本目录evidence截图。修复过自动布局、标签换行/卡宽和作用域说明等问题，当前可见稿为修后候选。
- 本轮检查是设计作者自检与PJ设计复核，不是独立QA。未在Figma Presentation真实点击全部路径，未验证任意输入/真实键盘、读屏、真机、服务端鉴权、生产数据、真实通知或下载。不能用原型连线当作这些能力通过。
- Figma打开与节点访问已通过工具读回及截图确认；用户的浏览器登录/权限仍依赖其正常Figma账号。没有创建公开匿名访问或更改共享权限。
- 每份目录唯一作者UX-3；交回PJ复核后停止写入。没有自动启动RD/QA或J12—J15。
