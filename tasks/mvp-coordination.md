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

## Codex 接管（2026-10-21 用户明确授权）

- 用户要求 Claude 限额期间由 Codex 接手全部生产开发，恢复后交叉检查。已在原 Claude 桌面会话发出停止写入、停止旧子任务、禁止运行旧待执行写入命令的通知；恢复后只读审查最新提交。
- 接管基线 `95b297c`。保留 Web 未提交批次、整个 iOS 未提交实现及根 package 的客户端测试脚本；不修改其他会话的竞品研究。生产目录、共享配置、任务状态及集成交付负责人改为 Codex。
- Codex 并行分工：`web_takeover` 独占 apps/web；`ios_takeover` 独占 apps/ios；`venues_backend` 独占 apps/api/src/venues；主负责人独占其他生产后端、数据库、共享配置、锁文件与任务表。子任务不提交，主负责人串行验证集成交付。PRD/Demo 原负责人不变。
- 已更新 heartbeat，禁止按旧提示恢复 Claude 写入；Claude 恢复只读检查，报告可复现缺陷，由 Codex 修复。独立测试仍以整体自测通过为前提。

## 接管实施检查点（2026-10-21 06:03 London）

- 已串行同步 Web 基线 `0b1a298`、iOS基线 `63c693b`、测试入口/签名游标 `29b012b`。下述后端集成批次在本记录写入时待提交，不能视作已经在GitHub。
- 生产后端已接资料、饭局/申请/审批/取消、生命周期、消息及显式已读、饭后与私聊授权、问卷、通知/举报与个案支持、删除屏障/本地清理、后台快照/下钻/CSV及AI偏好/会话/预算/草稿。AI原文与导出正文只在RAM；真实提供方未配置时明确不可用，未用fixture伪装真实调用。
- 05:57完整核心回归：unit131、真实PostgreSQL89、API84、release9通过；随后新增worker入口测试1、空batch同意/撤回与发现来源合计10项API、release10、SDK10、删除页6项分别通过。Web+admin185、iOS136在05:56版本通过；后续AI/采集UI增量仍需最终集成重跑。仓库Python64通过（随后新增运行说明仍待重查），类型/生成物/lint/secret检查在提交前重跑。
- 独立代码复核修复：删除席位与最低人数、私聊Inbox发送状态、支持case失权重放、PG微秒分页、pending申请Inbox、账号切换旧响应及UI隔离、失效reauth不得清AI、5xx事务回滚。用户数据删除worker物理清私有字段，远端身份/Apple撤销与政策未齐时NEEDS_SUPPORT，不宣称删除最终完成。
- 新增可销毁本机联调入口 `infra/local-acceptance.ts`（回环3000、临时PostgreSQL、测试身份与虚构餐厅、固定测试OTP），开始真实浏览器登录/补资料/创建/双账号申请审批/消息链；这不是线上或真实外部验收。API/worker实际入口与CI配置已准备，首尔没有安装或部署。
- Web AI助手接入已冻结，iOS AI UI仍在实施；Web采集同意与完整来源事件仍在实施。后台未知来源维持partial/null。当前仍未完成整体自测，尚未通知「测试- MVP+AI」开始执行；用户要求的独立测试交接在可执行范围自测全通过之后发送。

## 本地核心闭环复验（2026-10-21 06:22 London）

- 已同步 `ca8d8c1` 后端/AI内核和 `69266ba` Web助手/显式采集；两者本地远端一致。后者 GitHub Actions run `39547884093` 已完成 success（https://github.com/daisiechen/Grab-in-London/actions/runs/39547884093）；它不覆盖后续未提交增量。
- 本批新增真实Google Web地图初始化（公开Key/Map ID缺失则不加载SDK、列表回退）、支持CLI、支持纠错个案授权并发锁修复、AI完整保留地图/关键词/时段硬筛选，以及0021全局隐私epoch。Google公开数据不放Apple底图；iOS同样改用Google provider，无key/原生模块时回退列表。
- 独立交叉检查补证：支持纠错等待饭局锁时撤grant，修前错误写入，修后404且无修订；游客AI完成与登录撤销，修前稳定40P01，修后通过；删除其它账号后，旧AI转录/结果/草稿不可读，在途结果不能发布，成功配额释放，新会话可建。删除提交成功后清空整个单API的旧RAM上下文。
- 后台公式修复：按当期分类恢复认证历史事件，不改原始分类，不追溯链接匿名；weekly卡片/明细与批准Demo最新可见周一致；表单错误按step/field聚合、下钻和CSV贯通。
- 06:20整合回归：unit149、PostgreSQL100、API91、release10通过；Web+后台211通过；Web与后台生产build通过，仓库Python64通过；随后新增DeepSeek安全配置映射单测13/13及release10分别通过。非iOS全部包类型/SDK生成物/infra类型/lint/secret scan通过。新增或修改的局部回归不能代替整个未完成iOS批次的最终验证。
- iOS助手、三编辑器、显式已读与Google原生地图源码正在收尾；此前基线及新局部测试已过，最终全套/Metro export仍待该负责人冻结后整合复跑。真实Google Key/Map ID、DeepSeek模型/价格/计数器/60样本、身份/邮件、Xcode签名/真机与首尔部署仍是外部门槛，未接真实用户。


## Codex 接管后本机整体自测通过（2026-10-21 06:40 London）

- 最终代码提交 `8bc1e92`，承接 `20ff465` iOS主集成；本批包括原生显式采集/来源事件、原生scope无Set-Cookie、ID型选店确认修复、Web游客固定主体复用、快照删除主持人保留他人历史及SQL微秒精度、实际采集覆盖日期配置。此前 `20ff465` 本地远端SHA已核对一致。
- `core:check`、unit151/DB101/API96/release10、Web+后台211/iOS169（25 suites）、Python64、Web/admin builds均通过；最后原生no-cookie变更单独10API通过。Hermes导出1535modules/约3.3MB成功，不是原生签名安装。详情及本机日志见 [本地自测报告](../docs/delivery/mvp-local-selftest-2026-10-21.zh-CN.md)。报告/任务更新后重跑Python文档验证。
- 本机fixture环境已按最终后端重新启动，API3000与临时PG/worker；入口与固定OTP见运行说明。没有首尔部署或真实供应商调用。独立测试交接将固定最终文档提交SHA，不能把自动化计数视为217条用例全部通过。
- Claude当前09:10 London限额恢复，已停止原任务自动续写；现有heartbeat保留恢复后只读交叉审查，不重启旧写入任务。等待独测及真实外部门槛，完整任务不批量标done。

- 独测已正式发出并收到确认：被测交接提交 `8ba6fc7c9974cf6be1ac06d8b16e0380fb3beced` 与远端一致。06:41 London「测试- MVP+AI」回复已开始固定版本并按217条用例优先执行权限、并发、隐私、费用与核心路径。报告/缺陷待独立执行，本记录不是独测通过结论。`docs/README.md` 索引所有权交回QA会话；协调负责人继续生产代码修复，避免并行写入。现有heartbeat已更新为跟进独测和09:15 Claude只读交叉检查，不重复启动测试。


## 独测跟进与 Inbox 分页修复（2026-10-21 07:22 London）

- 已核实 `2ca0568` GitHub Actions run `39550981572` 完成 success，覆盖交接后的相同生产代码。QA已独立复跑核心/Web/后台569项、iOS169项及新增29项探针，并保存本地浏览器路径证据；尚未给217条逐项完整结论，不宣称独测全部通过。
- QA浏览器/源码发现 Web Inbox只读取首20条而丢弃nextCursor。协调会话用第二页饭局组件回归稳定复现（修前1失败/8通过），现顺序遍历所有页且重复/空游标fail-closed；同时移除聊天元数据定位任意5页截断。未修改API契约或PRD/Demo。
- 修后Web172项通过（新增第二页显示、超过5页定位、重复游标终止三项）；Web typecheck、限定文件lint、build及diff检查通过。该切片仅改Web三个文件；QA脚本/截图与其他研究修改保持各自负责人所有。卡片场次信息缺失待QA稳定编号与最小验收预期，暂不按实现反推需求。
- 独测会话已恢复执行剩余用例，不重复之前通过的项目；Claude仍等待09:10恢复后的只读交叉检查。


## QA-F01 申请场次信息修复（2026-10-21 08:15 London）

- QA提交 `83a2d5f` 登记QA-F01 OPEN；当时34 PASS / 1 FAIL / 14 BLOCKED / 168未完整验证，不是完整验收通过。报告/探针/索引仍由QA维护，协调会话不修改。
- 生产修复：InboxItem增量可选 `applicationMeal`，仅含饭局标题、London ZonedTime、主持人公开显示名。本人已授权申请按对应meal关联，不新增邮箱/留言/群信息；主持人非ACTIVE时标题/姓名遮罩。Web和iOS申请卡片展示摘要，原View application链接不变；iOS可访问性标签包含场次，避免同状态按钮无法区分。
- 定向验证：Web两场pending卡片检查标题、分别日期时间、主持人、各自mealId链接及不显示私人留言；API真实PG两场对应、精简摘要字段、无群信息及删除主持人遮罩；iOS卡片展示及跳转。修后API4、Web单文件12、iOS169通过；全包core:check、Web全量173及build、iOS类型/lint均通过。根Python69项中1项因QA并行修改探针后记录哈希待更新而失败（QA probe changed after run），已通知QA，不改其断言、不宣称全绿；协调文档单独验证。
- 旧的本机API进程不会自动加载新服务端代码；已提醒QA先保存现有路径证据，再重启可销毁fixture进行浏览器复验，不能用旧进程判断补丁失败。最终关闭由QA负责，未将QA-F01提前标CLOSED。


## 原14条阻塞本地解除准备（2026-10-21 08:38 London）

- QA已在 `c015910` 纠正PRIVACY-007/008为本地待执行，不再泛称外部阻塞。开发本轮按14个原ID逐条写 [解除矩阵](../docs/delivery/mvp-gate-unblocking-2026-10-21.zh-CN.md)，注明可复验部分、唯一依赖、负责人及不能关闭的真实门槛。
- 本轮生产增量：供应商Auth0/Apple分步持久checkpoint及稳定幂等key；0022恢复闸门阻断API业务及worker；可信离线台账重放复用原删除事务，保原删除ID/回执hash/有效期/政策；真实pg_dump/pg_restore与错误台账拒绝/重放/重复重放/他人保留；同库新API/RAM runtime旧AI410；本机100并发/1000账号/10000消息混合负载准备。
- iOS原生工具链仍因未接受许可退出69；新增4项冷启动/安全存储/410测试后全173通过，不冒称真重装。免费Personal Team足以尝试个人设备开发，不将付费Program或EAS误列为全部本地测试前置。
- DeepSeek官方参数/usage/数据边界核证ADR、34适配器回归、固定60合成中英样本及无网默认runner/结果校验已准备；未读取Key/真实调用/批准价，dry-run60 NOT_RUN，真实评测仍需实际账户及批准。
- 最终核心整合unit198、DB106、API100、release10通过；core:check、Web+后台215/iOS173通过。最后补充恢复回执原有效期/政策后定向恢复复跑；QA已串行补两份新文档索引并交回本批暂存；Python69项最终通过，限定lint与diff检查通过。QA脚本及报告保留独占，本轮不替其改case结论。

- 解除准备代码与文档已提交 `d4582f7` 并核对本地/远端一致，已即时发QA定向复验命令与真实边界。另补CI固定PG17客户端容器wrapper及参数回归，避免恢复测试依赖未声明的host pg_dump；这不改生产runtime，真实CI另查。


## 独立QA本地删除/恢复复验通过（2026-10-21）

- QA即时独立复验 `d4582f7` runtime：删除/恢复/DeepSeek准备定向57项、iOS冷启动/SecureStore16项、第三批P0边界12项均通过；这些测试数量不直接折算完整case数。
- QA另建真实pg_dump/pg_restore探针，备份前生成并可下载CSV E0，台账重放后用仍有效analyst会话读取E0实际返回410 SNAPSHOT_REVOKED且非CSV；保留原receipt/身份/快照/他人数据/幂等断言。
- QA-PRIVACY-007/008在本地验收范围PASS；未关闭Auth0/Apple真实远端撤销、生产独立台账持久化或G-HOST部署门槛。原217条当前52 PASS /153 NOT_RUN /12 BLOCKED；DB008支持联合路径与DB011错误人数声明分支仍未完整验证。
- QA正在单独冻结、验证和提交执行报告及探针。协调会话不改其报告/脚本；精确证据提交以QA后续记录为准。


## QA-F03 身份关联proof窗口修复（2026-10-21）

- QA真实HTTP/PG独立探针发现窗口重复毫秒→秒换算，300000ms实际变成0.3秒。开发新增1s/299s/300s/301s/未来1s回归，旧版3失败/23通过（有效proof被拒与未来proof被接受），保留 `/private/tmp/fancy-f03-red.log`。
- 修复去掉SQL时间单位换算，读取已消费且属于当前family的proof，在所有用户锁获取之后用同一effectiveNow对session authTime及proof consumed_at调用共用assertFreshAuth；严格0≤age<300000。没有放宽窗口或接受未来时间。
- 修后身份API26通过，API类型、限定lint及diff检查通过；全API105项/24文件整合通过（`/private/tmp/fancy-f03-api-all.log`），协调任务文档验证通过。QA-F03由独立QA持有，待其新提交定向复验后关闭。QA已明确本轮Git index由开发串行独占，未暂存QA报告/脚本。


## Claude只读交叉检查启动与CI退出竞态修复（2026-10-21 09:21 London）

- Mac解锁后，原Claude桌面 `local_dcb878d4-b44f-459f-b1b6-8dd287faf119` 恢复可操作；移除旧开发排队指令，自动继续仍关闭，重新发送仅只读审查当前main的任务。UI已显示repo/handover/身份/删除恢复/AI/客户端审查计划运行；未恢复旧子任务或写入，审查结论尚待返回。
- 远端 `f27c17d` Actions run39567618348/job119113614631实际failure：105项API断言均通过，但load场次退出时报57P01未处理异常。日志指出其超过1秒，触发后台deadline sweep。审查发现onClose仅清timer而不等待正在进行的sweep，是可独立复现的退出竞态。
- 新受控promise单测在旧逻辑FAIL，修复改为清timer→等待当前sweep→shutdown/recover；同一API生命周期不会在pool关闭后继续其定时任务。修后单测1、全API105、API类型/lint通过；远端CI需对应新提交复验，暂不声称已经绿。
- 用户已完成Xcode首次配置：checkFirstLaunchStatus退出0；只读host simctl查询退出0但devices为空、runtimes为空。旧许可69已解除；需安装运行时或配置实际iPhone/签名。没有代接受协议或安装组件。


## Claude第一轮只读结论与远端CI恢复（2026-10-21）

- 已直接核实5a37fdc Actions run39568728053被后续push取消；后续同生产修复的bf297d9 run39568947238完成success（https://github.com/daisiechen/Grab-in-London/actions/runs/39568947238）。不把cancelled当通过，也不继续说新修复远端未核实。
- Claude在原桌面会话完成至bf297d9第一轮源码交叉检查，声明无写入/旧脚本续跑，所有发现均静态、尚未写失败复现。身份proof、删除锁/授权、worker分步checkpoint、恢复gate、费用预留及Web账号响应隔离未发现新增问题；这不是运行验收签字。
- 六项静态发现分派：CR-01代理后IP限流合并（开发复现/配置可信代理）；CR-02恢复重放用当前时刻而非原acceptedAt（开发补跨start复现）；CR-03全局epoch导致AI/快照/幂等响应广泛失效（先查依赖与必要隐私fail-closed，不能直接拆屏障）；CR-04举报/支持自由文本保留（G-PRIVACY政策待批准，先查最小字段）；CR-05恢复503使用未登记码（随HTTP契约修复）；CR-06leave采用meal.version引发额外409（三端一致，Claude明确非正确性问题，记录权衡而非功能缺陷）。
- 已要求Claude继续只读补未覆盖的iOS session/guest存储/采集epoch及完整审批/退席/取消命令权限。QA正在本批5文件串行提交窗口，开发仅各自源码/测试实施，不git add/commit，待QA明确释放后集成。

## Claude补审修复与整合复验（2026-10-21 10:03 London）

- QA在90f3ab8释放Git窗口；原217条为74 PASS /131 NOT_RUN /12外部门槛BLOCKED。仅集成生产负责人冻结文件，不触及QA报告/脚本/索引及其他研究修改。
- CR-01/05已提交1251d08：可信代理IP/CIDR显式配置，默认不信任任意转发头；OTP/游客/回执客户端隔离与伪造头拒绝9API，配置26unit；503登记SERVICE_UNAVAILABLE。CR-03本人幂等响应7afdecf：旧实现无关删除后survey重放403，修后严格白名单且DB证明归属的survey/application返回原body不增业务行，其余继续fail-closed。
- CR-02及快照边界2585460：台账原acceptedAt重建删除时取消/退出，再推进他人生命周期；严格时间与整批预检。仅可证明账号出现前的S0/E0保持原ID、数据和CSV正文，S1/E1及旧epoch/撤销/证据不足仍410。恢复/快照5文件11API通过，未放宽AI全局屏障。
- Claude补审仍仅静态，开发分别复现：N1删除申请人后旧Approve/Decline401误登出正常主持人；N2首次钥匙串失败使后续登录永久受阻；N3晚到401重复旋转使另一重试token失效。修后N1业务404且主持人session200，自己失效仍401；fa61c8b原生失败存储动作显式重试，未成功清除仍阻断游客恢复，晚到401按实际使用token隔离刷新/失效。iOS180测试及Hermes1535modules导出通过，不等同真机重装。
- CR-04对已知举报人/目标/主持人/消息作者关联，读取即时遮罩、处理锁关联用户后重读、worker清双正文/理由/公开结果/精确审计关联出勤理由和幂等响应副本。保留IDs/事实/幂等键；旧NEEDS_SUPPORT本地已完成但缺文本步骤也补清。未知正文提及和已完成历史记录受控backfill仍需政策/实际数据评估，默认policy未批准仍NEEDS_SUPPORT。
- 整合发现另一个测试清库竞态：pg-pool.end可早于底层socket end回调完成，force drop导致57P01；受控单测修前FAIL，测试工具改为等待实际客户端end后再清库。没有吞掉数据库错误。修后全量core unit212/DB107/API130/release11、Web+后台215/iOS180通过，core:check通过。日志/private/tmp/fancy-cr-final-{check,core,clients}.log。最终提交后交独立QA复验，不将本轮自动化计数折算217条全通过；最新提交远端CI需另查。
- 用户重启后已实际读到Claude补审结果；其原会话保持只读、不恢复旧写入任务。Xcode许可完成但host尚无simulator runtime/device；账号/真实Key/首尔部署/政策门槛仍保留。

## QA-F04 人工停用预算后晚发布修复（2026-10-21 10:12 London）

- 独立QA在159b0e8发现挂起provider调用期间关闭预算，旧请求仍SUCCEEDED并发布；原失败由QA保存，不改其脚本/结论。开发补生产DB回归，修前3失败/18通过：reserve后停用仍dispatch，以及用量已settle后停用仍发布SUCCEEDED/NEEDS_INPUT。
- dispatch在原call→period锁序下重读enabled；停用则CANCELLED且只释放未发出的预留。最终finish在发布事务按调用涉及period排序FOR SHARE，停用则FAILED/UNAVAILABLE，不执行RAM发布且释放成功轮预留。该锁保持至事务结束，防止settle与publish间的停用漏检；已发生的供应商费用仍KNOWN并如实入账，不以停用退款或重试。
- 修后原kernel21项通过；再补确定性真实PG并发：operator持预算UPDATE且停用，finish等待该锁，停用提交后拒绝发布，kernel最终22项通过。完整core unit212/DB110/API130/release11及core:check通过（完整DB运行在最后并发测试加入前，额外一项单独验证通过），日志/private/tmp/fancy-f04-{red,green,fence,core,check}.log。未修改AI预算50元/月或外部启用门槛；缺陷关闭由独立QA在固定新SHA复验后记录。

## QA-F05 新建助手会话未清输入修复（2026-10-21 10:29 London）

- 独立QA在361e85e真实Web组件发现NEW成功后未发送文字仍保留。开发补原组件回归修前1失败/14通过；仅在NEW成功分支清input，不改通用clearConversation，TTL及偏好删除仍保留助手草稿，业务编辑器保持原内容且未调用apply。iOS原本NEW已清text，新增保护性回归而无生产逻辑变更。
- 修后生产Web单文件15项通过；全Web/后台218项（含QA工作树独立2项）及iOS181项通过，双端typecheck/限定eslint/Web生产build通过。首次绿色复验因modal使外部业务editor不可访问，测试改为先Close assistant再检查业务editor；该测试夹具错误不是新增产品缺陷。日志/private/tmp/fancy-f05-{red,green,clients-final,build}.log。QA独立探针由QA持有，缺陷待固定修复SHA复验关闭，不将本轮组件计数折算完整用例通过。

## QA-F06 Support CLI 认证合同补齐（2026-10-21 11:04 London）

- QA在291e115发现SUPPORT_CLI合法startOAuth被本地硬编码403；正式合同§7已要求该客户端，不能当真实供应商配置阻塞。增量start字段loopbackRedirectUri在CLI必填，固定raw `http://127.0.0.1:<1024..65535>/auth/callback`，其它client拒绝；每次start登记入原事务，无新数据库迁移或角色授予。原不带登记请求修后422，不伪报201。
- CLI provider直接回同源核心 `/v1/auth/oauth/callback`（Web原/auth/callback为SPA，不能用于CLI303浏览器导航）。核心验证provider后仅向登记loopback回code/state，60秒PKCE绑定交接；15分钟opaque access无refresh。LINK_REQUIRED仅浏览器错误，无ticket/长期token出URL，不影响浏览器原会话。契约/生成OpenAPI登记字段、303及错误分支，不改批准技术包。
- CLI默认同一进程浏览器认证后执行一条stdin命令，token仅RAM不写文件/argv/输出；显式安全注入旧token仅保留运维/测试兼容。原始本机HTTP path/host/origin/method/state/重复参数均校验，官方OS浏览器handler不用shell，超时退出关闭listener，无自动写重试。真实供应商回调名单/MFA及case grant仍待配置。
- CLI18unit、后端identity+support41API及根真实HTTP listener→核心回调→PKCE兑换→session读取/无权限拒绝联调1通过。完整核心unit232/DB111/API144/release11、冻结前core:check以及最终API/contracts/CLI typecheck、限定eslint、generated检查通过；日志/private/tmp/fancy-f06-{core,api,http-loopback,check}.log。独立QA正式复验需固定新SHA，R32原失败保留。
- 同时只读复核发现原生OAuth code/state未交core兑换，以及删除reauth误等handoff，属于另一本地桥接缺口（候选QA-F07）。已分配原生负责人最小修复并与本批分开提交，未以缺Key/真机免验，不在本批宣称iOS OAuth已闭环。

## QA-F07 原生OAuth与再次认证桥接（2026-10-21）

- QA独立R33复现Google/Apple原始code/state深链无法登录；开发新增oauth-bridge修前5失败，实际core JSON session的OAuth/EMAIL再次认证另2失败。旧客户端把提供方原code误当已经由核心兑换过的handoff，且曾接受URL linkTicket，不能归为设备或Key阻塞。
- 修复严格绑定授权URL内真实provider state（不是stateTransactionId）与精确app回调，原code/state仅交现有HTTPS oauthCallback；仅其JSON结果能提供handoff或LINK_REQUIRED，URL中的handoff/linkTicket拒绝。正常登录才兑换handoff；两类再次认证重验证原family JSON session，再以同一删除intent/receipt提交。generation、userId及mounted校验防止退出/换账号/页面卸载后的响应继续删除；再次认证后仍要求reauth时不自动循环。
- 冻结后根整合Web/后台219及iOS207测试通过（包含QA当前独立四项），全core:check通过；原生负责人另已完成iOS Hermes导出（/private/tmp/fancy-ios-f07-export及同名前缀日志）、类型/lint。根日志/private/tmp/fancy-f07-{clients,check}.log。仅原生七文件与本协调记录，不含QA/研究文件，不改server或共享契约；独立正式复验仍需固定修复SHA，真实Auth0/Google/Apple/设备仍未验收。
- Claude对b76c593 CLI及本批原生源码继续只读交叉检查；其新增适配器MFA claim丢失与原生双证明链接缺口正分别核证，不将静态检查当测试通过，也不因已修F07宣称完整认证已闭环。

## Auth0已验证MFA标记保留（2026-10-21）

- e5d3542独立QA已固定b76c593验证F06及1080993验证F07，原失败保留，当前91 PASS /114 NOT_RUN /12 BLOCKED，无当前FAIL；JOURNEY001仅解除前置失败回NOT_RUN。b76c593 CI39581746626完成success。QA提交窗口明确释放后开发接手。
- Claude只读发现Auth0适配器丢弃ID token已验证amr，根源码复核及真实RS256签名测试确认：旧版即使amr含mfa仍只回google，修前1失败。仅在jwtVerify签名/issuer/audience/expiry及nonce验证成功后，严格字符串数组内精确mfa才保留一次标记；缺失/字符串/混合数组/其它claim不授MFA，不授角色，不从客户端字段推断。
- 11项签名JWT回归通过，完整unit243通过、API类型及限定lint通过；初次未升级沙箱的完整unit因CLI回环监听权限4失败，按所需本地端口权限复跑全243通过，未改测试或吞错。日志/private/tmp/fancy-f08-unit-verified.log。官方依据在适配器就近引用Auth0 step-up文档；真实租户MFA策略/claim仍需G-AUTH，供应商验收未关闭。
- 另行核实双端身份链接仅存票据/提示而无正式双证明提交，不能继续称合同缺失。已分派Web与iOS负责人按现有§7补齐最小显式流程、TTL/取消/会话清除/冲突边界；属于另批进行中工作，不混入本适配器切片或F07关闭结论。

## 双端双证明身份链接补齐（2026-10-21）

- fb26b28已归档独立适配器MFA旧版3红/修后14绿，F08 targeted关闭、不增加217完整case计数；QA再次明确释放Git窗口。双端链接按既有§7实现，原Web只有ticket提示、原生LINK_REQUIRED丢verifier/proof且无提交，均为本地实现缺口。
- Web显式继续原身份验证，再单独确认连接；短期同tab票据存储只保受限字段以跨全页OAuth，原身份authProof及固定幂等payload仅RAM。原生保原new-identity verifier、真实core authProof和票据仅RAM，原登录成功后仍需显式确认，不自动merge；五分钟过期重新登录取证明，十分钟票据失效重新开始。取消/冲突/会话清除终止，网络未知同payload/key显式重试。旧成功/409/网络响应均不得清新attempt；页面卸载不导航。
- 根补真实PG native-link协议：新Google身份匹配email→LINK_REQUIRED无第二user→原身份IOS email登录proof/handoff→错误new verifier409、正确links200、同key重放200、新key消费409，最终两identity仍原user；无后端逻辑、schema或SessionManager放宽。
- 首批冻结整合Web/后台228、iOS219；其后补旧409/503/成功响应及定时器不得清新票据、终态可取消回归，最终Web/后台235、iOS227（含新增QA独立探针）、全API145通过。core:check、Web类型/lint/build及原生Hermes导出通过；Python70最终复验一度因QA报告R39基线展示未刷新而失败，QA已按真实fb26b28+dirty源码hash修正（R40原生仍360d1fe），validator及Python70通过，未改产品断言。unit243/DB111/release11沿用上一无变更层已通过结果，未冒称本批重复运行这些层。日志/private/tmp/fancy-f09-{clients-final,check-final,python-final,web-build,api}.log、/private/tmp/fancy-native-link-api.log及/private/tmp/fancy-ios-f09-export.log。原生已单独360d1fe提交；Web和运行记录随后按白名单交付。QA独立动态复验需最终SHA，真实双provider/设备未验收。
- Claude重新核验游客撤销静态疑点后明确撤回L3：exchangeHandoff已有revokeGuestAI且更新guest_sessions.revoked_at，与登录兑换同事务提交/回滚；未凭静态误报擅改现有原子撤销。CLI新账号/业务令牌范围两项仅记无越权的策略观察，不额外改变已批准权限合同。

## QA-F10 超长助手输入保留与提示（2026-10-21）

- 独立QA在e8844dee复现Web粘贴2001字符被maxlength截断，以及完整超长状态发送静默返回无提示；原两红由QA在f5a0143保留。当前100 PASS /104 NOT_RUN /1 FAIL /12 BLOCKED；没有把开发绿色测试代替独立关闭。
- Web与原生移除输入框2000硬截断，全文保留并在现有输入区提示缩短；发送前按原文长度拒绝超限，不允许首尾空白经trim绕过。空白不请求、2000字符允许、缩短后清长度错误且可正常发送；trim仅用于既有发送文本与空白判定。原生无真实设备粘贴验收声明。
- Web自有及QA探针21项、原生定向24项通过；根整合Web/后台241项、iOS233项及Web生产构建通过。日志/private/tmp/fancy-f10-web-final.log、/private/tmp/fancy-f10-ios.log、/private/tmp/fancy-f10-build-final.log。后端/契约未修改，不重复声称本批运行核心unit/DB/API/release。
- QA明确释放Git窗口后开发仅提交双端七个生产/自有测试文件和本记录，保留QA文件与研究修改。正式修复SHA交独立QA复验，AI045及F10关闭结论由QA持有。
- 全仓core:check及Python70项通过（/private/tmp/fancy-f10-check.log、/private/tmp/fancy-f10-python.log），包含生成契约一致性、类型、lint和密钥扫描；不等同真实供应商或设备验收。

## QA-F11 聊天403后的旧元数据围栏（2026-10-21）

- QA在49d22b6动态挂起恢复时取得的旧canSend元数据：LIVE403进入HISTORY后，晚到元数据重建轮询器，再发无权LIVE请求。没有自动发送或越权正文泄露；原红在1253409保留。同期F10独立Web3/iOS24复验关闭，当前101 PASS /103 NOT_RUN /1 FAIL /12 BLOCKED；本批不代QA关闭F11。
- 当前挂载聊天页用同步单调HISTORY围栏，403、发送403或退出/解散先置位停止轮询，再读一次授权HISTORY；旧元数据成功/失败与晚到LIVE结果不再改状态，分页使用HISTORY，发送同步拒绝。围栏只属于当前挂载会话，新路由实例可正常LIVE，不改后端授权或原生轮询。
- 自有前红13项中1失败（重复HISTORY），修后自有14及QA独立3全部通过；新挂载授权会话恢复LIVE及编辑器回归通过。根Web/后台247项整合通过；记录/private/tmp/fancy-f11-clients.log。QA已明确释放提交窗口，开发仅提交ChatPage、自有测试和本记录，保留研究修改；正式修复SHA交独立QA复验。
- 全仓core:check、Python70项及Web生产构建通过（/private/tmp/fancy-f11-check.log、/private/tmp/fancy-f11-python.log、/private/tmp/fancy-f11-build.log）。原生和后端无修改，沿用前批通过结果，不冒称重跑。

## QA-F12 地点查询移出业务事务（2026-10-21）

- QA在a1120ae的真实HTTP/PG探针挂起description-only编辑的地点查询，第二连接取得meal FOR UPDATE NOWAIT返回55P03，放行后PATCH200。原红在2125ca9保留，当前111 PASS /93 NOT_RUN /1 FAIL /12 BLOCKED。没有把未动态验证的publish描述为持meal锁；源码另确认confirmVenue持actor锁等待同类外部查询。
- fresh intent在幂等重放分支之后、业务事务之前查询地点，只传本次请求RAM中的venueRef/placeId；create/edit/confirm事务内不访问供应商。锁内重新校验活动账号、资料、版本、截止时间、安排状态和地点引用，写DTO继续不含供应商展示数据。description-only编辑仍真实查询地点，不绕过QA探针前置。
- 已知4xx准备失败进入短事务封存，重放不调用供应商；临时5xx释放claim，可同key恢复。整合精确比较发现原通用错误路径封存与首次HTTP各生成serverNow，可能差1ms；保留精确断言，修为首次返回同一封存正文，并保留首次/重放Retry-After。受控时钟每次序列化推进1ms的回归修前红、修后绿。
- 自有锁/重验/重放11项与关联API组合26项通过；根独测原挂起探针1项通过（默认工程不收集scripts，使用/private/tmp/fancy-f12-probe.config.mts显式运行，未改QA文件或仓库测试配置）。首轮整合unit246/DB111/API156/release11及core:check通过；日志/private/tmp/fancy-f12-{core,unit-final,api-final,release,check-final,original-probe}.log。仅最终冻结版本交独立QA正式关闭，CODE003整条仍需完整命令审阅。
- 通用错误直接返回还需隔离重试副作用：受控pool首次COMMIT抛40001、第二次handler业务拒绝，旧after闭包会错误执行上一次成功动作；确定性测试修前红。改为每次事务返回自己的after，拒绝为undefined，只执行最终成功提交的返回值。该回归使用受控数据库接口，不冒称真实PG并发；真实PG地点回归11项仍通过。最终七个生产/自有测试文件及本记录按白名单提交，不含QA或研究文件。
- 最终冻结版本unit247/API156/core:check及Python70通过，日志/private/tmp/fancy-f12-{unit-sealed,api-sealed,check-sealed,python}.log；DB111/release11沿用本批上述无变更层已通过结果。Web/原生未改，不冒称本批重复客户端测试；缺陷关闭与整条CODE003结论由QA持有。

## QA-F13 OAuth请求日志查询串脱敏（2026-10-21）

- QA在761304c用合法合成Google OAuth回调与真实非silent Fastify/Pino info子进程，证明默认req.url写出原始授权码。原始捕获只保父进程RAM，证据只记布尔；没有真实Key/账号/外网。PRIVACY003先前通过仅覆盖删除receipt POST，不代表回调日志安全。
- 生产server统一使用请求日志白名单：仅method、无query/fragment的路径、连接信息；不序列化headers/body/raw对象，保留reqId及响应耗时。业务request.url不改，回调仍能解析原始code/state。错误序列化丢弃提供方原message/stack/cause与附带请求，只保有限name/code及固定占位。
- 真实Pino定向2项修前红/修后绿；根显式运行独立OAuth/删除receipt子进程探针2项通过（/private/tmp/fancy-f13-probes.config.mts及fancy-f13-probes.log），未改QA探针/仓库收集配置且未打印原日志。仅三个生产/自有测试文件及本记录交付；固定提交由独立QA复验后决定F13关闭，CODE006全路径审计不由局部通过代替。
- 根工作树unit252（包含QA并行自有assets三项，不混入生产提交）、API156、core:check和Python70通过，日志/private/tmp/fancy-f13-{unit,api,check,python}.log。后端业务/DB和客户端未改，不冒称本批重跑无关层；提交需等QA明确释放Git窗口。

## QA-F14 双端恢复前台偏好版本验证（2026-10-21）

- 独立QA在8e94ab3复现iOS恢复前台仅tick，另一端删除偏好后仍留旧介绍；修正探针getState拼写为真实getSnapshot后同请求次数断言仍红，原红由04f219d保留。服务端删除/旧session屏障已绿，不无故改后端。Web只在部分待处理poller恢复查session，同类完成对话缺口经自有前红确认。
- 原生每次pause结束旧异步epoch，隐藏旧turn/result/账号偏好；active合并恢复请求，先读本人偏好epoch/version，再读会话。变化清旧上下文/候选，保本人未发文字；离线保持AI屏障，发送/重试/Continue/转写/确认候选不得绕过。偏好读/删除独立可用。NEW、换账号及再次pause均拒绝迟到旧响应；只读恢复不续TTL。
- Web对visibility/focus和下一AI动作同样验证，bootstrap绑定偏好epoch，不被单独查看偏好改写基准；pause revision与账号/会话generation合并围栏。后台SEND结果只RAM暂存，经当前校验后才显示；epoch变化销毁。首次bootstrap挂起的先后台放行/先回前台两序列均须校验后才发送，不绕过零AI请求断言。
- 原生定向33项（含QA原probe）、根iOS242项；Web助手40项、根Web/后台258项通过。日志/private/tmp/fancy-f14-{ios,web,build,check,python}.log；仅双端五个生产/自有测试文件及本记录提交，QA/研究/本地rig另批不混。正式F14关闭仍交QA固定SHA独立复验，不冒称真机/真实供应商验收。
- 全仓core:check、Web生产构建及Python70通过；本批后端业务无修改，unit/DB/API结果沿用最近已验证层，不声称在客户端切片重跑。并行本地rig发布隔离13项通过，其变更按另批处理。

## 本地生产界面验收入口（2026-10-21）

- QA后续需将Demo来源用例映射生产浏览器路径。复用既有临时PG/API/worker rig，不接真实凭据/付费供应商；另启显式FANCY_LOCAL_STAFF_FIXTURE=1时才预建qa-staff@example.invalid合成后台账号。通过真实核心OTP流程创建身份，再仅给该账号测试analyst/data_admin和模拟MFA；普通账号仍无角色/MFA，bootstrap登录显式204注销且数据库revoked_at回归证明撤销。
- Web先在127.0.0.1:5174登录，保持API/数据库不变，停止Web Vite后用同端口启动admin，避免5175写Origin被拒；生产CSRF/认证规则不变。精确命令、000000合成验证码、餐厅/最小seed、正常关闭重置及未接OAuth网页/可用模型的边界见infra/README.md。
- 仅infra/local-acceptance.ts、infra/README.md、infra/tests/local-acceptance.release.test.ts和本记录另批提交。真实PG本地入口最终2项通过（/private/tmp/fancy-local-rig-final.log）；此前整合release13通过，最终小补注销断言后仅重跑受影响2项，infra类型/lint通过。不会把夹具模拟MFA或空库指标当真实供应商/生产验收。

## QA-F15 明确授权的本人公开介绍上下文（2026-10-21）

- QA在04f219d服务端真实PG/受控provider复现：用户明确要求使用本人介绍写申请时，草稿调用仍没有本人公开昵称/bio/languages/interests。普通SEARCH无资料先验与私有canary均保留，F15原红由QA保存；原生/Web的F14已在ec379b0由独立QA关闭，当前正式122 PASS /82 NOT_RUN /1 FAIL（F15）/12 BLOCKED。
- 仅当前turn原用户文字的明确肯定请求触发本人ACTIVE四字段投影，支持保守中英表达；否定、引用、他人、模糊请求、编辑器文字或历史授权均不触发。资料仅RAM进入该次草稿调用，不进条件/偏好/历史或DB；不读取私有背景/邮箱，guest/无资料先澄清，SQL失败不编造。
- 在既有actor SHARE提交屏障内复核用户版本及同一四字段，生成中变化则SUPERSEDED无草稿发布。通用draft反编造校验不放宽：只将明确授权bio纳入原同句事实依据，姓名含职业不能授权编造职业，完成付款/订位等仍拒绝。原QA020与hostile矩阵20项由负责人复跑绿，前红/私有字段/下一普通轮不继承等断言保留。
- 根完整核心unit281/DB119/API156/release13通过（/private/tmp/fancy-f15-core.log）；仅controller/context与两个自有测试及本记录提交，QA/研究文件不混入。正式F15关闭仍需QA固定SHA独立复验，不代表真实模型或部署验收。
- 根显式临时配置复跑QA完整hostile矩阵20项、全仓core:check及Python70通过（/private/tmp/fancy-f15-qa-hostile.log、fancy-f15-check.log、fancy-f15-python.log）。客户端无修改，沿用F14已通过结果，不重复声称本批重跑客户端层。

## QA-F16 创建Review阅读条款后恢复原步骤（2026-10-21）

- 独立QA固定8387580真实浏览器走四步Review→cancellation terms→Back to review回到Arrange，venueRef仍在但供应商展示被持久草稿规则剥离，不能称业务数据丢失。QA另有同路径组件原红；资料保存疑点经重选London life后成功，未稳定复现，不作生产修复。
- /create与/create/terms使用同一创建流程owner，条款往返保持原内存步骤、未发布文字和供应商展示；不将供应商资料放history.state、全局缓存或持久存储。直接公开访问条款仍不初始化私有草稿或CREATE编辑器/启动埋点。发布校验和显式确认不变，不自动同意或发布。
- 自有真实路由回归与QA原探针共18项，涵盖Back to review/页头Back、Review确认false/true原样、0createMeal、持久草稿只存地点ID且展示字段null；根Web/后台262、core:check及Web生产构建通过（/private/tmp/fancy-f16-{clients,check,build}.log）。仅CreatePage、app/routes、自有create测试与本记录切片，F17导航来源另批；需QA释放Git窗口后提交固定SHA独立复验。
- QA在bda0547提交B3真实浏览器F16/F17原红与结构化观察后释放Git窗口；F15在492db55独立20+32项复验targeted关闭，资料门槛完整用例通过。当前124 PASS /79 NOT_RUN /2 FAIL（F16/F17）/12 BLOCKED。Python71通过（含QA新增浏览器证据校验测试），F17自有路由下一切片两红不混入F16提交或其262项整合快照。

## QA-F17 发布/保存与公开资料的返回来源（2026-10-21）

- QA固定8387580真实浏览器发布后详情Back指向Discover，从饭局进入Host公开资料后Back也指向Discover；PRD要求发布/保存详情父级为Meals/Hosting，参与者公开资料返回原饭局。原B3红及截图保留在bda0547，未借本修复改顶层本人Profile返回规则。
- 创建发布、编辑保存及无改动确认返回详情时，携带精确Hosting来源；详情只接受该精确来源，其他来源保持原Discover默认。Host头像/姓名进入公开资料仅传原meal路径及已验证父级；资料页只接受严格UUID饭局路径，Back还原原详情及其Hosting来源。外部地址/任意路径/尾缀参数等拒绝，PageHeader仅加可选透传state属性，不造通用导航框架、不存供应商信息。
- 自有12路由测试修前5红/7来源白名单fallback绿，修后12绿；相关create/meals/profile五文件43项通过（含QA条款原探针不改），类型/lint/build通过。仅六个生产/自有测试文件及本记录另批提交；F16已aa52dc8独立提交同步，F16/F17正式关闭仍由QA固定SHA复验决定。
- 根Web/后台274项、core:check、Web生产构建及Python71通过，日志/private/tmp/fancy-f17-{clients,check,build,python}.log。后端与原生无改动，沿用最近已验证结果，不声称本切片重跑无关层。QA独占文件及研究修改均保留。

## 本地固定时钟生命周期验收入口（2026-10-21）

- QA B6已在真实时钟浏览器完成申请/批准与首guest锁安排，但未来饭局无法立即验收截止/开始/结束/出席。既有rig无时钟钩子，不能单独改DB时刻或改业务日期冒完整旅程；另起空合成库重新走同一场全过程，保留旧B6现场证据。
- 入口显式要求本地模式+clock开关及本次新建loopback fancy_test_*空库，拒外部DB、production/staging和过去起点。只在该临时库安装时钟函数并重绑迁移已有timestamp DEFAULT，全部API/worker pool及本进程Node Date使用同一固定instant；原迁移/生产代码/主机时钟/业务日期/会话TTL不改，显式Date解析与真实timer/performance不改。
- stdin仅接受单调、有限范围的严格UTC JSON；阻新HTTP、排空在途、停止并等待worker后才推进DB/Node并处理一批due jobs，失败保持入口关闭并报告实际时刻要求重置。非法输入不推进。退出nested finally依次清理app、时钟pool、临时DB及PG，恢复进程Date；migration失败也尝试停止PG。
- 负责人真实PG/API定向7项通过，根全release18项通过（/private/tmp/fancy-clock-release.log）：四连接/默认值与Node一致、真实timer、drain、推进中途失败、正常会话到期、原40poll限流429后只推进60秒恢复且保留旧桶；生产worker/HTTP同一meal ID走close/start/end的-1ms/exact边界、roster2、双方SELF出席、互选OPEN，最终业务日期原样。
- 浏览器仍真实钟，此入口只验server主导meal/postmeal/session路径；客户端倒计时/日期校验与独立AI sweep TTL不纳入通过。推进marker不等同所有后台job完成，必须观察目标物化状态；限流窗口冻结时需在安全余量内推进1秒/60秒，不禁用或清桶。命令与限制见infra/README.md，QA正式浏览器复验仍独立执行。
- 根core:check及Python71通过（/private/tmp/fancy-clock-check.log、fancy-clock-python.log），无生产/客户端修改，不声称本批重跑这些业务层。QA在91cdaf1完成真实钟Web取消席位/独立退群/重新申请批准/历史间隙不可见/解散后只读完整路径，当前132 PASS /73 NOT_RUN /12 BLOCKED，无当前FAIL，并明确释放Git窗口。新clock入口正式提交后另起固定SHA环境，不篡改旧B6现场。

## QA-F18 私聊对方公开昵称（2026-10-21）

- 独立QA固定4a0c66f的B7真实浏览器旅程完成互选和一次显式私聊发送后，刷新页头仍为Conversation，不能识别对方；该缺陷是展示问题，不将已通过的单向禁止私聊/互选鉴权描述为失败。QA保留原截图与双向API原红，生产不改QA结论。
- 既有conversation查询仅在当前actor属于pair时投影另一ACTIVE用户的公开displayName为title，删除/删除中使用Deleted member安全名称，不读取邮箱。详情与Inbox统一，GROUP继续meal标题；会员区间、互选和历史读取规则不改，不扩DTO、不改客户端。
- 自有真实PG四项修前两红、修后全绿，关联19项通过；根完整API160项通过（/private/tmp/fancy-f18-api.log）。覆盖双方分别看到对方、发送后重取、匿名/外人禁止、删除申请后profile尚存即隐藏及GROUP不变。独立原探针另用临时配置显式运行，不改变仓库收集配置。
- 保留B7固定时钟现场，未重启API或重写同场业务时间；新代码与旧运行环境不混称浏览器修复通过。正式关闭需QA对提交SHA独立复验；提交等待QA释放索引窗口，研究修改及QA文件不混入。
- 根独立原探针2项、core:check及Python71通过，日志/private/tmp/fancy-f18-{probe,check,python}.log；客户端无修改，沿用最近已验证客户端层，不声称本批重跑Web/原生或真实供应商。

## 原生模拟器与本地API地址接线（2026-10-21）

- 独测及原生负责人提升只读simctl已确认iOS27.0/27.1和iPhone18 Pro可用，普通沙箱连接错误不代表缺runtime。临时副本prebuild成功，实际Xcode构建退出65因缺Pods，尚无App运行/跨端角色互换证据；不以Jest替代，不改真实设备/供应商门槛。
- README已有EXPO_PUBLIC_API_BASE_URL，但原app.config.js未接到Constants.extra.apiBaseUrl；仅将该显式环境值接入extra，未设或空值保持原3000与其他extra/plugins。新增配置回归修前一红、修后两绿，根原生244项通过（/private/tmp/fancy-ios-api-config-tests.log）。不改config.ts或生产身份/网络授权。
- 负责人在/private/tmp隔离CocoaPods/生成工程，独立合成API61973、新临时PG，不重启B7 API61971/PG/Admin5174。系统Ruby2.6首轮原生扩展缺SDK config.h，继续隔离依赖方案；构建产物和工具依赖不进仓库。实际启动与QA跨端验收仍待完成。
- 本切片根core:check及Python71通过（/private/tmp/fancy-ios-api-config-{check,python}.log）；仅app.config.js、config.test.ts与本记录提交，邮件F19另批，QA及研究文件保留。配置生效需后续构建/启动验证，不冒称模拟器验收通过。
