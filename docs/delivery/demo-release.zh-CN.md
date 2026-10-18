# 可分享体验版发布记录

## 2026-10-18 — 第 8 版：地图交互与助手顶部精简

- 沿用原公开网址与 public 访问模式。GitHub 实现：`69a38d6cd4fe9b7c98b21ff209edfcef416d8f62`；Sites 源码镜像：`e8be1c78c0ef81677f58861b5ce6662df43ad459`。
- 保存版本：`appgprj_6ad2791025408191bf7b3c5bbce7218c~appgver_eac8e088c79c8191a0880a2f7a03312b`（版本8）；部署：`appgdep_6ad4cd4f23d48191a8d123cb361d1ac3`，返回 succeeded。
- 小精灵保留拖动、吸边及收起；补充浏览器触摸事件测试。助手取消尺寸切换和关闭叉，顶部右侧显示 My preferences，保留下拉、外部点击及 Escape 收起。
- 首页地图支持拖动、双指缩放、加减、复位及 Search this area；创建饭局支持餐厅搜索、地图候选和 Use this restaurant 确认，再进入原有后续步骤。
- 114项测试通过：51领域/助手、25浏览器、6打包、32仓库；TypeScript/构建、28文件运行时校验和 diff 检查通过。触摸为 Chromium 合成事件，不宣称实体手机全面兼容认证。
- 线上已刷新并复核欢迎/发现页、地图缩放后 Search this area、助手顶部仅保留偏好入口；未见控制台 warning/error。截图与详细结果：`demo/qa/map-helper-update/`、`demo/qa/browser-results.md`。
- 地图和餐厅仍为本地示例，未接 Google Maps、Places、定位或真实预约 API；未增加依赖或改动受保护运行时。与版本7一致，沿用 pnpm build 构建后由官方 source helper 同步、校验和打包。

## 2026-10-18 — 第 7 版：AI 约饭助手公开体验

- 用户确认更新原公开网址，访问模式仍为 public。手机通过本文公开链接访问；`127.0.0.1:4173` 仅供电脑本地预览。
- GitHub 应用提交：`2638b8eb6181703dae0d31baef557276dd762d07`；Sites 源码镜像：`1867ff77835490beae23327c3a399c409fc58142`，使用该提交的 demo 目录，未包含研究文档的未提交改动。
- 保存版本：`appgprj_6ad2791025408191bf7b3c5bbce7218c~appgver_c37168be1d848191a396f22189ddf31a`（版本7）；部署：`appgdep_6ad4c0ff95748191a7a0e93a3147f0c7`，返回 succeeded。
- 包含可拖拽和收起的小精灵、打开回首页、新对话与偏好管理、消息时间及30分钟无操作重启。
- 发布源码的51项领域/助手测试、6项打包测试、TypeScript/构建和28文件运行时校验通过；此前实现轮的21项浏览器测试通过，本轮30项仓库验证通过。
- 线上浏览器验证欢迎页、Explore tables first、小精灵入口及助手首页，确认尺寸切换和30分钟说明已上线；未进行实体手机语音及触摸兼容性认证。
- AI仍为规则驱动的前端模拟，未接入真实模型、账号、支付、预约或消息发送。
- 通用构建 helper 因现存 npm/pnpm 双锁文件停止；随后沿用现有 pnpm build 构建并通过产物检查，再经官方 source helper 同步及打包。未修改依赖或受保护运行时。

发布日期：2026-10-16（Europe/London）。

公开体验链接：https://grab-in-london-demo.daisie-chen-94.chatgpt.site

## 给体验者

电脑或手机浏览器打开即可。可以先浏览饭局；要体验登录时使用示例邮箱alex@example.com和演示验证码123456，或选择标注为预览的Google/Apple模拟入口。无需输入真实账号密码或银行卡。

这是可交互设计原型：餐厅、用户、预约、付款和消息均为示例。各浏览器的操作互不共享，刷新后状态重置；不会发送邮件、预订餐厅或扣费。当前保留手机设备预览框，支持iPhone和Pixel布局。

## 本次发布证据

- Sites项目：`appgprj_6ad2791025408191bf7b3c5bbce7218c`，登记于`demo/.openai/hosting.json`。
- 访问模式：public，允许拿到URL的访客访问；未邀请或发送邮件给任何人。
- 保存版本：`appgprj_6ad2791025408191bf7b3c5bbce7218c~appgver_b6c8314a1d6481918c35a436997b20ba`（版本1）。
- 部署：`appgdep_6ad27986d1708191b5614b7b286182ce`，服务返回succeeded及公开URL。
- Sites独立源码镜像提交：`ede18f71aa731d391e52cb4efee28ea9f79cba02`。它是发布源仓库的提交，与项目GitHub仓库SHA不同；应用源码来自GitHub的品牌入口版e290b6d，加本站点标识和打包校验测试。
- 通过官方Sites helper同步精确源码，再上传由该状态构建的发布包；GitHub历史不重写。
- 25项自动测试通过：18领域、5服务/打包、2根目录检查；TypeScript/构建和28个受保护运行时文件校验通过。打包保留站点ID，排除凭据。
- 实际线上浏览器验证：品牌欢迎页、Explore tables first、主饭局详情及返回；检查时无console error。没有宣称多人真实服务或真实设备全面回归。

## 后续更新

保留现有project_id和公开访问模式，更新后使用同一项目发布新版本，复用现有URL。不要重复创建站点或改写受保护手机运行时。短期发布凭据只在会话内使用，不写入仓库；构建产物不提交到GitHub。

## 版本2：Inbox权限与设置 — 2026-10-16

- 继续使用同一public URL及Sites项目。
- 应用GitHub实现提交：1071a11347bd385f4c2e0651c6c0e882992f90fd。
- Sites源码镜像提交：f2771da3ad89667d59bc68953dd524d90397137c。
- 保存版本：appgprj_6ad2791025408191bf7b3c5bbce7218c~appgver_361629dcab188191860a289f8d33114b（版本2）。
- 部署：appgdep_6ad27e070c788191a7e20d3b0a976e72，返回succeeded。
- 申请中显示Inbox待办，发起人批准与预付决定群权限；以前确认过的退出成员只读归档。Profile新增Settings，独立退出、重播、重置和有效预览偏好。
- 本地完整路径验证+30项自动测试：23领域/5打包/2根检查。公开站点再次验证模拟登录、申请→Track in Inbox→Waiting for host approval、Settings两项开关；检查时无console error。
- 证据：demo/qa/inbox-settings/live.png及同目录本地流程截图。欢迎页room→seat仅为文案建议，本版本未改动标题。

## 版本3：欢迎页标题确认 — 2026-10-16

用户确认欢迎页标题改为“There’s a seat for you here.”。主Slogan保持“Meet new people over a meal.”，中文版PRD和品牌方向文档同步更新。

- Sites源码提交：78f6071802f6b91f52a8b41c6d64b8bf66ae4fd7。
- 保存版本：appgprj_6ad2791025408191bf7b3c5bbce7218c~appgver_87c6b06ad3708191a02fee9c6560c2fc。
- 部署：appgdep_6ad27ffa42e08191922dd1bc7afaec40，返回succeeded，继续使用原公开URL。
- 实际线上浏览器精确标题匹配通过；截图demo/qa/brand-review/welcome-seat.png。构建、运行时校验、5项打包测试和3项根检查通过。本次仅改欢迎页文案及相关文档，未改业务流程。

## 版本4：Fancy品牌迁移 — 2026-10-18

- 品牌名Fancy；主Slogan为Meet new people over a meal. / 吃个饭，认识一下。；欢迎页和Discover邀约Fancy a bite? / 一起吃点？。There’s a seat for you here.降为欢迎辅助句。
- 界面、字标、浏览器及Open Graph元数据、Sites显示名已同步；保留原公开URL与GitHub仓库名。
- GitHub实现提交：7ee7d1e4f26d6f4f21d13b8d03d7ba3b0d347da0；Sites源码提交：7a30c8b29e4fd26f3907ea76bb2192477925ff7e。
- 保存版本：appgprj_6ad2791025408191bf7b3c5bbce7218c~appgver_23a80dea5cb481918af061403ca8c654；部署appgdep_6ad4062c0c9c819189a03cecdc3b35a0返回succeeded。
- 42项测试通过（23领域/6打包与元数据/13根检查），TypeScript/构建与28文件运行时校验通过。检查本地iPhone与Pixel视觉；线上验证Fancy字标、欢迎/发现页精确标题、账号入口及浏览器标题，未见console error。没有声称本轮重新验证所有付款/聊天流程。
- 截图demo/qa/fancy-brand/live-welcome.png；Fancy仍是暂定名，未完成商标、域名和账号可用性核查。

## 2026-10-18 — 第 5 版：开发用产品界面
- 线上 Fancy 字标首字母大写；默认界面移除原型横幅、演示备注、城市边注和重播/重置入口。
- 场景验收控件收至 `?review=1`，不改变申请审批、支付确认和群聊准入规则。
- PRD 补充开发交付规范及仍未接入的真实服务边界。
- Sites 源提交：`b2f0c5b31880a347f63c15a93d068ba978872372`；发布第 5 版成功。
- 验证：24 项领域/呈现测试、6 项打包测试、13 项文档测试通过；28 个运行时文件完整性通过。浏览器检查默认欢迎、登录、发现页面和独立验收入口。

## 2026-10-18 — 第 6 版：全流程审查与修复
- 已发布到原public网址，访问范围不变。
- PRD v0.4；审查记录：`docs/delivery/full-product-audit.zh-CN.md`。覆盖17个应用路由、6个品牌/账号步骤；修复14类文案、状态、样式与路径问题。
- 修复支付/餐厅独立、取消分类、个人退款快照、按成员屏蔽、个人资料、实际饭局反馈上下文、新建饭局元数据、预约人数更新与符合餐厅营业时段的替代预约。
- 34项领域测试、6项打包测试、17项仓库验证通过；构建与28文件运行时校验通过。
- Sites源提交：`4dbf8b6414f2ced160b27e8a2c7b8262058cd955`；版本ID：`appgprj_6ad2791025408191bf7b3c5bbce7218c~appgver_af37433289e0819187a85338e3b4ae6e`；部署结果succeeded。
- 线上复核：欢迎、正常验证码错误、登录、Meals分类、Settings均符合新文案；无控制台错误。已保存 `full-audit/27-live-code-error-clean.png` 与 `28-live-settings-clean.png`。
- 所有外部服务依旧为前端占位，未增加真实扣款、预约、邮件或举报投递。
