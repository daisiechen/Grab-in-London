# J03 赴约前沟通安排或调整参与 · UX设计交接

修订：UX-r01｜唯一作者：UX-2｜IOS-0.1.0｜状态：候选待Owner审阅，未命名冻结；不启动RD、QA。

[独立Figma入口](https://www.figma.com/design/WeH78bY3LzZM9eSvGKI4u2?node-id=1-35) · [完整设计板](https://www.figma.com/design/WeH78bY3LzZM9eSvGKI4u2?node-id=1-2) · [需求映射](coverage.json) · [实际节点/连线读回](figma-readback.json)

## 固定输入与复用

输入提交`14db53257a2b4bb7610a3afad5e1ecfd735db605`。PRD PM-r01、Demo PM-r01；精确SHA256见manifest。用户本轮只授权首发11旅程UX设计，未来分享、提及/系统群提醒及移动Web不纳入。

沿用Fancy森林绿#123f35、奶油/浅色底、柑橘与错误色，Arial原用户端字体、21px页边距、11px控件圆角、45px按钮、44px触控、393×852 iOS画布。普通入口保留四目的地及53px居中Create meal，认证/四步/深层反馈与聊天保留安全区、不机械套tabs。旧Figma仅只读；组件key未发布导致导入不可用，设计系统搜索无Fancy资产，因此按既有规范建立小范围本地组件/变量，不更换主题，不发布/修改旧库。

## 共享状态与交付契约

正常路径：inbox→chat→sent→settings→groupconfirm→leftsettings→history；退席独立分支meal→seatconfirm→seatleft→继续聊天。AI路径chat→ai→replace→inserted→aisent，三段主动操作不合并。host解散、Pending、获准重入、故障与旧消息阅读从画布评审入口进入；不是让本人批准自己或制造对方回应。

字段与状态契约：消息纯文本trim 1–2000；clientMessageId重试同一ID，失败/429/503保稿，只本人重试，不离线自动发。聊天readSeq只随实际可见消息前进；通知read需独立本人标记，二者互不清。读授权区间joinSeq<seq<leaveSeq的并集，退群/重入空档不可读、不可泄露数量/发送者。切账号/对象、401/403失权丢弃旧响应；退出清账号cache。取消或结束饭局、退席、外订失败均不自动关群。

退席仅guest且now<startsAt并Confirmed，释放本人席位但保群；退群只关闭本人写区间，不改变席位，成功停Group settings且隐藏整个实时名册/人数；历史只读，未发稿可复制/删除。解散仅当前有写权host，关闭全体open intervals、席位不变且不可重开；guest不新增解散入口。重入必须新轮申请且host批准，不因Pending/只退群就恢复，也不补空档。Figma是各分支固定快照；不同退出分支的任意来回组合不模拟实时对象状态，必须按此状态契约实现，不能用跳到另一快照推断授权恢复。

AI只能用本饭局公开时间地点和本人请求，不读群/私聊正文、他页草稿或私密选择；保留/替换确认及实际Send均再鉴权。FR-13最小上下文/许可/30分钟TTL/1在途/迟到隔离及预算沿消费合同，不增加独立AI系统。业务事件按稳定ID去重，关键进度邮件不含私密原文；群消息首发只有授权未读，无群邮件、push、@、mute。

共同交互：默认/处理/失败/禁用有文字反馈；错误关联对应字段并保稿，长文/长标签换行、内容区纵向滚动，按钮label保持319px可用宽度。键盘出现时底部输入/确认区域应提升到键盘上方，返回关闭键盘并恢复原对象；触控44px、VoiceOver标签/焦点顺序/错误播报及动态字体在真实iOS实现验证，本稿不以截图宣称全面无障碍合规。原规范中历史支付行为不覆盖本版PRD。

## 节点与需求对应

| 输入需求 | Demo场景 | Figma代表节点 |
| --- | --- | --- |
| J03-R01 / §2 | C01Inbox/角色 | [inbox](https://www.figma.com/design/WeH78bY3LzZM9eSvGKI4u2?node-id=1-35)、[noticeread](https://www.figma.com/design/WeH78bY3LzZM9eSvGKI4u2?node-id=1-61)、[meal](https://www.figma.com/design/WeH78bY3LzZM9eSvGKI4u2?node-id=1-84)、[pending](https://www.figma.com/design/WeH78bY3LzZM9eSvGKI4u2?node-id=1-409)、[mealprogress](https://www.figma.com/design/WeH78bY3LzZM9eSvGKI4u2?node-id=1-429) |
| J03-R02 / §3 | C02收发 | [chat](https://www.figma.com/design/WeH78bY3LzZM9eSvGKI4u2?node-id=1-107)、[sent](https://www.figma.com/design/WeH78bY3LzZM9eSvGKI4u2?node-id=1-137)、[failed](https://www.figma.com/design/WeH78bY3LzZM9eSvGKI4u2?node-id=1-166)、[history](https://www.figma.com/design/WeH78bY3LzZM9eSvGKI4u2?node-id=1-382) |
| J03-R03 / §3 | C03读位 | [inbox](https://www.figma.com/design/WeH78bY3LzZM9eSvGKI4u2?node-id=1-35)、[noticeread](https://www.figma.com/design/WeH78bY3LzZM9eSvGKI4u2?node-id=1-61)、[older](https://www.figma.com/design/WeH78bY3LzZM9eSvGKI4u2?node-id=1-531)、[sent](https://www.figma.com/design/WeH78bY3LzZM9eSvGKI4u2?node-id=1-137) |
| J03-R04 / §4 | C04两种退出 | [meal](https://www.figma.com/design/WeH78bY3LzZM9eSvGKI4u2?node-id=1-84)、[seatconfirm](https://www.figma.com/design/WeH78bY3LzZM9eSvGKI4u2?node-id=1-303)、[seatleft](https://www.figma.com/design/WeH78bY3LzZM9eSvGKI4u2?node-id=1-321)、[groupconfirm](https://www.figma.com/design/WeH78bY3LzZM9eSvGKI4u2?node-id=1-342)、[leftsettings](https://www.figma.com/design/WeH78bY3LzZM9eSvGKI4u2?node-id=1-360) |
| J03-R05 / §4 | C05重入 | [leftsettings](https://www.figma.com/design/WeH78bY3LzZM9eSvGKI4u2?node-id=1-360)、[history](https://www.figma.com/design/WeH78bY3LzZM9eSvGKI4u2?node-id=1-382)、[pending](https://www.figma.com/design/WeH78bY3LzZM9eSvGKI4u2?node-id=1-409)、[reentered](https://www.figma.com/design/WeH78bY3LzZM9eSvGKI4u2?node-id=1-445) |
| J03-R06 / §4 | C06终态 | [hostsettings](https://www.figma.com/design/WeH78bY3LzZM9eSvGKI4u2?node-id=1-472)、[dissolve](https://www.figma.com/design/WeH78bY3LzZM9eSvGKI4u2?node-id=1-493)、[dissolved](https://www.figma.com/design/WeH78bY3LzZM9eSvGKI4u2?node-id=1-511) |
| J03-R07 / §5 | C07AI群稿 | [chat](https://www.figma.com/design/WeH78bY3LzZM9eSvGKI4u2?node-id=1-107)、[ai](https://www.figma.com/design/WeH78bY3LzZM9eSvGKI4u2?node-id=1-190)、[replace](https://www.figma.com/design/WeH78bY3LzZM9eSvGKI4u2?node-id=1-211)、[inserted](https://www.figma.com/design/WeH78bY3LzZM9eSvGKI4u2?node-id=1-235)、[aisent](https://www.figma.com/design/WeH78bY3LzZM9eSvGKI4u2?node-id=1-259)、[aifailed](https://www.figma.com/design/WeH78bY3LzZM9eSvGKI4u2?node-id=1-552) |
| J03-R08 / §6 | C08通知 | [inbox](https://www.figma.com/design/WeH78bY3LzZM9eSvGKI4u2?node-id=1-35)、[noticeread](https://www.figma.com/design/WeH78bY3LzZM9eSvGKI4u2?node-id=1-61)、[pending](https://www.figma.com/design/WeH78bY3LzZM9eSvGKI4u2?node-id=1-409) |

## 作者检查与证据边界

已实际读取原需求/Demo与旧设计规范；创建独立可编辑Figma Design，并读回全部屏幕文字、字体、原型目标及入口。所有屏幕393×852；字体Arial，无窄于300px的按钮/字段label，无完整UI截图铺底。查看整板合成截图及代表屏截图，已修正控件宽度模式和既有导航。代表截图在本目录evidence，原型连线与快照在figma-readback.json。

通过仓库回归核对输入哈希、每条旅程需求对应节点、原型无缺失目标、范围与阶段边界，以及本包关键隐私状态。读取节点/连线与截图检查不等于完整Presentation逐点击、自由输入、真机、真实服务或独立QA。

未在Figma模拟自由文本、完整键盘、多设备读位/分页与前后台、网络传输、真实OAuth/邮件/幂等、服务端区间鉴权。重入与host解散是独立合成角色/外部事件快照，不是主用户可执行的权限开关。

Figma文件仍可变；没有伪造命名版本或冻结ID。manifest固定当前读回/文件哈希，Owner尚未审阅通过。文件变更后必须刷新受影响映射和证据；后续是否启动RD/QA由用户另行授权。
