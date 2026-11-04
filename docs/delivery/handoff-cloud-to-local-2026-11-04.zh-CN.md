# 交接：云端主开发会话 → 本地会话（2026-11-04）

Owner 2026-11-04 决定：此后主要与 Mac 上的本地会话（「Fancy 开发-本地」）协作，云端会话停止主开发。本页是接手入口；规则仍以 [AGENTS.md](../../AGENTS.md)、[Agent 协作说明](../agent-collaboration.md) 与主 PRD r07 为准。

## 1. 代码与分支

- 全部工作在分支 `claude/trusting-bohr-uxr7eh`，最新提交 `1787d52`（已推送，本地与远程一致，工作区干净）。**尚未合并 main**；本地会话的 main 工作区另有未提交改动，合并前先核对、不要覆盖。
- 线上运行版本：`bd0a207`（首尔服务器，2026-10-29 部署）。`bd0a207` 之后到 `1787d52` 新增：上线计划文档、审核员登录（方案 A）。下次部署用 `1787d52` 或之后的 main。
- 合并 main 建议：在干净工作区 `git merge --no-ff origin/claude/trusting-bohr-uxr7eh`，跑全量验证（见 §6），推送后以 main 的 SHA 部署。

## 2. 已上线（https://fancyabite.uk）

- Web 全功能（与 iOS 一致；首页、找饭局地图/列表、饭局页含自动 slug、发起/编辑、审批、群聊与私聊、举报含单条消息、拉黑、饭后评价、头像、删号、设置、法律页）；分享链接预览由 `fancy-web`（serve.ts）生成标题。
- 管理后台 `/admin/`：举报队列与处理（5 类原因、紧急置顶）、J09 出席纠错、五个分析页（含“本周”行、同意样本标注）。
- 服务端：举报自动规则（举报人立即隐藏、7 天 2 人自动限制、30 天自动关闭、每日摘要、紧急提醒）、安全记录保留 12 个月、快照与数据保留期限、注册来源字段。
- 部署：Cloudflare Tunnel `fancy-prod` + 本机 nginx 网关，ss-server 与 443 未动；每日加密备份（Owner 已轮换为新 age 钥匙，私钥在其密码管理器）。手册：[首尔正式环境部署手册](../operations/seoul-production-deploy.zh-CN.md)（含部署记录 §13）。
- Ethan 举报提醒接收口已合并到 Building-Ethan main（`465f165`），**Fancy 侧 `ETHAN_MODERATION_URL/TOKEN` 尚未配置**（步骤见 Building-Ethan `docs/operations/fancy-moderation.md`）。

## 3. 正在卡住的问题（先处理）

**后台员工登录未走通**（2026-11-04 本地会话只读排查结论）：
- `POST /v1/auth/staff/start` 201 → Auth0 → `GET /v1/auth/oauth/callback` 303，但自 10-29 起没有新建任何会话，员工账号只有一条 `amr={otp}` 的旧会话，所以后台一直 `REAUTH_REQUIRED`。
- 最可能原因：Owner 在 Auth0 登录页选了与员工账号未关联的方式（如 Google），员工登录拒绝建号/关联（`flows.ts` FORBIDDEN），回到 `/admin/?signin_error=<code>`，浏览器仍带旧 OTP 会话。
- 待办：① 让 Owner 在 Auth0 页面选**邮箱验证码**登录，并看地址栏 `signin_error=`；② 在 `staffCallback` 记录 `signin_error` 代码到日志；③ 失败时页面明确显示原因（当前被旧会话的“需要重新验证”盖住）；④ 考虑安全登录失败时结束无 MFA 的旧会话。
- Auth0 已配：MFA 因子 One-time Password 开、策略 Never；Post-Login Action `Staff MFA`（仅 `acr_values` 含 multi-factor 时 `api.multifactor.enable`）已部署并挂到触发器。

小问题：后台侧栏“饭局与供需”悬停提示压在 Fancy 标志上（截图见 Owner 10-29 反馈）。

## 4. 上线计划与 Owner 决定

见[上线行动计划](launch-plan-2026-11.zh-CN.md)。截至 11-04：
- 目标 11-30，以全部功能验收通过为前提；首批饭局由 Owner 与朋友开。
- **待 Owner 确认**：11-30 改为“TestFlight + 网站，仅朋友内测”，正式 App Store 公开上架推后（届时请好英国代表）。云端会话已建议，Owner 尚未回复。
- 英国地址：家庭/学校地址不建议（会公开在隐私政策与 ICO 名册）；Owner 倾向直接请 UK GDPR 第 27 条代表（约 £950–1,200/年），已给她询价邮件模板，问清 ICO 登记填什么地址、隐私政策是否只写邮箱即可。家/学校地址不用。
- 审核员登录：方案 A 已实现（`1787d52`），默认关闭；开关步骤见[提交材料 §7](app-store-submission.zh-CN.md)。服务器上的部署套件需先更新到该版本。
- 运营者法定姓名由 Owner 提供，**只在部署时填入法律页，不进公开仓库**。

## 5. Owner 侧待办（Apple 账户已于 11-04 通过）

1. Team ID（developer.apple.com/account → Membership details）。
2. 注册 App ID `uk.fancyabite.app` 并勾选 Sign in with Apple。
3. App Store Connect 新建 App「Fancy: Meet Over a Meal」，English (UK)，SKU `fancy-ios-1`。
4. App Store Connect API Key（App Manager），.p8 自己保管；Issuer ID 与 Key ID 可告诉会话。
5. Sign in with Apple：Services ID + .p8 填进 Auth0 Apple 连接。
6. 之后：TestFlight 构建（Mac 本机 Release + 上传，免费，不用 EAS）、iOS 地图 Key 限定 bundle、Google OAuth 同意屏幕转正式、Auth0 删号管理应用（只给 `delete:users`、`delete:grants`）、Resend webhook、Ethan 密钥、异地备份、ICO 登记、政策占位符、签署 OSA 两份评估与 LIA。

## 6. 验证与环境要点

- Node 24、pnpm 11.25；`pnpm core:check`；`pnpm exec vitest run --project unit|api|db|web|admin`（云端环境下 pg_dump 恢复演练因缺二进制失败，属预期）；`pnpm exec vitest run --project release infra/tests/seoul-deploy.release.test.ts`；`apps/ios`：`pnpm typecheck`、`pnpm exec jest --ci`、`pnpm exec eslint . --max-warnings=0`；`apps/web`：`pnpm test`；`python3 -m unittest discover -s tests`（浅克隆下 25 个 git 历史错误属预期）；`pnpm --filter @fancy/ios e2e:real-api`（需本地 PG 17）。
- 不可编辑：带哈希的冻结文档 `docs/engineering/api-and-client-contract.zh-CN.md`、管理后台 PRD 与测量合约（`tests/test_requirements_traceability.py` 逐行固定）；新操作登记在 `packages/contracts/src/contracts.unit.test.ts` 的枚举列表。
- 安全边界：Google Maps Key、Auth0/Resend 密钥、备份私钥、审核验证码、员工邮箱都不进聊天或仓库；Owner 在自己终端或 `secrets.sh` 录入。不碰 ss-server 与 443。
- Owner 偏好：大白话、短、一步一步、给可点击的完整链接，并说清每个链接是哪个网站的。
