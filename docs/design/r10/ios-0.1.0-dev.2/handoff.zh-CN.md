# IOS-0.1.0-dev.2 · J02 UX-r02候选

[Figma可编辑入口](https://www.figma.com/design/c04Fi5iarZm7gTPw4u2f7f?node-id=1-24)，页面0:1。26个正常/必要状态根节点，原生文本/控件/SVG/分离地图及餐厅头像素材，不使用整屏截图作为UI填充。产品版本仍IOS-0.1.0，dev.2仅内部迭代。

复用旧MVP v13 / 361ab04ed6fc55c0f1e041bb5d6cc5d216d1a7b2视觉，业务固定14db53257a2b4bb7610a3afad5e1ecfd735db605；DS-0.1.0由UX-1唯一维护，引用docs/design/r10/system/tokens.json与Figma yUMVg2xpLXQHKPr2ZWpkO3。文件内为源转入本地原生节点，不冒称已发布组件key。源原四步、地图、进度条、ChoiceGroup、字段、费用深绿receipt、Review卡、申请卡、浮层与Ask Fancy保留。PJ已实际看Arrange源/Figma并排并确认方向；Header原分割线与地图链接原矢量/下划线已修。

## 入口与代表路径

- Arrange 1:24 → Introduce 1:340 → Costs 1:449 → 本人声明CostsConfirmed 4:164 → Review 1:594 → 本人最终确认ReviewReady 3:2365 → Published 1:719 → Applicants 1:880 → Approved 3:3809。
- 公开申请资料6:290；拒绝回执3:4329→不可再处理DeclinedResult 6:185。
- 订位声明3:3907→本人勾选5:188→Host-reported更新3:4021。
- 取消确认3:4117→Keep返回或Cancelled 3:4233。餐厅自己联系；群历史保留，群页交J03。
- AI主动草稿3:3526→替换确认3:3669→仍需手动Review/Publish；原文保留分支BACK。
- Reviewer专层3:4644：DST错误3:2803、发布失败3:3248/未知3:3387、409锁冲突3:4432、截止不足3:4538。外部事件不塞入用户屏作为假动作。

## 相对旧Demo的必要业务差异

按已确认首发范围删除Deposit/Fixed menu和Book through app；仅到店各付及host外订声明，原费用receipt只写Pay individually at the restaurant与Budget per person £25–35，不显示平台应付/发布收款行。新增已批准可选菜系/饮食字段、Review最低数/截止/声明来源细节，沿原字段/ChoiceGroup，不更改品牌。申请批准不再出现支付hold与“已通知对方”的虚假投递承诺；首批准锁定、人数变化Needs update及确认门槛补齐。服务失败与恢复用原BottomSheet，原v13没有的服务矩阵保留在状态合同而非无限扩屏。

visual-comparison.html为同393×852对照。Introduce重新采失焦源状态，旧keyboard截图仅历史交互证据；Figma移除平台键盘壳、恢复750高可滚动视口，长内容不压缩。源实际字体为隔离/tmp环境Liberation Sans（Arial度量兼容），Figma仍Arial。硬件壳/island、动态时钟、emoji/定位glyph平台渲染是明确豁免，地图链接使用原生矢量避免蓝底emoji。原分离素材来自repo；真实Places许可与provider内容未伪称已验证。

## 验证和Ready边界

实际浏览器走四步→发布→审核→取消浮层；原生Figma逐根读回文本、图片hash/范围、滚动和prototype动作并截图目视检查。Costs/Review/声明更新的本人确认门槛、锁定、人数2/4、Confirmed可见文字、长锁定提示与按钮间距均定向核对。完整需求/AC映射见coverage.json；每条源单元继承及状态/权限/返回恢复见state-contracts.zh-CN.md。

未运行Figma Presentation逐点完整流程；任意自由输入、原生键盘/动态字号/辅助功能、真实Places/OAuth/OTP/AI/邮件、持久化、交易锁/并发/worker/DST全矩阵未测试。固定样例选择不是自动填写产品规则。J01全身份门槛复用I1、Hosting父级与J03/J04联调尚未串联到跨文件Presentation；这三项如需展示应由PJ协调原包Owner补联调，不另复制整个模块。

UX-r02候选文件仍可变、未冻结，命名版本工具不可用，namedVersionId=null。Owner未批准整包、implementationReady=false；待Owner/PJ审阅、DS一致性和跨文件正常路径Ready核对。不启动RD实现/QA，不操作Git，由PJ串行提交。验证测试是设计证据检查，不能替代产品QA。

验证：`python3 -m unittest discover -s tests -p test_ux_r10_ios2.py`检查固定输入/包完整性、全部需求/AC映射、正常门槛连线、原素材及长滚动；2项通过。`git diff --check`通过。

PJ最后独立读回发现费用数字由“£”和“0.00”分节点组成；已定向移除两个Costs状态中的完整旧金额节点，而非只改整句匹配。全页派生状态扫描剩余0项旧零额/不存在的平台退款文案；取消说明统一自然表达Let the host know if plans change.，最终增量证据为evidence/final-copy-cleanup.json。

r11四类定向修复详见r11-repair.zh-CN.md；来源人数/审核/声明独立，终态无历史BACK复活，完整合成地址与确认长句回原字段内，不扩产品功能。当前42根包含最小必要来源/终态变体，不代表42个开发工作包；仍按一条完整J02交付。待PJ-ADMIN独立复验，未自签。

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
