# MVP 实施协调记录

## 用户授权与分工（2026-10-21，Europe/London）

用户已授权依据已认可技术方案启动 App（iOS）、Web、管理后台及服务端 MVP 开发，允许 Claude 拆分独立任务并行。Codex 负责协调、审查、整体自测及后续测试交接。实施范围包含真实 AI，不将原型模拟当成真实集成。

- Claude 桌面 Code 会话：`约饭App MVP三端开发`，本地会话标识 `local_dcb878d4-b44f-459f-b1b6-8dd287faf119`。启动指令已送达，已回报技术包 10 个哈希一致。
- 启动时 HEAD 与 origin/main：`4659fdb3b5e4779157ac45058cbf5134aea1b4d2`。精确设计快照见 [review manifest](../docs/engineering/review-manifest.json)。
- 实施状态只维护 [唯一任务表](todo.md)，本记录不另建完成清单。依赖顺序沿用 [执行入口](plan.md)；先 T00/T01/T02，再按依赖并行。
- Claude 负责新增 `apps/`、`packages/`、`infra/` 及对应验证；契约、数据库迁移和 Git 集成串行，一份文件同一时刻只有一个负责人。
- `docs/product/`、`demo/`、`admin/`、`shared/` 仍由原产出会话负责，本轮开发只读复用基线；最新 P-01—05 决定优先于旧原型差异。
- `docs/research/competitive-landscape.zh-CN.md` 是启动前其他会话改动，禁止混入本轮提交。
- 并行会话「测试- MVP+AI」负责 `docs/qa/`、`tests/test_qa_cases.py`、相关测试用例脚本及 `docs/README.md`；Claude 开发会话只读这些产物。需要更新索引时串行交接。

用户睡前再次授权：需要本人开通、付款、Key、许可或操作的事项先跳过，其他开发、自测继续；自测通过后交独立测试。Claude 已实际启动三个后台子任务：`Web client implementation (apps/web)`、`iOS Expo client (apps/ios)`、`Admin console (apps/admin)`。各子任务仅写自己的 `apps/` 目录，不提交或推送，不写根锁文件；Claude 主任务继续后端与数据库，串行处理依赖安装、根测试配置、任务状态与 Git 集成。接口契约已建立，客户端可先按 SDK 和隔离 mock 验证，但后端联调、真实登录、真机仍须分别验收，不能因客户端代码出现就提前关闭完整任务。

## 用户已明确的资源决定

| 项目 | 已确认 | 待确认或待用户操作 |
| --- | --- | --- |
| 托管 | 优先评估用户现有腾讯云首尔服务器；用户已授权只读检查 | 已核实 Ubuntu 22.04、2 核、约 3.6GB 内存、可用约 2.8GB、磁盘剩余约 40GB；已有服务占用 443，部署不得覆盖。容量及备份恢复尚未验证，不能宣称生产方案已验证 |
| 数据库 | 当前尚无数据库 | 本地独立测试 PostgreSQL 17 可初始化；服务器数据库安装、迁移与部署方案先形成可审查配置，不影响现有服务 |
| 域名 | 当前无域名 | 用户选择与购买域名；随后配置 DNS、TLS、身份回调及发信验证 |
| 身份、地图、邮件 | Auth0、Google Maps、事务邮件账号均未开通 | 用户创建账号、接受条款并批准适用账单；开发者准备回调、权限限制和 DNS 配置清单 |
| iOS | 有测试 iPhone；Apple Developer 与 Expo/EAS 均未开通 | 用户完成账号、开发者资格及签名相关操作；缺少完整 Xcode/签名时原生构建验收保持未完成 |
| 模型 | 用户指定 DeepSeek；已确认有 API 账号 | 用户稍后通过本地安全配置提供 Key；模型版本、结构化输出、用量、地区与留存需实测核查 |
| AI 费用 | 人民币 50 元/月上限 | 请求前并发预留费用，达到上限停止新调用；UNKNOWN 保留最大预留；不能误设为美元 50。账本若沿用 microUSD，必须用可审查 ADR 明确保守换算及价格/汇率版本；没有依据时保持真实调用禁用 |

人民币 50 元是模型调用费用上限，不是域名、Apple、Auth0、地图、邮件或额外云资源的费用授权。不开自动充值，不自动接受供应商合同，不将应用预算硬闸表述为供应商全部账单的绝对封顶。

## 前置操作与外部门槛

1. 服务器只读核查已获授权并执行；当前 Node 20，未发现 Docker、PostgreSQL。方案需要 Node 24 与 PostgreSQL 17，后续采用隔离运行时或容器的具体部署配置需先审查，不覆盖旧运行时或已有 443 服务。不要把服务器地址、账号、私钥或凭据写入公开仓库。
2. 用户在 [DeepSeek API 平台](https://platform.deepseek.com/) 已有账号，稍后创建或提供 Key，通过本地安全配置或部署平台密钥管理提供，不发聊天、不进 Git。模型调用价格以 [官方价格入口](https://api-docs.deepseek.com/quick_start/pricing/) 的实际链接及版本核查，不凭旧模型名估价。
3. 开发者提供域名、Auth0、Maps、发信域名及 Apple/Expo 的具体配置模板；用户处理账号、账单、条款、DNS 和签名中需要本人完成的步骤。
4. G-AUTH、G-PLACES、G-MAIL、G-IOS、G-PRIVACY、G-HOST、G-AI-MODEL/DATA/COST 逐项取得真实证据后才关闭。DeepSeek 不默认继承其他供应商的数据设置或留存承诺。

外部未就绪的任务记为 `blocked_external`，继续不依赖它们的本地实现与验证。不用 fake provider、模拟器、fixture、脚本存在或构建通过替代真实集成证据。

## 服务器目录隔离

用户追加要求：现有项目文件与 Fancy 项目文件分文件夹存放。已只读确认现有用户目录本就包含多个独立项目目录；Fancy 使用独立根目录 `~/fancy/`，其中 `releases/` 放版本代码，`shared/config/`、`shared/data/`、`shared/backups/`、`shared/logs/` 分别用于私有配置、持久数据、备份与日志。创建空目录不代表完成部署。

现有项目原路径和服务保持不变；若需要进一步把旧项目归入同一历史目录，先盘点 service、脚本、绝对路径、符号链接和恢复方式，再单独迁移。不能把整个用户目录或系统文件搬入一个项目目录。Fancy 的运行时、进程及数据库实例应隔离，不覆盖既有 Node 或占用中的端口。

## 验收后交接条件

用户补充授权：Codex 完成整体自测并通过之后，通知 Codex 会话「测试- MVP+AI」（`01a15bd2-dcd5-7e23-a65a-657705565050`），由该会话按测试用例独立执行测试。

交接时必须附：确切 commit、本地/远程 SHA 状态、未提交改动范围、三端/API/worker/数据库启动命令、环境与测试数据准备、真实/模拟适配器说明、自测命令与结果、证据及未关闭外部门槛。整体自测尚未通过时不得发出“已验收通过”的交接；独立测试完成前不得称最终验收已闭环。

## 本轮已核实的基线与限制

- Codex 独立执行原有 Python 仓库检查：56 项通过。
- Codex 独立执行 Demo 领域与助手及旧后台分析单测：94 项通过。这些仅证明既有原型回归，不证明生产 MVP 实现正确或外部门槛关闭。
- T00 提交 `a1da509` 后，Codex 独立运行 `source infra/dev-env.sh && pnpm core:check && pnpm core:test`：check、11 项配置单测、4 项真实 PostgreSQL 17 测试、8 项发布检查通过。首次普通沙箱运行因回环端口 `listen EPERM` 失败，获准监听后重跑通过；没有更改断言或跳过数据库测试。并行测试用例包落地后，63 项 Python 仓库验证通过。
- T01 实现提交 `c34d9c4`、状态提交 `91d7a7b` 后，Codex 独立复跑生成漂移/类型/lint/扫描检查、60 项单测、4 项真实 PostgreSQL 测试、9 项发布检查及 64 项 Python 验证，均通过。CLI 刷新令牌、协议相对回跳、可选 host 声明三个审查问题已由 Claude 修复并加入测试。T00 扫描入口曾在中文目录下静默跳过，T01 已修复并增加真实 CLI 非零退出回归；旧 T00 检查结果不单独证明该入口执行过。
- Xcode 后续已安装但许可尚未接受，默认 `/usr/bin/git` 因而报退出码 69。已核实旧 Command Line Tools Git 可运行，Claude 正在给开发环境脚本补相应 PATH 回退，不代用户接受许可或更改系统 `xcode-select`。Xcode 首次启动、许可及原生构建留待用户清醒后操作。
- 当前没有三端完整实现通过验收的证据；后续以唯一任务表及对应版本实测为准。
- 窗口控制曾出现 `noWindowsAvailable`，用户重新打开后已恢复。Claude 已回复确认 DeepSeek 与人民币 50 元/月及测试交接决定，并开始更新 provider 配置；后续服务器只读核查结果仍需同步给执行会话。

## 限额检查点与恢复（2026-10-21 02:28 London）

- Claude 桌面显示已达到会话限额，04:10 重置。没有购买额度或改模型。三个前端子任务及主任务需要在原会话恢复；不要另开一个无上下文任务重做。
- 已创建本会话 heartbeat `fancy-mvp`，按用户时区从今日 04:15 起至 09:15 每小时跟进，最多六次；无变化时保持安静。恢复后读取本记录、唯一任务表、工作区差异及暂存消息，继续开发、自测和有条件的独立测试交接；达到可执行范围闭环后停用跟进。机器仍需保持可运行。
- 这不是 MVP 完成交付。最后已同步的本轮协调提交为 `a6d294f`；T02、会话内核、三端客户端和相关工具/契约增补仍有大量未提交实现，未声称已同步 GitHub，不替 Claude 暂存这些文件。
- Codex 在较早的 T02 工作区上独立验证了 42 项 PostgreSQL 测试通过。后续再次执行时，66 项核心单测通过，数据库测试为 43 PASS / 1 FAIL（共 44）：`packages/db/src/migrate.db.test.ts` 的 schema parity 测试写死 8 张表，而新 `schema/conversations.ts` 已导出 3 张会话表，总计 11。应检查真实 SQL/Drizzle 全量映射并修复不随切片扩展的断言，而非删除校验或假称通过。此轮命令因 `&&` 在 DB 失败处停止，release/Python/diff 检查未继续执行。
- 已由 Claude 修复、仍待最终版本独立复验的审查项：过期幂等 claim 必须抛非可提交的 `FencingError`；作业每次领取独立 claim token，阻止同 owner 的旧执行者提交；重试耗尽进入 DEAD；错误代码采用有限白名单，拒绝把未知 code/错误原文入库；SDK 尊重 120 秒 Retry-After；worker 空闲轮询移除取消监听器。已添加对应回归，不据源码文字单独宣布通过。
- 新阻塞 **MVP-R01**（iOS）：`apps/ios/src/features/auth/session.ts` 中，受控 promise 延迟 `getSession`，先 `completeHandoff`、再成功 `logout`，最后释放旧响应，状态从 `signedOut` 又变成 `signedIn`。Codex 直接对当前 SessionManager 源码用 Node 24 transform-types 和 fake API 复现，不是设备验收。修复需 auth generation/epoch 使迟到会话/刷新/凭据写入失效，并覆盖退出与 SecureStore.clear 失败仍清缓存/进入退出态。反馈已暂存于 Claude，额度重置后先确认已交给 iOS 唯一负责人；不得由其他负责人并发改它的文件。
- 需用户明早处理：DeepSeek Key 安全配置、Xcode 首次打开/许可、域名及 Auth0/Maps/邮件/Apple/Expo 外部账号与账单/签名。按睡前要求先跳过，不反复请求，也不把 mock 或 Expo 单测当作真实门槛关闭。
- 阶段方法复盘：事务/租约回归、延迟响应复现与证据边界由现有 QA 验收及调试方法覆盖，本次不新建或安装技能候选，原任务继续优先。
