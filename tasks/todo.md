# 核心执行任务 v1

> 执行状态说明（2026-10-21起，Claude为本表唯一写入者）：`docs/engineering/review-manifest.json`固定的是提交`4659fdb`中已共同审查的设计快照，不随执行更新；本表仅“状态”值与“完成记录”随实施演进，任务定义/依赖/文件/验收/验证保持快照原文，由`tests/test_core_plan.py`对照该提交校验。执行环境与命令见本表末“执行环境”。

## 执行环境（本机，2026-10-21）

- Node 24.19.0/pnpm 11.25.0不在系统PATH，使用Codex运行时内置版本；PostgreSQL 17.11为EDB官方macOS二进制（get.enterprisedb.com，签名Team 26QKX55P9K），解压到用户目录`~/.local/share/fancy-pg17`，无root、无Docker。`source infra/dev-env.sh`设置PATH与`FANCY_PG_BIN`；也可用`FANCY_TEST_DATABASE_URL`指向`infra/compose.yml`的本地Postgres17。测试库只接受loopback且版本必须17。
- 验收启动：`source infra/dev-env.sh && pnpm install --frozen-lockfile && pnpm core:check && pnpm core:test:unit && pnpm core:test:db && pnpm core:test:release`；`core:test:api/web/ios`在对应切片落地前故意以退出码2失败。
- 本机缺完整Xcode（仅CommandLineTools），iOS模拟器/真机构建阻塞G-IOS：需用户从App Store安装Xcode并`sudo xcode-select -s /Applications/Xcode.app`；有测试iPhone。

## 用户外部决定与门槛现状（2026-10-21经Codex转达）

- AI模型供应商：DeepSeek；费用硬上限人民币50元/月。技术包A03文件名`providers/openai.ts`为已审查快照原文，实施按用户决定用DeepSeek适配（`AI_PROVIDER=deepseek`），差异须由Codex在设计文档登记ADR，本表不改任务定义。
- 托管：优先评估腾讯云首尔服务器（G-HOST）；尚无域名、托管数据库及Auth0/Google Maps/邮件/Apple/Expo账号 → G-AUTH/G-PLACES/G-MAIL/G-IOS/G-HOST/G-AI-*真实验收为blocked_external，本地实现与测试继续。
- 流程：完成后先交Codex自测，通过后由「测试- MVP+AI」会话独立测试；docs/qa/为额外只读验收输入。

初始全部任务为`todo`。依据[入口](plan.md)及技术包；列出的路径是目标写入范围，不是已存在文件。每片一个负责人，单次提交保持可验证；测试文件随对应切片创建。新证据文档若放docs/，同提交补docs/README.md。T03外部spike可与T02并行研究，写入/集成仍串行。

## T00 工作区与验证骨架

- 状态：done；依赖：无。
- 文件：`package.json`, `pnpm-workspace.yaml`, `infra/compose.yml`, `packages/testkit/`；相应测试就近创建。
- 验收：建立独立core脚本和Postgres17测试DB；保留demo/admin原入口和锁文件；生产fixture配置启动即失败。
- 验证：`core:check / core:test:release`。
- 外部依赖/证据：无。
- 完成记录：commit a1da509（2026-10-21）。命令：`source infra/dev-env.sh && pnpm core:check && pnpm core:test:unit && pnpm core:test:db && pnpm core:test:release`。结果：check通过（2包typecheck+infra、eslint 13文件、secret scan）；unit 11/11、db 4/4（真实PostgreSQL 17.11临时集群）、release 8/8；demo `test:domain` 63/63、`check:runtime`、`test:sites` 6/6及admin `test` 31/31仍通过，锁文件未改。证据：`packages/config/src/config.unit.test.ts`、`packages/testkit/src/postgres/server.db.test.ts`、`infra/tests/workspace.release.test.ts`。生产fixture拒绝由`check-env.ts`预检验证；API/worker入口在T02接入同一`loadConfig`。

## T01 请求响应schema与SDK

- 状态：in_progress；依赖：T00。
- 文件：`packages/contracts/`, `packages/client/`；相应测试就近创建。
- 验收：逐端点落实operationId/DTO/error/If-Match；OpenAPI与SDK由同schema生成；五页slug及survey枚举固定并验证未知字段拒绝。
- 验证：`schema生成漂移+API contract tests`。
- 外部依赖/证据：无。
- 完成记录：未实施；commit/命令结果/证据待执行者填写。

## T02 迁移与事务内核

- 状态：todo；依赖：T01。
- 文件：`packages/db/`, `apps/api/src/common/`, `apps/worker/src/runner/`, `packages/testkit/db/`；相应测试就近创建。
- 验收：只建通用user/幂等/审计/outbox/notifications/jobs/privacy_control迁移、runner租约及短事务锁工具；业务schema由各切片随自己的迁移创建，不能声明全部业务表已完成；普通30天与永久资源去重协议分开。
- 验证：`core:test:db（通用幂等/锁/租约fixture，不提前声称饭局并发测试通过）`。
- 外部依赖/证据：无。
- 完成记录：未实施；commit/命令结果/证据待执行者填写。

## T03 真实身份可行性spike

- 状态：todo；依赖：T01。
- 文件：`docs/engineering/evidence/auth-spike.md`, `packages/testkit/providers/`；相应测试就近创建。
- 验收：核实Auth0邮箱OTP/Google/Apple和禁自动合并；Expo开发构建回调与双身份证明；删除Auth0及Apple revoke/SMTP能力写证据，失败不假完成。
- 验证：`真实租户+开发构建手工证据 S03`。
- 外部依赖/证据：G-AUTH/G-IOS；无凭据则blocked_external，可继续T04 fake合约。
- 完成记录：未实施；commit/命令结果/证据待执行者填写。

## T04 会话与身份API

- 状态：todo；依赖：T02。
- 文件：`apps/api/src/identity/`, `packages/db/schema/identity.ts`, `packages/client/auth.ts`；相应测试就近创建。
- 验收：实现opaque session/rotation/CSRF/state nonce PKCE/handoff；双proof链接不静默搬业务历史；真实provider接T03，test adapter禁生产。
- 验证：`core:test:api S03 S04`。
- 外部依赖/证据：真实验收依赖T03。
- 完成记录：未实施；commit/命令结果/证据待执行者填写。

## T05 资料、角色与Web登录回流

- 状态：todo；依赖：T04。
- 文件：`apps/api/src/profiles/`, `apps/web/src/features/auth/`, `apps/web/src/features/profile/`；相应测试就近创建。
- 验收：公开DTO白名单、私密字段拒绝；18+/社区/资料gate；登录保留草稿主动重提，后台role/MFA服务端校验。
- 验证：`core:test:api / core:test:web S05`。
- 外部依赖/证据：G-AUTH真实验收。
- 完成记录：未实施；commit/命令结果/证据待执行者填写。

## T06 地点适配与选店Web

- 状态：todo；依赖：T05。
- 文件：`apps/api/src/venues/`, `apps/web/src/features/venues/`, `docs/engineering/evidence/places-policy.md`；相应测试就近创建。
- 验收：confirm placeId不信客户端地址；Google字段许可/缓存/署名和地图错误；搜索区域/返回选择保持，无手填绕过。
- 验证：`core:test:api / core:test:web S06`。
- 外部依赖/证据：G-PLACES真实验收；fixtures隔离。
- 完成记录：未实施；commit/命令结果/证据待执行者填写。

## T07 创建/编辑/预约声明切片

- 状态：todo；依赖：T06, T30。
- 文件：`apps/api/src/meals/publish.ts`, `apps/web/src/features/create/`, `packages/domain/time.ts`, `packages/db/schema/meals.ts`；相应测试就近创建。
- 验收：按P-03严格DST；host占位并调用T30 JOIN/排作业；锁定后编辑的guard以fixture测试，真实首guest永久锁在T10集成；声明stale不伪造预约。
- 验证：`core:test:db / core:test:web S07（S08真实批准集成留T10）`。
- 外部依赖/证据：无。
- 完成记录：未实施；commit/命令结果/证据待执行者填写。

## T08 发现/详情/本人Meals

- 状态：todo；依赖：T31。
- 文件：`apps/api/src/meals/read.ts`, `apps/web/src/features/discover/`, `apps/web/src/features/meals/`；相应测试就近创建。
- 验收：游客投影+筛选地图一致；本人申请/行程不公开；返回保持过滤，纯projectLifecycle不写库/争锁；五分区/双语/预算/多日期；菜系饮食分支交T32在P-05下实现，最终验收前不冒称完整发现已完成。
- 验证：`core:test:api / core:test:web S05 S09`。
- 外部依赖/证据：无。
- 完成记录：未实施；commit/命令结果/证据待执行者填写。

## T09 申请、撤回与多轮历史

- 状态：todo；依赖：T08。
- 文件：`apps/api/src/meals/applications.ts`, `apps/web/src/features/apply/`, `packages/db/queries/applications.ts`；相应测试就近创建。
- 验收：有效申请唯一/每轮独立；DECLINED不可重申，withdraw可；重试不重复、pending不占位。
- 验证：`core:test:db / core:test:web S10`。
- 外部依赖/证据：无。
- 完成记录：未实施；commit/命令结果/证据待执行者填写。

## T10 审批、退出与取消

- 状态：todo；依赖：T09。
- 文件：`apps/api/src/meals/decisions.ts`, `apps/web/src/features/host/`, `packages/db/queries/seats.ts`；相应测试就近创建。
- 验收：并发最后一席只1批准；截止后不可批；取消终态通知事实和首guest锁同事务，席位退出不退群。
- 验证：`core:test:db / core:test:web S01 S02 S11`。
- 外部依赖/证据：无。
- 完成记录：未实施；commit/命令结果/证据待执行者填写。

## T11 生命周期调度与历史名单联调

- 状态：todo；依赖：T10。
- 文件：`apps/api/src/meals/lifecycle.ts`, `apps/worker/src/lifecycle/`, `packages/db/queries/rosters.ts`；相应测试就近创建。
- 验收：接T31已完成函数与T02 runner；worker/在线共用补齐；迟到按截止和开始历史；等号退出排除、开始后保留他人、jobs重试不重复。
- 验证：`core:test:db S01 S12 S13`。
- 外部依赖/证据：无。
- 完成记录：未实施；commit/命令结果/证据待执行者填写。

## T12 群区间、消息与Inbox

- 状态：todo；依赖：T11。
- 文件：`apps/api/src/messaging/`, `apps/web/src/features/inbox/`, `packages/db/queries/conversations.ts`；相应测试就近创建。
- 验收：JOIN/MESSAGE/LEAVE统一序号与提交序；历史union无空档，LIVE撤权停止；cancel/end可聊、dissolve永不重开。
- 验证：`core:test:db / core:test:web S14 S15`。
- 外部依赖/证据：无。
- 完成记录：未实施；commit/命令结果/证据待执行者填写。

## T13 出席与饭后评分

- 状态：todo；依赖：T12。
- 文件：`apps/api/src/post-meal/attendance.ts`, `apps/api/src/post-meal/experience.ts`, `apps/web/src/features/post-meal/`；相应测试就近创建。
- 验收：7天半开窗口，self>host，unknown独立；有效资格评分1..5修订；无默认全员出席。
- 验证：`core:test:db / core:test:web S16 S17`。
- 外部依赖/证据：无。
- 完成记录：未实施；commit/命令结果/证据待执行者填写。

## T14 个人公评与发布

- 状态：todo；依赖：T13。
- 文件：`apps/api/src/post-meal/reviews.ts`, `apps/web/src/features/reviews/`；相应测试就近创建。
- 验收：双方出席/禁止自评；互评或7天发布；纠错立即撤出公开、版本不重复计。
- 验证：`core:test:api / core:test:web S18`。
- 外部依赖/证据：无。
- 完成记录：未实施；commit/命令结果/证据待执行者填写。

## T15 互选、拉黑与私聊

- 状态：todo；依赖：T14。
- 文件：`apps/api/src/connections/`, `apps/web/src/features/connections/`, `packages/db/queries/pairs.ts`；相应测试就近创建。
- 验收：单方私密且7天选择；每次发送锁内重算依据；撤回/block清双方，解除不恢复，另一有效饭局可保连接。
- 验证：`core:test:db / core:test:web S19 S20`。
- 外部依赖/证据：无。
- 完成记录：未实施；commit/命令结果/证据待执行者填写。

## T16 独立产品问卷

- 状态：todo；依赖：T13。
- 文件：`apps/api/src/post-meal/survey.ts`, `apps/web/src/features/settings/survey.tsx`；相应测试就近创建。
- 验收：again null与false分开；七枚举去重/不能全空；不接mealId/不受7天出席限制。
- 验证：`core:test:api / core:test:web S21`。
- 外部依赖/证据：无。
- 完成记录：未实施；commit/命令结果/证据待执行者填写。

## T17 站内通知与关键邮件

- 状态：todo；依赖：T12。
- 文件：`apps/api/src/notifications/`, `apps/worker/src/mail/`, `apps/web/src/features/notifications/`；相应测试就近创建。
- 验收：按事件收件人渠道唯一；批准拒绝过期取消邮件与站内；失败不回滚席位，UNKNOWN处理/死信告警。
- 验证：`core:test:db / provider inbox evidence S22`。
- 外部依赖/证据：G-MAIL真实验收。
- 完成记录：未实施；commit/命令结果/证据待执行者填写。

## T18 举报与受审计支持CLI

- 状态：todo；依赖：T15。
- 文件：`apps/api/src/support/`, `apps/support-cli/`, `apps/web/src/features/settings/reports.tsx`；相应测试就近创建。
- 验收：receipt本人可查；support MFA+case+reason+version；逾期出席更正同命令重算，无任意SQL或chat默认读权。
- 验证：`core:test:api / core:test:db S20 S23`。
- 外部依赖/证据：G-AUTH MFA/运营负责人。
- 完成记录：未实施；commit/命令结果/证据待执行者填写。

## T19 删除屏障与清理作业

- 状态：todo；依赖：T18, T17。
- 文件：`apps/api/src/accounts/`, `apps/worker/src/deletion/`, `apps/web/src/features/settings/deletion.tsx`；相应测试就近创建。
- 验收：reauth后同步撤权/未开始cancel leave/pending withdraw/群区间关闭；预存receipt可恢复各provider和内容清理；本片只实现privacy epoch和删除台账屏障，快照发布/410联调必须到T23才验收。
- 验证：`core:test:db / core:test:api S24；S25联调留T23`。
- 外部依赖/证据：G-PRIVACY/G-AUTH；分析快照联调在T23。
- 完成记录：未实施；commit/命令结果/证据待执行者填写。

## T20 授权采集与匿名关联

- 状态：todo；依赖：T16。
- 文件：`apps/api/src/analytics/ingest.ts`, `packages/client/analytics.ts`, `apps/web/src/features/analytics/`；相应测试就近创建。
- 验收：按契约事件schema/consent/身份/环境；重复eventId不重计；前端不能伪造批准/出席成功。
- 验证：`core:test:api S26`。
- 外部依赖/证据：无。
- 完成记录：未实施；commit/命令结果/证据待执行者填写。

## T21 快照计算和手算指标

- 状态：todo；依赖：T20, T19。
- 文件：`apps/worker/src/analytics/`, `packages/domain/metrics/`, `packages/db/queries/snapshots.ts`；相应测试就近创建。
- 验收：REPEATABLE READ输入清单/修订hash；逐项采集契约分子分母；迟到更正新快照，Survey先最新再日期筛。
- 验证：`core:test:db S17 S21 S27`。
- 外部依赖/证据：无。
- 完成记录：未实施；commit/命令结果/证据待执行者填写。

## T22 后台五页与分类

- 状态：todo；依赖：T21。
- 文件：`apps/api/src/admin/`, `apps/admin/src/`, `packages/client/admin.ts`；相应测试就近创建。
- 验收：复用五页视觉，角色服务端校验；过滤/下钻绑定snapshot；分类审计只data_admin且新快照生效。
- 验证：`core:test:api / core:test:web S27 S28`。
- 外部依赖/证据：无。
- 完成记录：未实施；commit/命令结果/证据待执行者填写。

## T23 导出、隐私与快照撤销联调

- 状态：todo；依赖：T22。
- 文件：`apps/api/src/admin/exports.ts`, `apps/worker/src/deletion/snapshots.ts`, `apps/admin/src/features/exports/`；相应测试就近创建。
- 验收：CSV与页面同快照并防公式；删除受影响snapshot全410/cache导出失效；新快照清主体，恢复先删台账。
- 验证：`core:test:db / core:test:web S25 S28`。
- 外部依赖/证据：G-PRIVACY。
- 完成记录：未实施；commit/命令结果/证据待执行者填写。

## T24 iOS身份、资料与原生壳

- 状态：todo；依赖：T05, T03。
- 文件：`apps/ios/app/`, `apps/ios/src/features/auth/`, `apps/ios/src/features/profile/`；相应测试就近创建。
- 验收：开发构建原生导航与键盘；OAuth/OTP回流/session SecureStore/退出；同profileGate不另造用户。
- 验证：`core:test:ios + device S03 S04 S05`。
- 外部依赖/证据：G-IOS/G-AUTH。
- 完成记录：未实施；commit/命令结果/证据待执行者填写。

## T25 iOS发现、选店、创建与审批

- 状态：todo；依赖：T24, T10, T06。
- 文件：`apps/ios/src/features/discover/`, `apps/ios/src/features/create/`, `apps/ios/src/features/meals/`；相应测试就近创建。
- 验收：同SDK和Google署名；DST偏移选择/不存在报错；申请草稿和审批409可恢复、外订到店付无假支付。
- 验证：`core:test:ios + device S06 S07 S10 S11`。
- 外部依赖/证据：G-PLACES。
- 完成记录：未实施；commit/命令结果/证据待执行者填写。

## T26 iOS会话与饭后

- 状态：todo；依赖：T25, T15, T16, T17, T19。
- 文件：`apps/ios/src/features/inbox/`, `apps/ios/src/features/post-meal/`, `apps/ios/src/features/settings/`；相应测试就近创建。
- 验收：前后台poll/区间权限；出席评分公评互选Survey同规范；举报/删除receipt且push不实现。
- 验证：`core:test:ios + device S14 S19 S21 S24`。
- 外部依赖/证据：T19已完成后验收删除真实流。
- 完成记录：未实施；commit/命令结果/证据待执行者填写。

## T27 部署、CI与运行恢复

- 状态：todo；依赖：T23, T26。
- 文件：`infra/`, `apps/api/src/health/`, `apps/worker/src/runner/`, `.github/workflows/core.yml`；相应测试就近创建。
- 验收：CI全脚本/生产禁fixture；API单副本Recreate/禁止重叠部署，重启AI旧会话410/未发文字保留；expand兼容迁移/worker租约恢复；实测备份RPO/RTO与删除台账重放、日志不含私密。
- 验证：`core:test:release S22 S25 S29`。
- 外部依赖/证据：G-HOST。
- 完成记录：未实施；commit/命令结果/证据待执行者填写。

## T28 真实外部集成与全链路验收

- 状态：todo；依赖：T27, T32。
- 文件：`docs/engineering/evidence/core-acceptance.md`, `packages/testkit/e2e/`；相应测试就近创建。
- 验收：G-AUTH/PLACES/MAIL/IOS/PRIVACY/HOST逐证据关闭；真实两账户Web/iOS跨端批准群聊饭后后台链路；完整AI依赖单列不能冒称全产品可发布。
- 验证：`全部core脚本+真机/收件箱/恢复证据 S30`。
- 外部依赖/证据：全部external gates。
- 完成记录：未实施；commit/命令结果/证据待执行者填写。

## T29 执行交接与AI集成前检查

- 状态：todo；依赖：T28。
- 文件：`docs/engineering/evidence/handover.md`, `tasks/todo.md`；相应测试就近创建。
- 验收：已实现/真实通过/未通过逐项列；实际API与schema和本包一致差异有ADR；AI后续只接同权限命令，AI包未验收则完整发布保持blocked。
- 验证：`core:check + evidence audit S30`。
- 外部依赖/证据：真实AI A任务及最终集成是完整产品发布依赖，不在本任务伪造完成。
- 完成记录：未实施；commit/命令结果/证据待执行者填写。

## T30 会话与授权区间内核（先于T07）

- 状态：todo；依赖：T02。
- 文件：`packages/db/schema/conversations.ts`, `packages/db/migrations/`, `apps/api/src/membership/intervals.ts`；相应测试就近创建。
- 验收：只建GROUP及interval/event/head内核；JOIN/LEAVE/分配序号事务服务可供T07调用；提交顺序与seq一致，区间查询不包含空档；消息HTTP/UI在T12。
- 验证：`core:test:db S14（内核部分）`。
- 外部依赖/证据：无。
- 完成记录：未实施；commit/命令结果/证据待执行者填写。

## T31 生命周期函数（先于T08/T09）

- 状态：todo；依赖：T07。
- 文件：`apps/api/src/meals/lifecycle.ts`, `packages/domain/lifecycle.ts`, `packages/db/queries/rosters.ts`；相应测试就近创建。
- 验收：实现advanceLifecycle与无写入projectLifecycle共用纯规则；截止/开始/结束及历史名单可在fixture测试；在线申请审批依赖本函数，T11仅调度联调。
- 验证：`core:test:db S09 S12 S13（fixture历史）`。
- 外部依赖/证据：无。
- 完成记录：未实施；commit/命令结果/证据待执行者填写。

## T32 菜系与饮食筛选的数据闭环

- 状态：todo；依赖：T01, T06, T07, T25。
- 文件：`packages/contracts/venue.ts`, `apps/api/src/meals/`, `apps/web/src/features/discover/`, `apps/ios/src/features/discover/`；相应测试就近创建。
- 验收：按P-05与数据契约§6实现可选host声明/字典/unknown/筛选/披露，原PRD/Demo回填仍归原会话；首guest后锁定一致，T28最终完整核心验收等待本任务。
- 验证：`core:test:api / core:test:web / core:test:ios S31`。
- 外部依赖/证据：P-05已确认；原文回填待原会话（执行需同时读决定附件）；若涉及iOS文件实现同时依赖T25，先后端与Web再iOS联调。
- 完成记录：未实施；commit/命令结果/证据待执行者填写。

T02创建runner与通用通知表，T27仅扩运行/恢复；T31创建生命周期/roster函数，T11仅接调度并联调，不重复归属。每片业务迁移归该片，T02不预建未定义业务表。

## A00 真实模型与数据/成本spike

- 状态：todo；依赖：T01。
- 文件：`packages/testkit/model-provider/`, `docs/engineering/evidence/ai-spike.md`；相应测试就近创建。
- 验收：核查固定snapshot/schema/usage/30秒终结；store与供应商实际留存分开，默认无预算不启用；真实账户评测证据。
- 验证：`真实provider合成输入测试；G-AI-MODEL/DATA/COST，无凭据标blocked_external`。
- 外部依赖/证据：按[AI方案](../docs/engineering/ai-development-plan.zh-CN.md)；没有真实门槛证据不能done真实集成。
- 完成记录：未实施；commit/命令结果/证据待执行者填写。

## A01 AI契约、偏好与版本CAS

- 状态：todo；依赖：T02, T04。
- 文件：`packages/contracts/ai.ts`, `apps/api/src/ai-assistance/preferences.ts`, `packages/db/schema/ai.ts`；相应测试就近创建。
- 验收：六类偏好白名单与P-04/P-05；本人确认保存/CAS替换/删除不依赖模型；AI仅无正文元数据和偏好迁移。
- 验证：`core:test:api + core:test:db AI-S04 AI-S10`。
- 外部依赖/证据：按[AI方案](../docs/engineering/ai-development-plan.zh-CN.md)；没有真实门槛证据不能done真实集成。
- 完成记录：未实施；commit/命令结果/证据待执行者填写。

## A02 短期会话与删除屏障

- 状态：todo；依赖：A01, T19。
- 文件：`apps/api/src/ai-assistance/sessions.ts`, `apps/api/src/accounts/ai-deletion.ts`, `packages/testkit/ai-clock/`；相应测试就近创建。
- 验收：先实现24h guest主体/cookie+CSRF或iOS bearer，刷新不重置额度；RAM不入WAL，安装marker防重装读旧Keychain；device/generation/活动去重/30分钟等号；刷新退出账号变化/偏好删除迟到失效、账户删除不漏AI。
- 验证：`core:test:api + core:test:db AI-S05 AI-S06 AI-S10`。
- 外部依赖/证据：按[AI方案](../docs/engineering/ai-development-plan.zh-CN.md)；没有真实门槛证据不能done真实集成。
- 完成记录：未实施；commit/命令结果/证据待执行者填写。

## A03 请求去重、预算预留与provider adapter

- 状态：todo；依赖：A02。
- 文件：`apps/api/src/ai-assistance/requests.ts`, `apps/api/src/ai-assistance/budget.ts`, `apps/api/src/ai-assistance/providers/openai.ts`, `apps/ops-cli/`, `apps/api/src/ops/`；相应测试就近创建。
- 验收：主体1在途/成功轮预留；内部2次调用均预算闸/总deadline；UNKNOWN保留费用/禁重发，ai_budget_ops+MFA对账API/ops-cli审计；Mock禁生产。
- 验证：`core:test:db + core:test:api AI-S07 AI-S08 AI-S09；真实provider验收依赖A00`。
- 外部依赖/证据：按[AI方案](../docs/engineering/ai-development-plan.zh-CN.md)；没有真实门槛证据不能done真实集成。
- 完成记录：未实施；commit/命令结果/证据待执行者填写。

## A04 真实AI检索/解释与事实验证

- 状态：todo；依赖：A03, T08, T32。
- 文件：`apps/api/src/ai-assistance/query.ts`, `apps/api/src/ai-assistance/context.ts`, `packages/domain/ai-query.ts`；相应测试就近创建。
- 验收：明确hard与soft排序/清除标记、日期服务端解析；完整集合先排后20候选/3卡；最小投影/无chat/不编事实，source版本重验。
- 验证：`core:test:api AI-S01 AI-S02 AI-S03 AI-S11`。
- 外部依赖/证据：按[AI方案](../docs/engineering/ai-development-plan.zh-CN.md)；没有真实门槛证据不能done真实集成。
- 完成记录：未实施；commit/命令结果/证据待执行者填写。

## A05 三种草稿与确认交接

- 状态：todo；依赖：A04, T12。
- 文件：`apps/api/src/ai-assistance/drafts.ts`, `packages/contracts/ai-drafts.ts`, `packages/testkit/ai-drafts/`；相应测试就近创建。
- 验收：申请20–300/创建字段/群1000以内；生成与transfer重验目标；不写业务/不勾声明，编辑器冲突和重复转入有确定行为。
- 验证：`core:test:api AI-S12 AI-S13`。
- 外部依赖/证据：按[AI方案](../docs/engineering/ai-development-plan.zh-CN.md)；没有真实门槛证据不能done真实集成。
- 完成记录：未实施；commit/命令结果/证据待执行者填写。

## A06 Web助手生产适配

- 状态：todo；依赖：A05。
- 文件：`apps/web/src/features/assistant/`, `packages/client/ai.ts`；相应测试就近创建。
- 验收：复用浮动首页/偏好/卡片；处理中失败重试/Continue/NEW/TTL不同；draft转原编辑器本人主动submit且无覆盖丢稿。
- 验证：`core:test:web AI-S04 AI-S05 AI-S12 AI-S13`。
- 外部依赖/证据：按[AI方案](../docs/engineering/ai-development-plan.zh-CN.md)；没有真实门槛证据不能done真实集成。
- 完成记录：未实施；commit/命令结果/证据待执行者填写。

## A07 iOS助手与跨端偏好

- 状态：todo；依赖：A06, T26。
- 文件：`apps/ios/src/features/assistant/`, `apps/ios/src/api/ai.ts`；相应测试就近创建。
- 验收：原生浮动入口/键盘/上下文切换；偏好共享版本对话不跨端；冷启动/前后台/断网/退出及删除，不用WebView冒交付。
- 验证：`core:test:ios + device AI-S05 AI-S10 AI-S14`。
- 外部依赖/证据：按[AI方案](../docs/engineering/ai-development-plan.zh-CN.md)；没有真实门槛证据不能done真实集成。
- 完成记录：未实施；commit/命令结果/证据待执行者填写。

## A08 60样本真实评测与对抗/并发验收

- 状态：todo；依赖：A07, A00。
- 文件：`packages/testkit/ai-evals/`, `docs/engineering/evidence/ai-evaluation.md`；相应测试就近创建。
- 验收：20/10/10/10/10合成中英样本覆盖AC-AI01—15；四项零容忍/90%/P95≤10s@5并发/30秒终结；记录版本、原偏差，不降低门槛。
- 验证：`真实provider+core:test:db+device AI-S01—AI-S15；G-AI-MODEL/DATA/COST`。
- 外部依赖/证据：按[AI方案](../docs/engineering/ai-development-plan.zh-CN.md)；没有真实门槛证据不能done真实集成。
- 完成记录：未实施；commit/命令结果/证据待执行者填写。

## A09 核心+AI联合交付检查

- 状态：todo；依赖：A08, T28, T29。
- 文件：`docs/engineering/evidence/mvp-acceptance.md`, `infra/ai-runtime/`, `tasks/todo.md`；相应测试就近创建。
- 验收：核心六门槛+AI三门槛和PRD回填diff复核；费用人工停用/清理/ai_budget_ops对账/单API重启会话失效/合并发布回归；未授权不部署，上线与设计完成分开。
- 验证：`core:test:release +真实全链路 AI-S15；全部外部门槛与本轮决定原文回填`。
- 外部依赖/证据：按[AI方案](../docs/engineering/ai-development-plan.zh-CN.md)；没有真实门槛证据不能done真实集成。
- 完成记录：未实施；commit/命令结果/证据待执行者填写。
