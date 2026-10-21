# MVP 本地自测与独立测试交接

用户已授权 Codex 接管生产代码开发，Claude 恢复后只读交叉检查。此报告覆盖本机可执行范围，不是正式上线或真实供应商验收结论。

## 版本与范围

生产代码分批提交：`ca8d8c1` 后端及 AI 内核、`69266ba` Web 助手及采集、`ac0afa9` 地图及隐私并发修复、`20ff465` iOS 助手/Google 原生地图/安全游客凭据。最终采集与统计修订为 `8bc1e92`，精确 SHA 在交接消息固定。本报告提交之后的独测改动须另记被测版本。

新生产目录为 `apps/`、`packages/`、`infra/`；原 PRD、Demo 和旧后台未改写。工作区独立研究文件 `docs/research/competitive-landscape.zh-CN.md` 不属于本次代码提交或验收范围。

## 最终验证

2026-10-21 06:38 London 对整合工作区执行，以下命令均退出 0：

| 验证 | 结果 |
| --- | --- |
| `pnpm core:check` | 全包类型、生成契约漂移、lint、密钥扫描通过 |
| `pnpm core:test` | unit 151、真实 PostgreSQL 101、API 96、release 10 通过 |
| `pnpm core:test:clients` | Web/后台 211；iOS 169（25 suites）通过 |
| `python3 -m unittest discover -s tests` | 64 通过 |
| Web / 后台 `build` | 均通过；Web 有大于 500kB 的分块提示，无构建失败 |

iOS Hermes 导出成功（1535 modules，约 3.3MB hbc，`/private/tmp/fancy-ios-analytics-export-final`），只验证 JavaScript 打包。最后补充原生采集响应不发 Set-Cookie，10 项相关 API 回归单独复验。

本机日志位于 `/private/tmp/fancy-takeover-final-{check,core,clients,python,web-build,admin-build}.log`，是本机临时证据，不保证跨机器可读。远端 CI 需对应提交另查，不能以旧提交的 success 替代本批验证。

## 已验证路径与适用限制

- 本机真实 PostgreSQL 17 与 HTTP API：事务、幂等、容量并发、London/DST、生命周期、消息区间/显式已读、反馈/互选、支持个案权限、删除屏障、统计快照/导出、AI 去重/预算/全局隐私 epoch。SQL 快照保留微秒，删除主持人不移除其他参与人的历史事实。
- Web 与后台：组件交互、权限和过期响应、AI 编辑器确认及显式采集；构建独立校验。真实 Chrome 393×852 本地联调走过登录、补资料、选虚构餐厅、创建、切换账号申请、审批、消息及已读。采用同一浏览器退出换账号，不等于两个隔离设备的跨端验收；本轮没有可交付的浏览器截图文件。
- iOS：React Native 组件/状态回归和 Hermes JavaScript 导出；原生 Google 地图无 Key/模块时回退列表。不是签名安装、原生编译、iPhone 或真实 OAuth/地图验证。
- AI：真实编排和 HTTP/数据库逻辑配受控 provider、价格/计数器做自动化验证；没有发起真实 DeepSeek 调用。密钥本身不启用 provider，人民币 50 元/月硬闸不代表外部供应商账户全部费用已被封顶。
- 采集默认关闭，只在显式同意后工作；原生签名 visitor scope 仅 RAM。服务端不接受客户端自报业务成功/结果数。快照部署覆盖日期须在实际验证后配置，未知历史保持 partial/null。

## 独测复现入口

先 `source infra/dev-env.sh`。适用命令见 [运行说明](../../infra/README.md)。`FANCY_LOCAL_ACCEPTANCE=1 node infra/local-acceptance.ts` 提供可销毁临时 PostgreSQL、API 3000 与 worker；另起 `pnpm --filter @fancy/web dev`，访问 `http://127.0.0.1:5174`，固定测试邮箱验证码 `000000`。它使用测试身份、虚构餐厅，邮件/模型不可用；退出即销毁数据。不得连接真实用户或部署此入口。

测试主体为 [217 条用例](../qa/test-cases.json)。独测需按 case 分别记录 PASS/FAIL/BLOCKED/NOT_RUN/N/A、精确 commit、证据和环境；现有自动化通过数不能直接换算 217 条全部通过。真实 PG 的角色/MFA/生命周期等可复用 API harness 建立独立 fixture；不能把普通登录提升为管理员。

## 尚未关闭的人工与真实门槛

1. Auth0、Google Places/Maps、事务邮件账号/条款/配置及域名、TLS、回调；服务端和双客户端地图 Key 分开受限。
2. DeepSeek 安全 Key、真实模型版本/价格/精确计数器/数据条款与 60 样本及并发费用实测；无自动充值。
3. Xcode 首次启动及许可、Apple/Expo、签名、iPhone 原生构建和跨端业务实测；没有代接受许可或改系统开发目录。
4. 首尔服务器安装、迁移、网关切换及备份恢复演练；当前仅只读核查及预留 Fancy 独立空目录，旧项目未移动或覆盖。
5. 隐私保留期、供应商身份/Apple 撤销、加密删除回执通道和备份清理；提供方缺失时删除作业保留 NEEDS_SUPPORT，不能声称最终清理完成。

Claude 桌面限额恢复后复核本轮最终代码及独测缺陷，禁止恢复旧写入任务。独立测试完成和以上门槛闭合之前，完整 MVP 验收及发布仍未完成。
