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

## QA-F19 邮件死信告警接线（2026-10-21）

- QA固定cc489ef真实临时PG/受控MailProvider原R98两绿一红：8次耗尽转DEAD正确但无告警；原红由68374a9保留。未找到独立SQL监控入口，不将已有job_dead误称邮件覆盖。
- mailDelivery仅成功转DEAD的UPDATE RETURNING赢家调用onDead，默认及worker显式接同一安全sink，输出mail_dead/outboxId/内部errorCode/attempts/lookupAttempts，不序列化邮箱、recipient、template、正文、refs或供应商异常。后续tick/并发tick不重复，异步observer失败用同安全元数据回退，不撤回已提交DEAD或重发。
- 8次发送/8次查询/满24小时、非法payload和不可用收件人均覆盖；provider未配置时仍观察历史耗尽但不dispatch新邮件。有效UNKNOWN lookup lease不因第8次已领取被另tick提前转DEAD，未知结果仍只查询，权威NOT_SENT才允许同ID重试。
- 自有修前5红，修后邮件10项及根完整DB126项通过（/private/tmp/fancy-f19-db.log）；根显式复跑QA原probe3项通过（/private/tmp/fancy-f19-probe.log），未改QA文件/测试收集配置。仅delivery、main、自有dead-letter测试与本记录切片；正式关闭仍交QA固定SHA独立复验，不代表真实邮件供应商告警平台已配置。
- 最终冻结根core:check、release18及Python71通过（/private/tmp/fancy-f19-{check,release,python}.log）；客户端与API业务未改，沿用最近已验证结果，不冒称本切片重跑。原生配置6b308ce另批已推送，模拟器实际构建仍由原生负责人继续。QA文件及研究修改保留。

## 原生实际构建与TypeBox首开崩溃（2026-10-21）

- 负责人已在/private/tmp隔离编译现代Ruby3.4.11、CocoaPods1.16.2并完成Pods安装；ASCII副本消除中文路径编码错误，仅OpenSSL库目录避免DYLD误引curl证书路径，未关闭TLS或猴补SDK。Debug与Release真实Xcode构建成功，simctl实际安装启动；Simulator图形壳不可用仍限制交互旅程，不再以runtime/Pods缺失作为旧阻塞。
- 未修复Release首开真实崩溃：TypeBox ESM导出的Object变量被提升，Metro CommonJS shim调用Object.defineProperty时得到undefined。仅Metro对@sinclair/typebox及其子路径选择官方CJS require条件，其他模块原context透传；不改共享schema、SDK或业务逻辑。自有resolver回归覆盖根/子路径与相似包名不误匹配。
- 临时相同修复重新Release成功，Discover首屏持续显示，独立合成API61973收到App GET /v1/meals 200。根直接检查/private/tmp/fancy-ios-typebox-screen.png确认实际画面，同时统计授权标题与状态栏重叠另交QA核证，不混入模块解析修复。API/PG独立，QA B7现场不动。
- 上述实际运行来自临时副本，正式提交SHA需独立复验，不作为完整Web/iOS角色互换通过；根原生251项通过（/private/tmp/fancy-ios-metro-tests.log），其余最终验证及QA原红登记后提交。临时入口/private/tmp/fancy-ios-native-entry.txt，构建/private/tmp/fancy-ios-native-release-typebox.log，原崩溃/private/tmp/fancy-ios-runtime.log。
- 正式Metro两文件冻结后根core:check及Python71通过（/private/tmp/fancy-ios-metro-{check,python}.log）；负责人已逐字同步当前源码到ASCII临时副本重建，安装/启动结果另交QA。QA在87434e3保留F20原崩溃与F21安全区独立缺陷，释放提交窗口；原红准确源码基线仍待负责人确认，不推测。组件测试/首屏截图均不替代原生交互旅程。

## QA-F21 原生顶层提示安全区（2026-10-21）

- QA原图确认统计授权标题与系统时钟重叠，独立F21不与TypeBox首开F20混合。仅AppRoot将SessionBanner与AnalyticsConsent一起置于一个SafeAreaView top/left/right，避免各自重复顶边距；导航children和助手仍原布局，不改授权存储/允许拒绝语义。
- 自有修前3红，修后定向8绿、负责人全iOS254绿。测试使用真实safe-area库及非零initialMetrics，并验证初始/折叠偏好/离线提示共用容器，导航/助手不被包入；实际Release布局截图为主要视觉证据，不仅断言props。
- 精确9df9ab0归档加唯一AppRoot生产差异实际Release成功，PID41469持续，API61973 GET /v1/meals 200且runtime无fatal。根直接查看/private/tmp/fancy-f21-native-screen.png确认19:21状态栏与标题分离；构建/runtime为/private/tmp/fancy-f21-native-{build,runtime}.log，不称完整交互旅程通过。repo与ASCII副本AppRoot哈希一致，正式SHA仍交QA复验。
- F20另已精确87434e3无Metro归档重建并launch复现defineProperty/RCTFatal（/private/tmp/fancy-f20-87434e3-red-runtime.log）；精确9df9ab0归档无F21重建运行持续Discover（/private/tmp/fancy-f20-9df9ab0-native-screen.png及同前缀build/runtime）。不再依赖首次未记SHA旧红，正式关闭结论仍由QA持有。
- 根最终iOS254、core:check及Python74通过（/private/tmp/fancy-f21-{ios,check,python}.log）。后端/Web未改，沿用最近已验证层；仅AppRoot、自有safe-area测试及本记录提交，等待QA B11窗口释放。实际修复关闭由QA按正式SHA独立决定。

## QA-F22 明确Spanish语言条件（2026-10-21）

- QA固定b332b705原R117矩阵14绿/2红中，先Spanish追问后明确language Spanish仍NEEDS_INPUT。仅query正则支持language Spanish/冒号/空白及词边界，原Spanish language/speak Spanish/中文保持；单独Spanish继续澄清，菜系与语言来源证据不放宽。
- 自有新增前三例修前红，修后query17绿，原QA-AI007真实PG绿。根完整unit292通过（/private/tmp/fancy-f22-unit-listener.log）；普通沙箱CLI本地OAuth监听4红保留在fancy-f22-unit.log，允许loopback后原样全绿，不改测试掩盖环境。
- query与controller F23由不同唯一owner分别冻结，根整合DB/API/原独测matrix及全仓检查后各自切片提交，不混QA或研究文件。正式关闭仍交QA固定SHA决定。
- 根冻结整合DB127/API160及当前独测矩阵17项通过（/private/tmp/fancy-f22-f23-{db,api,original-matrix}.log），core:check通过。该矩阵在QA原R117后新增一项，严格记录本次17，不覆盖原红。Python77在QA并行更新证据时两项一致性失败（probe变更/报告尚未同步），原日志fancy-f22-f23-python.log保留，待QA批冻结后原样复跑，开发不替QA改证据。
- QA在ef40e7c冻结原红及支持/指标/创建证据后释放窗口；根原样复跑Python77全绿（/private/tmp/fancy-f22-f23-python-frozen.log），原并行快照失败记录保留。本次仅F22两文件与记录先提交，F23另切片，独测正式状态160 PASS /43 NOT_RUN /2 FAIL /12 BLOCKED，开发不抢先关闭。

## QA-F23 缺当前饭局目标的中文澄清（2026-10-21）

- QA原R117先明确解释饭局M，下一中文请求未附当前mealId时没有复用M，但错误固定英文回复。仅EXPLAIN无当前ids分支将本轮input交澄清helper，含中文使用中文提示；英文保持原回复，不从历史/editor/偏好猜语言，不扩其他reply本地化。
- 自有明确M→中文无目标→英文无目标修前中文红、修后controller真实PG14绿；三轮只有各自原解析provider一次，缺目标cards空且不含旧标题、业务行不增。源码两文件冻结后与F22整合根DB127/API160/独测当前矩阵17、unit292、core:check及冻结Python77均通过，日志见本轮F22记录；无需为仅分commit重复相同冻结层。
- F22先e355584独立推送核SHA，本切片仅controller与自有DB测试及本记录，不混QA/研究。正式关闭交QA最终SHA独立复验，不声称真实模型或完整原生交互通过。

## QA-F24 版本化区域映射与快照边界（2026-10-21）

- QA确认Places确认仅持久化unknown，缺数据契约§areaCode本地算法；真实GeoJSON来源许可仍外部门槛，不能替代本地实现。新增可注入Polygon/MultiPolygon、version与单调revision，纯合成几何覆盖共享边/孔边包含、孔内部排除、重叠按code排序首项、无匹配unknown；校验有限2D坐标、闭环、拓扑及code长度，不接受未切割跨反经线配置。
- provider已验证坐标只在prepare RAM映射，外部查询仍在业务事务外；数据库仅app-owned code/version/revision。新增0023迁移不改旧迁移，无dataset默认unknown/null/0；真实fixture数据只允许dev/test。CAS基线+单调revision防旧在途/旧部署覆盖，拒同revision不同mapping，默认0不抹新版。
- 同venueRef编辑保留meal原区域快照，实际换venue才用新区域，避免仅改文案暗改统计维度。十三生产/自有测试文件由backend唯一负责，web只读交叉审无新P1/P2，提出code64长度问题已修正；真实London覆盖不作通过声明。
- 自有15unit、26关联API与10迁移DB通过；根冻结整合全core unit298/DB130/API163/release18通过（/private/tmp/fancy-f24-f26-core.log），core:check通过（/private/tmp/fancy-f24-f26-check.log）。F25/F26分别冻结另批提交；F27新发现页切片尚未加入上述冻结整合，不混称其通过。
- QA在bf5031a保留F24–F27原红并释放Git窗口，根冻结Python77通过（/private/tmp/fancy-f24-f26-python.log），独测正式172 PASS /29 NOT_RUN /4 FAIL /12 BLOCKED；开发不抢先关闭。F24只十三文件+本记录提交，其他生产切片和研究/QA修改不混入。

## QA-F25 默认AI搜索显示实际日期窗口（2026-10-21）

- 原R131默认搜索仅显示next 7 days，不提供实际伦敦起止。仅SEARCH默认分支从一个MATERIALIZED DB clock快照得到七个YYYY-MM-DD，初查与提交复验共用同一数组，成功与无结果均显示含首尾的实际窗口；不写hardconditions，不改变自然周/显式日期和即时资格判断。
- 自有新增三项修前三红、修后controller PG17绿，含真实DB从午夜前推进两秒后初查/finish日期仍一致；根原QA搜索矩阵22绿（/private/tmp/fancy-f25-original-matrix.log）。全core/check/Python77为F24–F26冻结整合结果，见本批记录，不将分commit误当代码变动重跑。
- F24先8c3a947独立同步，本切片仅controller、自有DB测试与本记录；正式缺陷关闭交QA固定SHA复验，不含F27后续分页改动。

## QA-F26 原生清理异常日志最小化（2026-10-21）

- QA动态render真实RootLayout并调用createServices捕获的onClearError，R139证明原console.warn记录原Error中的合成私密标记；R138未await render为QA夹具错误，原记录保留。本切片仅删除原error参数并输出固定LOCAL_SIGN_OUT_CLEANUP_FAILED，不序列化message/stack/cause或原始对象。
- 根原QA动态探针1绿、全原生255绿（/private/tmp/fancy-f26-{original,ios}.log），全core/check/Python77已在本批冻结整合通过。QA拥有动态测试文件，生产仅_layout.tsx一行及本记录另commit，不混QA文件，正式关闭由QA固定SHA复验。

## QA-F27 发现页候选扫描上限（2026-10-21）

- QA原R141在500条截止未成团物理OPEN候选后放第501 eligible，旧公开读越过扫描上限直接返回501。仅发现路由使用物理keyset LIMIT500，满页/500后以最后实际扫描位置签名续页；不peek501，不跳过尚未返回候选，满500即使恰好末尾也保守返回一次续页。
- 页面与完整eligible统计分开：统计独立批次500遍历、同DB readNow与请求RAM provider缓存，复用原投影/资格/筛选，不拿截断页当全体数量；仍不写business_events或meal物理状态。不扩myMeals/供应商架构。
- 自有原红首批应空却返回501；修后新3+原meals9/analytics1共13API绿，根原独测probe1绿（/private/tmp/fancy-f27-original.log）。覆盖同毫秒微秒游标、满页不跳行、exact500空终页、筛选篡改、统计完整501；根首轮API165绿/1失败来自新增微秒夹具未同步scheduled_end违反meals_check2，原日志fancy-f27-api.log保留，修正合法fixture并冻结后完整重跑，不改生产约束。
- 最终冻结根API166、core:check、scope lint及Python77通过（/private/tmp/fancy-f27-{api-frozen,check,python}.log），原probe1绿。QA明确释放Git窗口，仅routes、新自有测试与本记录提交；F24–26独立复验仍由QA决定，不提前改结论。其他核心层及客户端未改，沿用最近已验证结果，不重复声称本批重跑。

## QA-F28 CSV测试数据来源标识（2026-10-21）

- QA原R152确认snapshot/asOf/filterHash/定义版和隐私字段正确，但fixture CSV无合成标志。仅CSV增加服务端白名单dataSource/environment；任何已验证test/fixture/outbox_test/mock适配器标synthetic_fixture，真实production为production，其余non_production，不把staging真实数据谎称合成，disabled AI不误判。
- 不接受客户端source，不导出adapter名称/Key/原配置，不改导出隐私与快照绑定。来源标识说明当前服务端环境，未声称新增逐行历史数据血缘系统。自有真实PG修前一红/三绿，修后5unit/4API及原ADMIN004探针绿；根整合验证后仅exports模块三文件与本记录提交，QA及研究文件保留。
- 原生官方headless XCUITest已实际exit0：隔离设备Decline→Discover→Profile→登录→邮箱输入精确回显，入口/private/tmp/fancy-xcui-probe/ENTRY.md，binary来自冻结5b且hash匹配，不冒新SHA完整旅程。新跨端19d受控时钟API61973/origin localhost5177已交QA，旧5b证据保留；正式匹配19d binary另用独立DerivedData构建中，不覆盖QA设备状态。
- 根unit301/API166/原QA metrics矩阵13及core:check全部通过（/private/tmp/fancy-f28-{unit,api,original,check}.log）。全Python77有两项QA快照一致性失败（probe已改/报告R142等仍更新中），原日志fancy-f28-python.log保留；自有文档结构/引用验证单独通过fancy-f28-documentation.log，不改QA证据或声称全77通过。QA明确让root先提交此生产切片、其批收束后自行再验证。

## QA-F29 AI会话活动锁升级（2026-10-21）

- QA R154使用真实不同PG backend，仅spy暂停已执行原validate的连接，复现同session两activity从meta SHARE升级UPDATE导致40P01；不是mock SQL。原红保留QA文件。本切片仅sessions.ts及自有session-lock-upgrade.db.test.ts，由原AI owner唯一负责。
- activity/reset在activeSubject→preferenceEpoch后直接取meta UPDATE再privacy SHARE/RAM校验；纯read和finish默认meta SHARE，不更改用户/偏好/隐私屏障。避免先共享后升级，不靠允许死锁或吞错误兜底。
- 自有真实双连接：第一完成实际validate后持锁，第二在pg_stat_activity观察到meta FOR UPDATE等待，释放第一后两成功；activity/activity、activity/reset及双read共享并发3项与原privacy-review4项共7绿。旧QA spy若丢新增参数/强制两排他validate同时到达，须由QA调整调度观测位置并保原红，不能为迎合探针放松生产锁。
- 根完整DB/API与core:check整合验证中，代码冻结后分别记录结果；不将新的统一写锁泛化为所有AI并发均无死锁。完整只读写入口审阅已另交QA临时清单，静态候选/真实证据与外部门槛明确区分。
- 根最终DB133/API166、core:check及本轮文档结构3项通过（/private/tmp/fancy-f29-{db,api,check,documentation}.log）。QA证据仍并行更新，未重跑或冒称全77一致性绿；该批冻结后由QA补其完整验证。root沿用QA明确保留的提交窗口，仅两生产/自有测试文件与本记录提交，不混QA/research，正式SHA交QA独立复验。

## QA-F30 删除屏障之后拒绝身份绑定（2026-10-21）

- QA R158真实双HTTP队列：holder users FOR NO KEY UPDATE允许限流FK，DELETE先等用户UPDATE、LINK后等，放行后DELETE202且DELETING，旧LINK仍200并新增身份。R155/157强锁阻preflight为夹具错误，原红分别保留，不混作产品复现。
- 仅identity/routes.ts与自有link-authorization.api.test.ts：票据无锁hint只确定锁集合，先排序user UPDATE并检查actor/shell ACTIVE，再锁票据权威重读绑定/目标/有效性与identity映射，消除与purge user→ticket相反锁序。锁后重验原session/family撤销、expiry/idle/kind/owner、原family proof及严格敏感认证期限；不改handoff/公共认证框架。
- 自有回归捕获JS毫秒截断会放过同毫秒刚过期会话；仅本handler关闭锁阶段后读取完整DB clock text，票据/会话SQL期限使用同精确instant，认证年龄来自同instant。不靠sleep，真实PG固定时钟-1µs拒/+1µs允许确定性覆盖。
- 修前真实删除先赢link200；修后新8+原identity26/native1共35API及原R158探针1绿。包括family撤销、票据/会话过期、双intent只消费一次、inactive shell不得迁移；最终两文件冻结，root整合API/check/Python后提交，正式关闭仍交QA固定SHA独立复验。
- 根冻结完整API174及原QA队列probe1、core:check、自有文档结构3项通过（/private/tmp/fancy-f30-{api,original,check,documentation}.log）。全Python77两项QA证据WIP一致性失败（probe changed/报告R160等未同步）保留fancy-f30-python.log，不改QA证据或声称全绿；QA批收束后补其完整验证。QA55a7f5明确释放root窗口，本轮仅两生产/自有测试文件与本记录提交，研究与QA修改保留。

## QA-F31 OAuth取消后保留允许的回流目标（2026-10-21）

- QA R166 Google/Apple取消后原Try again硬编码Discover，丢已allowlist饭局申请路径；没有自动申请。仅OAuthCallbackPage在现started guard中一次消费并保存已验证目标，错误重试复用该RAM ref，默认/恶意外部目标仍Discover，不扩大持久存储或授权。
- 自有取消→重试→正常登录返回申请页而0applyMeal、两provider及外部目标fallback回归修前两红/修后与原auth共25绿；根Web/admin282、Web生产构建及core:check绿（/private/tmp/fancy-f31-{clients,build,check}.log）。QA拥有探针findByRole不支持exact的类型问题由QA改锚定精确名称解决，不放宽目标或由生产改测试。
- 根修正后原QA+自有定向复跑及自有文档结构验证另记fancy-f31-{original,documentation}.log。全Python77仍1项QA probe更新后hash未冻结一致性失败，原fancy-f31-python.log保留，开发不改QA证据或冒全绿。正式SHA交QA真实隔离合成OAuth portal浏览器取消/重试复验，不关闭真实Google/Apple门槛。

## QA-F32 OTP跨邮箱共享IP配额（2026-10-21）

- QA R168真实不同PG backend在实际count之后暂停，两邮箱同IP都读4而各201，突破5/15min；R167代理connect callback透传错误是QA setup，原记录分别保留。仅startOtp新增opaque email/IP两命名advisory事务锁，字符串统一排序，LOGIN/REAUTH同序，取齐后去重/DBnow/count/insert；不记明文邮箱/IP到锁键或日志。
- Provider发送继续提交后，异常耗次与原cookie/native/purpose规则不改。新4真实PG回归覆盖holder观察两quota等待→[201,429]/总5/send1、跨IP同email同请求去重、不同IP独立、provider挂起时两quota锁都已可独立取得；与identity/native/F30共39API绿。不能以修后不可能双count到达的旧barrier强迫死锁或允许6次，QA需保原红并按实际配额等待调度复验。
- 原R168重跑先红，最终两文件冻结；root完整API/check/Python验证后单独提交。命名锁更改不声称旧新程序混跑期间绝对配额，发布时应统一协议版本。
- F31真实浏览器HTTP合成授权页被生产HTTPS保护正确拒绝，先前HTTPsmoke不等同完整浏览器取消通过。只读未见现有可信本机TLS/tunnel，未读key/安装trust/外网暴露；保API/组件证据，浏览器段待执行，不放宽HTTPS检查。
- 根冻结API178及core:check、自有文档结构3项通过（/private/tmp/fancy-f32-{api,check,documentation}.log）。全Python77两项QA证据并行更新一致性失败（probe hash/报告184与187状态快照未同步），原fancy-f32-python.log保留；不改QA证据或冒全绿。root持串行窗口，仅OTP两文件与本记录提交，独测需用实际锁等待调度在正式SHA复验并保R168原红。

## QA-F33 发现页详情返回上下文（2026-10-21）

- QA B15/R171真实/Discover languages=en→详情Back丢筛选，默认硬Discover。仅Discover/Card/Detail/Profile及小型returnContext白名单helper+自有测试六文件：内部/discover规范filters/view/area/selected UUID，Hosting精确来源优先/默认不变，未知参数剥离/外部路径与hash拒绝，不存供应商展示数据。
- 每张后续页card只记录app-owned来源签名cursor，返回同canonicalfilters取对应页且仍含selected才恢复；cursor无效/权限变或已无该meal仅一次首屏回退，最多2请求，不单取getMeal造card绕筛选。离线/503保原错误，来源页nextCursor继续Showmore；应用新筛选清区域/选择/cursor。签名权威仍在API，不将客户端形状校验当授权。
- 原首批list/areas两红保留，修后自有14+原Discover9+F17来源12共35相关回归通过。根全Web/admin297、Web生产构建、core:check及Python77全部通过（/private/tmp/fancy-f33-{clients,build,check,python}.log）。后端/原生未改，沿用最近已验证层，不冒称本批重跑。
- QA b19bf59冻结原证据后明确释放root窗口，本切片六文件+本记录独立提交，不混研究；正式SHA交QA固定版本真实浏览器筛选/区域/卡片及后续页返回复验，开发不抢先关闭F33或完整旅程。

## QA-F34 生产Web紧凑时间菜单（2026-10-21）

- QA核主PRD337紧凑菜单已在ce74研发基线，非仅Demo豁免；生产原select缺交互。仅steps接线与专用TimePicker组件/CSS/自有测试四文件，仍48半小时计划时间、不校验供应商库存；160px触发/菜单、箭头内缩16、最高224内部滚动，portal约束手机边界，已选/空00聚焦、方向/Home/End/Enter、Escape/外部关闭及焦点恢复，无新增包或通用框架。
- 自有3+原Create17相关20项通过，真实隔离Chrome61981生产组件/CSS测得160宽/224高、选中19:30自动focus与内部scroll、键盘00:30/归焦、Esc/Outside及320/144视口无溢出。该证据仅组件真实浏览器，不冒完整Create旅程通过；正式交QA独立集成复验。
- F34–36最终冻结整合Web/admin306、iOS256、Web生产构建及core:check通过（/private/tmp/fancy-f34-f35-{clients,build}-final.log、fancy-f36-ios.log、fancy-f34-f36-check-final.log）。自有文档结构3项绿；全Python77两项QA probe/reportR176等WIP一致性失败原fancy-f34-f36-python.log保留，不改QA证据或冒全绿。三切片分别提交，root持串行窗口，仅各白名单与记录，不混研究。

## QA-F35 确认换餐厅后清旧时间（2026-10-21）

- QA B11真实North18:30→South仅预览仍North18:30正确，确认UseSouth后旧Time未清。仅CreatePage中央update及独立venue-change测试：已选地点身份确变才清time/startOffset/closeOffset、预约声明与Review；同placeId显示更新/ref刷新保持有效时间确认，初选不误清，预览/取消不触父草稿，日期/标题/人数/费用可复用字段保持。
- 自有修前两红/两绿，修后4+原Create17共21绿；QA真实父组件原反例另有工作树绿，正式关闭仍按提交SHA复验。F34先b9a7f9e独立推送，本切片仅CreatePage/新自有测试+记录；最终整合306/256/build/check及文档范围见本批F34，不因分commit重复声称重跑。

## QA-F36 原生内部页面避让导航头（2026-10-21）

- QA Apply13真实标题Y127与native导航头116–170重叠，独立于首屏F21；5b/19d Screen/Apply字节相同。仅Screen的ScrollView显式contentInsetAdjustmentBehavior automatic，让UIKit按真实header调整，不硬编码高度/重复safearea，不改AppRoot/键盘/OS设置。
- 新自有回归修前undefined红、修后绿，根全iOS256/type/整目录lint通过；保interactive dismissal/handled taps/KAV原配置。此测试证明配置，不单独证明几何视觉；正式SHA独立正常签名Release构建后交QA实际标题/滚动/提交复验，现键盘问题不另凭自动化手势失败认定根因。
- F35先386e600同步，本切片仅Screen+自有inset测试与记录；三切片最终整合结果见F34记录。正常Xcode签名19d已实际恢复到Apply表单，新的正式SHA构建仍需保留自动Simulated.xcent与Mach-O entitlement，旧5b/19d及诊断产物不覆盖、QA设备状态不抢。


## QA-F37 原生聊天自定义头避让导航栏（2026-10-21）

- QA Chat17实际导航栏Y116–170与群标题Y125.7、Leave group Y114–158重叠；ChatScreen独立根不使用Screen，故F36不覆盖此处。仅认证聊天根通过已安装Expo公开useHeaderHeight取得真实高度，iOS paddingTop避让；保bottom safearea、keyboard offset88及消息/权限/历史行为。
- 新3动态高度0/64/96回归修前undefined红、修后绿；既有chat与analytics自有测试只补导航context mock。全量原生与core:check结果在冻结后记录；组件配置证明不代替真实几何与消息验收。原Chat17精确Message selector失败与真实顶部遮挡分别处理，不把选择器失败冒认消息产品缺陷。
- 原生83df实际Apply15已由QA完成保留身份恢复、标题避让、编辑返回保稿及显式提交到pending；这不意味着未执行的直接键盘提交路径或F37已关闭。QA继续主acfe饭局Web主持/Native加入申请审批与双端消息，未移交staff克隆，61973/时钟/设备由QA独占。dc09848政策草稿及其CI成功不等于政策获批。
- 冻结四文件根核对：全iOS38套/259项、core:check、自有文档结构3项及diff检查全部通过（/private/tmp/fancy-f37-ios-tests.log、fancy-f37-check.log、fancy-f37-documentation.log）；未修改后端/Web，沿用其上批验证，不冒称全层重跑。root持串行Git窗口，仅四原生文件与本记录提交推送，正式SHA后独立正常签名构建交QA，不安装或抢其设备。

- F37正式611a90e正常签名Release构建完成，独立191源与归档逐字一致且构建后无漂移；/private/tmp/fancy-native-f37-611a90e/ENTRY-F37.md仅指当前f37证据，build/deepstrict0。binary f6e897805f0a2f5f663bcde1efb14e719f09504c8cd99c2cf6b0f2d4e33c114a，Hermes3ab9145c1829c05c59eac6c47e64f13d9f69ee7a974a03f5d7c641d7a8046c2e。已交QA自行选安全安装时机，root未操作设备/时钟。

## QA-F38 Web聊天读取失败不得伪装空记录（2026-10-21）

- QA R187受控429实际ChatPage显示SAY HELLO且无可见读错误；跨端主饭局PG已有原生消息，冻结clock累积限流是夹具条件，读取错误伪空才是通用产品缺陷。QA推进新窗口后实际Web读到原生消息并显式回复，PG两条各一sender，不将先前selector/429误称消息丢失。
- 仅ChatPage和自有read-error.unit.test：独立readError/首次Loading，首次成功读取后才允许真empty；LIVE错误保原自动退避、旧消息/输入草稿、不自动重发，成功仅清读错误不吞发送错误；403进入HISTORY仍终态，失败可见且显式HISTORY-only单飞重试，不重启LIVE。
- 自有3修前红→绿、原QA probe1与完整inbox21通过；根全Web/admin311通过但QA-owned OTP重发1失败（找不到Resend code），保/private/tmp/fancy-f38-clients-final.log并交QA核计时，不改QA脚本或声称全量绿。Web生产构建与core:check通过。QA仍持第四批Git窗口，生产本切片尚待其释放后提交与独立正式SHA复验。
- QA已定位OTP探针base取早于异步响应启动countdown，满载提前检查；仅受控Date.now从render前固定，同一spy推进，原30秒/过期/保邮箱断言不放宽。独立全Web/admin R188当前冻结工作树312通过/0失败，root只读JSON核success=true；前次311/1保历史。此增量仍待正式SHA，不提前关闭F38。
- QA随后正式611a Chat19实际iOS27.0保留账号冷启动1PASS，191源/binary/Hermes核对；title.y189.667与Leave.y178均在nav.bottom170以下，截图直接视觉无重叠，冷载读回两条持久消息，原83df重叠图保留。F37由QA定向关闭，不扩为整个原生旅程或生产发布通过。


## QA-F39 收件箱群聊不得误报席位确认（2026-10-21）

- QA正式Web3919465/API19d反向Native主持/Web加入饭局e0af2bf6-41e9-4d8b-ae79-310b7ab3d095，显式Cancel my place成功后application CANCELLED/seat LEFT，群membership leave_seq仍null；保留群聊是独立权限事实，旧Inbox硬编码Seat confirmed误称仍有席位。
- 仅InboxPage将LIVE GROUP改为中性Meal group，不从群权限猜申请状态，不改退席/群权限/API；自有seat-label组件投影回归修前1红，修后完整inbox5文件22项通过，Web类型、两文件lint、diff均绿（/private/tmp/fancy-f39-before.log、fancy-f39-after.log）。此为文案/组件证明，真实反向取消路径原证据由QA拥有，正式关闭待提交SHA独立复验。
- F38已由QA正式3919465独立R189七项通过并定向关闭；JOURNEY008完整异常路径仍NOT_RUN。F39不改后端/iOS，沿用其既有验证，不冒重跑；root保留QA/平台配置/research修改，Git窗口须明确交接后才提交。


## QA-F40 原生主持人解散群聊入口（2026-10-21）

- QA正式Native611a Host28主持反向饭局e0af2bf6-41e9-4d8b-ae79-310b7ab3d095批准第二轮后，聊天仅Leave group且原生没有dissolveGroup调用，缺PRD已要求的主持解散路径。后端既有主持授权/版本CAS/永久解散接口不改，不把host离群当解散。
- 最小ChatScreen+自有chat-dissolve测试：getMeal.meal.host.id与当前session比对才提供主持解散独立确认，未知/失败不猜权限；当前版本与独立intent key，成功cache/history/停止poll，未发文字可见保留且不重放。409关闭旧确认并权威重读inbox，失败阻旧版本/显式单飞Reload；成功更新后要求再点入口和确认，发现已解散立即只读。普通失败在确认Modal内显示，保草稿与重试意图；保现消息/键盘/底部safearea。
- 本轮不改API/群授权/申请；QA保持61973、clock与设备独占，待正式SHA正常签名独立归档构建，仅交包不安装。现自有业务回归与全原生验证进行中，冻结后记录实际结果，目标关闭仍由QA真实主持/全体只读复验。
- 冻结后全iOS39套/266项、类型、全apps/ios lint及两文件diff检查通过（/private/tmp/fancy-f40-{ios-tests,types,lint,check}.log）；自有7项覆盖guest/host lookup失败、取消/确认、409新版/刷新失败显式恢复/已解散、普通失败Modal与保稿。QA明确短借Git仅三文件，推送核SHA后归还；F39同时由QA正式R191两项及实际四群中性标签复验关闭，原红保留。
- 更正统一检查结果：core:check的类型/生成/lint通过，最后密钥扫描因本机新apps/web/.env.local中的供应商Key退出1；该文件git check-ignore确认排除，不读取/输出Key、不删除配置或放宽scanner。正式4945453完整git archive隔离副本再运行原扫描零发现通过，证明提交源码不含此本机配置；不将工作树整套core:check误称绿。上述原提交记录的误记在本次更正，实际日志保留。


## 外部资源就绪后恢复遗留接入（2026-10-21）

- 用户明确除Apple Developer仍待审核，当前外部依赖已完成，授权补齐遗留开发；不再把旧无账号作为停工理由。资源真源见平台配置交接，T03/A00恢复in_progress；不把账号/Key存在等同真实功能通过。首尔目前授权仍只读，实际安装部署另协调。
- 三负责人并行：root负责共享config/扫描保护/集成与Git；venues_backend独占Resend适配器与worker接线；web_takeover独占新infra真实联调入口及就近验证；ios_takeover完成F40后核AI生产bundle/计数与离线调用计划。QA的docs/qa/脚本/索引和当前61973/5177/device/clock保留，旧B7仅5174前端已由QA明确释放，切换须先核PID/cwd且不停61971/PG/tab4。
- 运行配置产生的新本地dotenv本应Git忽略，原扫描器将其计入公开源码检查。仅明确Git忽略且未跟踪的.env/.env.*配置可排除，模板与已跟踪配置/其它ignored源码仍扫描，Git查询不确定则继续扫描。新Git夹具验证忽略私有配置不读、force-track后照常捕获、其它ignored源码仍捕获；不删真实Key/不放宽模式/不回显值。
- 冻结本批根core:check、unit322、release23全部通过（/private/tmp/fancy-external-{check-final,unit-final,release-frozen}.log）。此前并行mail synthetic字面量触发扫描的红保留，测试fixture已按repo模式parts构造，非实际凭据。三切片将分别提交，不混QA/research。


## 真实邮件发送适配与配置接线

- 新ResendMailProvider仅固定官方HTTPS POST/有限超时/禁止redirect和SDK重试，outbox UUID作供应商幂等键、固定模板与白名单UUID深链，无用户正文/原始错误日志。发送接受需有效provider UUID；5xx/408/409/传输或畸形响应保UNKNOWN，不将超时/404当NOT_SENT；Sending-only Key不假设有读取权限，lookup当前严格UNKNOWN零网络。
- CoreConfig新增RESEND_API_KEY/RESEND_FROM配对验证，值不回显；Worker显式provider且完整配置才选真实适配，缺配/测试模式仍不可用。新增合成测试16 transport+3selection与config合计47绿，worker类型/lint绿，根整合322/23/check结果见上；未启动真实Worker/未发送邮件，不声称投递或UNKNOWN完整恢复已通过。
- 待后续薄切片：持久供应商回执/签名webhook恢复与退信状态、Auth0 Management最小权限撤销、删除通知隐私保留。不能因Sending Key已配置而编造按idempotency-key查询或扩授权；真实邮件接线与最终验收分别记录。


## 隔离真实身份与地图联调入口

- 新infra/real-integration.ts默认dry-run，显式real模式及QA释放5174双闸才启动；只白名单读取root私有配置，不输出值，强制Auth0/Google、禁AI与业务mail worker。创建自有临时PG17/新DB，拒绝继承QA既有DATABASE_URL，API随机loopback端口，Web5174同源代理精确Origin。
- Web子进程仅最小系统环境与APIorigin，浏览器公开Key仍由现web.env.local加载；不继承root服务端凭据。清理只自建API/Web/PG/DB。4项红绿+infra类型/lint与实际dry-run退出0，仅公开plan，无外呼/用户/OTP/业务邮件。根整合release23/check通过覆盖冻结文件。
- QA已明确旧B7仅Admin Vite PID71240/5174可释放；root只读ps/cwd核对应/private/tmp/fancy-qa-4a0c66f-yxsch6uh/apps/admin，不停61971/PG/tab4；当前61973/5177与设备时钟继续QA独占。真实启动与登录/地图/创建全链仍待随后执行，不将dry-run冒真实联调通过。


## DeepSeek生产接线与有界离线计划

- 补API main实际注入provider/price/counter：只有显式AI_BUNDLE_FILE私有绝对路径、DeepSeek模式/Key、固定模型版本/峰值人民币价格、实际公开artifact哈希/性质、MODEL/DATA/COST三份有效审批证据全部通过才构建，否则继续不可用；程序不自写审批、不自动初始化预算、不把Key当通过证明。
- 官方Flash1017同commit四公开文件哈希固定，byte-BPE无normalizer扩张且256单字节覆盖；共用实际发送payload与完整schema/system/user/JSON-mode模板做UTF8保守界，再要求COST单独证明托管端额外输入上界，缺证不默认0。不把公开模板证明泛化为API隐藏提示已验证；真实alias漂移/数据条款/质量评测仍须实证。
- pure dry-plan无Key/env/network：固定6条中英合成spike只列payload hash/上界费用，不发送；60样本最多120内部调用槽，每call16000输入/2000输出按峰值2/8元每百万tokens合计最高5.76元，纠正曾误按两次累计输入的3.84元估算。不是已花费或实际调用数；人民币50/月仍不变。
- 根冻结core:check、unit334、API178通过（/private/tmp/fancy-ai-f41-{check,unit,api}.log），相关66回归及assistant/API/testkit类型/lint绿；实际官方artifact加明确临时SYNTHETIC审批夹具正路径/错hash核查零network，夹具已删，不是真审批。未启用真实AI或关闭MODEL/DATA/COST门槛。资料来源：官方api-docs.deepseek.com pricing/ChatCompletions/token_usage与deepseek-ai官方HF固定commit，见代码PUBLIC_ARTIFACTS。


## QA-F41 原生收件箱返回时刷新失效缓存

- QA正式0db Native36/37/38实证：冷启见群，进聊天标已读导致inbox cache删除，返回已挂载Inbox显示Chats0/Applications0且无加载/错误，实际下拉立刻恢复列表；该手动恢复不是自动路径通过。根因query订阅数据失效不触发reload，F40解散仍定向通过不重开。
- 仅InboxScreen与自有inbox-refresh：恢复focus先session revalidate/世代校验再reload，首挂载不重复读；数据缺失显示Loading/不假0，离线/403可见错误并显式重试，读到403仍保原hook清缓存，无自动失败循环；分页后先assertGeneration再写conversation缓存，晚响应不跨账号回灌。不改通用query/cache/Chat或消息写入。
- 自有原2红→4绿（mounted invalidation/focus、403恢复、offline不读、expiry晚响应），全iOS40套270项/type/lint/diff绿（/private/tmp/fancy-f41-all-ios.log），根check与unit334/API178见同批AI记录；未改后台/Web，沿用未变层。正式SHA正常签名包交QA实际Back/Inbox复验，未用组件通过抢关F41。


## Auth0管理撤销适配与独立配置

- 独立Auth0 Management适配器只针对保留本地映射的精确issuer/subject，先撤该user全部Auth0 grants再删该远端user，不按Fancy UUID/email删，不复用BFF登录凭据或假定其有client_credentials。只请求delete:grants/delete:users，token仅RAM/singleflight/期限/严格scope，401清cache下轮取，拒绝/限流/超时/未知均NEEDS_SUPPORT，不伪造供应商幂等header。
- 新管理配置两键须配对且domain受限，值不回显；缺配保不可用。Apple独立Unavailable，缺APPLE行/空grant/404都不是从未Apple授权的证明；保本地identity到真正remote与policy完成，不标完整删除已通过。另新增可选RESEND_WEBHOOK_SECRET严格canonical有界Svix配置，未配置不启webhook，配置存在不当作真实回调通过。
- 自有Auth010unit+新2/原5真实PG回归17项及类型/lint通过；覆盖精确归属、token生命周期/权限、丢DELETE响应后重启幂等404恢复/Apple仍Support。全批根core:check、unit360、DB135、API195、release23、Web/Adminbuild全部绿（/private/tmp/fancy-providers-f42-{check,core,webbuild,adminbuild}.log）。原生F42另280项绿，未重跑未改Web组件层，不冒全端真实验收。
- 只检查私有配置键是否存在：当前Management两键、Resend webhook secret、AI bundle与policy声明仍未保存，真实操作待对应配置/人工批准，账号已具备不等同这些新增最小权限设置已完成。没有读取/输出值，没有真实管理API删除或发信。


## Resend签名回执与UNKNOWN持久恢复

- 新0024迁移/Drizzle列一致：供应商消息一对一outbox映射、dispatch admission/HMAC指纹与仅有限事件ID/type/hash/times回执，不存raw/email/body。Worker当前claim/未过期lease才可登记发送尝试并外呼，失效/失败zero fetch；标记本身不是wire已发生证明，结合受验回执才认定供应商结果。
- 发信tag仅outbox_id UUID；独立封装raw-body parser只作用/v1/webhooks/resend，Svix原始bytes HMAC/timingSafeEqual/单一headers/±5分钟签名attempt时间、有限body与事件/UUID严格验证；缺配置不注册，不削弱普通API JSON/Origin/身份校验。svix-id同hash幂等、异hash/跨outbox providerID冲突拒；乱序delivered/bounced独立记录，仅email.sent升SENT。
- 回执与outbox状态同事务清claim/lease，先于send响应或UNKNOWN查询返回的旧writer无权覆写；24h/8次转DEAD后晚到的权威sent仍可纠正为SENT，保原死信原因/告警，delivered/bounced先到DEAD不复活发送。没有事件/404/lookup timeout仍不能NOT_SENT或自动重发UNKNOWN。
- Root main给持久请求指纹加sessionSecret HMAC而非可直接字典比对的email请求SHA；rotation下旧marker不匹配保持UNKNOWN/拒重发，不宣称匿名化或永久保留批准。另将独立Management适配实际注入deletion steps，Apple仍不可用；保显式policy版本+accountDeletionApproved声明gate，缺配不完成删除。
- 独立新增17API/30unit/20DB含callback早到/HTTP丢响应、lease排队过期、晚DEAD/乱序、schema parity通过；根最终core:check/unit360/DB135/API195/release23及Web/Adminbuild绿见同批日志。未给现QA或真实联调库apply迁移、未发真实邮件/配置外部webhook。真实收件、签名来源及bounce联调仍待部署/secret/明确测试发信授权，不冒集成闭环。


## QA-F42 原生主持人报告其他成员出席

- QA与静态PRD/API对照确认原生只有本人自报，缺主持人对其他start-roster成员的事实报告入口；Web已有。仅PostMealScreen与自有host-attendance回归：权威getMeal.host绑定meal/session，在windowOpen对eligible其他成员提供默认未选的present/absent与独立确认，明确SELF优先且不是评分；不改后端授权、体验评分或公开再约语义。
- 按attendance.version及独立意图写入，成功刷新而不丢体验/参考草稿；409关闭旧确认，保选择/只读重取，失败阻旧版本直至显式Reload再确认；普通失败Modal可见。初始postMeal/hostlookup仅signedIn并校验generation/scope，晚响应不回灌私有cache；不用修通用hook来扩大本片。
- 新10项红绿涵host/guest/unknown/window/SELF、409版本与刷新失败/关闭窗口、Modal失败、保其他草稿与lateexpiry；全iOS41套280项/type/全目录lint/diff绿（/private/tmp/fancy-f42-{ios-tests,types,lint}.log）。根最终corecheck/unit360/DB135/API195/release23/Web+Adminbuild绿见同批provider记录。正式SHA独立正常签名包再交QA实际饭后host/guest复验，不以组件冒实机通过。
- F41已由QA正式042bc Native43原始自动返回探针及R19513项通过定向关闭：实际安装binary/Hermes与193源核对，ColdInbox→读持久消息→Back/Inbox自动恢复5群，无manualpull；原红与下拉手动恢复证据保留。完整JOURNEY003仍不抢先结论。
- 用户随后批准删除受理/完成通知专用verified邮箱加密副本最长7天，到期/密钥不可用/供应商抑制降级匿名回执，不绕抑制/不营销；该具体通知规则不代替全部G-PRIVACY批准。已交独立owner准备最小scope继续实现。Google登录用户选择现在本人完成，未将未来操作当已登录。


## 删除通知专用加密配置准备

- 按用户批准的两类删除通知最长7天方案，新增独立DELETION_MAIL_KEY_VERSION/DELETION_MAIL_KEYS_JSON配置：默认null，不生成或复用session/provider密钥；版本与1至8把canonical base64 32字节AES密钥严格校验，错误不回显值。仅配置准备，不代表通知已实现、真实发信授权或完整隐私门槛批准。
- config33项、配置类型/lint、workspace release11项及diff验证通过；实际私有配置未修改。加密envelope、生产者/过期清理/发送目的校验仍由唯一owner实施，尚未闭环。QA已提交22e665f并明确释放Git窗口；F42正式cd69正常签名包已交QA实际验收，不将构建当功能通过。


## 删除通知加密保留与供应商抑制（本地验证）

- 按用户批准，两通知复用既有refs-only outbox、dispatch admission和签名receipt。0025新增目的隔离AES-256-GCM邮箱副本，仅实时USER受理捕获已验证邮箱；AAD绑定用户、请求、接受/截止与两固定模板，RESTORE不重捕获。受理事务入列，真实COMPLETED才入完成通知，缺key保匿名回执，缺整体policy或remote证明不发虚假完成。
- 截止固定168小时（calendar7days跨London回冬令时可能169h）；DB时间检查，运行tick过期清密文，provider不可用也执行清理。普通ACTIVE收件人条件不放宽，purge仅精确保留本请求/用户/event两通知；UNKNOWN不盲目重发。
- 官方email.suppressed仅受验签名及dispatch/provider映射接受，停止本目的两通知并清密文，不存reason原文/email；统一envelope再按ID锁outbox，回执清claim围栏旧writer。DB锁后复查TTL，剩余时长保守转performance期限，在Resend admission后fetch前再查。DB与HTTP不可能原子，不能撤回有效期内已发请求；物理清理依服务运行，停机不保证168h瞬时清，恢复仍拒超期发送。
- root冻结core:check退出0，unit364/DB147/API199/release23全通过，日志/private/tmp/fancy-deletion-mail-frozen-{check,core}.log；文档3/diff绿。首次未提权有4项CLI loopback环境红，保留fancy-deletion-mail-final-core日志；未改断言，允许本机监听的完整重跑全绿。定向DB33/API22/unit33覆盖DST、双连接锁等待、抑制/到期、缺key与恢复。未改Web/native，未重跑未变UI全量。
- 未生成或保存真实加密key、未配置真实webhook、未发真实邮件或远端删除；迁移仅新测试库，不动QA及真实联调库。QA继续DM撤回/F42；clone工具仅准备和自建库验证，尚无安全checkpoint，禁止源61973导出/复制。整体生产验收未闭环。


## QA-F43 候选归类为限流恢复

- 原Native56再约末步失败实为HTTP429（requestId37f989d8-baa3-4964-ac94-5f9d70bd5eea），PG零新consent符合拒绝，非500或既有pair重建缺陷。QA在正常下一配额窗口Native57只重试choice成功，未重复出席/评分/公评；原失败保留，不改生产服务。
- 新独立API回归覆盖旧饭局双方出席/互选、撤回、block/unblock后epoch3旧consent全撤、新饭局双方出席再互选200/OPEN和两条新basis consent。root复跑1/1绿，agent API类型/lint绿，仅新增测试，不动原rig。
- ee971b4远端CI已成功。QA报告F42实际取消零写入、HOST absent、SELF present优先及再HOST不覆盖通过，最终关闭/完整旅程范围以QA正式归档为准；第三B API隐私探针两阶段通过不冒生产隐私全部关闭。clone工具仍只准备/自建测试，等待安全checkpoint。


## QA-F44 原生拉黑与解除入口

- QA正式cd69公开主页/Settings原始surface确认正常UI缺Block/Unblock；本片只PublicProfile接MemberSafety，不扩Settings列表、不改已有撤回。合同原无读取本人block状态，新增getBlock GET /blocks/{subjectId}只读本人方向和latest revision，单SQL快照不撕裂；self403/目标非ACTIVE404，不泄对方拉黑，不建pair或业务记录，写合同不变。生成OpenAPI/client artifact同步，显式额外read白名单新增getBlock（不加入mutation集合）。
- 原生先GET真实state再呈Block/Unblock，两动作独立确认；取消零写，初始read失败显式Reload阻mutation；409关闭旧确认、GET权威刷新并重新确认，不按currentVersion猜blocked；普通error留Modal/保意图，actor/target/sessiongeneration护栏拒晚响应、reload单飞。解除明确不恢复旧同意，不改后端consent权限。
- root冻结core:check及unit365/DB147/API203/release23全绿，日志/private/tmp/fancy-f44-frozen-{check,core}.log；原生42套292项/type/lint绿，新增12项红绿及实际Profile入口测试，日志/private/tmp/fancy-f44-native-{full,type,lint}.log。文档/diff另验，未改Web。此前合同read白名单遗漏红及root一次批量替换误入mutation白名单红已修正为精确read增量，未放宽mutation协议断言。正式SHA还须独立正常签名包和匹配新GET后端实际QA，组件绿不抢关F44。
- QA已明确safecheckpoint原61973/PID63824固定2026-10-24T01:10Z暂停业务/时钟，尚未执行source连接/sidecar。阶段1同库方案只/tmp自建库准备：禁AI lifecycle全库recover/worker/迁移/drop，精确新staff及family预检、clock一致、有限CSV/privatehash；旧19d只有snapshot读取无创建API，创建新封存需另审极窄sealer步骤，不冒正常API已支持或把缺夹具归用户阻塞。


## F44隔离实测准备与后台同库前置

- QA正式B19 c480b802已push并释放Git窗口，193PASS/12NOT_RUN/1FAIL(F44)/11BLOCKED；该SHA远端CI成功。F44本地修复不抢关。QA第二专用sim D92E76C4-9333-4FC7-8B53-E681DA73C055只由QA安装操作；原E770、61973/PID63824、原PG和2026-10-24T01:10检查点继续冻结。
- 新F44独立2005991完整archive/API62044只用于targeted，新PG合成completed双方SELFpresent饭局/唯一DM/共享群，tmpfactory剥AI生命周期与worker，正常OTP/退出；不冒原J004同库通过。初版fixedclock落后真实测试会令native15min token假过期，QA未安装登录前已准只重建OWN62044，用真实当前UTC+2h安全时间及正常+61s cooldown，保旧元数据历史、不清OTP/配额、不改TTL；新IDs/clock/stop以重新发布ENTRY为准。197源逐字一致，正常签名API62044包编译中，未安装。
- 同库阶段1临时工具/private/tmp/fancy-admin-sidecar/ENTRY.md已冻并交QA审核，source连接0/CLI拒执行。自有PG核63表，明确16类新staff/auth/TEST分类/角色/框架限流/新snapshot/CSV metadata delta；旧业务、sealed facts、旧session及AI pending/budget不变。正常logout会新增仅新staff的ai_subjects，不冒AI全表零写。staff正常OTP→自身TEST→logout204，sidecar停止并只close自身listener/pool；QA将来用原正常clock协议+60s至01:11并对比业务/待发通知、出新checkpoint，才RAM receipt重attach/正常browser登录。当前尚未执行原clock推进或source接入。
- 原19d无createSnapshot HTTP；新封存是显式fixture operator直接现sealer新UUID，不改旧facts，不冒正常产品API或启全worker。原buildServer自动AI recover已从tmpfactory剥离；严格新staff/family预检在authenticate前拒原tokens，独立browser context，clock mismatch503，OWNstop不drop。阶段2/3仍待精确ID白名单。
- AI3102/PID42728只读核script qa-ai-browser-fixture.ts，server/identity/assistant routes/controller/assistant合同五文件逐字匹配cb9257e，不泛化全archive。TestIdentity OTP/guest/IOS入口和controlled固定文本provider，只有自有PG synthetic价格/预算；本轮未发模型请求/OTP或预算写入、不停服务（SIGTERM会drop其OWNDB）。后续AI原生候选等F44后再排，不抢Xcode或改原环境。


## F44 独立真实UI定向通过与同库工具审查边界

- QA报告Native61取消Block及63取消Unblock五facts不变；62确认Block为1block/1revision、epoch2旧双方consent撤销，DM两旧消息只读，共享群仍可编辑且原membership/message refs不变；64确认Unblock后0block/2revision末项false，旧consents仍撤销、DM仍只读/群可编辑。2005991的197源、实际安装binary/Hermes一致，API3/native12定向回归。F44仅新62044/新PG/第二sim CLOSED_TARGETED_QA，原J004完整旅程转NOT_RUN保剩余sameDB/全链前置，以QA正式归档为准；setup红留存，不拿后验修正的selector/类型断言错误当产品错误。
- 最终F44匹配包正常签名Releasearm64/deepstrict0，binary2b8dba59047e0b0132b5fbcf920596df51b95f993850ae84eac416d3dca50c10/Hermes2b313e5e0de067d33da45133815347ef6cc7ee4ad7b6e7170974c35e50e121fa。当前OWN API62044 PID80077，futurefixed2026-10-22T01:20:33.806Z，ENTRY-F44-RIG.md为准；旧77194仅核实OWN后重建保历史，原61973未动。后续新001/AI用例不在本次定向结论范围。
- QA发现sidecar复制运行archive遗留local-acceptance端口adaptation及非Git ENTRY，已恢复正式git19d且保前红history：1231regular+4tracked symlink逐Git一致，runtime无原server/lifecycle/localacceptance。精确更正：offline-test自建库seed确import旧httpserver，不能说所有test导入图无server。QA隔离copy自有PG复跑通过。
- root按已审observer有限只读source核PID63824唯一API/PG、五合成饭局、23迁移逐正式19d校验/PG17/exact01:10，生成0600本地trust descriptor，不读env/.pgpass/Key/正文；因此root只读source连接已发生，不能继续称全系统source0。没有source业务写、bootstrap或clockadvance。descriptor只版本/head metadata不冒全facts证明；新runner须17表同RR只读count/rowdigest基线，正常bootstrap/logoutclose→QA合法+60s/newcheckpoint→RAMreceipt重attach。
- QA独审factory/descriptor通过，operator仅mock不足真实SQL，root要求新增真实自有PG整链与PGPASSFILE/devnull及白名单env防隐式凭据；默认仍不执行source。专用f44-admin.localhost Origin实际IAB新host非认证marker隔离验证通过，具体52045代理/CSRF仍待正常登录200。Admin无登录表单，准备明确临时QA身份portal走正常OTP/logout，不injectcookies/不擅补staffprofile；无cookie session-read可落正常401但原cookie/bearer仍预检拒，改动重冻审核。原01:10继续冻结。


## F45/F46实际缺口与F47一次性环境故障

- F45：权威AI方案46/103要求当前安装token-only安全恢复/TTL内显式Continue，未见后续覆盖决策。QA正式2005991/3102 Native68正常Start后69约2分钟冷启只有Start，服务器同PID42728未重启/session ACTIVE gen1未过期/noPending，未Ask模型/reset，已actual红。owner正实现session/device/revoke/TTL/owner绑定的安全存储及marker清理，不存正文/偏好/草稿；旧guest身份复用不能替代AI上下文Continue，待正式artifact复验。
- F46：QA Native66本机退出guest而62044远端family仍active，不能猜请求为429；Native67 cold仍guest证明本机未恢复该登录。root新增真实navigation按signedout卸Settings的deferred429回归1红→3绿，连auth29绿/type/lint绿，全局session notice在AppRoot安全区、不依赖Settings局部state；204不警示，晚到失败不附新signin。QA独立network/503卸载回归baseline两红/WIP两绿；尚未正式提交/原生复验关闭，等F45冻后一并全原生验证分片提交。
- 原库stage1 bootstrap已由QA独立V2真实operator演练放行后执行：hash22tools/1231archive全匹配，正常新合成staff OTP→自身TEST→logout204/全部family撤，17表前后digest23083470f1ff1655bf348cdd7c210ed3bb878e1991b38cc5fa0a6b9a31a5cadb不变；自身listener/pool关闭，rootsession46293停WAIT，未resume/snapshot/clockwrite。
- F47：QA独立推进前17表digest再核同，按协议仅一次FIFO advance01:11，旧rig随后报LOCAL CLOCK STOPPED current01:10 resetrequired并自动退出；63824/61973消失、PG拒连。旧脚本任一advance阶段错误均fatal，finally无条件dropDB/pg.stop删目录；日志未记录具体失败阶段，不能猜drain或workerstop timeout，Nodecurrent旧也不能证明PG commit是否发生。保留原api.log、descriptor、QA/private/tmp/fancy-qa-stage1-before.json和operatorreceipt；禁止重试advance/resume/snapshot/重启/清理旧环境，不伪造旧IDs/history宣称恢复，旧同库后台trace未闭环。生产代码与独立F44结果不因该fixture丢失重开。
- venues owner已获准最小F47基础设施修复：阶段安全错误/DBclock OLD/TARGET/UNKNOWN、默认异常保OWNDBPG、显式核owner receipt才清理、PGstop失败不强rm、真实heldrequest/responseabort/workerstop/advance/tick故障回归。app.close原AI recovery元数据副作用须明示，保库不冒静止快照。所有验证只新自有PG，原环境不复建。
- AI3102正常签名包200已交QA；034独立parent持OWNPG/仅OWN APIchild真SIGKILL再spawn的短生命周期测试通过：同auth/business/clockhash、技术delta空、旧session/result410，测试资源已清理，无standing；最终WIP因F45暂停，不冒native034通过。完整001新case/sameDBstaff/合法clock与默认保数据需后续独立新环境，不拼旧trace。


## F45/F46/F47 冻结整合与正式复验交接

- F45正式1e6c2a4安全保存当前安装AI凭据：session/generation/device/revoke/服务端TTL与真实owner绑定，正文/偏好/草稿不落盘；冷启仅候选，用户显式Continue才读上下文，marker缺失先清Keychain再写marker。账户切换与晚响应围栏、存储失败拒用均有回归。原Native69红保留，实际正常签名包复验前不关闭。
- F46正式65e6818把远端退出未确认提示移至AppRoot/session独立订阅，Settings卸载后仍显示；204无提示，晚到失败不附新登录。仅说明远端未确认，不能声称Native66已查明429或已撤销family。
- F47正式6e497d3默认退出及异常保留OWN PostgreSQL；显式0600所有权receipt、真实PID/port/data目录核验并pg_ctl成功后才清理。时钟故障输出阶段和数据库OLD/TARGET/UNKNOWN，不能从旧Node时间猜提交结果。新PG失败停机保数据回归通过。关闭app可能写AI recovery元数据，保留并非静止快照。原61973资料已丢失，禁止resume46293/重建旧IDs冒恢复；原sameDB后台旅程需全新case重跑。
- root综合冻结core:check退出0、unit365/DB147/API203/release27全部绿；原生317/type绿，QA自有unused import修正后全iOSlint0，文档3绿。日志/private/tmp/fancy-f454647-{check,core}.log及fancy-f45-f46-frozen-{ios,type}.log。三提交分别push/fetch核对HEAD=origin/main，其他QA/research修改未索引。
- 已交ios owner完整archive正式6e497d3，API3102正常签名Release arm64 build-only，待实际source/binary/Hermes证据后QA仅第二sim安装，复验冷启Continue、重装marker与退出notice。整体生产验收未闭环。
- AI3102仅补合成London新日2026-10-22预算10CNY/100calls，旧日/月与业务probe不变，所有调用价格标注synthetic-only-no-real-charge；本次无真实provider调用/充值/预算初始化。私有回执/private/tmp/fancy-ai3102-synthetic-day-cap-receipt.json，不公开配置或凭据。


## F48 游客申请入口与 CI 所有权证明补齐

- QA正式08783e3保Native70原红及独立R203：OPEN/future/有席饭局游客无Request to join；没有OTP/资料/申请业务写。状态193PASS/11NOT_RUN/2FAIL/11BLOCKED，以QA后续报告为准。F48正式0a4593e仅原生MealDetail与自有8项回归：signedOut且OPEN、开始/截止未过及未满才显示登录入口；restoring/unavailable不当游客，signed仍权威allowedActions。复用现有AuthGate保存原申请目标，未扩后端权限或自动提交。root全原生47套326项/type/全部iOSlint绿，正式0a4593e已push核一致。
- 6e497d3正常签名包已完整1485/native202逐源核对并交QA；binary2728ffde02d3a5489a29d62a874276e3338c43b2f2ceec42de80758449db2bfa/Hermes08dcc1275b1842a21677d93327fc8e0c0452cd8adb063efdd2e0955492ace80f。仅QA可安装第二sim；先正式包正常Start再coldContinue，不期待旧200包已有新凭据。F48不在6e497包，已另排正式0a4593e正常签名build-only，尚未实际复验关闭。
- 远端b4394b0在types/lint检查步骤失败，正式快照仍含QA unused noContent导入；此前root绿包含QA未提交修正，08783e3已收录该修正。未取得完整远端错误日志，不把推断当具体日志证实；后续完整CI仍须核。另静态确认F47新增OWN测试在现CI仅共享外部PG/dump wrappers下无法成立，未冒称它是前次已发生的检查失败。
- 正式236360c新增独立FANCY_OWNED_PG_BIN，CI按官方PGDG方式备本机17服务端，已有符合版本即复用；不改原Docker service/dump wrappers，不skip。两测试明确排除外部URL，仅OWN集群证明；root故意外部127.0.0.1:1/普通bin空/独立真实17环境2项绿，缺OWN硬红由owner保留。完整core:check0、YAML/shell语法0；Ubuntu安装及完整CI尚待实跑，不能称已通过。
- F46代理仅/tmp新fakeupstream四项绿，无standing/真实3102连接；正在准备固定503/明确双旗标/0600ownerreceipt入口，真实启动须root再核。QA Native71 selector问题与F48业务红分开，Native72继续正常新syntheticactor资料路径，不冒001guest前缀通过。034仍只/tmp自有短生命周期准备，不动3102/62044/原失库。整体验收未闭环。


## B21 独立恢复闭环与 F49 键盘避让

- QA正式787a710已push并释放Git：193PASS/12NOT_RUN/1FAIL/11BLOCKED；F45实际75/76 signed冷Continue同session/gen1及数据，77真实卸载重装先清旧auth/AI后正常guestStart，78原guest冷Continue同session/gen1，未发字不持久，EDIT导致服务端TTL合法更新不谎称全部TTL不变。F45仅CLOSED_TARGETED_QA；AI034退NOT_RUN，RAMloss410及未发文字保留仍未验，不冒整条AI全过。实际actor以服务端ID认定，不按快速输入可能缺字的预期邮箱推断。
- F48正式0a4593e包full1492/native204逐源一致，binaryc4014ad60492622983c949c6034f52f6edb7d39a4af4e0ab52e3a02ec2a62ceb/Hermes300b5dc9a3d43a3c5a7cf897f4e8e7c4c4459c18c08e25e95b14622963e2ef61，正常签名/deepstrict0，已QA核，正在正常游客申请→登录/profile→原申请目标actual复验；组件R204绿不抢actual关闭。完整CI98722c6 completed/success已双方独立核，不能泛化后续新提交或provider验收。
- F49新实际79：键盘y590..816，输入y626..720、Ask y733..778，二者hittable=false，断言exit65，未tapAsk/模型调用；这是独立键盘布局缺陷，不重开F45恢复数据结论。root正式cbdbf97只三文件：AI opt-in整Modal KeyboardAvoidingView flex1/padding并排除安全top/left/right，sheet及ScrollView允许收缩；移除原只包内部的KAV，保handled taps。其他Sheet默认不变，无新provider要求；manager/协议未改。
- root布局祖先/默认Sheet关闭边界原红→绿，最终48套328原生/type/全iOSlint0，日志/private/tmp/fancy-f49-{native,type,lint}-release.log；中间测试误用新版库已移除的UNSAFE query导致红及一次无provider的默认Sheet回归红均保留并修正，未放宽实际79要求。交叉审未发现静态阻塞，提醒安全区/横屏实际几何，已交正常签名cbdbf97新包build-only，再由QA实际keyboard/Ask/mock/旋转复验，不以结构测试冒通过。
- 034/tmp工具三项独立review问题已修：lstat/uid/canonical/权限/receipt与实际PG身份校验，确认停PG/PID退出/端口拒绝/离线系统ID后才rm；IPC断开仅关自有API/pool；主finally真实清理+ECONNREFUSED后才打印true。真实PG stop失败保数据、路径替换拒绝、一次性合成childwait失败保handle、IPC断开PG事实存活回归绿，产品1400tracked仍2005991exact。独立复审六hash全吻合通过；父SIGKILL/内核不可杀仍未测，startup/runtime错误可能API活着，保PG非静止快照。无standing62046/旧服务连接，需QA安全checkpoint后新环境，不能改原3102冒RAMloss。整体验收未闭环。


## B22 游客入口实际关闭与统一旅程环境首片

- QA正式c923457已push/释放Git：193PASS/13NOT_RUN/11BLOCKED。F48 actual80正式0a包游客Discover→Request to join→精确邮箱OTP→完整资料→同meal空Apply/Send存在，正常用户/资料及原餐application0、businessProbe不变，无新增AI请求，定向CLOSED_TARGETED_QA；J001退NOT_RUN，未补两方向全生命周期/同DBAdmin前不记整条PASS。
- F49正式cbdb包已冻/root核唯一ENTRY：/private/tmp/fancy-native-f49-cbdbf97/ENTRY-F49.md，full1522/native205源exact，正常签名Releasearm64/build0/deepstrict0；binary951de2ab20497848ea8af6fd9be3b33f24a8c10e60475ddcda765f3c310069ba/Hermeseb15719c14182ef7a7075dd3250cc83e2b0a46fa0197d9d7ad5f9965c6d95186，API3102/Mapsblank/NO_DOTENV。未由开发安装，已交QA控制时序，实际79键盘/横屏/Ask仍待测。新CI以远端最新结果为准，旧987成功不延伸新SHA。
- QA确认J001–012共同前置含H/A+B隐私、角色互换、同物理DB/通知/Admin。3102硬编码draft与034最小SEARCH只能局部证据，不能拼作完整journey通过。统一方案/private/tmp/fancy-unified-journey-plan.md已逐12case映射：默认每case/角色回合独立DB，全端同库；H/A/B正常UI生成业务，staffbootstrap/支持grant/sealer例外独列；controlled显式SEARCH→卡→选M→draft，零外呼。未实现的lifecycle暂停/testmail装配/快照周期等未知明确保留。
- root已授权环境唯一owner venues仅/tmp统一P1：锁完整c3fb355正式archive，独立randomport及OWN短命PG，不占QA034演练62046；先owner/clock与API临时lifecycle pause协调，产品archive不改，差异manifest。pause仅停timer并等在途sweep，不shutdown RAM；保生产初始化/close语义，HTTPgate/AIpause/workerstop/DB与各Nodeclockack/duebatch/resume分阶段，失败保库。先报精确scope，不实现provider/mail/staff/业务seed，不启动standing/操作设备/旧环境。QA当前独立034短命自有PG演练，root不并占其端口。整体验收未闭环。


## F49 实际关闭、新034环境与F46代理准入

- QA确认F49 actual81键盘保持时输入/Ask/Close均可点，实际mockAsk获clarification且无业务写；82设备横放请求仍遵正式portrait锁、Close收键盘/重开保未发字，真实landscape布局N/A；85长历史自然scroll后Keep原文→Close核原文→Reopen明确Replace通过，未Send。83滚到系统键盘栏/84未先scroll是QA控制失败并保留，不记新产品缺陷。F49可targetedclosed待QA正式B23，不拿旧3102后台兼容局部授J005完整SEARCH或当前backend整合通过。
- QA85明确设备安全checkpoint后root按已审双闸启动034新OWNPG/API62046：parent34705/exec99659，runOwner d7a338c9-1d06-4eac-b4ce-d7fdec7402b2、rigOwner bbf009d0-a909-4898-8339-9f21af4967e6，RUNreceipt/private/tmp/fancy-ai034-run-nv2TE7/RUN-receipt.json及OWNreceipt/private/tmp/fancy-ai034-retained-TrsW5T/owner-receipt.json。transport0700/private/tmp/fancy-ai034-transport-sm0pd116，FIFO0600由root O_RDWR持fd3防EOF，finite-events.jsonl仅有限metadata。初inspect pending0/inflight0，未crash/业务/模型；workerfalse。旧3102/62044/设备均未动。停止仅核自身parent SIGTERM保PG，无cleanup。
- 原生034必须同一UITest/App进程跨OWNchild restart：正常AI完成→输入UNSENT→Close flush EDIT/停poll→READY暂停写→fresh inspect/hash/pending0/inflight0→仅有限crash命令→同进程Open/Continue验410+UNSENT保留，不得两次冷启冒客户端RAM保持。QA获准在明确checkpoint写原FIFO有限命令，不复用初始hash。正式cbdb/API62046包ENTRY-AI034已build/root核full1522/native205/build0/deepstrict0，binaryba9b449813f9ae511f03c8ac697fca2f820b7e2f9b68e3bc7a1eda97766f46ef/Hermes968179de48cd76f4c0c2d55da6e87641595c657b0c5eaa264f9d1bfbaa715154；尚未安装，QA先原3102正常logout与F46链。
- root按QA明确请求启动新F46 proxy-v2自身63102→3102：PID36778/exec64138、ownerf46-6685e8a14e484ec2bf7b8c04e0cf4c3f、receipt/private/tmp/fancy-f46-proxy-v2/owner-f46-6685e8a14e484ec2bf7b8c04e0cf4c3f.json，有限log同目录finite-events.jsonl。factorybb3c9e8.../runnerfef1f7e...已核，7真实fakeupstream绿。只精确logout注503并记录有限event/count/forwardedToUpstream:false，不日志headers/body/path、不主动上游调用，不声称观察全server所有logout。新API63102正式cbdb签名包仍build-only中，QA先86正常logout基线，后proxy包正常OTP再故障logout/localguest/全局notice/远端family仍active/coldguest，不借此声称已远端撤销。
- 统一P1原onSend排空缺口已另P1v2修，旧历史未改：/private/tmp/fancy-unified-journey-p1v2-c3fb355/runner/ENTRY.md，13新OWNPG绿，onRoute await真实handler finally结合responseDone，新增send先完整响应→真实SQL锁→COMMIT旧钟→才advanceTARGET。ios独审20证据hash/1522正式源0diff并确认此前唯一gap已闭；仅同顺序synthetic route证明，非真实CSV auth，detached work/abort保守timeout与非quiet边界保留。AI_RESUME后故障best-effort暂停分别ACK/UNKNOWN，不冒全部静止。无standing/旧连接。
- P2a controlledprovider新sibling纯schema/planner12项root复跑绿，零DB/预算/网络/Key；GROUP真实target权限仍由生产controller前置，pure不冒鉴权。已交P2b真实worker/testmail最窄装配提案，只读scope先审；H/A/B正常UI、角色互换、同DBAdmin/通知等完整journey仍未就绪，整体生产验收未闭环。


## B23/B24 原生键盘与退出失败实际定向关闭

- QA正式B23 f2da660、B24 01b3262已push/fetch一致，各80Python绿并释放Git。F49 actual81/82/85已CLOSED_TARGETED_QA，保79产品红和83/84 QA控制红；真实横屏布局按正式portrait-only配置N/A，不能扩大为横屏功能通过。整case仍193PASS/13NOT_RUN/11BLOCKED，不以局部草稿/入口关闭增加旅程PASS。
- F46 actual86原3102正常logout，独立PG同user activeIOS1→0且LOGOUT1，87冷启Guest。正式cbdb/API63102独立签名包actual88正常OTP登录既有完整profile，89精确503退出后Guest且AppRoot全局未确认提示仍见、Dismiss仍Guest；proxy实际仅一条logout-fault-injected/count1/503/forwardedToUpstream:false。远端同user before/after activeIOS1/total2/LOGOUT1不变，明确未撤销；90冷启Guest/noSettings/不恢复凭据，远端仍active。F46已CLOSED_TARGETED_QA，不冒全机断网/所有上游logout观测或远端已撤。
- F46正式包/private/tmp/fancy-native-f46-proxy-v2-cbdbf97/ENTRY-F46.md full1522/native205exact/正常签名Releasearm64/build0/deepstrict0，binary4fa890197a3d41475b56dc13c29355fbe31bca7ca582d0b83b81410d7ce4353a/Hermes34696a155df3b71fd746bf77b8f141372142a80dd7f88924a0e4a54690bcf7a5，NO_DOTENV/Mapsblank/API63102已QA独核安装。开发未操作设备；03462046新OWN与proxy63102及旧3102/62044均保留，不清库。QA下一同UITest/App进程跨034child重启，root不写FIFO/不额外inspect覆盖checkpoint；本地未发文字仍待实际验收。
- P2a独立审hash+12纯测试绿，无实质阻塞；文档应准确为生产draftTarget在第二阶段draft生成前，planner先generate，不冒所有生成前已校验。原冻结文件不改，后续ENTRY澄清。P2b已获批新sibling完整runtime/test sink薄片，当前自有PG正常API业务首测与backoff自测中，仅正常API自测不替QA UI，UNKNOWN/periodic快照等待整批冻和独审；不涉及真实邮件/staff/人工sealer/真实模型或旧环境。整体生产验收未闭环。


## B25 AI034 全场景通过与最小 J010 装配

- QA正式B25 2c626a4e4709cb96f18aa31fa9ecfbd2466577e6已push核一致/80Python绿，AI034三expected由75–78冷启重装及91同一UITest/App进程跨childRAMloss实际补齐，现194PASS/12NOT_RUN/11BLOCKED。91正常完成SEARCH→输入未发字→Close flush/READY→freshinspect pending0/inflight0→原有限FIFO重启，child34736→45797，同PG/auth/business/clock全同、technicalDelta空；同App Continue过期/旧结果消失/未发字逐字保留、无自动New或请求，后续digest不变。不是冷启动模拟保客户端RAM。034父34705/exec99659/FIFO fd3及currentchild45797、proxy63102 PID36778继续保留，不清库不复用旧PID。
- QA独立短命新PG复跑P1v2 13项、旧P2b 19项均绿，旧P2b1522文件manifest/Git三方核0diff；证据/private/tmp/fancy-qa-p1v2-independent.log、fancy-qa-p2b-independent.log、fancy-qa-p2b-source-proof.json。P2bv2另新目录仅修FULL_RUNTIME_SYNTHETIC_MAIL标签+实际receipt断言/绝对路径重定位，原19全绿且旧P2b冻结不变；QA独核全部hash/normalized diff并新19全绿，证据/private/tmp/fancy-qa-p2bv2-independent.log。仅自建库前置，不授standing/UI旅程或真实邮件PASS。
- P2bv2正确基线/private/tmp/fancy-unified-journey-p2bv2-worker-c3fb355/runner/ENTRY.md（aa946bbcf7cf998cb52bbf38ec51ca1e1db11a3ad379cac81ae127581f69cca3），SHA256SUMS ed536924bca2a026347203c52a965d2734bf00e9fdc80e1408f18b0b3b6aca0d。收据任务曾只发送到已完成agent未重新触发，root检查后用followup纠正，修正已实际完成；下游只接精确新freeze不等口头状态。
- 12项待测为完整journeys，按QA要求优先最小J010，不等待support总装；权威J010前置H/A+授权support/受控邮件/跨端，B/Admin及其它统一复用需求不得擅加成单case硬门槛。先H/A正常UI建minimum3/仅A确认2人→合法截止→双方通知/testmail/群消息，缺support等原前置时whole仍NOT_RUN，不把部分或APIseed授PASS。
- 新唯一owner journey_access获准/tmp J010 access新sibling约10适配文件：基P2bv2稳定nativegateway候选62047→本runrandomAPI/canonical52991 Web，Vite configFilefalse/envDirfalse/cleanenv/空Maps同源proxy，删P1测试HTTP及故障IPC，保真实phase/完整worker。OTP真实provider校验与RAM实际ref/challenge/role/current绑定，0600短TTL私有回复，不stdout/log/SQL改quota；固定钟不能按UUID排序猜最近。strictOWNER/revision/currentclock有限控制，stop只自身前端/gateway/rig.stop保PG无cleanup。先纯/fakeupstream和40000–44999新OWNPG短命自测，未准绑定62047/52991、浏览器cookie探针或设备安装，产品archive/所有freeze不改。
- iosowner另P3a staff薄片获准：正常OTP新exact合成S经双gates真验证后模拟amrmfa，唯一fixture直接写仅新S analyst/data_admin角色，正常classify自身TEST/审计/逐family正常logout；普通自测A真实API餐S0→classifyA snapshotPendingtrue→完整worker周期S1/旧S0不变/同filterCSV。无support/grant/人工sealer/delete/真实provider，AdminUI门户另片。venuesowner另P2c真实HTTP/PG controlledAI链获准，SEARCH公卡→明确选M→draft/transfer及target/actor/version拒绝，预算仅新库synthetic，不改生产controller/DTO或已冻P2a；两片均不standing/旧连接/设备/Git，不把API自测替QAUI。整体生产验收未闭环。

## J010 新隔离环境与异步故障保护复核

- Access v1/v2历史保留；v3修正异步worker/API失败后OTP finally可能重开HTTP的独立审查缺口。parent持续failure latch与API本地failed屏障共同拒绝resume，OTP在途epoch变更拒交付，stop取消未取私有FIFO；真实SQL锁确认OTP未settle时触发worker错误，释放后HTTP仍503/direct IPC resume拒绝，以及OWN API/worker退出可inspect unavailable且保PG。owner15项与QA独立15项全绿，ios只读33产物/1522正式源精确无阻塞。特定取码回归不泛化任意失效时点绝无FIFO或已交付码撤销，不声称零检测延迟或全静止。
- 最终冻结/private/tmp/fancy-j010-access-v3-c3fb355/runner/ENTRY.md SHA cbe55b970c7e888d3e65c1ef25f8b28186210f3227281b52cee10ff9c173546c，ACCESS-PINS d6ddf3eca9767a73bad8a45776014b00d936b25cdf3d70df045fe7c60bcea5a1、SHA256SUMS-ACCESS a6f1549a926d92101f322b0c6c3c47f00a4a78edae015849cab80067d3cde08d为本片权威；继承旧清单仅历史。
- 经QA接受和ios复核，root已启动一次新OWN J010 partialstanding：Web unified-p1.localhost:52991/native12762047，单一新PG/API/fullworker，正式c3fb3551522源不变，没有业务seed/真实外呼。私有RUNreceipt /private/tmp/fancy-j010-access-run-UC8TVF/RUN-receipt.json，parent66714/exec76480，transport/private/tmp/fancy-j010-transport-HwQzJs持O_RDWR FIFO fd3，勿EOF或误停；有限命令以最新owner/revision/currentClock为准，失败只inspect/stop保PG。QA已接收并开始真实Browser预检，正常UI H/A建餐/申请/审批/截止通知邮件/群写尚待完成；support未装配，wholeJ010仍NOT_RUN。
- J010正常签名包/private/tmp/fancy-native-j010-c3fb355/ENTRY-J010.md已QA独核1522/native205与binary/Hermes，只有QA可装第二sim；root不操作设备。真实Secure cookie、同源会话及原生跨端证据不能由Vite transform或API自测替代，不放宽Secure或擅装证书。
- P3a staff26项及P2c真实AI HTTP/PG22项冻结；QA分别独跑新增7/3项绿，仍只是自建库前置。P3b role-only30项冻结于/private/tmp/fancy-unified-journey-p3b-support-c3fb355/runner/ENTRY.md（d732f2782d90e81849dac16da23d050791e3b2b1521afeeea97ed3aa67473c0c），ios核46产物/1522源一致无新增阻塞：真实CLI PKCE/nonce后精确C模拟MFA、只新C support一角色、原批准S两角色、正常CTest分类/审计/退出隔离，case grants为零；正常CLI OS临时回调端口例外明确。未装入J010 live，不冒真实IdP或UI通过。
- P3c同源Admin门户仅只读方案：普通Web登录/profile后手动打开/admin/，不能把/admin塞入已明确拒绝的returnTarget或新增产品登录页。尚未授权实现或启动。原034/proxy/3102/62044与失库历史均保持，未清理。root39afb65远端完整CI39708231033 success已核，本轮只更新协调证据，不把旧CI延伸为新提交结果。整体生产验收未闭环。

## F50 站内通知入口缺失与 Web 第一修复切片

- QA在正式c3fb新J010正常Web H发布/原生A申请/主持审批至2人、minimum3后合法推进截止：餐取消原因insufficient，双方各同event notification1/outboxSENT1/sendCalls1，Web群正常可写，无退款承诺。真实点击Notifications却落入聊天空态：Inbox链接存在但缺静态路由，被/inbox/:conversationId吞入。原生也没有站内通知页面；统一F50，wholeJ010仍失败，support原前置另pending，不把后台SENT当客户端通过。
- Web新增静态/inbox/notifications页面，真实listNotifications逐页/重复游标拒绝/按ID去重、固定模板文案与未知模板安全回退、meal详情链接；显式markRead用单飞与幂等Intent，服务端成功才更新readAt，失败保未读，初读错误可重试且不假空。复用现有session epoch重挂载及query generation私有围栏，无新通知数据/权限或聊天API改动。
- 自有3项原路由红已留/private/tmp/fancy-f50-web-red.log；首次实现错误把Instant传ZonedLike格式器导致两项红，改为明确Europe/London的Instant显示，未放宽业务断言。最终4项定向绿/type/lint/Webbuild绿，venues只读交叉审无阻塞。全Web/admin首轮317/318唯一QA地图fallback红保留，显式空VITE公共Maps变量后同53套318项全绿（/private/tmp/fancy-f50-web-admin-controlled.log）；私有dotenv未改/未输出。
- iosowner独占原生通知入口/页面/route/自有测试并行，尚未冻结，不纳入Web提交；QA证据与research不索引。当前live c3fb冻结目录/API/PG/clock不改，修复需后续正式source匹配新环境与实际双端复验，不以组件测试关闭F50或整条J010。整体生产验收未闭环。

## B26 原红归档与 F50 原生通知切片

- QA正式B26 b150e64已push，80Python绿：194PASS/11NOT_RUN/1FAIL/11BLOCKED，J010因F50客户端通知缺失实际失败；同库合法截止后H/A各通知与mailSENT各一次、原生收到Web群消息及Web取消后发送已记录。F51另实际95键盘590..816，原生Message703.67..744.67/Send700.67..745且hittable=false，未强行tap；不是群权限或F49 Sheet旧缺陷，尚未关闭。
- F50原生五文件新增Inbox Notifications入口/route、真实listNotifications分页和显式markRead。加载与错误不伪空、分页错误保旧列表且重复游标拒绝；mark单飞及同ID失败重试保Intent key，成功才已读，无聊天引用猜权限。focus/foreground先验证session，generation/revision拒旧响应，403/404/410清投影。固定模板文案及未知模板通用通知，无自由正文。
- root审查发现首轮334绿未覆盖mark在途跨后台后按钮禁用残留，退回补真实AppState deferred回归并修bookkeeping；迟到结果仍不回填。最终定向8项与全49套336项/type/all-iOSlint绿，root最终core:check/native/type/lint通过，日志/private/tmp/fancy-f50-final-{check,ios,ios-type,ios-lint}.log。正常签名正式包与QA actual尚未做，F50不因本地绿关闭。
- Web53bd8fe已正式push；远端本次CI39711935722失败于Run pnpm/setup@v3，项目check/test未执行，详细日志接口不可用，不能猜产品失败原因或冒CI绿。B26原记录保留，后续新SHA仍须核CI。F51已给iosowner唯一ChatScreen+自有keyboard-layout测试薄片：用实际screen/local坐标转换替换常量88，保持既有header安全布局及业务协议；尚在实施，不混本片提交。旧UC8TVF run/clock16Z/最新QA控制revision10及全部原环境保留，root不写FIFO，整体生产验收未闭环。

## F51 聊天键盘遮挡的独立修复

- QA actual95原红为keyboard顶590，Send底745且hittable=false，未强制点击/未发送；原生收到Web取消后群消息不等于原生可发送。F51保持独立于F49 Sheet与F50通知，不改群权限、消息协议或强制隐藏键盘绕过验收。
- 首个动态keyboardVerticalOffset候选虽纯测试绿，root与venues实读RN0.88确认prop变化不自动重算KAV；该候选撤回，不能用其早期日志声明通过。最终仅ChatScreen与自有keyboard-layout测试两文件：固定outer viewport真实measureInWindow，窗口/键盘矩形相交计算clamp到容器高度的paddingBottom，子flex内容压缩而测量外层总frame不反馈缩水。用普通View替代常量88的KAV，保F37 header/safearea与所有消息/草稿逻辑。
- keyboard show/change/hide与真实outer layout触发重测，hide清零、focus/blur/unmount revision拒迟到；无私有RN调用、TextInput重挂、全局AppRoot接口或100ms轮询。仅保证真实layout/keyboard事件后的重测，不声称无事件的任意同高祖先平移可检测；app仍portrait-only，不新增横屏功能。
- 最终5项自有回归包含生产交集helper的geometry/clamp/晚回调及实际Chat组件synthetic native measure→真实padding渲染/viewport尺寸变化/keyboard hide/清监听。全50套341原生/type/all-iOSlint绿，日志/private/tmp/f51-intersection-{all,type,lint}.log；模拟测量不冒真实95几何通过，需正式签名包由QA核Send在键盘上方、可点击且正常发送后才能关闭。
- QA接受下一完整J010原前置解释：同新PG正常验证C support角色与必要TEST分类后正常logout，drain并关闭合成portal，再H/A真实UI；不要求15min CLI token跨数小时仍active，不新增casegrant。旧UC8TVF run/源/IDs/证据全部保留。新run只读计划为最终SHA新archive+Accessv3屏障+P3b角色前置、单API/fullworker/单AI，候选新origin unified-j010-v2.localhost:52992/native62048，尚未实现或启动；实际启动仍需独立审查与端口核验。
- CI8303首轮与明确重试attempt2均已用专用GitHub日志核：registry.npmjs.org下载pnpm原生包30s Timeout，项目检查未运行；保原失败，不盲换registry或以本地绿冒远端绿。下个正式SHA继续核完整CI。整体生产验收未闭环。

## 3a17 正式包独核与新 J010-v2 前置准备

- 3a17e8b8971f617b1e4d4f1c3903586b6464e6f9正常签名Release arm64模拟器包已完成，ENTRY /private/tmp/fancy-native-j010-v2-3a17e8b/ENTRY-J010-V2.md SHA5fa7fec5f990c27a29086472c53ffeda0c5777519b51b27b12d04891dfafd276。全1600 tracked/209 native-client-contracts逐源与Git核exact，binary f0e3ff5ca7ccda1c44697dd3397d57d60ae2bbfda1f1cdfec494b529300a4892、Hermes ca87e8da835fcf0527a51c499441b0aa1d95499529c2bd8f39186079ef18154a；API12762048/NO_DOTENV/Mapsblank/build0/deepstrict0/自动Simulated.xcent与MachO appid。QA已独核以上所有源/hash/签名一致；未安装、启动或请求新端点，不重建无关包。
- QA正式3a17定向通知8+键盘5共13项独跑全绿，证据/private/tmp/fancy-qa-f50-f51-component.json；只证明组件前置，不替原95几何/正常Send或完整J010，B26仍194PASS/11NOT_RUN/1FAIL/11BLOCKED。
- 新/private/tmp/fancy-j010-v2-3a17e8b装配仍WIP：唯一owner生成1600正式源，单API/fullworker/单AI、Accessv3故障保护与exactS/C正常支持前置组合，尚未绑定62048/52992。root初读发现CLI未认证即exit0或stop可能悬挂pending promise，已交owner补停止取消/实际退出与预期logoutACK阶段回归；必须修测冻结后再独审，不因目录存在授ready。所有旧run、clock、IDs与设备状态不变。
- 最新CI3a17 run39713204637/job119609129976再次止于pnpm/setup@v3固定官方实现a0881977cd8ea73b1ed212236c99ca10dcc80cf4，registry.npmjs.org/@pnpm/linux-x64/11.25.0元数据30s Timeout；专用日志已核，尚未到runtime安装/frozen-lockfile/项目测试。venues只读本机同linux-x64与exe官方端点15s也超时，不足以判定全球故障；官方版本配置兼容，无bootstrap retry/timeout输入，缓存位于安装之后不能解决此步。未改mirror/签名/lockfile或盲重跑，远端验证仍未通过。整体生产验收未闭环。


## J010-v2 装配独审与完整旅程交接

- 基于已提交的通知与聊天键盘修复，新隔离测试装配完成最终冻结。24项自测全部通过，其中新增9项前置测试由QA独立复跑通过；协调与交叉审查均确认正式源码及执行产物一致。
- 支持账号前置的提前退出与停止取消边界已补齐回归；正常退出、授权页面请求完成及关闭后才开放普通业务与时钟推进。保留单API、完整后台任务运行器和单AI生命周期，未创建普通用户的饭局或申请测试数据。
- 新隔离环境已交QA执行正常合成支持账号授权与双端界面操作；已有环境和失败证据保留。授权页面的实际交互仍在检查，不以自测替代浏览器结果，不绕过授权流程。
- 通知与键盘缺陷仍待正式包实际复验，完整旅程尚未通过。当前独立验收统计仍为194项通过、11项未执行、1项失败、11项阻塞。整体生产验收未闭环。

## 通知与键盘专项复验解耦

- 无账号表单探针的真实浏览器有序对照及服务端有限计数确认：相同表单下，no-referrer策略对应Origin为空并被严格校验拒绝；same-origin策略对应同源Origin并被接受。浏览器仍未显示JSON结果，因此客户端显示错误不等于请求未送达。该结论只覆盖探针，原支持授权链仍待真实复验，不据此关闭F52或放宽CSP。
- 为避免支持前置阻塞客户端修复验收，已准备并独审一套仅含普通主持人和加入者的隔离专项环境。15项保护回归通过，正式源码与完整后台运行器一致；独立QA及交叉审查通过后已交正常Web/App界面执行。无支持账号、角色、模拟MFA或业务预置，不绕过支持授权；范围仅F50双端通知和F51原生键盘发送。
- 正式测试包沿用已核版本，不重复构建；已有失败环境保留。完整J010仍不满足支持前置，不因专项通过授予完整旅程通过。支持授权页仅计划在新副本修正已证实的响应策略，保留严格Origin、nonce及生产OAuth校验，后续仍须正常浏览器链验证。整体生产验收未闭环。

## B30 通知与聊天键盘实际关闭

- 独立QA正式B30已提交并同步：F50双端通知与F51原生聊天键盘定向关闭。正常界面验证通知已读隔离、刷新持久化、重开聊天及上方提示消失后键盘展开仍可发送，两条原生消息均在Web另一成员端实际收到。保留原失败及测试定位错误历史，不以组件测试代替实际操作。
- 当前正式统计194项通过、12项未执行、11项阻塞。完整J010因支持授权前置未满足改为未执行，原失败证据保留；专项关闭不代表完整旅程通过。
- 先前协调提交的完整远端CI已恢复并通过，不把其结果延伸到后续提交。支持授权页的新隔离副本仅修正已证实的表单响应策略，严格Origin、一次性nonce、CSP及生产授权协议保持；交叉审查与独立12项回归通过，正常浏览器支持链仍待QA独核后执行。当前未启动新授权计时，不重用旧失败事务。整体生产验收未闭环。

## Parallel survey testing and bounded authorization diagnostics

- A separate Web questionnaire partial environment now runs independently of the support authorization prerequisite. Formal product sources remain unchanged. Only ordinary H/A/B identities are enabled; there are no elevated roles, seeded business facts, ratings or Admin exports. Owner and independent QA each passed all 16 tests, covering survey submission, edits, reload, account isolation, version conflicts, no meal association and retained failure protection.
- QA has actual normal-interface evidence for submission, editing and reload persistence; separate-account isolation is still being executed. Whole J007 remains NOT_RUN until its original cross-client, eligible meal-rating and same-database Admin CSV assertions are completed.
- A separate authorization diagnostic copy is frozen with 16 owner and 16 independent QA tests passing. Saturating phase counters distinguish consent exceptions, response completion, callback arrival and exchange stages without recording authorization material. Origin, CSP, nonce, timeout and production protocols remain unchanged. No new actual diagnostic transaction has started; F52 stays open.
- Full remote CI for the preceding QA commit was independently confirmed successful. That result is not extended to later commits. Existing environments and failure evidence remain preserved; overall production acceptance is incomplete.

## Scoped authorization closure and AI fixture identity correction

- Independent normal-browser comparison confirmed CSP mediation in the no-account redirect probe. A new isolated consent portal now derives only the current valid transaction's canonical callback and registered exact loopback callback as form targets, rejecting missing, expired, consumed or mismatched transactions. Origin, nonce, PKCE, cancellation and timeout protections remain intact; no production source or real provider policy was changed.
- QA independently passed 21 checks and then completed the actual synthetic support authorization chain, including callback, exchange, exact roles, TEST classification, normal logout, CLI exit and portal drain. F52 is CLOSED_TARGETED_QA for this synthetic environment only. Whole J010 and real identity-provider acceptance are not inferred. The successful same-database environment is retained for the full normal user journey; a matching normally signed native build is ready for QA verification.
- The independent AI fixture run retained its original 20-pass/1-fail startup result. Read-only evidence identified an invalid equality between PID-file startup seconds and PostgreSQL SQL startup time, which can legitimately cross a second boundary. A new fixture binds both observations independently and exactly, retaining PID, instance, directory, port and process-status checks without tolerance. Owner and independent QA each passed 24 checks; F53 is targeted closed while the original failure remains historical evidence.
- The corrected controlled-AI environment is now ready for actual Web paths with ordinary accounts and no seeded business facts. Its fixed synthetic provider, token accounting and local test budget are not real model, price or production budget approval. Full cross-client and Admin assertions remain pending. Overall production acceptance is incomplete.

## F54 replacement error visibility

- Actual QA found that a rejected AI draft replacement left its confirmation open while the rate-limit error appeared only behind that modal. The original editor text stayed intact; the rate limit itself was valid.
- The assistant now passes its existing error to the confirmation component's existing error slot. No quota, request, transfer, cancellation or editor-write behavior changes. Two regressions first failed on the missing active-dialog alert, then passed for rate-limit and stale-target rejection, including Keep restoring access to unchanged original text and no business submission.
- The complete assistant suite passed 31 tests, all Web tests passed 277, and core checks, Web type checks and production build passed. Independent read-only review found no blocker. Actual QA replay on the formal new source remains required; F54 is not closed by these checks.

## Mail receipt concurrency regression synchronization

- The latest remote regression retained one failure in the mail receipt lock test: its old sender updated one row where the test expected zero. The preceding verification runs passed. Observing the receipt waiting for an outbox lock did not establish that it would own that lock before the sender resumed; this failure alone does not demonstrate a production claim-fencing defect.
- The test now blocks the receipt on its mapping row after it has acquired the outbox lock, then confirms through the sender's own PostgreSQL backend that the receipt blocks that sender. Releasing the barrier verifies receipt success, zero stale-claim updates and preserved SENT evidence. Both started requests settle before their connections are released. No production behavior or final native package changes.
- Independent read-only review confirmed that this establishes the intended ordering without weakening the assertions. The mail suite passed 18 tests and the complete API suite passed 203 tests; core checks passed. Unified environment authorization and clock-phase validation continues separately; full acceptance remains incomplete.

## Final unified local acceptance environment

- The formal product archive is unchanged from the F54 fix. All 1,651 tracked source entries and 70 executable fixture files were verified against the frozen manifests. The owner, coordinator and independent QA each passed the same 54 tests with no failures or skips; final read-only review closed the latest-classification and active-account checks. The latest mail concurrency test commit also passed complete remote CI.
- The unified environment includes the full worker, one API and one controlled assistant lifecycle, normal synthetic staff/support prerequisites, same-origin Admin, and ordinary user flows without seeded meal, application or feedback facts. Later support login uses a fresh normal CLI authorization. Temporary case grants require exact out-of-band approval; deadlines, lost acknowledgements and revocation failures close access. A previously admitted legitimate request may commit after expiry; its real result and confirmed cleanup are reported separately. This is test orchestration, not a new production grant issuer or production TTL guarantee.
- After independent acceptance, one new isolated environment was started and handed to QA. Normal staff setup reached self-classification; the support browser authorization and both final logout/drain prerequisites remain ahead of ordinary business testing. The matching signed native candidate is independently verified. No real provider calls, mail delivery, remote deletion or deployment were performed.
- QA also completed the previous AI environment's deadline rejection slice: normal seat withdrawal preserved group membership, the other account's draft survived reload, and submission after automatic insufficient-members cancellation was rejected with unchanged business facts. This proves the cancellation branch, not a separate OPEN-to-CLOSED assertion. Full remaining journeys and overall production acceptance remain incomplete.

## F55 completed external reservation attestation

- Actual native QA found that Costs and Review described a future promise to reserve, while publication recorded the host's completed booking declaration and displayed the restaurant as booked. This contradicted the frozen MVP contract; it is a current-version defect, separate from next-version UX work.
- The native checkbox and Review now share an explicit completed-reservation statement naming the restaurant, total people, date and London time, with a clear distinction between the host's confirmation and verification by Fancy. The existing missing-confirmation error uses the same completed-booking meaning. Validation, user-controlled consent, dependent resets, API and business payloads are unchanged.
- Five new component regressions first failed, then passed for the declaration, the unchecked gate, and reconfirmation after restaurant, date, time or capacity changes. Review also asserts the completed declaration. Targeted tests passed 28 cases; all 346 native tests, type checks, lint, coordinator core checks and read-only review passed. An earlier malformed test command discovered zero tests and is retained as a setup failure, not counted as validation.
- A matching new signed client and actual QA replay are still required. Existing meals, API, database and clock are preserved; old declarations are not silently rewritten. F55 remains open until independent formal-package verification.
