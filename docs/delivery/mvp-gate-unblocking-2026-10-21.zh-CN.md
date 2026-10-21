# 14条阻塞逐项拆解与本地解除准备

对应QA原14条历史分类；不是新的用例真源或PASS报告。QA报告仍由独立测试会话维护，最终case状态由其复验决定。本轮不调用真实供应商、不接受许可、不改首尔服务器。

| 原阻塞ID | 已推进/可直接复验的部分 | 仍缺的具体依赖与解除条件 | 负责人 |
|---|---|---|---|
| QA-PRIVACY-007 | 真实PG/生产worker分步失效注入，Auth0失败、Apple失败、超时后稳定幂等键重试、已完成step跳过、旧失败不覆盖成功、他人数据保留；3文件8项过 | 本地case可交QA复验，不需账号。真实远端撤销另需Auth0管理权限、Apple撤销凭证/无grant证明和实际响应，不用这些阻塞本地测试 | 开发提供实现；QA复验；真实账号由用户 |
| QA-PRIVACY-008 | 实际pg_dump/pg_restore；独立删除台账摘要匹配、API/worker恢复闸门、重放共用删除事务；旧身份不可用、快照撤销、他人保留、重复不新建请求；原删除ID/receipt hash保留 | 本地case交QA复验。生产独立台账持久化/异地备份、完整性漏项检测、先停入口再arm的操作演练仍需部署；尚不能自动识别任意外部pg_restore | 开发准备工具/演练；QA复验；用户批准真实部署 |
| QA-AI-034 | iOS新增冷启动/Continue、410保未发字、SecureStore token-only与设备锁定行为；新API+RAM runtime同数据库HTTP旧session410且无模型调用 | Jest不是真Keychain重装。Xcode许可未接受，simctl退出69，无法确认可用runtime；用户接受许可后补模拟器/设备重装实测 | 开发本地证据；用户许可/配对；QA原生验证 |
| QA-GATE-001 G-AUTH | 身份协议和fixture回归已有；不需重做本地登录代码 | 无已批准Auth0租户/应用；缺Google OAuth、Apple Sign in配置与安全client凭据、真实邮箱OTP及回调域名。需用户开通/条款，再由开发验证三方式/链接/系统回流 | 用户开通；开发接线；QA真实验证 |
| QA-GATE-002 G-PLACES | provider字段/失败/署名回退及Web/iOS地图入口已有本地回归 | 无Google Cloud Maps/Places项目与受限server/Web/iOS Key、Web Map ID；缺实际非示例伦敦餐厅/分店、照片/署名/缓存许可证据。需用户开通项目与账单后实测 | 用户项目；开发配置；QA真实验证 |
| QA-GATE-003 G-MAIL | outbox去重/UNKNOWN不盲重发及有限错误码已测 | 未选事务邮件提供方，缺发信域名及DNS验证、API凭据、退信回调签名、批准的真实测试收件箱。删除回执加密通道同未接 | 用户账号/DNS；开发适配器；QA收件箱验证 |
| QA-GATE-004 G-IOS | 实际Hermes导出；本轮全iOS173。工具链已只读核查 | Xcode首次状态/simctl退出69许可未接受；设备Team/签名/配对未配置。个人设备开发测试可用免费Personal Team，不把付费Program/EAS冒充所有本地验证必需；分发另行配置 | 用户许可/登录/配对；开发构建；QA设备测试 |
| QA-GATE-005 G-PRIVACY | 本地失败/恢复准备如007/008，不以政策未定阻塞这些注入 | 保留期限及适用隐私/社区文本审批、供应商处理边界、Apple/Auth0真实撤销、加密回执与备份删除执行证据尚无。需要负责人明确批准，技术实现不能代替政策决定 | 用户批准政策；开发接线；QA核验 |
| QA-GATE-006 G-HOST | 1000合成账号/10000合成消息/100并发本机混合读取及worker计时；真实备份恢复、API单实例重启旧AI410均已有 | 本机inject不含TLS/网络/首尔竞争，需首尔安装部署批准、域名/TLS、独立备份目标与台账通道，再按24h RPO/4h RTO实测并验证Recreate无重叠。现有服务器只读授权未扩大 | 开发本机准备；用户授权资源变更；QA实际环境 |
| QA-GATE-007 G-AI-MODEL | 固定60中英合成样本20/10/10/10/10、无网默认runner与结果校验器；dry-run60 NOT_RUN，未伪造分数 | 缺安全DeepSeek Key、冻结的实际model/prompt/schema/price/fixture及显式real harness执行、独立草稿人工复核、5并发/真实耗时。阈值不变 | 开发准备；用户安全Key及配置批准；QA真实评测 |
| QA-GATE-008 G-AI-DATA | 已核对官方API/JSON/thinking/usage和公开数据政策，ADR不继承store:false或零留存承诺 | 缺适用API账户DPA/地区与分包方/训练使用及opt-out/提示输出与安全日志留存的账户级证据，以及面向用户说明批准；首尔主机不能证明模型数据在首尔处理 | 开发资料核对；用户账户条款与批准；QA核验 |
| QA-GATE-009 G-AI-COST | 人民币50/月账本与UNKNOWN预留已有；官方候选价核对、60样本结果版本字段及校验准备 | 缺批准的生效模型价、完整消息tokenizer上界、每日/每用户调用额度；真实usage/账单与call对账。Key不自动启用调用，无自动充值 | 开发上界/对账准备；用户金额及账户批准；QA实账 |
| QA-AI-050 | DeepSeek替换ADR、参数/usage/拒答边界回归及60样本固定。无需Key部分已备 | 完整真实准入仍依007/008/009的精确模型/价格/数据批准与真实60样本，不把dry-run算模型通过 | 开发；用户真实配置；QA |
| QA-AI-052 | 固定官方endpoint/拒绝重定向、JSON非schema保证、显式关thinking、严格usage/finish/refusal、禁继承OpenAI store字段；本地provider34项及eval13项过 | 真实响应兼容性、账户地区/留存及token上界仍待账户级证据；无效参数不能关闭DATA | 开发本地证据；用户账户资料；QA |

## 本轮实际验证与边界

- 最终core:test：unit198、真实PostgreSQL106、API100、release10通过，含恢复、重启和负载准备；iOS新增4项后全套173通过。全包core:check与Python69项最终通过；恢复回执原有效期/政策和独立台账文件持久化增量已定向复验通过。
- 真实本机pg_dump/pg_restore演练约401ms；这是小型合成数据的整个测试计时，不是首尔RTO，也没有证明生产备份24小时RPO。旧备份之后的独立台账重放验证1个删除主体，用户/快照/会话保持安全状态，重复重放保留同删除ID与回执hash。
- 100并发混合（25消息/75资料读取）、1000账号、10000消息：一次本机p95约65.7ms、错误率0、观测worker延迟124ms。不是持续负载或网络端到端SLO。最初单账号100次消息读取触发40/min限流，调整请求组合而未放宽限流。
- 复现：`source infra/dev-env.sh`；`pnpm exec vitest run --project api apps/api/src/recovery infra/tests/load.api.test.ts`；供应商失败命令见下。日志 `/private/tmp/fancy-recovery-load.log` 与 `/private/tmp/fancy-unblock-core.log` 仅本机临时证据。
- 删除分步：`pnpm exec vitest run --project db apps/worker/src/deletion apps/worker/src/handlers/deletion.db.test.ts apps/worker/src/handlers/deletion-review.db.test.ts`。
- 恢复操作与独立台账限制见 [运行说明](../../infra/README.md)；DeepSeek官方来源、候选价格及缺证据见 [核证ADR](../engineering/decisions/deepseek-readiness.md)，评测命令见 [评测准备](../../packages/testkit/src/ai-evals/README.md)。
- iOS工具实测：xcode-select -p、xcodebuild -version退出0；checkFirstLaunchStatus、simctl定位/设备/runtime枚举及xctrace均69。没有接受许可或修改系统配置。Apple [开发账户说明](https://developer.apple.com/help/account/basics/about-your-developer-account)支持免费个人设备测试，但不能替代签名与实际设备证据。

开发先提供可复现增量和确切提交，独立QA按case全部断言复验；表中“可复验”不等于PASS，正式发布门槛仍未关闭。
