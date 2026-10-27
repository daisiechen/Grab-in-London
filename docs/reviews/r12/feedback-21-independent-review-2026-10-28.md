# r12 · 21条反馈独立验收

当前：21条反馈均在固定样例范围内独立接受；I1与I2 Edit补充为本评审实际点击，I2其余与C21明确引用根PJ真实点击证据。原UX包/PRD/Demo/工程和旧签署未代改。

独立浏览器：已装本地Chromium，继承原proxy/TLS配置，仅公开Figma安全鼠标/滚轮/键盘/截图/只读DOM；无登录/真实账号服务、无cookie/token读取、无DOM改写。自有浏览器已close。

|条目|请求|视觉审查及真实结果|互动|
|---|---|---|---|
|C01|城市位置移至标题右侧，不单独占一行|真实Discover首屏London在标题右侧同行，未再独占一行。|NOT_APPLICABLE|
|C02|预算补图标，元信息图标列与文字基线对齐|卡片£25–35预算前已见money小图标；地点/日期/预算/人数的图标列和文字基线逐行对齐。|NOT_APPLICABLE|
|C03|参与者头像打开对应公开个人主页，不卡片饭局详情|实际依次点击三个头像，分别到Maya77:175、Leo77:277、Emma77:379公开主页；各Back均回Discover5:17，未进入饭局详情。|PASS|
|C04|详情首屏优先重要安排，图片降级不占顶部大图|最新真实详情首屏先有日期19:00London、confirmed3of4、Minimum3含host、money£25–35/person、host与外订各付说明，110px照片在这些之后；1224×609 scale-down也看见整设备。|NOT_APPLICABLE|
|C05|移除重复人数信息，保留唯一必要截止信息|confirmed3of4与Minimum3分别表达已确认数/最低事实，不将最低人数误删；下部只有Applications close23Oct18:00，无旧重复3–4说明段。|NOT_APPLICABLE|
|C06|外订状态标签无串行与文字截断|实际wheel长页后Host books externally标签完整，不与地点/地图说明串行或截断。|NOT_APPLICABLE|
|C07|费用与支付右列不越界、不裁切|费用右列£25–35及At restaurant均完整，右内边距可见，没有越界/裁切。|NOT_APPLICABLE|
|C08|删除认证字标旁无用红箭头|实际Create与Log in首屏均无字标旁多余红箭头，只保留正常返回控件。|NOT_APPLICABLE|
|C09|注册登录模式切换同步选中加粗与对勾|实际Create→Log in后选中粗体/边框/勾同步，Email进入13:174；Back→Create选态复原，Email进入5:355。未发送验证码或调用供应方。|PASS|
|C10|撤回结果移除Track in Inbox追踪入口|直接Pending11:978为合成前提，真实Withdraw request→11:2510确认→Withdraw→11:1191；最终Withdrawn没有Track in Inbox。非仅直达终态截图。|PASS|
|C11|申请页本人身份行移除无用Edit|真实Request a seat页本人Alex身份行未再出现无用Edit。|NOT_APPLICABLE|
|C12|明确App语言首发范围，交流语言能从资料修改|实际Settings English说明→Back→再开→Edit profile→wheel语言字段→selector。首次底图Settings错误已交原UX修；刷新后底图为Edit profile，Cancel保English；选English+Spanish→Save→Profile已存E/S→Edit重进仍E/S→Back仍已存。界面继续English，并非locale切换。|PASS|
|C13|去除逐项optional标注，仅标必填项|实际Profile编辑首屏及wheel下段，Work/School/Hometown无逐项optional，姓名/介绍/生活状态/交流语言/兴趣必填星号保留。原作者长注册/编辑PNG也逐张核对。|NOT_APPLICABLE|
|C14|选餐厅地图使用合理小pin，不用饭局聚合大气泡|见下方I2实际证据补充|见JSON实际方法|
|C15|人数范围合成一组最小值最大值选择|见下方I2实际证据补充|见JSON实际方法|
|C16|预算金额遵守卡内边距和文字基线|见下方I2实际证据补充|见JSON实际方法|
|C17|勾号居中，复选框与说明正文对齐|见下方I2实际证据补充|见JSON实际方法|
|C18|成员头像小于发起人身份头像|见下方I2实际证据补充|见JSON实际方法|
|C19|Save changes单行完整显示在按钮内|见下方I2实际证据补充|见JSON实际方法|
|C20|拒绝申请提供可选预设原因与清楚结果|见下方I2实际证据补充|见JSON实际方法|
|C21|修复底部Inbox换行及中央加号裁切|Inbox单行，加号圆完整，Current/Left/Dissolved来源底栏一致；7张PNG实际查看，非native图冒充Browser。|PASS_FROM_ROOT_TRACE|

C12首次FAIL截图及修后截图、每步鼠标坐标/结果URL/可见状态在JSON；只修selector来源后重新实际Cancel/选择/Save/重入，不用native反应代替click。C04/C05中间修复的预算仍靠后/最低事实丢失风险由root截图评审发现，记录为R12-C04-SUMMARY-01、R12-C05-MINIMUM-01；原UX补预算与Minimum3首屏后，独立刷新实际截图并wheel核长页关闭，不用中间候选冒充最终通过。C10真实Pending→Withdraw确认→Withdrawn后无Track，不是只看终态。

C21根PJ三来源actual trace及七张PNG已独立读取/查看，输入hash全匹配，不冒称本评审人重复点击。

## 限制

- C12 selector Cancel returned editor top, values preserved; native resetScrollPosition:false is not proof actual scroll position retained.
- Language flow fixed English+Spanish sample, no arbitrary locale/language selection or cross-refresh/server persistence claim.
- Some early screenshots preceded asset rendering; final Discover screenshot has fully loaded map/photo/avatars.
- At609 fixed-size viewer initially clips; explicit scale-down fits full device; no claim native iOS layout adaptation tested.
- Floating helper may cover non-target description in long scroll; this review certifies requested C01-13 target areas, not every possible helper/scroll combination.
- Direct Pending/Settings entry establishes synthetic precondition, not real authentication or backend state.
- I2固定样例通过；真实服务、任意输入、跨刷新持久化与真机尚未验证。

作者8项静态检查通过，仅证据保护，不当Browser PASS。输入/全部自有PNG散列已绑定JSON；反馈总表只哈希稳定scope projection，不把其可变管理状态当冻结输入。无代码/QA/部署授权。

## I2最终独立补充

21条目标均在固定样例范围内接受。C14–20引用根PJ真实Chromium trace及23张截图，方法与亲自复点明确分开。独立补测C15：原3–4编辑为2–5后Cancel，Published仍minimum3/1of4，重进Edit仍3–4；再次2–5，经五人外订声明明确勾选、Review minimum2/capacity5、明确勾选Save，Published实际为minimum2/1of5。未使用native目标存在替代点击。

范围弹层首次错误显示Create a meal，保留FAIL图；原UX仅修来源标题后，刷新从Published实际进入Edit及范围，底图明确Edit meal，关闭R12-C15-CONTEXT-01。C18实际头像进入Alex公开页及Back已验；C13实际Introduce的Cuisine/Dietary options无optional；C04/C05派生Published安排/最低/预算在110px次级照片前且唯一Applications close保留。自身浏览器已关闭。

最终root trace JSON/MD、I2 manifest及35个源文件散列已全部核对并绑定JSON；全部自有及引用截图SHA匹配。I1原8项与I2原9项静态检查通过，仅作证据保护。21条固定样例设计反馈接受，本评审停止写入；不修改旧签署，不要求作者manifest自签。
