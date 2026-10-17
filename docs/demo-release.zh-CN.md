# 可分享体验版发布记录

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
