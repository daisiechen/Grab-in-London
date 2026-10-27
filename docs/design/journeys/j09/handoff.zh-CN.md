# J09 · UX-r01 设计交接

**候选待Owner审阅，未命名版本冻结；RD、QA未启动。**

[独立Figma入口](https://www.figma.com/design/m6kRIdrsctVT63PIN42kwD?node-id=1-25)。文件可继续变化；本次可审阅基准是节点表和`figma-readback.json`的SHA256，不伪造Figma版本号。

## 固定输入

- 输入提交：`14db53257a2b4bb7610a3afad5e1ecfd735db605`；PRD `PM-r01`，Demo `PM-r02`。
- [PRD](../../../product/journeys/j09/requirements.zh-CN.md)、[Demo](../../../../demo/journeys/j09/index.html)、[PM映射](../../../product/journeys/j09/coverage.json)。未修改这些输入。
- 采用既有Fancy用户端/后台规范。先检索Code Connect（无匹配），只读检查旧Figma；旧本地组件跨文件导入不可用，库搜索无匹配Fancy资产，按既有值建立本文件最小本地组件和绑定变量，未扩设计系统或改旧文件。

## 画板与对应

| 状态 | 节点 | 尺寸 |
| --- | --- | --- |
| case · 查看事实，留下处理依据 | [1:25](https://www.figma.com/design/m6kRIdrsctVT63PIN42kwD?node-id=1-25) | 1440×505 |
| active · 处理此案 | [1:42](https://www.figma.com/design/m6kRIdrsctVT63PIN42kwD?node-id=1-42) | 1440×501 |
| correction · 追加支持修订 | [1:59](https://www.figma.com/design/m6kRIdrsctVT63PIN42kwD?node-id=1-59) | 1440×744 |
| window · 仍在7天自助窗口内 | [1:84](https://www.figma.com/design/m6kRIdrsctVT63PIN42kwD?node-id=1-84) | 1440×475 |
| impact · 修订已追加，请核对影响 | [1:100](https://www.figma.com/design/m6kRIdrsctVT63PIN42kwD?node-id=1-100) | 1440×649 |
| reply · 回复并记录处理结果 | [1:129](https://www.figma.com/design/m6kRIdrsctVT63PIN42kwD?node-id=1-129) | 1440×633 |
| replied · 处理结果与回复已保存 | [1:150](https://www.figma.com/design/m6kRIdrsctVT63PIN42kwD?node-id=1-150) | 1440×560 |
| conflict · 记录已发生变化 | [1:168](https://www.figma.com/design/m6kRIdrsctVT63PIN42kwD?node-id=1-168) | 1440×501 |
| failed · 修订未执行 | [1:185](https://www.figma.com/design/m6kRIdrsctVT63PIN42kwD?node-id=1-185) | 1440×415 |
| denied · 无权查看此个案 | [1:199](https://www.figma.com/design/m6kRIdrsctVT63PIN42kwD?node-id=1-199) | 1440×389 |

完整场景映射见[coverage.json](coverage.json)，原型读回见[figma-readback.json](figma-readback.json)。没有将来源/权限/任务等documented-only条款假称可执行。

## 共享状态与交付契约

### 单案最小工具边界

这是支持个案的交互设计示意，正式能力可由受限CLI/API实现；不承诺新增完整客服后台导航。角色是经身份/MFA及caseId范围授权的support；逐次重验，analyst/身份过期/无case授权拒读拒写并清受限事实。只能看本案必要报告和业务事实，不看任意聊天、公评正文、单方意愿或全表。普通举报/删除支持可只回复，删除实际执行归J08；只回复不自动生成出席修订。

### 纠错规则与传播

按权威scheduledEndAt，窗口[scheduledEndAt,scheduledEndAt+7天)，连续UTC时长；前1ms拒绝，恰好满7天可支持逾期纠错。要求开始名单内且未取消；名单排除提前或恰好开始退出者，host在内。present/absent、非空原因、expectedVersion，追加SUPPORT修订与case/actor/time/revision/幂等关联，原self/host不覆盖，无verified第四状态、无SQL直改。取消不写；409读合法新版本/保选择原因后本人确认新意图；确定失败保稿；Unknown先查原次不追加第二条。

本稿与PM Demo原始事实一致：self absent、host present，有效absent；本例支持再次核对absent，因此影响区为“继续不适用”，不虚构从可用变失效。合法支持值优先，其后self、host、unknown；若改为absent，公评不公开、单场体验排除，仅依赖本场的联系暂停新发送但历史保留。另一有效共同场次及双方有效同意可继续开放，不全局误伤；恢复不复活已撤回/拉黑意愿。普通修订生成新snapshot，旧asOf不变；隐私撤销另走J08/J11。

### 回复、审计与失败

publicOutcome非空、纯文本、仅提交者可见结论/下一步；失败保输入、不标REPLIED；实际成功才显示已回复与审计。受理/开始/纠错/回复分开，若只回复不记录CORR。真实MFA、事务/锁、可靠传播、时钟和跨场恢复留生产验证；命令退出0不能证明传播完整。共享输入、焦点/取消和长文响应式沿后台规范；只设计本案，不新增队列、批量修订或财务能力。

## 作者实际验证与限制

- Figma工具实际创建、读回全部节点/文字/字体/原型目标：10个代表状态、13条读回导航；目标缺失0，整UI图像填充0。数量仅为定位证据，不作为完成阈值。
- 读取字体：Noto Sans SC, Georgia；J07为用户端Arial，后台正文沿既有中文Noto Sans SC与Georgia字标。
- 实际获取并查看本目录evidence截图。修复过自动布局、标签换行/卡宽和作用域说明等问题，当前可见稿为修后候选。
- 本轮检查是设计作者自检与PJ设计复核，不是独立QA。未在Figma Presentation真实点击全部路径，未验证任意输入/真实键盘、读屏、真机、服务端鉴权、生产数据、真实通知或下载。不能用原型连线当作这些能力通过。
- Figma打开与节点访问已通过工具读回及截图确认；用户的浏览器登录/权限仍依赖其正常Figma账号。没有创建公开匿名访问或更改共享权限。
- 每份目录唯一作者UX-3；交回PJ复核后停止写入。没有自动启动RD/QA或J12—J15。
