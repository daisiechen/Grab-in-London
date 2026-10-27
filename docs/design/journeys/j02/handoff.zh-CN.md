# J02 发起饭局并完成招募管理 · UX设计交接

修订：UX-r01｜唯一作者：UX-2｜IOS-0.1.0｜状态：候选待Owner审阅，未命名冻结；不启动RD、QA。

[独立Figma入口](https://www.figma.com/design/oxJEKNBSpEbwsmMKLHd7Hv?node-id=3-715) · [完整设计板](https://www.figma.com/design/oxJEKNBSpEbwsmMKLHd7Hv?node-id=3-682) · [需求映射](coverage.json) · [实际节点/连线读回](figma-readback.json)

## 固定输入与复用

输入提交`14db53257a2b4bb7610a3afad5e1ecfd735db605`。PRD PM-r01、Demo PM-r01；精确SHA256见manifest。用户本轮只授权首发11旅程UX设计，未来分享、提及/系统群提醒及移动Web不纳入。

沿用Fancy森林绿#123f35、奶油/浅色底、柑橘与错误色，Arial原用户端字体、21px页边距、11px控件圆角、45px按钮、44px触控、393×852 iOS画布。普通入口保留四目的地及53px居中Create meal，认证/四步/深层反馈与聊天保留安全区、不机械套tabs。旧Figma仅只读；组件key未发布导致导入不可用，设计系统搜索无Fancy资产，因此按既有规范建立小范围本地组件/变量，不更换主题，不发布/修改旧库。

## 共享状态与交付契约

正常路径：welcome→auth→verify→profile→arrange→arranged→introduce→costs→review→ready→published→applicant→approved→declared；原已有合格身份复用J01合同，不要求重复资料。AI代表分支：introduce→ai→replace→introduced；生成、转入、发布分别主动。必要故障从画布顶部评审链接进入，不伪装成正常产品按钮。

字段与状态契约：姓名2–40、简介20–1000、语言/生活状态/兴趣及18+/社区确认均独立有效；账号组合字段在本稿为紧凑摘要，实际编辑复用J01。Arrange需明确确认placeId；搜索/预览不算选中，更换清时间/声明/Review。London 48个半小时时间是计划而非库存；DST歧义主动选offset，不存在拒绝；2≤minimum≤capacity≤6含host，截止默认−60分钟、最晚−30且仍在未来。Introduce标题5–80、正文20–1000；语言/氛围字典、菜系可空、饮食可多选，均host声明且无过敏保证。Costs只到店各付、正数两位小数GBP min≤max，未确认本人外订不能继续。Review展示当前草稿全部关键内容，Edit返回保稿；条款阅读不勾选。Figma转入AI稿后Review正文由字符串变量保持当前样本；任意自由编辑仍以PM Demo演示。

发布Unknown先查原意图、不建第二场；失败保稿，幂等记录。Pending不占座，批准前锁内重验，首批准锁关键安排；审批成功并不核实餐厅预约。声明更新后返回Hosting保持新声明样本；未允许下一申请时不放误导入口。人数不足截止取消、达标后开饭前跌破仍取消，取消保留群且不可重开，开始后禁取消。通知矩阵按PRD§7，不保证真实送达。

共同交互：默认/处理/失败/禁用有文字反馈；错误关联对应字段并保稿，长文/长标签换行、内容区纵向滚动，按钮label保持319px可用宽度。键盘出现时底部输入/确认区域应提升到键盘上方，返回关闭键盘并恢复原对象；触控44px、VoiceOver标签/焦点顺序/错误播报及动态字体在真实iOS实现验证，本稿不以截图宣称全面无障碍合规。原规范中历史支付行为不覆盖本版PRD。

## 节点与需求对应

| 输入需求 | Demo场景 | Figma代表节点 |
| --- | --- | --- |
| J02-R01 / §2 | C01身份门槛 | [welcome](https://www.figma.com/design/oxJEKNBSpEbwsmMKLHd7Hv?node-id=3-715)、[auth](https://www.figma.com/design/oxJEKNBSpEbwsmMKLHd7Hv?node-id=3-734)、[verify](https://www.figma.com/design/oxJEKNBSpEbwsmMKLHd7Hv?node-id=3-758)、[profile](https://www.figma.com/design/oxJEKNBSpEbwsmMKLHd7Hv?node-id=3-779)、[arrange](https://www.figma.com/design/oxJEKNBSpEbwsmMKLHd7Hv?node-id=3-804) |
| J02-R02 / §3 | C02候选选择 | [arrange](https://www.figma.com/design/oxJEKNBSpEbwsmMKLHd7Hv?node-id=3-804)、[arranged](https://www.figma.com/design/oxJEKNBSpEbwsmMKLHd7Hv?node-id=3-825)、[searcherror](https://www.figma.com/design/oxJEKNBSpEbwsmMKLHd7Hv?node-id=3-1258) |
| J02-R03 / §3 | C03安排校验 | [arranged](https://www.figma.com/design/oxJEKNBSpEbwsmMKLHd7Hv?node-id=3-825)、[dst](https://www.figma.com/design/oxJEKNBSpEbwsmMKLHd7Hv?node-id=3-1276) |
| J02-R04 / §4 | C04四步发布 | [introduce](https://www.figma.com/design/oxJEKNBSpEbwsmMKLHd7Hv?node-id=3-855)、[introduced](https://www.figma.com/design/oxJEKNBSpEbwsmMKLHd7Hv?node-id=3-932)、[costs](https://www.figma.com/design/oxJEKNBSpEbwsmMKLHd7Hv?node-id=3-962)、[review](https://www.figma.com/design/oxJEKNBSpEbwsmMKLHd7Hv?node-id=3-986)、[terms](https://www.figma.com/design/oxJEKNBSpEbwsmMKLHd7Hv?node-id=3-1014)、[ready](https://www.figma.com/design/oxJEKNBSpEbwsmMKLHd7Hv?node-id=3-1030) |
| J02-R05 / §5 | C04四步发布 | [costs](https://www.figma.com/design/oxJEKNBSpEbwsmMKLHd7Hv?node-id=3-962)、[review](https://www.figma.com/design/oxJEKNBSpEbwsmMKLHd7Hv?node-id=3-986)、[ready](https://www.figma.com/design/oxJEKNBSpEbwsmMKLHd7Hv?node-id=3-1030) |
| J02-R06 / §5 | C05故障恢复 | [ready](https://www.figma.com/design/oxJEKNBSpEbwsmMKLHd7Hv?node-id=3-1030)、[published](https://www.figma.com/design/oxJEKNBSpEbwsmMKLHd7Hv?node-id=3-1051)、[unknown](https://www.figma.com/design/oxJEKNBSpEbwsmMKLHd7Hv?node-id=3-1222)、[publisherror](https://www.figma.com/design/oxJEKNBSpEbwsmMKLHd7Hv?node-id=3-1240) |
| J02-R07 / §6 | C07招募审核 | [applicant](https://www.figma.com/design/oxJEKNBSpEbwsmMKLHd7Hv?node-id=3-1077)、[approved](https://www.figma.com/design/oxJEKNBSpEbwsmMKLHd7Hv?node-id=3-1102)、[declared](https://www.figma.com/design/oxJEKNBSpEbwsmMKLHd7Hv?node-id=3-1128)、[declined](https://www.figma.com/design/oxJEKNBSpEbwsmMKLHd7Hv?node-id=3-1149)、[applicantfull](https://www.figma.com/design/oxJEKNBSpEbwsmMKLHd7Hv?node-id=3-1165) |
| J02-R08 / §7 | C09截止与人数 | [closed](https://www.figma.com/design/oxJEKNBSpEbwsmMKLHd7Hv?node-id=3-1315)、[started](https://www.figma.com/design/oxJEKNBSpEbwsmMKLHd7Hv?node-id=3-1331)、[cancelled](https://www.figma.com/design/oxJEKNBSpEbwsmMKLHd7Hv?node-id=3-1202) |
| J02-R09 / §7 | C10取消 | [cancel](https://www.figma.com/design/oxJEKNBSpEbwsmMKLHd7Hv?node-id=3-1181)、[cancelled](https://www.figma.com/design/oxJEKNBSpEbwsmMKLHd7Hv?node-id=3-1202) |
| J02-R10 / §4 | C06AI草稿 | [ai](https://www.figma.com/design/oxJEKNBSpEbwsmMKLHd7Hv?node-id=3-887)、[replace](https://www.figma.com/design/oxJEKNBSpEbwsmMKLHd7Hv?node-id=3-909)、[introduced](https://www.figma.com/design/oxJEKNBSpEbwsmMKLHd7Hv?node-id=3-932)、[aierror](https://www.figma.com/design/oxJEKNBSpEbwsmMKLHd7Hv?node-id=3-1297) |

## 作者检查与证据边界

已实际读取原需求/Demo与旧设计规范；创建独立可编辑Figma Design，并读回全部屏幕文字、字体、原型目标及入口。所有屏幕393×852；字体Arial，无窄于300px的按钮/字段label，无完整UI截图铺底。查看整板合成截图及代表屏截图，已修正控件宽度模式和既有导航。代表截图在本目录evidence，原型连线与快照在figma-readback.json。

通过仓库回归核对输入哈希、每条旅程需求对应节点、原型无缺失目标、范围与阶段边界，以及本包关键隐私状态。读取节点/连线与截图检查不等于完整Presentation逐点击、自由输入、真机、真实服务或独立QA。

未制作全部Google/Apple/验证码供应方分支、Google地图/照片许可素材与每一DST日期组合；继承PRD§2–3及J01输入，不以合成餐厅样例替代生产范围。时钟、并发末位、真实发布/通知、任意字段组合与输入均不在Figma运行。

Figma文件仍可变；没有伪造命名版本或冻结ID。manifest固定当前读回/文件哈希，Owner尚未审阅通过。文件变更后必须刷新受影响映射和证据；后续是否启动RD/QA由用户另行授权。
