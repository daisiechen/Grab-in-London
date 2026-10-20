# 已确认体验恢复与 28 条批注核对

日期：2026-10-19。基线：102183d。2026-10-19用户端候选冻结。2026-10-20用户明确要求不交接协调会话，直接更新公开链接；本站第9版已发布成功，[发布回执](publication-2026-10-20.json)。仅用户端文件由本会话提交，后台并行文件保持原归属。本文不替代原研发准入报告，也不把构建成功当成生产可用。

## 比较原则

此前需求补全版将既有交互替换为简化 R1 页面，超出评审授权。此次以保留在 `?scope=future` 的既有界面为交互参照，恢复发现工具栏、列表/地图切换、日历、Meals 标签、Inbox 和资料结构；既定首期外订/线下自付、截止与权限规则继续由共享模型执行。上一版的支付/库存模拟不并入首期。

对照入口：[上一版](http://127.0.0.1:4173/?scope=future)、[恢复候选](http://127.0.0.1:4173/)。[上一版截图](previous-baseline.png)、[恢复发现页](discovery.png)、[主持列表](hosting.png)。[手机/公开访问修复版](https://grab-in-london-demo.daisie-chen-94.chatgpt.site)，原URL不变，保留公开权限。

## 批注逐项核对

| 编号 | 原问题 | 本轮调整与检查 |
| --- | --- | --- |
| 01 | 助手不能移高 | 拖动上界缩至状态栏安全区下8px；键盘上移实测可达更高位置，[截图](helper-high.png)；保留吸边/触摸拖动 |
| 02 | 搜索框用途不明 | 撤去新增顶部搜索框，餐厅/区域搜索移入更多筛选；Ask Fancy 独立入口 |
| 03 | 单日期输入 | 恢复月历，支持不连续多日期切换、选中并集及清空，[截图](calendar.png) |
| 04 | 顶层 Back 无意义 | Discover / Meals / Inbox / Profile 无 Back |
| 05 | 不需个人导出 | 删除 Export my data 产品入口；验收模式去标识后台投影独立保留 |
| 06 | 筛选不应用底部弹层 | 日期/人数/更多筛选改工具栏下拉面板；确认/删除等流程仍用确认弹层 |
| 07 | 地图切换退化 | 恢复 List / Map 双段控件与地图底部结果预览/翻页 |
| 08 | 举报无反馈 | 提交后显式感谢、已收到、将审核和case编号，[回执](report-receipt.png) |
| 09 | 拉黑无确认 | Block member 先确认，Confirm block 才执行 |
| 10 | 头像与语言太挤 | 增加参与人行与语言/主持行间距，语言显示完整名称 |
| 11 | 返回丢失来源 | 页面栈记录来源、饭局和成员；从Meals进入详情后返回原分类；发布后返回Hosting |
| 12 | Meals未突出日期 | 日期列、Today/Tomorrow/In N days；Upcoming按时间升序，Past按时间倒序 |
| 13 | 取消列表默认展开 | Cancelled仅主动选中标签后显示 |
| 14 | 分类被纵向堆叠 | 恢复横向 Upcoming / Applications / Hosting / Past / Cancelled |
| 15 | 虚构餐厅/自由填写 | 创建只能选Google Maps可查的真实餐厅目录；校验身份、名称、地址一致；无自由添加虚构结果 |
| 16 | 不保存草稿 | 删除保存草稿；步骤内保留编辑，取消/离开确认丢弃，发布后清空 |
| 17 | 原生日历时间太大 | 创建改紧凑自定义月历与半小时列表，未使用原生date/time输入 |
| 18 | 时区术语不必要 | 界面Date / Time；按餐厅当地时间解释，内部仍London/DST；欧洲不是一个时区 |
| 19 | Back优先级 | Continue在上、Back在下 |
| 20 | minimum应可自定义 | From / Up to同一行，整数2≤minimum≤capacity≤6，均含host；旧记录门槛不改写 |
| 21 | 语言缩写 | 显示完整 English / Chinese / French / Spanish，不显示en/zh |
| 22 | 描述标签过重 | 改为A little note for your table |
| 23 | 预算过度纵向 | From / Up to同一行 |
| 24 | 找不到本人主持 | Hosting标签和You’re hosting标记，发布后可回该列表 |
| 25 | Inbox交互退化 | 恢复申请进度卡、群列表/消息预览、私聊与更新；待审不获得群消息权限 |
| 26 | 饭后不能聊天 | 结束不关闭群；本人退群或host解散后才停止；独立字段不改参与/出席，排除r1-1 |
| 27 | Profile缺内容 | 恢复头像、工作/伦敦生活、介绍、兴趣、完整语言多选、学校/家乡及编辑并验证保存 |
| 28 | Settings重复 | 设置仅本人Profile入口；保留底部Inbox，无重复全局设置按钮 |

## 真实地点与模拟边界

地点身份采用官方资料核验：[Dishoom Carnaby](https://www.dishoom.com/carnaby/)、[Flat Iron Soho](https://flatironsteak.co.uk/restaurant/soho/)、[The Barbary Neal’s Yard](https://www.thebarbary.co.uk/neals-yard)。目录保存名称、完整地址和Google Maps链接。当前不是实时Google Places；任意餐厅搜索、预约可用性和真实订位均尚未接入。饭局、预算、人物、消息及预约声明仍为模拟数据；通用餐厅素材不声称是这些餐厅的实拍。

## 验证

- 用户端domain：86/86通过，新增人数区间全组合/非法边界、真实地点身份、饭后群聊/独立退群/解散权限/投影隔离、London跨夏令时日期标签。
- Sites封装：6/6通过。
- 仓库Python：39/39通过。
- 用户端构建通过；28个受保护设备运行时文件完整性通过。存在既有大包体积提示，不是编译错误。
- 后台单测：修复共享源后49/49通过；后台其他验证由后台原会话执行，其后续指标自查不在本轮白名单。
- 浏览器：完整35/35通过（Chrome，串行1.4分钟），含26条保留版/设备运行时回归与9条R1恢复流程；[逐项结果](browser-suite.jsonl)、[最终回执](browser-suite-summary.json)。此前中止的未完成运行不作为通过证据。随后针对登录返回路径补修，受影响10/10通过（45.6秒，含新增1项）；保留版/设备运行时26项未受此补修影响。合计36条唯一场景，最后仅按改动范围重跑。另修正默认地图高亮与全部结果范围不一致，对应筛选/地图场景1/1再次通过（1.7秒）。
- CUA人工走查：日期非连续多选、助手上移、真实餐厅选择→日期/人数→描述/预算→预览→发布→返回Hosting、详情返回、饭后发送→退群确认→历史保留、举报回执、拉黑确认，均有实际页面证据。

## 用户端冻结白名单

`demo/src/Prototype.tsx`、`demo/src/prototype.css`、`demo/src/experience.ts`、`demo/package.json`、`demo/tests/experience.test.ts`、`demo/tests/pilot.test.ts`、`demo/tests/r1.spec.ts`、`demo/tests/assistant.spec.ts`、`demo/tests/map-prototype.spec.ts`、`demo/tests/post-meal-scenario.mjs`、`demo/README.md`、`demo/qa/experience-restoration-2026-10-19/`、`shared/pilot.ts`、`shared/venues.ts`、`shared/README.md`、`docs/product/PRD.zh-CN.md`、`docs/product/product-brief.md`。

未改受保护设备文件、后台、后台PRD/契约、协调评审报告/索引和竞品研究；不提交构建产物或个人配置。本轮提交不混入后台并行候选。Sites发布仓库保留原历史，发布快照采用demo/与shared/目录，构建产物与源码提交对应；发布隔离副本再次通过86项规则测试、6项封装测试和构建。
