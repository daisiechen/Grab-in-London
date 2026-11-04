# 上线行动计划（2026-11-04 起）

背景：2026-11-04 Owner 的 Apple 开发者账户（个人）审核通过。Web 端与管理后台已于 2026-10-29 部署到首尔服务器（https://fancyabite.uk，版本 `bd0a207`，分支 `claude/trusting-bohr-uxr7eh`，尚未合并 main）。本页按阶段排出 Web、iOS、管理后台的上线路径；部署细节见[首尔正式环境部署手册](../operations/seoul-production-deploy.zh-CN.md)，提交材料见[App Store 提交材料](app-store-submission.zh-CN.md)。

## 阶段与负责人

| 阶段 | 内容 | Owner 做 | Claude（云端/Mac 会话）做 | 预计 |
| --- | --- | --- | --- | --- |
| 0 收尾 | 后台员工登录（Auth0 MFA）走通；分支合并 main，生产改为从 main 部署 | 用「安全登录」登录后台并反馈 | 合并、全量验证、按 main 重新部署 | 1 天 |
| 1 Apple 准备 | Team ID；注册 App ID `uk.fancyabite.app` 并开启 Sign in with Apple；App Store Connect 建 App；建上传用 API Key；Apple 登录的 Services ID 与 .p8 填进 Auth0 | 在 Apple 后台点击操作（按清单），密钥自己保管 | 写入 Team ID 与正式配置；iOS 地图 Key 限定 bundle | 0.5–1 天 |
| 2 TestFlight | Mac 本机构建 Release、上传 App Store Connect、内部测试（内部测试无需审核） | 在 iPhone 装 TestFlight 并接受邀请 | Mac 会话构建与上传（免费，不用 EAS） | 1 天 |
| 3 三端验收 | 在正式环境逐项验收 Web、iOS、后台；修 bug 并重新发布 | 按验收清单操作、截图反馈 | 修复、回归、发布 | 3–5 天 |
| 4 合规与运营 | 英国地址（虚拟办公室）；ICO 登记缴费；回国后的英国代表；填政策占位符并发布；签署 OSA 两份评估与 LIA；Google OAuth 同意屏幕转正式；Auth0 删号管理应用；Resend 回调；Ethan 提醒密钥；异地备份 | 购买、登记、签署、控制台操作 | 比价与材料、填占位符、生成法律页、配置与验证 | 与阶段 2–3 并行，约 1 周 |
| 5 提交审核 | 截图、商店文案、隐私标签、年龄分级、审核员账号与示例饭局 | 在 App Store Connect 提交 | 准备截图与材料、建审核账号 | 审核通常 1–3 天 |
| 6 上线 | 标记内部/测试账号；确认采集后设分析起点；记录上线日；首批饭局（避免空城） | 发出首批饭局、邀请种子用户 | 上线当天检查与监控 | 1 天 |

## 关键依赖

- 阶段 2 依赖阶段 1（App ID、App 记录、API Key）。
- 阶段 5 依赖阶段 3 通过与阶段 4 中的：政策占位符已填并发布、ICO 已登记、支持邮箱可用。
- App 提供 Google 登录时，Apple 审核指南 4.8 通常要求同时提供一种可隐藏邮箱的隐私登录（实际上就是 Apple 登录），所以阶段 1 一并完成；否则需在首发版暂时去掉 iOS 的 Google 登录。

## 待 Owner 决定

1. 目标上线日期。
2. 首批饭局与种子用户：谁来开第一批局、几桌、哪几天。
3. App Store 审核员账号用哪个邮箱（建议新建专用邮箱）。
4. 元旦后回国：选英国代表服务（代表地址可同时作为对外地址）还是在英国期间先用虚拟办公室。
