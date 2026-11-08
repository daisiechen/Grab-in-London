# 交接：本地会话 → Peanut 团队（2026-11-08）

Owner 2026-11-08 决定：Fancy 的后续开发与维护交给 Cumora 的 Peanut 团队，Mac 上的本地会话（「Fancy 开发-本地」）收尾后停手。本页是接手入口；上一份交接见[云端→本地会话交接](handoff-cloud-to-local-2026-11-04.zh-CN.md)，规则仍以 [AGENTS.md](../../AGENTS.md)、[Agent 协作说明](../agent-collaboration.md) 与主 PRD r07 为准。

## 1. 一句话现状

main `248cdf3`（含云端交接分支、审核员登录方案 A、后台员工登录诊断修复）已于 2026-11-08 部署到 https://fancyabite.uk ，公开健康检查全部通过；后台员工安全登录仍待 Owner 用邮箱验证码方式重试确认，iOS 尚未上 TestFlight。

## 2. 代码与分支

- 仓库：https://github.com/daisiechen/Grab-in-London （公开仓库：不放密钥、个人资料、构建产物）。
- main：`248cdf3`（合并 PR 12）。没有开着的 PR。旧分支 `claude/trusting-bohr-uxr7eh`、`claude/staff-signin-diagnostics` 已全部并入 main，可删。
- Peanut 团队：只推 `agent/<agent id>/…` 分支（例如 `agent/rd/…`），经 PR 合并 main；agent 不推 main、不碰服务器。
- CI：`.github/workflows/core.yml`（`verify`，含 PostgreSQL 17、API/db/release 测试与 Python 仓库检查），PR 与 main 推送时运行。合并前必须通过。

## 3. 线上环境（首尔）

- 服务器：腾讯云首尔，ssh 别名 `tencent-seoul`（只配在 Owner 的 Mac 上，带 sudo）。Ubuntu 22.04，2 CPU，3.6GB 内存。
- 当前发布：`20261108T184751Z-248cdf31a60a`，上一版 `20261029T212845Z-bd0a2074d4b5`（可回退）。
- 结构：Cloudflare Tunnel `fancy-prod` → 回环 nginx `127.0.0.1:8180` → API `3100`、fancy-web `3102`；PostgreSQL 17 `127.0.0.1:5433`；部署套件 `/opt/fancy-deploy`（每次切换后从当前发布自动同步）；日志 `journalctl --namespace=fancy -u fancy-api`。
- 完整说明：[首尔正式环境部署手册](../operations/seoul-production-deploy.zh-CN.md)（部署记录见其 §13）。

## 4. 没做完的事

| # | 事项 | 卡在谁 |
| --- | --- | --- |
| 1 | **后台员工登录确认**：Owner 打开 https://fancyabite.uk/admin/ → 安全登录 → 在 Auth0 页面选「邮箱验证码」。成功则进入后台；失败时页面现在会显示原因，日志会记 `staff sign-in did not finish` 与错误代码（如 `FORBIDDEN`）。员工账号只关联了 Auth0 邮箱登录（`email|…`），选 Google 等其他方式会被拒。另需 Auth0 返回 `amr` 含 `mfa`（MFA 因子 One-time Password，Post-Login Action `Staff MFA`） | Owner |
| 2 | **11-30 范围**：是否改为“TestFlight + 网站，仅朋友内测”，App Store 公开上架推后（届时再请英国 GDPR 第 27 条代表）。本地会话建议同意，Owner 尚未明确回复；确认后写入[上线行动计划](launch-plan-2026-11.zh-CN.md) | Owner |
| 3 | **Apple / TestFlight**：Owner 先完成 Team ID、注册 App ID `uk.fancyabite.app`（勾 Sign in with Apple）、App Store Connect 新建 App「Fancy: Meet Over a Meal」（English (UK)，SKU `fancy-ios-1`）、App Store Connect API Key（.p8 自己保管）；把 Team ID、Issuer ID、Key ID 交给 Mac 会话，再由 Mac 本机 Release 构建并上传（不用 EAS） | Owner → Mac 会话 |
| 4 | 审核员登录（方案 A）开关：代码已上线、默认关闭；Owner 在服务器跑 `secrets.sh` 生成审核码并填进 App Store Connect（[提交材料 §7](app-store-submission.zh-CN.md)） | Owner |
| 5 | Ethan 举报提醒：`ETHAN_MODERATION_URL/TOKEN` 未配置（步骤见 Building-Ethan `docs/operations/fancy-moderation.md`） | Owner |
| 6 | 云端交接 §5 其余 Owner 待办：Sign in with Apple 的 Services ID 与 .p8 进 Auth0、iOS 地图 Key 限定 bundle、Google OAuth 同意屏幕转正式、Auth0 删号管理应用（只给 `delete:users`、`delete:grants`）、Resend webhook、异地备份、ICO 登记、政策占位符、签署 OSA 两份评估与 LIA | Owner |
| 7 | Auth0 租户名为 `fancy-dev`（开发租户沿用到正式），上架前确认是否另建正式租户 | Owner 决定 |
| 8 | 后台侧栏“饭局与供需”悬停提示压在 Fancy 标志上（小问题） | 开发 |
| 9 | iOS 模拟器里装的原生开发构建仍是 `fd7d70a`，新 App 图标未显示；需在 Mac 上重新原生构建 | Mac 会话 |

## 5. 构建与测试（确切命令）

环境：Node 24、pnpm 11.25；Python 3.11+（macOS 自带 3.9 跑不了部分脚本）。

```sh
pnpm install --frozen-lockfile
pnpm core:check
pnpm exec vitest run --project unit --project web --project admin
pnpm exec vitest run --project api --project db        # 需要 PostgreSQL 17：FANCY_PG_BIN 或 FANCY_TEST_DATABASE_URL
pnpm exec vitest run --project release infra/tests/seoul-deploy.release.test.ts   # 含 shellcheck
python3 -m unittest discover -s tests
cd apps/ios && pnpm typecheck && pnpm exec jest --ci && pnpm exec eslint . --max-warnings=0
cd apps/web && pnpm test
```

- Owner 的 Mac 没装 PostgreSQL 17 与 shellcheck，api/db 与 shellcheck 依赖 CI。部分 `tests/test_pm_*` 需要产品原型运行环境，本机会报错、CI 正常。
- 不可编辑：带哈希的冻结文档 `docs/engineering/api-and-client-contract.zh-CN.md`、管理后台 PRD 与测量合约（`tests/test_requirements_traceability.py` 逐行固定）。

## 6. 部署到首尔（今后谁来做、要什么）

**前提**：要部署的提交已在 main、CI `verify` 通过；**Owner 本人在聊天里明确同意这一次部署**（其他会话转述不算）。

**执行者**：必须是能 `ssh tencent-seoul` 并 sudo 的会话——目前只有 Owner 的 Mac（本地 Claude 会话或 Owner 本人终端）。按协调会话的说明，Peanut 团队的 agent 不碰服务器，所以部署由 Owner 在 Mac 上亲自执行，或在 Mac 上开一个会话代为执行；若 Owner 决定让 Peanut 侧来部署，需要她另行开通该环境的 ssh 与 sudo 权限，并沿用本节边界。

```sh
SHA=$(git rev-parse origin/main)                       # 必须是完整 40 位 SHA，短 SHA 会 fetch 失败
ssh tencent-seoul 'sudo /opt/fancy-deploy/secrets.sh --check'      # 只看键名与状态
ssh tencent-seoul "sudo /opt/fancy-deploy/deploy.sh --ref $SHA --dry-run"
ssh tencent-seoul "sudo /opt/fancy-deploy/deploy.sh --ref $SHA"   # release → migrate（有数据先备份）→ switch（失败自动退回）→ healthcheck
ssh tencent-seoul 'sudo /opt/fancy-deploy/healthcheck.sh --public'
curl -sS https://fancyabite.uk/healthz                 # {"status":"ready"}
```

- 同一 SHA 需要重新构建（例如改了 Web 构建值）：`release.sh --ref SHA --rebuild --yes` → `migrate.sh --release <发布名>` → `switch.sh --release <发布名>`（`deploy.sh` 不接受 `--rebuild`）。
- 回退：`switch.sh --release 20261029T212845Z-bd0a2074d4b5`（或手册中的上一版）。
- 每次部署的输出结尾必须是 `proxy guard unchanged`。**绝不**停止、重启或改动 ss-server，不占用 443；日志里的邮箱、token、验证码打码。
- 密钥只由 Owner 本人运行 `ssh -t tencent-seoul sudo /opt/fancy-deploy/secrets.sh`（或 `--reset KEY`）录入；会话只跑 `--check`。服务器上的任何只读排查也先问 Owner。
- 部署后在[部署手册 §13](../operations/seoul-production-deploy.zh-CN.md) 记一行。

## 7. 必须由谁做

| 谁 | 事 |
| --- | --- |
| Owner 本人 | 同意每一次服务器动作；录入/轮换密钥；Auth0、Apple、Google、Cloudflare、Resend 控制台；App Store Connect；法律文件签署与 ICO；运营者法定姓名只在部署时填法律页、不进仓库 |
| Owner 的 Mac（ssh / Xcode） | 首尔部署与服务器排查；iOS 原生构建、模拟器验证、TestFlight 上传（Xcode，模拟器 iPhone 18 Pro，开发包 `com.example.fancy.dev`，正式包 `uk.fancyabite.app`）；`apps/ios/.env` 的 Google Maps iOS Key 由 Owner 粘贴，会话只用 `grep -c "^EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY=AIza" .env` 检查是否已填 |
| Peanut 团队 | 代码、文档、测试，在 `agent/<agent id>/…` 分支开 PR；CI 通过后合并 main（按其合并权限）；不碰服务器 |

## 8. 协作偏好

和 Owner 说中文、大白话、短、一步一步；给链接写完整网址并说明是哪个网站。每次改动配测试、提交并推送，核对本地与远程一致。

## 9. 本地会话停手

2026-11-08 起本地会话不再主动改 Fancy 代码；其工作区 `fancy-dev`（分支 `local/staff-signin`、`local/handoff-peanut`）提交本文后清理。Mac 上需要 Xcode 或 ssh 的事，由 Owner 届时指派。
