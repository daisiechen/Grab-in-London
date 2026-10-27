# DS-0.1.0 通用设计规范候选

[Figma规范入口](https://www.figma.com/design/yUMVg2xpLXQHKPr2ZWpkO3?node-id=2-70) · [控件与状态](https://www.figma.com/design/yUMVg2xpLXQHKPr2ZWpkO3?node-id=7-4) · [原卡片、导航与助手](https://www.figma.com/design/yUMVg2xpLXQHKPr2ZWpkO3?node-id=7-43)

本版保留Owner认可的原MVP v13视觉，未获Owner批准为冻结开发基线。旧UX-r01为被否定的历史候选。可编辑原生节点、语义变量与组件来自原源码和实际正常操作截图；地图/餐厅照片/人物/桌面插画为离散内容资产，未以整屏截图冒充可编辑UI。此规范是DS源文件，不是已发布live library。

## 1. 真源与资产

视觉真源为v13/app361ab04；业务沿14db532及有效决定。精确hash见manifest；规划取3c81b27快照，不把会变的进度JSON整体hash当设计输入。品牌资产维持原Fancy字标、橙色右上箭头与table插画。[新增Logo候选](../brand/handoff.zh-CN.md)独立待Owner选择，不自动替换界面。

原素材索引见manifest.sourceContentAssets：london-map为合成几何底图；restaurant、maya、leo、emma与brand-table延续原Demo内容用途和许可边界，不冒称真实Places照片或已获得新商业许可。正式照片/地图的署名与授权按原PRD关口核对。

## 2. Tokens、字体和布局

机器可读真源[tokens.json](tokens.json)，Figma基础板2:70同步展示。Forest #123f35、ink #10241f、muted #6c746f、border #e4e7e2、ivory #f5f2e8；语义名action/primary、text/primary、separator/default等绑定原生变量。保留原surface、选中、错误和focused状态，不新增品牌调色板。

字体Arial，Figma实际Regular/Bold；原600/700/900映射可用Bold，表单、标题、正文、caption/eyebrow均沿原字号/行高/字距。源浏览器缺Arial时曾回退DejaVu，已用/tmp度量兼容Liberation Sans重新取图；这只是截图环境修复，产品未改字体。中文由原生平台适当回退，不把Linux偶然字体当新规范。

参考393×852pt，顶部54/底部34为参考系统安全区。实际使用safeAreaInset，不把设备外壳/动态岛/系统时钟画入App组件。普通页边距21，Discover16，入口24；按原section27、field7、chip8、form列12。主要按钮45pt/圆角11，字段43pt/圆角9，chip可见38、quick35，最小触控扩展44pt。保留原map预览图116×150、13gap、真实密度和头像32；中心Create53pt凸起，原五项底导航及SVG。

## 3. 最小组件与适用上下文

| 家族 | Figma节点 | 变体及规则 |
|---|---|---|
| Button | 6:12 | Default/Disabled/Processing，Label属性；横向按钮文字可HUG或FILL但必须实测不窄换行；禁止以禁用色冒充保存成功 |
| Field | 6:20 | Default/Focused，Label/Value属性；入口暖白、普通App白底；错误复用5:2、文本与边框同时表达 |
| Choice | 4:128/4:136 | 原选中/未选中chip；选中不只靠颜色，保留勾选语义 |
| QuickFilter / Calendar / Sheet | 4:15 / 5:6 / 5:151 | 草稿、Apply、Clear、关闭不应用；过去日不可选、未来日可选；多日期OR |
| MealCard / Avatar / map pin | 4:23 / 4:101 / 4:104 | 原图文比例、含host总人数与已确认分开；真实内容图片填充，标签可编辑 |
| Bottom navigation | 4:70 | Discover/Meals/Create/Inbox/Profile；当前项视觉+辅助标签；认证和全屏编辑按原规则隐藏 |
| Assistant launcher | 4:108 | 原sprite胶囊与轻阴影、home/preferences/conversation形态；不替换为整宽Ask按钮 |
| Header / Inline error | 4:121 / 5:2 | 原返回层级；失败保稿、有文本反馈；错误不当空结果 |

跨文件无法导入未发布组件时，各文件使用最小本地副本并记录DS-0.1.0来源；不宣称live library或跨文件同步。版本Figma允许必要细化，但应先更新规范修订，避免漂移。原source-to-native.js只用于将实测源DOM/素材移成可编辑节点，不是重用被否定的通用screen-builder。

## 4. 交互、键盘与无障碍

打开页不触发业务/模型写入。按钮按下、处理中、失败、成功有不同反馈；一在途时避免重复发送。原生Return/Back及关闭sheet恢复上级上下文；未保存编辑取消恢复确认值。长正文、表单、偏好sheet允许滚动，固定操作不能被键盘和home indicator遮挡。邮箱/验证码使用相应键盘与自动填充提示；可见标签不由placeholder替代；错误附在字段及可访问摘要；焦点不靠颜色、VoiceOver读出角色/当前值/选择及disabled。

Figma为393pt代表视口，Dynamic Type、横屏/小屏/系统键盘与VoiceOver属于后续实现和设备验证；本轮给出约束，不称已经真机验证，也不把服务未实现列作设计未完成。

## 5. 核对与版本边界

三屏同态对照在I1 evidence/compare-discover/detail/form.png，PJ已实际看过方向；后续修正浅分隔线、右上箭头与输入字重，并保存新版对照。豁免外壳、时钟、指针，核对地图、照片、卡片密度、导航、表单及助手形态。DS截图final-ds-controls/cards已实际查看；原生变量、组件、文字样式读回见evidence/final-readback.json。

本轮候选可供Owner审阅；未安装系统依赖、未接真实服务、未启动RD/独立QA。Figma文件仍可变；实际命名版本API不可用，不伪造版本ID或冻结。Owner选择Logo和批准最终设计冻结是后续治理项。
