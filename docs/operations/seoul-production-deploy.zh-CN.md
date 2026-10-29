# 首尔正式环境部署手册

日期：2026-10-29｜负责人：Claude Code（部署套件与执行）、Owner（账号授权与密钥）｜状态：套件已就绪，尚未在服务器执行

本手册把 Fancy 正式环境（Web、`/v1` API、`/admin/` 后台、法律页面）部署到既有腾讯云首尔服务器，域名 `fancyabite.uk`。执行者是 Owner Mac 上的 Claude 会话，通过 `ssh tencent-seoul` 操作；凡是需要 Owner 登录账号、点授权或输入密钥的步骤，都标为 **Owner**，由她本人完成。部署套件在 [`infra/deploy/seoul/`](../../infra/deploy/seoul/)，依据的决定见[接手计划 §6、§8](../delivery/claude-takeover-plan.zh-CN.md)。

## 1. 硬性边界

- 服务器公网 443 端口属于 Owner 依赖的代理 ss-server。套件**不停止、不重启、不改配置、不占用**它及其端口；每个改动服务器的脚本开始和结束时只读记录 ss-server 进程与 443 监听状态，前后不一致会醒目提示。安装软件包期间用 `policy-rc.d` 禁止任何包脚本启停服务，并让 needrestart 永不自动重启它。测试 `infra/tests/seoul-deploy.release.test.ts` 会拦截任何触碰 443/ss-server 或防火墙的改动。
- 不开放任何入站端口：公网流量经 Cloudflare Tunnel（cloudflared 主动外连）进入；nginx、API、PostgreSQL 都只监听 127.0.0.1。ufw 保持现状（未启用），套件不改防火墙。
- 系统自带 Node 20（`/usr/local/bin/node`）不动；Fancy 用独立的 Node 24（`/opt/node24`）。
- 开发环境 `/home/ubuntu/fancy/development-20261025/` 照常使用；早期的 `/home/ubuntu/fancy/releases/`、`shared/` 只读列出、不迁移、不删除。正式环境从空库起步，与开发环境完全分开（目录 `/srv/fancy`、端口、数据库都不同）。Owner 日后可自行决定归档那两个旧目录。
- 密钥只由 Owner 在服务器终端输入，写入 root 所有、权限 0600 的文件；不进聊天、截图、Git 或日志。Claude 会话只运行 `secrets.sh --check`（只显示键名与状态）。

## 2. 架构与关键选择

```
用户 ──HTTPS──> Cloudflare 边缘 ──Tunnel(外连)──> cloudflared ──> nginx 127.0.0.1:8180
                                                                   ├─ 页面导航     → fancy-web 127.0.0.1:3102（写页面头部；挂了退回静态单页）
                                                                   ├─ /assets/、图片、法律页  静态文件（nginx 直接发）
                                                                   ├─ /admin/      后台（静态）
                                                                   ├─ /v1/         → API 127.0.0.1:3100 ──> PostgreSQL 127.0.0.1:5433 (TLS)
                                                                   └─ /healthz     → API /health/ready
worker（无端口）────────────────────────────────────────────────────────────────> PostgreSQL
```

| 选择 | 理由 |
| --- | --- |
| Cloudflare Tunnel | 443 已被代理占用；Tunnel 只需外连，不开入站端口，TLS 证书由 Cloudflare 管理 |
| nginx（Ubuntu 官方包）作同源网关 | API 不提供静态文件，Tunnel 也不能直接发文件；后台必须与 API 同源（cookie 会话 + Origin/CSRF）。nginx 来自 Ubuntu 仓库，安全更新随无人值守升级自动安装。只监听回环，默认站点在启动前删除，不会占 80 端口 |
| 页面头部服务 fancy-web | Web 是单页应用，链接预览机器人与爬虫不执行 JavaScript，只看服务器返回的 HTML。`apps/web/server/serve.ts`（Node 24、无依赖、无密钥）为首页、发现页、饭局页、主页写入标题/描述/canonical/OG/JSON-LD，饭局旧地址 301 到规范地址，并生成 `robots.txt`、`sitemap.xml`。nginx 只把“页面导航”交给它：构建里真实存在的文件（`/assets/`、图片、图标、法律页 CSS）和法律页目录仍由 nginx 直接发，`/v1`、`/admin/` 不经过它；`/index.html` 301 到 `/`，保证首页总带头部。它只监听 127.0.0.1:3102，经回环读取 API 的公开接口（不带访客 Cookie，头部不因访客而变）；不读 `/etc/fancy/fancy.env`。它停了或不响应时，nginx 自动退回普通单页（`@spa`），网站照常可用，只是预览暂时没有饭局标题 |
| 真实客户端 IP | nginx 把 Cloudflare 的 `CF-Connecting-IP` 写成唯一的 `X-Forwarded-For`，API 只信任 `127.0.0.1`（`TRUSTED_PROXY_CIDRS`），客户端伪造的转发头一律丢弃，限流按真实 IP 隔离 |
| Node 24.22.1 装在 `/opt` | 项目要求 Node 24；不替换系统 Node 20，其他服务不受影响。官方压缩包按 SHASUMS256 校验 |
| PostgreSQL 17（PGDG 官方源） | 与开发、测试一致；只听 127.0.0.1:5433（避开开发常用的 5432）。内存按 3.6 GB 整机分配：shared_buffers 512 MB、effective_cache_size 1.5 GB、work_mem 8 MB、最多 50 连接 |
| 数据库 TLS（本机 CA，`sslmode=verify-full`） | 生产配置守卫要求 `DATABASE_URL` 开启 TLS；node-postgres 把 `require` 当作 `verify-full`，自签证书会被拒，所以 bootstrap 生成本机 CA 和 127.0.0.1 证书，API 用 `sslrootcert` 校验。CA 私钥签完即删 |
| 在服务器上按 Git 提交构建 | 仓库公开，服务器无需凭据即可取到确切提交；pnpm 安装的是本机 Linux 包（Mac 是 darwin/arm64）；发布与提交 SHA 一一对应。只装 API、worker、Web、后台四个工作区（约 200 MB，不装 iOS 工具链），只跑两个 Vite 构建、不做类型检查（合并前由 CI/Mac 跑 `pnpm core:check`）。构建在 systemd 临时单元里以 `fancy` 用户运行，内存上限 1800 MB、低 CPU/IO 优先级，不挤占在线 API 与数据库；本机实测构建两端各约 1 秒 |
| 发布目录 + 原子切换 | `/srv/fancy/releases/<时间>-<提交>`，`/srv/fancy/current` 符号链接用 `mv -T` 原子替换；保留最近 5 个发布供回滚 |
| 先迁移、后切换 | 迁移前自动加密备份；新版本先在 127.0.0.1:3101 以候选 API 启动并通过 `/health/ready`，再在 127.0.0.1:3103 以候选 fancy-web（读候选 API）启动并确认写出首页头部，然后才切换正式进程；切换后 API、fancy-web 或网关首页头部不健康就自动退回上一版。回滚到尚无 `serve.ts` 的旧发布时，套件停掉 fancy-web，由 nginx 发普通单页 |
| systemd 托管 | `fancy-api`、`fancy-worker`、`fancy-web`、`fancy-tunnel` 常驻；每日备份、每小时删除台账导出、每 5 分钟健康检查用定时器；服务以 `fancy`/`fancy-tunnel` 系统用户运行并加沙箱限制 |
| 密钥文件 | `/etc/fancy/fancy.env`（root:root 0600）由 systemd 在降权前读取，服务用户本身读不到该文件 |
| 加密备份 | `pg_dump` 直接流入 `age`，用 Owner 的**公钥**加密：服务器能加密、不能解密自己的备份；私钥只在 Owner 的密码管理器里 |
| 日志 | Fancy 服务写入独立 journald 命名空间 `fancy`，保留 30 天，不改系统全局日志设置；nginx 访问日志只记路径不记查询串，保留 30 天；PostgreSQL 日志不记绑定参数，按星期轮转（最多 7 天） |
| 无人值守安全更新 | 开启 Ubuntu 安全更新，不自动重启；若 ss-server 来自 deb 包，把该包排除在自动升级之外（避免升级时被重启；Owner 想让它自动更新时删掉 `/etc/apt/apt.conf.d/53fancy-protect-proxy`） |

### 目录与端口

| 位置 | 用途 |
| --- | --- |
| `/opt/fancy-deploy/` | 部署套件（root 所有；每次切换后从当前发布同步） |
| `/opt/node24` → `/opt/node-v24.22.1-linux-x64` | Fancy 专用 Node 与 pnpm 11.25.0 |
| `/srv/fancy/releases/`、`/srv/fancy/current` | 发布与当前版本（root 所有，服务用户只读） |
| `/srv/fancy/state/` | 发布历史 `history`、上一版 `previous`、最近备份与恢复演练记录、部署锁 |
| `/srv/fancy/cache/` | Git 缓存与 pnpm 仓库（`fancy` 用户） |
| `/etc/fancy/fancy.env`、`web-build.env` | 密钥与构建参数（root 0600） |
| `/etc/fancy/backup-age-recipients.txt`、`pg-ca.crt` | 备份公钥、数据库 CA 证书（公开内容） |
| `/etc/cloudflared/` | Tunnel 配置与凭据（凭据 0400，仅 `fancy-tunnel` 用户） |
| `/var/backups/fancy/db/`、`ledger/` | 加密备份（root 0700） |
| `/var/log/fancy/` | nginx 日志 |

| 端口（均为 127.0.0.1） | 服务 |
| --- | --- |
| 3100 / 3101 | API / 切换前的候选 API |
| 3102 / 3103 | Web 页面头部服务 fancy-web（`apps/web/server/serve.ts`）/ 切换前的候选 fancy-web |
| 5433 | PostgreSQL 17 |
| 8180 | nginx 同源网关 |
| 20241 | cloudflared 指标与 `/ready` |

## 3. 分工

| 步骤 | 谁做 | 说明 |
| --- | --- | --- |
| 合并到 main、CI 通过 | Owner 同意；Claude 会话核对 CI | 正式环境默认只部署 main |
| 上传套件、bootstrap | Claude 会话 | 先 `--dry-run` 给 Owner 看，再正式执行 |
| Cloudflare 授权（tunnel login） | **Owner** | 打开会话给出的链接，登录 Cloudflare，选择 fancyabite.uk |
| 创建 Tunnel、DNS 路由、启动 | Claude 会话 | 若 Cloudflare 报已有记录，由 Owner 在控制台删除旧的根域/www 记录 |
| Auth0、Resend、Google Cloud、Apple 控制台设置 | **Owner** | 见 §5 清单 |
| 生成备份密钥（Mac 上 `age-keygen`） | **Owner** | 私钥存密码管理器 |
| 输入密钥（`secrets.sh`） | **Owner** | 在自己的终端运行，回显关闭 |
| 检查、部署、验证 | Claude 会话 | `secrets.sh --check`、`deploy.sh`、`healthcheck.sh --public` |
| 授予员工角色 | **Owner**（先用员工邮箱登录一次，再执行一条 SQL） | 见 §6.3；邮箱不经过聊天 |
| 恢复演练 | Owner 临时提供私钥文件，Claude 会话运行 | 演练后销毁服务器上的私钥副本 |

## 4. 首次部署步骤

所有命令都在 Owner 的 Mac 上执行（在仓库根目录）。每个脚本都支持 `--dry-run`，并在每一步打印将要做什么。

### 4.0 前置检查（Claude 会话）

```sh
git fetch origin && git status
gh run list --branch main --limit 3          # 目标提交的 CI 全绿
ssh tencent-seoul 'lsb_release -ds; free -m; df -h /; ss -Hltn'   # 只读核对
```

### 4.1 安装基础环境（Claude 会话）

```sh
rsync -a --delete infra/deploy/seoul/ tencent-seoul:/tmp/fancy-deploy-kit/
ssh tencent-seoul 'sudo bash /tmp/fancy-deploy-kit/bootstrap.sh --dry-run'   # 给 Owner 过目
ssh tencent-seoul 'sudo bash /tmp/fancy-deploy-kit/bootstrap.sh --yes'
```

bootstrap 共 12 步：只读盘点（含旧目录与端口）→ 保护代理（needrestart、自动升级排除、`policy-rc.d`）→ 基础包 → PGDG 与 Cloudflare 软件源（PGDG 密钥指纹校验）→ PostgreSQL 17、nginx、cloudflared → 用户与目录 → Node 24 与 pnpm → 数据库（TLS、调优、角色 `fancy_app` 与库 `fancy`）→ nginx（回环、占位页）→ 日志 → 无人值守更新 → systemd 单元与套件安装到 `/opt/fancy-deploy`。可重复运行：已完成的步骤显示 `unchanged`，配置未变时不重启数据库或 nginx。结尾的 “proxy guard unchanged” 表示 ss-server 前后一致。

### 4.2 Cloudflare Tunnel

1. **Owner**：`ssh -t tencent-seoul sudo /opt/fancy-deploy/tunnel.sh login`，打开打印的链接，登录 Cloudflare 并选择 `fancyabite.uk`。命令在授权完成后自动结束。
2. Claude 会话：

```sh
ssh tencent-seoul 'sudo /opt/fancy-deploy/tunnel.sh create'
ssh tencent-seoul 'sudo /opt/fancy-deploy/tunnel.sh route'     # fancyabite.uk 与 www 指向 Tunnel
ssh tencent-seoul 'sudo /opt/fancy-deploy/tunnel.sh install'   # 写配置、校验、启动 fancy-tunnel
ssh tencent-seoul 'sudo /opt/fancy-deploy/tunnel.sh forget-login'  # 删除账号级 cert.pem
```

此时访问 https://fancyabite.uk 应看到占位页 “Fancy is getting ready.”。`mail.fancyabite.uk` 的 Resend 记录不受影响。

3. **Owner**（Cloudflare 控制台，建议）：SSL/TLS → Edge Certificates 打开 Always Use HTTPS；不要对整站开启 Bot Fight Mode / “I'm Under Attack”（会拦截 iOS App 的 `/v1` 请求）；Rocket Loader 保持关闭。

### 4.3 生成备份密钥（Owner，在 Mac 上）

```sh
brew install age
age-keygen -o ~/fancy-backup-key.txt     # 打印的 "Public key: age1..." 是公钥
```

把 `~/fancy-backup-key.txt` 整个存进密码管理器后从磁盘删除；只有公钥会输入服务器。私钥丢失 = 所有备份无法恢复。

### 4.4 输入密钥（Owner）

先完成 §5 的控制台设置，拿到各项值，然后：

```sh
ssh -t tencent-seoul sudo /opt/fancy-deploy/secrets.sh
```

脚本逐项提示（机密项回显关闭，只显示“收到 N 个字符”），自动生成 `SESSION_SECRET`、数据库密码与删除邮件密钥环，最后要求粘贴备份公钥。想复用开发环境已有的值（如 Resend Key）可加 `--import /home/ubuntu/fancy/development-20261025/Fancy/.env`，脚本逐项询问是否采用，值不显示。轮换某个凭据时用 `--reset KEY`。

### 4.5 部署（Claude 会话）

```sh
ssh tencent-seoul 'sudo /opt/fancy-deploy/secrets.sh --check'         # 只看键名与状态
ssh tencent-seoul 'sudo /opt/fancy-deploy/deploy.sh --ref main --dry-run'
ssh tencent-seoul 'sudo /opt/fancy-deploy/deploy.sh --ref main'
ssh tencent-seoul 'sudo /opt/fancy-deploy/healthcheck.sh --public'
```

`deploy.sh` = `release.sh`（取提交、安装、构建、封存）→ `migrate.sh`（生产配置守卫 → 待执行迁移 → 有数据时先备份 → 迁移）→ `switch.sh`（候选 API 与候选 fancy-web 验证 → 原子切换 → 重启 API、worker 与 fancy-web → 健康检查（含网关首页由 fancy-web 写出头部），失败自动退回 → 同步套件 → 启用定时器）→ `healthcheck.sh`。首次部署是空库，全部迁移（截至 2026-10-29 为 0001–0029）依次执行。

## 5. Owner 控制台清单

| 平台 | 要做的事 |
| --- | --- |
| Auth0（UK 租户） | 建议新建 Regular Web Application “Fancy Production”（与开发应用分开，独立 client secret）；Allowed Callback URLs 只填 `https://fancyabite.uk/auth/callback`、`https://fancyabite.uk/v1/auth/oauth/callback`、`fancy://auth/callback`；Allowed Logout URLs 与 Allowed Web Origins 填 `https://fancyabite.uk`；授权类型只开 Authorization Code 与 Passwordless OTP；连接只开 `email`（6 位验证码，发信用 Resend）、`google-oauth2`、`apple`。另建 Machine-to-Machine 应用授权 Auth0 Management API，**只**勾选 `delete:users` 与 `delete:grants`（多勾会被代码拒绝），用于删号时撤销身份。员工 MFA：用 Post-Login Action 只对员工邮箱要求 MFA，确认令牌带 `amr: mfa` 后后台才能用 |
| Google Cloud（fancy-512319） | 服务端 Places Key（`GOOGLE_MAPS_API_KEY`）：仅 Places API (New)，应用限制为服务器出口 IP（在服务器上 `curl -4 https://ifconfig.me` 查看后由 Owner 填入），不得放进 App 或网页。Web 地图 Key（`VITE_PUBLIC_GOOGLE_MAPS_KEY`）：仅 Maps JavaScript API，HTTP 来源 `https://fancyabite.uk/*`。iOS 地图 Key（`EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY`）：仅 Maps SDK for iOS，应用限制为 iOS bundle `uk.fancyabite.app`；它在客户端内，可被提取，所以必须靠 bundle 限制。三个 Key 分开、都设预算提醒与配额上限。OAuth 同意屏幕由“测试”改为“正式发布” |
| Apple Developer | Sign in with Apple：App ID `uk.fancyabite.app` 开启该能力；建 Services ID、私钥（.p8），回调 `https://<租户>.uk.auth0.com/login/callback`；把 Team ID、Key ID、私钥填进 Auth0 的 Apple 连接（私钥只在 Auth0，不进服务器） |
| Resend | 沿用已验证的 `mail.fancyabite.uk`（爱尔兰区）与仅发信 Key；新建 Webhook 指向 `https://fancyabite.uk/v1/webhooks/resend`，事件选 `email.sent`、`email.delivered`、`email.bounced`、`email.suppressed`，签名密钥填 `RESEND_WEBHOOK_SECRET` |
| Cloudflare | §4.2 的授权与建议设置；可选：免费的外部可用性监测（如 UptimeRobot）每 5 分钟访问 `https://fancyabite.uk/healthz` |
| 腾讯云 | 可选：开启云硬盘定期快照作为第二道备份；确认安全组无需为 Fancy 新开端口 |
| 政策文本 | 填好 `docs/policies` 占位符后发布；`PRIVACY_POLICY_VERSION` 与生效日期一致，`RETENTION_POLICY_JSON.deletionReceiptDays` 与 `{{DELETION_RECEIPT_RETENTION}}` 一致，备份保留 35 天与 `{{BACKUP_RETENTION}}` 一致，日志保留 30 天与 `{{LOG_RETENTION}}` 一致 |

## 6. 验证清单

### 6.1 自动检查

`healthcheck.sh --public` 全部 PASS：六个服务运行（含 fancy-web）；API live/ready；fancy-web 在 127.0.0.1:3102 写出页面头部，网关的 `/discover` 由它返回、`/robots.txt` 由它生成，公网首页带服务器写入的头部；网关首页、`/privacy`、`/terms`、`/guidelines`、`/support`、`/admin/` 为 200；`/v1` 到达 API（未知路径返回 API 自己的 404 与 `x-request-id`）；Tunnel 已连接；密钥文件 0600；磁盘与内存；ss-server 与 443 仍在（只读观察）。

### 6.2 人工核对（Owner 与 Claude 会话一起）

- [ ] 浏览器打开 https://fancyabite.uk，首页、饭局列表、地图正常；四个法律页可读且 URL 无斜杠也能打开。
- [ ] 用邮箱验证码登录 Web（真实邮件到达，发件人 `Fancy <noreply@mail.fancyabite.uk>`）；Google 登录回流成功。
- [ ] iOS 正式构建（`EXPO_PUBLIC_API_BASE_URL=https://fancyabite.uk`）可登录，含 Apple 登录。
- [ ] 上传头像后能显示；地点搜索返回真实餐厅（服务端 Places Key 生效）。
- [ ] 后台 https://fancyabite.uk/admin/ 用员工邮箱登录并通过 MFA，举报队列可打开。
- [ ] Resend 控制台看到 webhook 投递成功。
- [ ] `ssh tencent-seoul 'sudo systemctl start fancy-backup.service && sudo cat /srv/fancy/state/last-backup'` 产生第一份加密备份；随后做一次 §8 的恢复演练。
- [ ] 把一个饭局链接贴进 iMessage/WhatsApp/Slack，预览显示饭局标题与描述；`curl -s https://fancyabite.uk/discover | grep og:title` 有结果。
- [ ] `ssh tencent-seoul 'ss -Hltn'`：除原有端口外，Fancy 只新增 127.0.0.1 上的 3100、3102、5433、8180、20241（3101、3103 只在切换时短暂出现）；443 仍由 ss-server 监听。

### 6.3 授予员工角色

Owner 先在 Web 用自己的员工邮箱登录一次（创建账号），然后**在她自己的终端**执行下面的命令（邮箱是私人信息，不经过聊天；如她愿意告诉会话，也可由 Claude 会话代为执行）：

```sh
ssh tencent-seoul "sudo -u postgres psql -p 5433 -d fancy -v email='<员工邮箱>'" <<'SQL'
INSERT INTO roles (user_id, role, granted_by)
SELECT c.user_id, r.role, 'owner-bootstrap'
FROM private_contact c CROSS JOIN (VALUES ('support'), ('analyst'), ('data_admin')) AS r(role)
WHERE c.email = lower(:'email')
ON CONFLICT DO NOTHING;
SQL
```

### 6.4 分析覆盖起点

首次运行 `secrets.sh` 时 `ANALYTICS_COVERAGE_START` 留空。API、Web、iOS 的采集在生产实测都通过后，Owner 运行 `ssh -t tencent-seoul sudo /opt/fancy-deploy/secrets.sh --reset ANALYTICS_COVERAGE_START`，填三者实际覆盖起点中最晚的 UTC 时刻（如 `2026-11-20T00:00:00Z`），再由 Claude 会话 `sudo systemctl restart fancy-worker`。在此之前快照保持 partial，属预期。

## 7. 日常发布与回滚

发布：合并到 main、CI 通过后，`ssh tencent-seoul 'sudo /opt/fancy-deploy/deploy.sh --ref main'`。同一提交再次构建会直接复用（`release.sh --rebuild` 强制重建）。

迁移规则：迁移只能前进，且新迁移在切换前就执行，旧版本会短暂运行在新表结构上，所以迁移必须是**加法**（加表、加列、加索引，新列可空或有默认值）；删除或改名分两次发布完成。

回滚（只回退代码，不回退数据库）：

```sh
ssh tencent-seoul 'sudo /opt/fancy-deploy/rollback.sh --dry-run'
ssh tencent-seoul 'sudo /opt/fancy-deploy/rollback.sh --yes'                  # 回到上一版
ssh tencent-seoul 'sudo /opt/fancy-deploy/rollback.sh --to <发布ID> --yes'      # 指定版本
```

若数据库已有目标版本不认识的迁移，脚本会拒绝；确认那些迁移是加法后再加 `--allow-newer-schema`。需要撤销数据变更时走 §8 的恢复流程。`switch.sh` 在新版本不健康时已自动回滚，历史见 `/srv/fancy/state/history`。

## 8. 备份、恢复演练与真实恢复

- 每日 04:20（伦敦时间）完整备份，每小时第 47 分导出删除台账，均为 `age` 加密文件，保留 **35 天**（与隐私通知 `{{BACKUP_RETENTION}}` 一致；最新一份完整备份始终保留）。迁移前另有一份 `pre-migrate-*` 备份。
- 异地副本（待 Owner 决定）：备份目前只在同一台服务器上，服务器整体损坏时无法恢复。可选：① Owner 的 Mac 定期 `rsync` 拉取 `/var/backups/fancy`（文件已加密）；② 写 `/etc/fancy/backup-offsite.sh` 上传到 Cloudflare R2 等对象存储（脚本对每个新文件自动调用）；③ 腾讯云硬盘快照。24 小时 RPO 需要至少一种。
- 恢复演练（建议上线前一次、此后每季度一次）：

```sh
# Owner：从密码管理器取出私钥，临时放到服务器（只有 root 可读）
scp ~/fancy-backup-key.txt tencent-seoul:/tmp/k && ssh tencent-seoul 'sudo install -m 0600 -o root /tmp/k /root/fancy-backup-key.txt && rm -f /tmp/k'
# Claude 会话：
ssh tencent-seoul 'sudo /opt/fancy-deploy/restore-drill.sh --identity /root/fancy-backup-key.txt --shred-identity'
```

演练把最新备份恢复到独立库 `fancy_restore_drill`，核对表数量、最新迁移、几张主表行数，解密最新台账，记录耗时到 `/srv/fancy/state/restore-drills.log`，最后删除演练库并销毁私钥副本。只输出计数与耗时，不输出任何数据。

- 真实恢复（数据损坏时，按[运行说明](../../infra/README.md)恢复章节）：停 API 与 worker（`systemctl stop fancy-api fancy-worker`；Tunnel 与 nginx 照常运行，网页可开但 `/v1` 不可用）；导出当前删除台账（若源库可读）；把备份恢复到新库并迁移到当前版本；对新库执行 `FANCY_OFFLINE_RECOVERY=1 node infra/recovery.ts arm` 再 `replay`（台账必须比备份新）；把 `DATABASE_URL` 指向新库（`secrets.sh --reset DATABASE_URL` 会重建密码，或手工调整库名）；启动 API 与 worker，`healthcheck.sh` 通过后恢复访问。目标 RTO 4 小时，以演练实测为准。

## 9. 监控与日志

| 看什么 | 命令 |
| --- | --- |
| 健康状态 | `sudo /opt/fancy-deploy/healthcheck.sh`；定时检查失败时 `systemctl --failed` 会列出 `fancy-healthcheck.service` |
| API/worker/fancy-web/Tunnel 日志 | `sudo journalctl --namespace=fancy -u fancy-api -u fancy-worker -u fancy-web -u fancy-tunnel --since -1h` |
| 网关日志 | `/var/log/fancy/nginx-access.log`、`nginx-error.log` |
| 数据库日志 | `/var/log/postgresql/fancy/` |
| 最近备份/台账 | `/srv/fancy/state/last-backup`、`last-ledger` |
| 发布历史 | `/srv/fancy/state/history` |

内核安全更新需要重启服务器才生效，套件不会自动重启（会中断 Owner 的其他服务）；需要时由 Owner 选时间手动重启，重启后所有 Fancy 服务自动启动。cloudflared 与 PostgreSQL 来自第三方源，每月由 Claude 会话检查一次 `apt list --upgradable` 并在 Owner 同意后升级。

## 10. 环境变量清单

“来源”说明值从哪来；“机密”为是的值只能由 Owner 在 `secrets.sh` 中输入或由服务器生成。全部写入 `/etc/fancy/fancy.env`，除非另注。

| 变量 | 值或来源 | 机密 | 说明 |
| --- | --- | --- | --- |
| `ENVIRONMENT` | 模板默认 `production` | 否 | 启用生产守卫 |
| `DATABASE_URL` | `secrets.sh` 生成密码并拼出 `postgresql://fancy_app:…@127.0.0.1:5433/fancy?sslmode=verify-full&sslrootcert=/etc/fancy/pg-ca.crt` | 是 | 同时设置数据库角色密码 |
| `AUTH_ADAPTER` | `auth0` | 否 | 测试身份适配器被守卫拒绝 |
| `PLACES_ADAPTER` | `google` | 否 | |
| `MAIL_ADAPTER` | `provider` | 否 | 走 Resend |
| `AI_PROVIDER` | `disabled` | 否 | 本版不上线 Ask Fancy |
| `DEV_FIXED_OTP` | 必须不存在 | — | 固定验证码在生产被拒 |
| `WEB_ORIGIN` | `https://fancyabite.uk` | 否 | cookie 写入的 Origin |
| `ADMIN_URL` | `https://fancyabite.uk/admin/` | 否 | 摘要邮件里的后台链接 |
| `SESSION_SECRET` | 服务器生成（64 位十六进制） | 是 | CSRF 与限流哈希 |
| `IOS_REDIRECT_URI` | `fancy://auth/callback` | 否 | 须在 Auth0 回调名单中 |
| `AUTH0_DOMAIN` | Owner：Auth0 应用页 | 否 | 如 `<租户>.uk.auth0.com` |
| `AUTH0_CLIENT_ID` | Owner：Auth0 正式应用 | 否 | |
| `AUTH0_CLIENT_SECRET` | Owner：Auth0 正式应用 | 是 | |
| `AUTH0_MANAGEMENT_CLIENT_ID` | Owner：M2M 应用（可选，建议） | 否 | 没有时删号停在 NEEDS_SUPPORT |
| `AUTH0_MANAGEMENT_CLIENT_SECRET` | Owner：M2M 应用 | 是 | 只授 `delete:users`、`delete:grants` |
| `GOOGLE_MAPS_API_KEY` | Owner：Google Cloud 服务端 Places Key | 是 | 只在服务器，限 Places API (New) 与服务器出口 IP |
| `DEEPSEEK_API_KEY` | 必须不存在 | — | AI 关闭 |
| `AI_BUNDLE_FILE` | 必须不存在 | — | AI 关闭 |
| `RESEND_API_KEY` | Owner：Resend 仅发信 Key | 是 | |
| `RESEND_FROM` | `Fancy <noreply@mail.fancyabite.uk>` | 否 | |
| `RESEND_WEBHOOK_SECRET` | Owner：Resend Webhook 签名密钥（可选，建议） | 是 | `whsec_` 开头 |
| `DELETION_MAIL_KEY_VERSION` | 服务器生成 `v1` | 否 | 与下一项一起生成 |
| `DELETION_MAIL_KEYS_JSON` | 服务器生成 AES-256 密钥环 | 是 | 删号通知邮件地址加密 |
| `ANALYTICS_COVERAGE_START` | 首次留空；Owner 在生产采集验证后填写 | 否 | 见 §6.4 |
| `PORT` | systemd 单元设置（API 3100，候选 3101；fancy-web 3102，候选 3103） | 否 | **不得**写入 env 文件 |
| `HOST` | `fancy-web.service` 设置 `127.0.0.1` | 否 | 只给 fancy-web；不在 env 文件 |
| `FANCY_API_ORIGIN` | `fancy-web.service` 设置 `http://127.0.0.1:3100`（候选读 3101） | 否 | fancy-web 读取公开饭局/主页的地址；不在 env 文件 |
| `FANCY_PUBLIC_ORIGIN` | `fancy-web.service` 设置 `https://fancyabite.uk` | 否 | canonical、OG、sitemap 里的网址；不在 env 文件 |
| `PRIVACY_POLICY_VERSION` | Owner：隐私通知生效日期 | 否 | 生产必填 |
| `RETENTION_POLICY_JSON` | Owner：G-PRIVACY 批准，如 `{"accountDeletionApproved":true,"deletionReceiptDays":30}` | 否 | 生产必填；`accountDeletionApproved` 为 Owner 的明确声明 |
| `LOG_LEVEL` | `info` | 否 | |
| `TRUSTED_PROXY_CIDRS` | `127.0.0.1` | 否 | 只信任本机 nginx |
| `SUPPORT_EMAIL` | Owner：支持收件箱 | 否（私人信息，不进仓库） | 每日举报摘要收件人 |
| `MODERATION_AUTO_HIDE_REPORTERS` | `2` | 否 | 7 天内不同举报人数阈值 |
| `ETHAN_MODERATION_URL` | Owner（可选） | 否 | 举报摘要推送 Ethan，另一分支正在加入；代码合并前留空 |
| `ETHAN_MODERATION_TOKEN` | Owner（可选） | 是 | 同上 |
| `VITE_PUBLIC_GOOGLE_MAPS_KEY` | Owner：Web 地图 Key，写入 `/etc/fancy/web-build.env` | 否（会出现在网页代码中） | 仅构建时读取；限 HTTP 来源 |
| `VITE_PUBLIC_GOOGLE_MAPS_ID` | Owner：Web Map ID，写入 `web-build.env` | 否 | |
| `EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY` | Owner：iOS 构建环境（Mac / EAS），不在服务器 | 否（在 App 内） | 必须限制为 bundle `uk.fancyabite.app` |
| `EXPO_PUBLIC_API_BASE_URL` | iOS 构建：`https://fancyabite.uk` | 否 | 不在服务器 |
| `EXPO_PUBLIC_LEGAL_BASE_URL` | iOS 构建：`https://fancyabite.uk` | 否 | 不在服务器 |

另有两项非环境变量的服务器文件：备份公钥 `/etc/fancy/backup-age-recipients.txt`（`secrets.sh` 最后一步输入）与 Tunnel 凭据 `/etc/cloudflared/<id>.json`（`tunnel.sh create` 生成）。

## 11. Owner 必须亲自完成的事项

1. 同意合并到 main 并开始部署。
2. `tunnel.sh login`：在浏览器授权 Cloudflare 的 fancyabite.uk；如有冲突的旧 DNS 记录，在 Cloudflare 控制台删除。
3. Auth0：正式应用、回调名单、email/Google/Apple 连接、M2M 应用（仅两个权限）、员工 MFA Action。
4. Google Cloud：三个 Key 的限制（服务端 Key 限服务器出口 IP、Web Key 限域名、iOS Key 限 bundle）、预算提醒、OAuth 同意屏幕转正式。
5. Apple Developer：Sign in with Apple 的 Services ID 与私钥，并填进 Auth0。
6. Resend：Webhook 与签名密钥。
7. 在 Mac 上 `age-keygen` 生成备份密钥，私钥存密码管理器。
8. 运行 `secrets.sh` 输入全部密钥与设置（含 `SUPPORT_EMAIL`、`PRIVACY_POLICY_VERSION`、`RETENTION_POLICY_JSON` 的 G-PRIVACY 声明）。
9. 决定异地备份方式（Mac 拉取、R2 或腾讯云快照）。
10. 上线前用自己的员工邮箱登录一次并执行 §6.3 的角色授予；恢复演练时临时提供私钥文件。
11. 生产采集验证通过后设置 `ANALYTICS_COVERAGE_START`（§6.4）。
12. 填写并发布政策文本占位符，保持保留期与本手册一致。

## 12. 已知限制

- 单机部署：服务器宕机即服务中断；API 与 worker 都只能单实例（见[运行说明](../../infra/README.md)）。
- 数据库与应用同机，备份默认也在同机，异地副本待定（§8）。
- fancy-web 每次页面导航（饭局页、主页）向 API 读一次公开数据，没有缓存；流量大时再加 nginx 微缓存。它只在启动时读一次 `apps/web/dist/index.html`，所以切换发布后必须重启（`activate_release` 已做）。
- 已有服务器上首次部署带 fancy-web 的发布前，要先用新发布里的套件重跑一次 bootstrap（安装 `fancy-web.service` 与 nginx 片段）；`switch.sh` 发现单元缺失会拒绝并给出命令。
- 不设 Content-Security-Policy（Web 地图加载 Google 脚本，需实测后再加）。
- 健康检查失败只在服务器上留记录，没有主动告警；建议接外部可用性监测（§5）。
- 本套件已在本地验证：脚本语法与 shellcheck、模板渲染、systemd 单元校验、真实 nginx 1.24 的页面导航/静态文件/fancy-web 停机退回路由（发布测试在有 nginx 时自动运行，`FANCY_NGINX` 可指定路径）、TLS `verify-full` 连接、非超级用户执行全部迁移、加密备份与恢复管道、生产形态配置下的 API 启动与 `/health/ready`、发布构建脚本；尚未在首尔服务器实际执行，上线以 §6 的验证为准。

## 13. 部署记录

| 日期 | 版本 | 结果 |
| --- | --- | --- |
| 2026-10-29 | `4d918b5`（分支 `claude/trusting-bohr-uxr7eh`，尚未合并 main） | bootstrap、Cloudflare Tunnel（`fancy-prod`，fancyabite.uk 与 www）、secrets、首次部署均完成；公开健康检查全部通过；首份加密备份已生成，每日定时备份启用；ss-server 与 443 全程未变。Auth0/Resend/Google 服务端 Key 沿用开发环境已配置的值（Auth0 为 fancy-dev UK 租户的 BFF 应用）；Web 地图 Key、Auth0 删号管理应用、Resend webhook、Ethan 推送暂未配置。备份密钥在录入当日因私钥误贴入聊天已轮换，旧密钥未加密过任何数据 |
