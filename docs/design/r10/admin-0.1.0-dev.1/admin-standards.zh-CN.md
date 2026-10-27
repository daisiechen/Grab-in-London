# 后台原MVP复用规范 · UX-r02候选

本文件只整理既有后台规范及版本路径差异，不重设计品牌，不代替DS-0.1.0。视觉真源为`admin/`原产品Demo；`apps/admin`工程实现、PM简化Demo及被Owner否定的UX-r01均不是视觉真源。业务以冻结旅程PRD优先，历史模拟支付/平台订位不恢复。

## 布局、密度与字体

- `admin/src/styles.css`：228px浅侧栏、69px顶栏、主内容左右38px、顶部32px、最大1570px；指标三列等宽、间隔17px；主要趋势与覆盖/证据面板1.85:1、间隔20px。Panel白底、14px圆角、23px内边距；不替换成森林绿通栏或整宽按钮说明卡。
- 源字标Georgia Bold Italic 39px，内容Arial并按平台回退PingFang SC/Microsoft YaHei；指标Avenir Next/Arial 41px；主标题29px，面板标题16px，表格/控制11–12px，口径注释沿既有11px规则。Figma正文中文使用可用Noto Sans SC、拉丁Arial和字标Georgia，属于源字体平台回退的显式映射，不改CSS字体栈。
- 仅沿用源semantic tokens：forest #123f35、citrus #d7ee79、surface #fff、ink #203d33、muted #758279、border #e4e9e2、cream #f6f7f3、amber #9b6529。源图表/状态色与离散素材原样保留，不强制把所有色压成全局新主题。
- 保留源Icon、Panel、Badge、NativeSelect/MultiSelect、DataTable、Empty、DetailDialog的结构与密度。实际源码SVG与图表向量保留可编辑；未将整UI截图贴入交付。

## 输入、导航与反馈

日期原生控件显示由浏览器/OS决定，日期草稿和已应用范围分开，主动应用；非法日期不覆盖有效结果。保留7/28/90快捷范围、多选、隐藏条件chip、重置和更多筛选弹层。弹层外点/焦点离开/Escape/路由切换关闭，关闭还焦点；选择过程中不重建整个页面。

侧栏/顶栏保留原信息层次，产品版本只激活当前范围；源中的J12体验留存专门页不因视觉复用被签发。J10概览的weekly、14天激活、30天再赴约仍保留。J11写分类受data-admin和当前状态约束，分析者不显示可执行写入动作；J09不扩成客服导航/队列。

指标卡与图表提供口径/数据点可见标签；口径抽屉宽min(620px,100%)、满视口高、header padding25px 28px、body28px、源遮罩#203d3340并blur2px。展开/逐层返回时保留snapshot/asOf/definition/filter及触发控件；Escape或关闭恢复焦点，受限/撤销数据不得借返回缓存复活。

## 响应式、语言与可访问性

沿源1000px以下图标侧栏、640px以下横向导航；长表仅自身横滚，页面不横溢，详情抽屉缩至视口。按1440/1024/864/390目标核代表长表、筛选和详情，不绘制五页×每宽度×每错误的重复组合。后台窄屏是已批准后台适配，不是移动Web产品。

中文默认、英文切换；保路由、已应用日期/业务筛选、搜索/排序及当前业务结果。语义按钮/名称、焦点轮廓、键盘/读屏状态文字、图表文本、reduced-motion沿原契约。Figma图层/截图不能证明真实键盘、读屏或浏览器原生输入通过。

## 同态对照与边界

同目录evidence的source-overview/source-drawer来自本轮临时纯前端副本的真实Chromium操作，1440×1000视口、fullPage截图；figma-overview/figma-drawer为对应原生组件化新稿。原文件未修改，依赖只读复用，缓存在/tmp；无真实后台或provider调用。

Linux初始Arial会回退DejaVu，已用临时Liberation Sans度量兼容配置重取最终源截图，CSS未改；Figma捕获将字体映成Inter/Tinos等，交付稿已恢复源映射。日期原生输入的值和calendar indicator在捕获中缺失，已按源DOM补回；源花形字标的Unicode被渲为emoji，已按原形补为可编辑SVG；CSS backdrop在捕获中缺失，已补源遮罩。这些是转译纠偏，不是新设计。
