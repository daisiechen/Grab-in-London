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

另一个终端运行 `pnpm --filter @fancy/web dev`，访问 `http://127.0.0.1:5174`。此入口使用临时数据库、测试身份、虚构餐厅，邮箱验证码为000000；退出即销毁数据。它不是线上服务，不能接真实用户，也没有真实地图、邮件或模型调用。后台若需MFA/角色，按API测试夹具向这个临时库显式授予测试角色；业务身份不可因能登录便自动取得后台权限。

## 正式进程入口

通过安全配置提供 `.env.example` 的变量后，API入口为 `node apps/api/src/main.ts`，worker入口为 `node apps/worker/src/main.ts`。API绑定回环；由同源HTTPS网关同时提供Web、后台及 `/v1`，不得跨域直接转发session cookie。Node24和项目固定pnpm版本需预装；迁移由单独受控发布步骤执行，API启动不擅自迁移。

同源网关上线时，将 `TRUSTED_PROXY_CIDRS` 配置为实际受控代理的IP或CIDR（逗号分隔）；默认空值不信任转发头。网关须清理并重写客户端转发地址，不得把任意用户提供的头作为可信来源。不使用通配符、主机名或全网CIDR。未配置时，代理后的OTP、游客及删除回执限流会共用代理IP；实际部署需复验不同客户端隔离与伪造头无法绕过限流。

Support CLI浏览器认证的供应商允许回调应登记 `<WEB_ORIGIN>/v1/auth/oauth/callback`（核心HTTP端点），Web原有 `<WEB_ORIGIN>/auth/callback` 是SPA页面，不能替代CLI的浏览器跳转。CLI每次启动本机127.0.0.1随机端口并登记固定 `/auth/callback`，核心仅303回该登记地址，交接码60秒且绑定PKCE；兑换后15分钟access仅在执行命令的进程内使用，无refresh。真实Auth0回调名单、MFA claim及支持角色/个案grant仍须实际配置和复验；拥有CLI程序不会取得这些权限。

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
