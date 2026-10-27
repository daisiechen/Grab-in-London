# r11 J02定向修复交接（待独立复验）

01来源保持：Published1:719→Host statement19:1152/确认19:1324，背景始终仅host1/4；Confirm后19:997仍1/4，未替用户Approve。已更新host-only再次打开用19:1518/19:1692，Cancel回19:997。原Approved2人3:3907/5:188不改；已经更新2人3:4021打开新19:1888/19:1995，取消回同更新态，不退Needs update。Pending/Declined/Updated分别取消确认19:650/19:765/19:875，Keep各回原源事实；只有显式Approve变Confirmed。

02地址：Review及Ready/Terms/失败/未知衍生态原Place & time内显示The Little Table · 14 Sample Lane, London W1，卡片/下组/确认区已随长文重排。该地址来自冻结PM sample-place-soho-01的合成候选；旧v13视觉店名The Little Table作为该演示候选的视觉别名，非真实provider许可/分店验证。生产由已选placeId许可displayName/address提供，不硬编码别名或样例街道。

03终态：取消5种来源各自最新详情，Back→19:211 Cancelled父级，卡片用5个互斥二分条件回本次真实终态；不返回旧确认/已完成草稿。拒绝后6:185 Back→19:241 Hosting父级→同Declined详情；旧回执3:4329 Back也回6:185，不能靠BACK复活Approve。系统minimum不足明确Cancelled · Minimum not met，不写Host reason。真实服务器事实/幂等仍须实现验证。

04长确认：Costs与Confirmed的碎片字符串重组为单一322宽/84高段落；Review与Ready重组为完整安排核对句＋分离44pt下划线Read cancellation terms，打开条款不勾选本人确认，父级原生checkbox反应不等子链接反应。下游卡片/动作跟随重排，未缩字凑屏。未勾选Publish沿原禁用反馈，原无reaction保留。

原生完整读回与布局框在figma-readback.json；全图仍可变，无命名版本API。固定样例/条件导航是设计原型，未声称真实服务、任意输入或新Presentation全链通过。原作者只修，不自签；PJ-ADMIN独立复验后才本版开发方案。

截图边界：Review整屏用contentsOnly隔离导出以排除画布浮层干扰；表单滚动下方的单行节点导出受祖先clip无法作为视觉证据，已弃用空白crop，长确认区域以实际原生边界与独立Presentation滚动复验为准，不冒称已看不可见截图。

## R11-I2-05 Costs 助手避让

只改 Costs `1:449` 与本人已确认 `4:164`：复用v13原Tuck Fancy to edge样式（64px白色圆角外形、48px原SVG、原paw；右侧x349），默认边缘折叠。原helperDockPosition允许fraction=1，此处固定原底部停靠y678；点击折叠入口展开原助手，原hide再折叠（原生可编辑bool变量动作，非服务AI）。未删助手、未改品牌。两个状态独立变量，不改变本人确认门槛。

读回金额底边最大655.54 < 助手顶部678；任何正向页面滚动s使金额y减s，因此折叠和展开均不遮预算。新入口36:293/36:308，原展开1:577/4:269，hide1:589/4:281。`evidence/r11-costs-helper-readback.json`记录真值/绑定/动作/bbox；前后原生截图及scroll420截图已保存。滚动截图是临时原生content平移−420截图后恢复y0，不冒称Presentation实点。原助手在底部可能覆盖右侧空白触区边缘，但Continue文字/主点击中心保持可见；自由拖动与真实助手服务未验证。

原v13对照：既有old-costs.png + prototype.css helper-launch/is-tucked/paws与assistant.ts helperDockPosition。自有Playwright本轮启动EPERM立即退出，未新增环境；未伪称新源浏览器截图。独立复验待PJ-ADMIN，尚未自签05关闭。

## Published 编辑入口/取消与瞬时提示修复候选

R11-I2-PROT-01：真实首测Published无可见编辑路径，违反J02无人获准前可编辑规则。新增56:2028 Edit arrangements从原Published按钮组可达56:290；原Arrange/Introduce/Costs/确认/Review/确认布局及字段按原生节点复用，标题Edit meal，最后Save changes本人确认，不重复Publish。各页左上Cancel明确回Published1:719，取消保原1/4 host与安排。首guest批准的3:3809、3:4021保原disabled编辑(.45、无reaction)。图中仅原固定字段样例；任意真实输入/跨端409/全部约束仍需求+状态合同，未声称服务已实现。源picker/terms/AI稿保留编辑来源，避免回原创建流程。

R11-I2-PROT-02：发布toast原为永久遮挡，新2s AFTER_TIMEOUT隐藏，点击提示可立即关闭；Save changes使用Your changes are saved回执，原Publish保原文案。截图r11-published-edit-entry.png为原生滚动位置临时平移展示入口，变量默认截图仍可见toast，不冒称计时实测；r11-edit-arrange.png查看Cancel和原布局。发布content已恢复y0。

此次增量evidence/r11-published-edit-readback.json独立绑定新增帧/动作及Published变动，原figma-readback和历史独立签署不改写为新实测。待PJ-IOS-DEV2同Browser实际复验，原作者不自签。

## R11-I2-PROT-03 / 04 同态布局与最低人数

首次r11-published-edit-entry.png暴露Maps链接下面两个说明TEXT同y−0.75导致重叠，live核实。03将第二行放到14.25，说明块30.25px；同源host-only衍生声明底图一并修同一错误。新r11-published-layout-min3.png实际查看两行分离且下方标题保足间距。

04实际Arrange最低3/容量4已选中，原Published及Review最低2漂移；仅统一这条代表路径到3–4/Minimum3 Capacity4，host-only来源与编辑/Review/Terms/失败恢复摘要同步。不禁止业务合法最低2，不更改confirmed1/4或2/4事实、不增加审批。源历史独立签署保留，新增delta r11-published-layout-min3-readback.json叠加最新修复事实；首次问题截图保留。新图临时滚动位置已恢复0，toast计时仍交实际Browser复验，不用原生静态图判计时失败。
