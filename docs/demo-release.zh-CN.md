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
