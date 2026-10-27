# J04 饭后记录体验并决定是否继续联系 · UX设计交接

修订：UX-r01｜唯一作者：UX-2｜IOS-0.1.0｜状态：候选待Owner审阅，未命名冻结；不启动RD、QA。

[独立Figma入口](https://www.figma.com/design/UvgjBArZae7tQuSAXu8cWA?node-id=1-35) · [完整设计板](https://www.figma.com/design/UvgjBArZae7tQuSAXu8cWA?node-id=1-2) · [需求映射](coverage.json) · [实际节点/连线读回](figma-readback.json)

## 固定输入与复用

输入提交`14db53257a2b4bb7610a3afad5e1ecfd735db605`。PRD PM-r01、Demo PM-r02；精确SHA256见manifest。用户本轮只授权首发11旅程UX设计，未来分享、提及/系统群提醒及移动Web不纳入。

沿用Fancy森林绿#123f35、奶油/浅色底、柑橘与错误色，Arial原用户端字体、21px页边距、11px控件圆角、45px按钮、44px触控、393×852 iOS画布。普通入口保留四目的地及53px居中Create meal，认证/四步/深层反馈与聊天保留安全区、不机械套tabs。旧Figma仅只读；组件key未发布导致导入不可用，设计系统搜索无Fancy资产，因此按既有规范建立小范围本地组件/变量，不更换主题，不发布/修改旧库。

## 共享状态与交付契约

正常路径：past→present→scorepicker→scoreselected→scored→feedback（点击示例公评输入）→draft→waiting。私评分可跳过；初始化Choose 1–5、未选保存禁用，选择1–5使用同一Figma变量，不默认4分。公评与本人再约独立，空白Save反馈为No changes。WAITING不暴露对方意愿且没有Withdraw connection；Edit my reconnect choice→已选编辑→本人点击取消勾选→Save feedback→choice cleared，公评保持不变。

只有外部对方本人选择已完成的独立mutual快照，才有Open private chat→dm→dmsent；本用户没有“替对方同意”按钮。从真实OPEN进入Withdraw/Block需确认，取消用BACK保留来处；撤回后readonly返回choiceremoved，不再显示旧同意；解除block不复活旧同意。外部对方选择、host补报及支持纠错均从评审区进入，用户画面没有合成控制器。

字段与状态契约：开始名单、cancelled与unknown/absent资格按PRD§2；本人最新出席优先，host仅补缺，unknown不是absent。窗口[end,end+7d)，本人/host限窗口、支持纠错在J09且保留历史；七天外独立revoke仍可用。私评分1–5整数仅本人/授权职责可见；公评trim1–500、不能空白覆盖既存项、双方提交或窗口结束且资格仍有效才公开；再约为独立布尔且单方保密，不从私评分推断。

Save feedback只提交dirty，先确认OPEN撤回再开始整批；确认取消全批零写。先公评后再约；前项失败/未知/409则后项Not saved yet，成功不回滚、Retry只未存项，Unknown先查原次，409保draft读权威后本人确认。每分项提交重新校验资格/窗口/版本，对象切换丢迟到响应。私聊1–2000纯文本、每次送出重验人对授权/共同依据/block；撤回清双方同意并前进epoch，历史读取与未来发送分离。合法出席纠错隐藏失效公评/评分统计并重新计算，另一有效依据可保连接，撤回/block绝不因资格恢复复活。

问卷是J06独立对象，不在饭后追加问卷；无公开星级/信誉排名、自动推荐、AI私聊代发或常规核实队列。

共同交互：默认/处理/失败/禁用有文字反馈；错误关联对应字段并保稿，长文/长标签换行、内容区纵向滚动，按钮label保持319px可用宽度。键盘出现时底部输入/确认区域应提升到键盘上方，返回关闭键盘并恢复原对象；触控44px、VoiceOver标签/焦点顺序/错误播报及动态字体在真实iOS实现验证，本稿不以截图宣称全面无障碍合规。原规范中历史支付行为不覆盖本版PRD。

## 节点与需求对应

| 输入需求 | Demo场景 | Figma代表节点 |
| --- | --- | --- |
| J04-R01 / §2 | C01出席 | [past](https://www.figma.com/design/UvgjBArZae7tQuSAXu8cWA?node-id=1-35)、[present](https://www.figma.com/design/UvgjBArZae7tQuSAXu8cWA?node-id=1-59)、[absent](https://www.figma.com/design/UvgjBArZae7tQuSAXu8cWA?node-id=1-85)、[expired](https://www.figma.com/design/UvgjBArZae7tQuSAXu8cWA?node-id=1-445)、[hostgap](https://www.figma.com/design/UvgjBArZae7tQuSAXu8cWA?node-id=1-466)、[hostreported](https://www.figma.com/design/UvgjBArZae7tQuSAXu8cWA?node-id=1-487) |
| J04-R02 / §2 | C01出席 | [past](https://www.figma.com/design/UvgjBArZae7tQuSAXu8cWA?node-id=1-35)、[present](https://www.figma.com/design/UvgjBArZae7tQuSAXu8cWA?node-id=1-59)、[hostgap](https://www.figma.com/design/UvgjBArZae7tQuSAXu8cWA?node-id=1-466)、[corrected](https://www.figma.com/design/UvgjBArZae7tQuSAXu8cWA?node-id=1-504) |
| J04-R03 / §3 | C02私评分 | [present](https://www.figma.com/design/UvgjBArZae7tQuSAXu8cWA?node-id=1-59)、[scorepicker](https://www.figma.com/design/UvgjBArZae7tQuSAXu8cWA?node-id=3-211)、[scoreselected](https://www.figma.com/design/UvgjBArZae7tQuSAXu8cWA?node-id=3-264)、[scored](https://www.figma.com/design/UvgjBArZae7tQuSAXu8cWA?node-id=1-103) |
| J04-R04 / §3 | C03公评 | [feedback](https://www.figma.com/design/UvgjBArZae7tQuSAXu8cWA?node-id=1-126)、[draft](https://www.figma.com/design/UvgjBArZae7tQuSAXu8cWA?node-id=1-149)、[nochanges](https://www.figma.com/design/UvgjBArZae7tQuSAXu8cWA?node-id=1-170)、[waiting](https://www.figma.com/design/UvgjBArZae7tQuSAXu8cWA?node-id=1-211) |
| J04-R05 / §4 | C04组合保存 | [draft](https://www.figma.com/design/UvgjBArZae7tQuSAXu8cWA?node-id=1-149)、[partial](https://www.figma.com/design/UvgjBArZae7tQuSAXu8cWA?node-id=1-186)、[unknown](https://www.figma.com/design/UvgjBArZae7tQuSAXu8cWA?node-id=1-398)、[conflict](https://www.figma.com/design/UvgjBArZae7tQuSAXu8cWA?node-id=1-421)、[withdraw](https://www.figma.com/design/UvgjBArZae7tQuSAXu8cWA?node-id=1-303) |
| J04-R06 / §5 | C06互选私聊 | [waiting](https://www.figma.com/design/UvgjBArZae7tQuSAXu8cWA?node-id=1-211)、[mutual](https://www.figma.com/design/UvgjBArZae7tQuSAXu8cWA?node-id=1-236)、[dm](https://www.figma.com/design/UvgjBArZae7tQuSAXu8cWA?node-id=1-259)、[dmsent](https://www.figma.com/design/UvgjBArZae7tQuSAXu8cWA?node-id=1-282) |
| J04-R07 / §5 | C07边界 | [choiceeditor](https://www.figma.com/design/UvgjBArZae7tQuSAXu8cWA?node-id=3-161)、[choiceunchecked](https://www.figma.com/design/UvgjBArZae7tQuSAXu8cWA?node-id=4-230)、[choiceremoved](https://www.figma.com/design/UvgjBArZae7tQuSAXu8cWA?node-id=3-180)、[withdraw](https://www.figma.com/design/UvgjBArZae7tQuSAXu8cWA?node-id=1-303)、[readonly](https://www.figma.com/design/UvgjBArZae7tQuSAXu8cWA?node-id=1-321)、[block](https://www.figma.com/design/UvgjBArZae7tQuSAXu8cWA?node-id=1-343)、[blocked](https://www.figma.com/design/UvgjBArZae7tQuSAXu8cWA?node-id=1-362)、[unblocked](https://www.figma.com/design/UvgjBArZae7tQuSAXu8cWA?node-id=1-380)、[expired](https://www.figma.com/design/UvgjBArZae7tQuSAXu8cWA?node-id=1-445) |
| J04-R08 / §6 | C08修订传播 | [corrected](https://www.figma.com/design/UvgjBArZae7tQuSAXu8cWA?node-id=1-504)、[readonly](https://www.figma.com/design/UvgjBArZae7tQuSAXu8cWA?node-id=1-321) |

## 作者检查与证据边界

已实际读取原需求/Demo与旧设计规范；创建独立可编辑Figma Design，并读回全部屏幕文字、字体、原型目标及入口。所有屏幕393×852；字体Arial，无窄于300px的按钮/字段label，无完整UI截图铺底。查看整板合成截图及代表屏截图，已修正控件宽度模式和既有导航。代表截图在本目录evidence，原型连线与快照在figma-readback.json。

通过仓库回归核对输入哈希、每条旅程需求对应节点、原型无缺失目标、范围与阶段边界，以及本包关键隐私状态。读取节点/连线与截图检查不等于完整Presentation逐点击、自由输入、真机、真实服务或独立QA。

原型采用固定输入样本与独立分支快照；私评分picker变量之外，不声称完整持久业务模型。任意跨分支组合、自由文本/键盘、HTTP/版本/幂等/七天时钟、真实对方同意、支持权限、跨旅程统计和私信传输未在Figma运行。

Figma文件仍可变；没有伪造命名版本或冻结ID。manifest固定当前读回/文件哈希，Owner尚未审阅通过。文件变更后必须刷新受影响映射和证据；后续是否启动RD/QA由用户另行授权。
