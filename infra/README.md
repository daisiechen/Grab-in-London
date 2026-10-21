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

当前仅支持一个API进程承载AI的RAM内容；worker独立一份运行。多API或多worker快照定时器的协调尚未完成，不能直接水平扩容。worker有饭局close/start/end、删除清理、事务邮件发送端口及小时快照；实际邮件/身份撤销提供方尚未配置，邮件不发送、删除状态保留NEEDS_SUPPORT。发现来源与客户端采集覆盖未整体复验前，快照标记partial，未知值为null。

部署后实际复验API来源hook、Web和iOS全部采集入口后，设置 `ANALYTICS_COVERAGE_START` 为三者实际覆盖起点的最晚时刻。worker再与数据库ledger安装起点取较晚值；不设置时保持partial，不把旧历史伪补为完整采集。这个操作不能用代码存在或mock测试替代实际部署验证。

发布目录采用 `/home/ubuntu/fancy/releases/<commit>/`；配置、数据、备份、日志分别放 `shared/config`、`shared/data`、`shared/backups`、`shared/logs`，均不进入公开仓库。先在备用回环端口验证新release，再通过经批准的同源网关切换；旧release保留用于回滚。实际端口、域名、TLS及systemd文件待服务器操作授权后核定，不能猜测并覆盖已有配置。

## 人工门槛与恢复

- G-HOST：批准安装及部署；确认域名/TLS、备份目标、磁盘与网络访问策略。当前未部署。
- G-AUTH/G-PLACES/G-MAIL：Auth0、Google、邮件真实项目及最小权限密钥；Google服务端Key与Web受域名限制的公开Key/Map ID、iOS受bundle限制的公开Key分开。客户端配置见各app的说明，不复用服务端密钥。Google Places结果只放Google底图；无配置时列表回退。测试适配器在staging/production启动时被拒绝。
- G-IOS：Xcode首次启动与许可、Apple/Expo账号、签名和iPhone实测；自动化组件测试不能代替安装测试。
- G-AI：DeepSeek安全Key放未跟踪安全环境变量 `DEEPSEEK_API_KEY`，不要发聊天或进Git；当前价格/计数器及每天/每用户额度仍须核实。月预算固定人民币50元，无自动充值；Key本身不启用调用。HTTP应用可通过 `AppDeps.assistant` 显式注入经过验证的provider/价格/计数器，默认不注入，真实评测通过后才开放。
- G-PRIVACY：批准保留期、删除身份/Apple授权撤销、争议最小记录、加密删除回执邮件通道与备份清理；未关闭不能接真实用户。

恢复备份时先停API/worker、恢复到隔离库，重放独立删除台账和快照撤销屏障，再验证删除主体不可登录、正文不可读、旧快照/导出返回410。实际备份/恢复演练尚未在首尔服务器执行，不能据本文件宣称通过。数据库迁移后的回滚不能仅切旧代码，须先核对旧代码与当前schema兼容性。

CI只运行验证，无部署凭据或远程写权限。配置依据官方 [checkout](https://github.com/actions/checkout)、[pnpm/setup](https://github.com/pnpm/setup) 文档；远端CI首次执行结果需单独核查，不能以本地测试替代。
