# Fancy MVP 运行与交付

此目录的配置属于生产代码准备；没有向腾讯云安装、迁移或切换服务。首尔服务器仍只获授权只读检查，现有项目与 `/home/ubuntu/fancy/` 分开。不要覆盖已有443服务。

## 本机可执行验收

```sh
source infra/dev-env.sh
pnpm install --frozen-lockfile
pnpm core:check
pnpm core:test
pnpm core:test:clients
python3 -m unittest discover -s tests
pnpm --filter @fancy/web build
pnpm --filter @fancy/admin build
```

需要 PostgreSQL17；测试自动创建和销毁独立库，不接受非回环数据库，除非专门显式启用远程测试。没有 PostgreSQL 二进制时，可自行启动 `infra/compose.yml` 的本地测试数据库并设置 `FANCY_TEST_DATABASE_URL`。该 compose 的无持久化/关闭fsync设置只用于测试，不可部署。

真实浏览器联调可在一个终端运行：

```sh
source infra/dev-env.sh
FANCY_LOCAL_ACCEPTANCE=1 node infra/local-acceptance.ts
```

另一个终端运行 `pnpm --filter @fancy/web dev`，访问 `http://127.0.0.1:5174`。此入口使用临时数据库、测试身份、虚构餐厅，邮箱验证码为000000；退出即销毁数据。它不是线上服务，不能接真实用户，也没有真实地图、邮件或模型调用。需要合成后台账号时，启动 API 前显式增加第二个开关：

```sh
source infra/dev-env.sh
FANCY_LOCAL_ACCEPTANCE=1 FANCY_LOCAL_STAFF_FIXTURE=1 node infra/local-acceptance.ts
```

在 Web 用 `qa-staff@example.invalid` 和 `000000` 登录。此固定虚构账号预先通过核心登录协议创建，授予 `analyst`、`data_admin`；只有它在第二个开关启用时获得模拟 `mfa` claim。这不代表真实 MFA 验证通过。普通任意 `@example.invalid` 账号仍只有 OTP、无后台角色；第二个开关关闭时，固定邮箱也无模拟 MFA、不会预建角色。bootstrap 的临时登录已注销且不输出凭据；只移除已消费的 bootstrap OTP 行，避免它占用浏览器首次登录的重发窗口，其余限流不变。

后台验收与 Web 串行共用 **5174 同源**：保持 API/临时 PG 运行，先在 Web 登录，再只停止 Web Vite（Ctrl-C），然后运行：

```sh
source infra/dev-env.sh
pnpm --filter @fancy/admin exec vite --port 5174
```

在同一浏览器访问 `http://127.0.0.1:5174`，使用已有 cookie；不要清除登录数据。后台读取及写入仍受原角色/MFA/CSRF 校验。返回 Web 时停 admin Vite，再运行 `pnpm --filter @fancy/web dev`。默认 admin dev 的5175适合独立只读开发，但本 rig 的写操作只允许5174，不改变生产 Origin 规则。

数据库没有预填真实业务历史。最小业务 seed 通过 Web 创建两个不同合成邮箱账号，补资料，搜索 `Fancy` 选虚构餐厅，创建未来饭局，再由另一账号申请、主持人审批。可复用 `FANCY_QA_LOCAL_FIXTURE=1 node scripts/qa-inbox-fixture.mjs` 生成双 pending Inbox 合成场景；脚本日期固定2026-10-23/24，过期后需改用浏览器创建未来饭局。worker 启动并定时生成快照，空库/未到成熟窗口的指标为空或未知，不能当成熟业务数据。

正常停止 API rig 会清理临时库，重启重新预建（若启用）合成 staff；强杀进程不保证执行清理。Google/Apple 的 TestIDP 授权地址为 `test-idp.invalid`，此 rig 没有合成授权网页，所以浏览器 provider 登录/身份链接仍未测，需后补独立 fixture 或真实配置。AI 未注入可用模型端口，维持明确不可用提示；不因 `mock` 配置字样宣称模型链已联通。

## 正式进程入口

通过安全配置提供 `.env.example` 的变量后，API入口为 `node apps/api/src/main.ts`，worker入口为 `node apps/worker/src/main.ts`。API绑定回环；由同源HTTPS网关同时提供Web、后台及 `/v1`，不得跨域直接转发session cookie。Node24和项目固定pnpm版本需预装；迁移由单独受控发布步骤执行，API启动不擅自迁移。

同源网关上线时，将 `TRUSTED_PROXY_CIDRS` 配置为实际受控代理的IP或CIDR（逗号分隔）；默认空值不信任转发头。网关须清理并重写客户端转发地址，不得把任意用户提供的头作为可信来源。不使用通配符、主机名或全网CIDR。未配置时，代理后的OTP、游客及删除回执限流会共用代理IP；实际部署需复验不同客户端隔离与伪造头无法绕过限流。

Support CLI浏览器认证的供应商允许回调应登记 `<WEB_ORIGIN>/v1/auth/oauth/callback`（核心HTTP端点），Web原有 `<WEB_ORIGIN>/auth/callback` 是SPA页面，不能替代CLI的浏览器跳转。CLI每次启动本机127.0.0.1随机端口并登记固定 `/auth/callback`，核心仅303回该登记地址，交接码60秒且绑定PKCE；兑换后15分钟access仅在执行命令的进程内使用，无refresh。真实Auth0回调名单、MFA claim及支持角色/个案grant仍须实际配置和复验；拥有CLI程序不会取得这些权限。

Web/iOS遇到LINK_REQUIRED时须明确继续用原账号登录，再由用户确认连接此登录方式，不能只提示返回登录或自动合并。新身份票据最多10分钟、原身份proof须在5分钟内；服务端仍校验当前family及Web HttpOnly binder或原生PKCE verifier。原生票据/verifier/proof仅RAM；Web为跨整页OAuth仅在同tab sessionStorage保存字段受限的短期票据与预认证关联ID，完成的authProof和令牌不进入存储或URL。取消、到期、冲突、会话清除终止；未知网络结果只允许用户以原payload/原幂等key显式重试。真实双提供方链接仍须实际账号验收。

当前仅支持一个API进程承载AI的RAM内容；worker独立一份运行。多API或多worker快照定时器的协调尚未完成，不能直接水平扩容。worker有饭局close/start/end、删除清理、事务邮件发送端口及小时快照；实际邮件/身份撤销提供方尚未配置，邮件不发送、删除状态保留NEEDS_SUPPORT。发现来源与客户端采集覆盖未整体复验前，快照标记partial，未知值为null。

部署后实际复验API来源hook、Web和iOS全部采集入口后，设置 `ANALYTICS_COVERAGE_START` 为三者实际覆盖起点的最晚时刻。worker再与数据库ledger安装起点取较晚值；不设置时保持partial，不把旧历史伪补为完整采集。这个操作不能用代码存在或mock测试替代实际部署验证。

发布目录采用 `/home/ubuntu/fancy/releases/<commit>/`；配置、数据、备份、日志分别放 `shared/config`、`shared/data`、`shared/backups`、`shared/logs`，均不进入公开仓库。先在备用回环端口验证新release，再通过经批准的同源网关切换；旧release保留用于回滚。实际端口、域名、TLS及systemd文件待服务器操作授权后核定，不能猜测并覆盖已有配置。

## 人工门槛与恢复

- G-HOST：批准安装及部署；确认域名/TLS、备份目标、磁盘与网络访问策略。当前未部署。
- G-AUTH/G-PLACES/G-MAIL：Auth0、Google、邮件真实项目及最小权限密钥；Google服务端Key与Web受域名限制的公开Key/Map ID、iOS受bundle限制的公开Key分开。客户端配置见各app的说明，不复用服务端密钥。Google Places结果只放Google底图；无配置时列表回退。测试适配器在staging/production启动时被拒绝。
- G-IOS：Xcode首次启动与许可已在本机核实完成；仍需模拟器运行时或实际iPhone配对、Apple账号及签名实测。免费Personal Team可用于个人设备开发；TestFlight/商店分发需要相应开发者资格，Expo/EAS不是本地Xcode构建的必需条件。自动化组件测试不能代替安装测试。
- G-AI：DeepSeek安全Key放未跟踪安全环境变量 `DEEPSEEK_API_KEY`，不要发聊天或进Git；当前价格/计数器及每天/每用户额度仍须核实。月预算固定人民币50元，无自动充值；Key本身不启用调用。HTTP应用可通过 `AppDeps.assistant` 显式注入经过验证的provider/价格/计数器，默认不注入，真实评测通过后才开放。
- G-PRIVACY：批准保留期、删除身份/Apple授权撤销、争议最小记录、加密删除回执邮件通道与备份清理；未关闭不能接真实用户。

恢复备份时先停API/worker、恢复到隔离库，重放独立删除台账和快照撤销屏障，再验证删除主体不可登录、正文不可读、旧快照/导出返回410。实际备份/恢复演练尚未在首尔服务器执行，不能据本文件宣称通过。数据库迁移后的回滚不能仅切旧代码，须先核对旧代码与当前schema兼容性。

删除隐私屏障保持全局保守失效：AI RAM内容没有完整第三方来源索引，不能只按会话主人清理。快照仅在严格早于删除账号创建、无该主体索引且处于删除前有效epoch时保留；幂等响应仅对冻结字段白名单内、经数据库证明完全属于当前活跃调用人的survey/application成功响应允许跨无关删除重放，其余继续拒绝。举报/工单按举报人、USER目标、MEAL主持人、MESSAGE发送人等已知结构关联即时遮罩、worker清理文本及已证实副本；任意正文中的未知提及不猜测删除。保留期与合法争议记录政策仍待批准，默认删除不得假报全部完成。

CI只运行验证，无部署凭据或远程写权限。配置依据官方 [checkout](https://github.com/actions/checkout)、[pnpm/setup](https://github.com/pnpm/setup) 文档；远端CI首次执行结果需单独核查，不能以本地测试替代。


## 隔离恢复与负载准备（不代表首尔验收）

本机演练：`pnpm exec vitest run --project api apps/api/src/recovery infra/tests/load.api.test.ts`。
使用真实PG17的pg_dump/pg_restore，把备份之后接受的删除台账保存在备份之外，再在隔离库恢复。
0022恢复闸门会阻止API业务流量和worker；台账摘要匹配且逐主体复用生产删除事务、撤身份/快照后才ready。
重放保留原删除ID与回执hash，避免恢复后换provider幂等键；重复重放不多建删除请求。
恢复重放按台账原 `acceptedAt` 判断当时取消主持饭局或退出席位，再推进其余主体到当前生命周期；身份新鲜度和清理调度仍按实际执行时刻。台账整批预检接受时刻、有效期及账号创建顺序，错误台账不得先写一部分业务数据。

人工生产恢复必须先停入口/API/worker，恢复到隔离库，应用迁移，再在API/worker启动前arm闸门。
绝不能先开放恢复库再补台账。以下工具默认拒绝运行，需显式离线模式、安全环境和独立台账文件：

```sh
FANCY_OFFLINE_RECOVERY=1 node infra/recovery.ts export /private/path/deletion-ledger.json
FANCY_OFFLINE_RECOVERY=1 node infra/recovery.ts arm /private/path/deletion-ledger.json
FANCY_OFFLINE_RECOVERY=1 node infra/recovery.ts replay /private/path/deletion-ledger.json
```

export对当前源库执行，arm/replay对隔离恢复库执行；用各自安全DATABASE_URL，不把URL放命令历史或公开资料。
export使用0600且拒绝覆盖；只导出ID、接受时刻和回执hash，不导出正文或明文回执。
独立台账必须比恢复备份新且完整；把备份内的旧台账再次导出不满足这个条件。
当前工具只提供显式离线导出/重放，尚未配置生产独立持久化通道、导出频率/漏项检测或异地存储，不能据本机演练关闭G-PRIVACY/G-HOST。
不能靠恢复库自身的READY默认值识别一次外部pg_restore；停流量及arm是发布操作契约，需在真实托管演练验证。

负载前置使用1000合成账号、10000合成消息，100并发（25消息读取+75资料读取）走真实HTTP处理器/PG，但Fastify inject不包含TLS、网络和首尔资源竞争。
最初对同一账号发100次消息读取触发40/min限流；调整为混合合法请求，不关闭或提高限流。
输出p95、错误率和观测到的worker延迟；这里不是持续压测或生产SLO证明。24小时RPO/4小时RTO目标仍须真实备份频率、独立台账持久化和首尔恢复计时验证。

CI备份工具使用同一个固定PG17服务镜像生成pg_dump/pg_restore wrapper（`infra/scripts/ci-pg-clients.sh`），不假定host有PG17客户端。依据[GitHub Ubuntu runner清单](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md)，其host预装版本不能直接等同本项目PG17。wrapper只适用于Linux CI的host网络和/tmp共享，已做参数/空格路径回归；真实CI结果仍单独核查。

## 固定时钟的本地生命周期验收

仅用于另起的空合成库，不接已有或外部数据库。启动前先停止旧 rig（会销毁旧库）；旧截图可保留，但必须在新 clock rig 重新创建并审批同一场饭局，再完成其后续旅程。时钟模式同时要求显式本地开关、时钟开关和本次新建空 `fancy_test_*` 库，拒绝 `FANCY_TEST_DATABASE_URL`，也拒绝 production/staging 环境。

```sh
source infra/dev-env.sh
fancy_clock_start=$(node -e 'console.log(new Date(Date.now()+5*60*1000).toISOString())')
FANCY_LOCAL_ACCEPTANCE=1 FANCY_LOCAL_CLOCK=1 FANCY_LOCAL_CLOCK_START="$fancy_clock_start" FANCY_LOCAL_STAFF_FIXTURE=1 node infra/local-acceptance.ts
```

起点须晚于本次启动的真实时间、且不超过未来30天（避免迁移已写的 coverage 元数据倒序）；上述命令选未来5分钟。饭局的截止和开始时间均应在该起点之后。Node 和本 rig 全部数据库池连接（包括 worker）固定在该 instant；真实等待不会使业务时间前进。所有已有 timestamp DEFAULT 在**该临时库**内改指 fixture clock，源码迁移不变；运行时代码的 `clock_timestamp()` 与快照 `transaction_timestamp()` 经过同一固定值，额外覆盖 `now()`/`statement_timestamp()`。已核运行 SQL 无 `CURRENT_TIMESTAMP`/`CURRENT_DATE` 特殊语法依赖；不宣称任意未来 SQL 都会自动兼容。

在运行 API 的终端输入一行严格 JSON，UTC、固定三位毫秒，不附其它字段：

```json
{"advanceTo":"2026-10-24T16:59:59.999Z"}
```

示例日期须替换为**实际饭局响应中的 UTC closesAt/startsAt/scheduledEndAt**，不要把 London local time 当 UTC，跨夏令时尤其如此。只允许严格向前，且距起点不超过30天；无效命令会显示 `COMMAND REJECTED; current=...`，不会改变时刻。每次推进先阻止新 HTTP 并排空在途请求，停止并等待当前 worker tick，再提交数据库时刻、更新 Node、执行一批 due jobs（本次同步最多10个 job），最后恢复 worker 和 HTTP。clock marker 只证明时刻已推进，不保证整个队列处理完成；恢复后的 worker 会继续轮询处理。QA 必须轮询目标饭局的 lifecycle 状态、start roster 和饭后 window，直到对应检查点的预期状态成立，再采集证据；不能仅等待固定秒数或看到 marker 就认定全部完成。若 drain/worker/数据库失败，保持入口关闭并输出 `STOPPED; current=...; reset required`，不会误称未推进；此时应停止并重新创建空 rig，不能继续复用不确定状态。

建议检查点为截止前1毫秒/恰好截止、开始前1毫秒/恰好开始、结束前1毫秒/恰好结束。每一步确认终端 clock marker，再刷新页面并记录同一个 meal ID；饭局、席位事件和 job 的业务时间不被改写。结束后通过原 UI 申报出席、评分、互评、互选。正常会话期限不延长：Web 7天 idle/30天 absolute，跨越期限会真实返回401，应重新用 OTP 登录；OTP重发窗口及短期票据同样不会因真实等待自动恢复。

**固定时钟也固定生产限流窗口。** 写入仍为10次/秒 burst、60次/分钟；Inbox/消息轮询仍为每账号每资源40次/分钟。真实浏览器轮询一段时间后可能429，等待真实一分钟不会恢复。远离生命周期边界时，可按终端指令推进1秒或60秒进入新窗口后继续；恰好边界前停止无关页面轮询，只进行少量必要请求，然后推进下一检查点。不要关闭、调高或清空生产限流。

浏览器本身保持真实时钟。本模式只证明由服务端返回的 meal 状态、roster、饭后 window 和权限路径；浏览器本地倒计时、OTP倒计时、客户端日期校验、AI TTL/后台独立扫除器不算本轮通过。`setTimeout`、worker轮询和超时计时仍为真实时间；AI无可用模型端口，也不把它当作可控生命周期集成。正常退出会恢复本进程 Date 并清理临时数据库；主机时钟、生产代码、真实服务均不更改。

### Local fixture preservation and explicit ownership cleanup

The local acceptance rig now preserves its newly owned PostgreSQL process and
cluster directory on normal stop or fatal clock-transition failure. It prints a
private `rig-receipt.json` path (mode `0600`), containing only ownership metadata,
database name and the shutdown boundary; no connection URL or credentials.
Do not treat preservation as a quiescent snapshot: `app.close()` may write AI
recovery metadata, and timed-out requests or worker work may still be active.
Shutdown waits are bounded using real timers. Inspect the receipt and process
state before any subsequent operator action; this does not authorize recovery of
an older QA fixture or reconstruction of its historical IDs.

Clock failure diagnostics contain a fixed stage/code, requested and Node clock,
and a separate database outcome `OLD`, `TARGET`, or `UNKNOWN`. A failed COMMIT
acknowledgement can mean the database already reached `TARGET` while Node still
reports the old instant. No automatic rollback, resume, cleanup or clock advance
follows such a failure. A due-job tick processes only its existing bounded batch,
not necessarily every due job. Raw exceptions and provider text are not logged.

Destruction requires a separate, explicit command (never a stdin clock command):

```sh
source infra/dev-env.sh
node infra/local-acceptance.ts --cleanup-own /absolute/owned/rig-receipt.json --owner OWNER_ID_FROM_PRIVATE_RECEIPT
```

The cleanup verifies the private receipt, owner marker, canonical temporary
cluster paths, current PostgreSQL PID and port. External clusters, wrong owners,
symlink receipts/cluster paths and mismatches are refused. Only a successful
`pg_ctl stop` permits directory removal; stop failure retains the data. Ordinary
self-owned automated tests retain their successful `stop()` cleanup behavior.
