# 实施验证与发布门槛 v1

本轮只有设计包及文档验证，尚无生产后端。下述业务测试是Claude后续必须实现的验收，不把场景文本冒充已执行测试。[任务表](../../tasks/todo.md)列明依赖；[场景清单](acceptance-scenarios.json)是机器可查的最小覆盖矩阵，不能替代PRD全量验收。

## 1. 验证层次与命令

当前可运行：`python3 -m unittest discover -s tests -v`，`git diff --check`；原型`demo`的`test:domain`、`check:runtime`、`test:sites`和`admin`的`test`为历史规则回归。只改文档无需重做视觉截图，但不得改受保护runtime来躲检查。

**以下脚本尚不存在**，T00创建独立pnpm workspace时落实名称，不能声称当前已通过：

| 后续命令 | 必须做什么、失败条件 |
| --- | --- |
| pnpm core:check | 所有新packages/apps typecheck、lint、schema引用、生成SDK无漂移、未用字段/secret扫描；不改Demo锁文件 |
| pnpm core:test:unit | 纯规则边界、IANA时区、过滤与手算指标；不连接外部服务 |
| pnpm core:test:db | 临时真实Postgres17，迁移空库+升级库、CHECK/partial unique/FK、两连接并发/回滚/死锁重试；禁止SQLite替代 |
| pnpm core:test:api | schema、公开/本人/host/其他人/support/analyst权限、cookie/CSRF、幂等、receipt及provider失败；test identity provider仅test环境 |
| pnpm core:test:web | Playwright覆盖公开浏览→登录→申请→批准→群消息→饭后；含断网/409/权限撤销、后台五页/同快照导出 |
| pnpm core:test:ios | 原生组件/SDK契约、Expo开发构建和设备流程；真机证据另附，不能用DOM测试替代 |
| pnpm core:test:release | fixture禁入生产、env完整、角色/MFA、迁移、备份恢复删除台账、worker重启、发布smoke |

生产环境必须拒绝TEST_AUTH、FIXTURE_PLACES、开发固定OTP等适配器；测试adapter只能在test构建与隔离DB。真实身份/地点/邮件沙箱与CI mock证据分别记录，不用fixture通过关闭G-AUTH/G-PLACES/G-MAIL。

## 2. 必须实现的场景与证据

[清单](acceptance-scenarios.json)每项有ID、taskIds、前提、动作、断言；实现后在测试名称保留Sxx，并在任务PR/提交证据记录命令、时间、commit、环境、结果。最关键的并发测试用barrier控制两个DB连接而非sleep碰概率：先占meal锁，审批请求开事务等待，时间越过截止再放锁，应拒绝并提交EXPIRED/取消；同理2审批争最后席位仅1成功。conversation锁测试让JOIN/MESSAGE/LEAVE交错，验证提交顺序与seq及游标不跳读。

指标使用可手算fixture，覆盖同一用户多轮申请、host、空值、本人/host冲突、支持更正、非成熟结果、迟到、DST周、ProductSurvey最新版本先取后筛；逐个指标的分子、分母、排除项、页面/CSV一致，不能只测图表能渲染。旧快照受普通纠错不变，删除则410并清cache/CSV；新快照数值按清理政策重新生成。

真实设备证据必须含iOS系统浏览器登录回流、邮箱OTP、SecureStore退出清除、前后台消息补拉、原生键盘不遮挡、Google地图/照片署名、DST歧义输入和删除receipt；Web测试同业务规则。用户未授权发布时只本地/已有测试环境，不擅自创建付费项目或上架。

## 3. 环境、运行与运维

待创建`.env.example`仅名称/说明，真实值不入Git：DATABASE_URL、AUTH_ISSUER/AUDIENCE/CLIENT_ID（secret由密钥管理）、WEB_ORIGIN、IOS_REDIRECT_ALLOWLIST、SESSION_KEY_ID、CURSOR_SIGNING_KEY、PLACES_*、MAIL_PROVIDER_*、MAIL_FROM、PRIVACY_POLICY_VERSION、RETENTION_POLICY_JSON、ENVIRONMENT、LOG_LEVEL。生产启动校验TLS/allowlist、cookie安全、fixture关闭、保留政策已配置、角色/MFA要求；secret轮换保留keyId的兼容验证窗口，不打印值。

API `/health/live`只表明进程；`/health/ready`校验DB/迁移版本，不同步调用Places/Auth0阻塞每次探针。worker心跳/最早未完成dueAt/最久outbox age可观察；结构化日志requestId/operation/actor伪名/aggregateId/errorCode/latency，无token、OTP、邮箱、chat和私密选择。告警：生命周期延迟>60s、邮件死信、删除步骤失败、快照失败>2小时、start_roster重建不一致、异常401/429、DB死锁/连接池饱和。阈值为初始工程配置，真实负载验证后调整。

本地compose仅Postgres；staging API+worker+DB同模型，生产托管DB加TLS/自动备份。G-HOST必须记录供应商、地区、预算、恢复目标与实测；默认演练目标RPO≤24h、RTO≤4h只是设计目标，不是已达成承诺。先按100并发、1000测试账户、10000消息测审批/轮询/快照争用，记录p95、错误率、连接池及worker延迟，必要时调poll/索引，不为未知规模预拆微服务。成本和供应商合同不得由Agent自动接受。

部署：API固定单实例/Recreate（不得滚动重叠或蓝绿；扩容先AI context ADR），发布会话失效提示与未发文字保留→备份→兼容expand迁移→API/worker新版本→readiness→两账户smoke（批准、群、撤回、快照）→监控。契约破坏变更先新字段/新版本和客户端兼容，不能立即删旧列。回滚应用版本必须兼容已应用迁移；不自动down丢数据。job以唯一键和租约恢复，不清表重跑；故障恢复先重放删除/epoch台账、确认已撤销export失效，再开放流量。

## 4. 阶段验收和准入结论

- 设计包验收：精确文件哈希、双方审查、任务依赖无环、场景覆盖、文档引用有效；不等于业务实现通过。
- 本地核心完成：T00—T32中适用实现/测试完成，外部依赖可明确blocked_external；只能称本地/测试核心，不可称真实MVP。
- 真实核心验收：G-AUTH/PLACES/MAIL/IOS/PRIVACY/HOST全部证据闭合；设备/恢复/支持可运行。真凭据未有时继续不依赖它的切片。
- **完整产品发布必须完成真实AI方案A00—A09的实现、评测与核心联调**。本包已包含依据FR-13/P-04/P-05的AI设计，尚未实现；不能把核心T任务完成称完整MVP发布。

阻塞分开记录：产品未决才是requirements blocker；供应商配置/条款/签名是external gate；实现测试失败是engineering blocker；AI包未就绪是完整产品release blocker。执行者不得把一类完成当另一类关闭。

AI运行补充：先停后启/重启旧AI会话410，支持角色不等于ai_budget_ops；UNKNOWN对账只能按提供方账单证据操作并审计，不能重发模型请求解锁预算。
