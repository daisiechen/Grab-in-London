# MVP 与 AI 测试计划及覆盖矩阵

本轮交付为**测试设计**，不是业务验收报告。输入基线为 `4659fdb3b5e4779157ac45058cbf5134aea1b4d2`：主PRD v0.8/AI增补0.2、后台PRD v1.4/采集契约v4、现有双端Demo及共同认可技术包。资源补充输入为`0dfd0c8`的[tasks/mvp-coordination.md](../../tasks/mvp-coordination.md)：DeepSeek、人民币50/月及自测后交接。JSON的decisionOverrides单独固定此来源，不改写旧技术快照。研发会话可继续推进，执行测试前须记录实际被测commit并复核与本基线的差异，不能把固定快照描述为当前实现进度。

入口：[可读用例](test-cases.zh-CN.md)、[结构化真源](test-cases.json)、[协作与差异登记](collaboration-and-gaps.zh-CN.md)。全部业务用例尚未执行；一条待澄清边界标为BLOCKED，其余NOT_RUN。所有已有场景/任务有用例关联，不等于每个需求断言均已证明正确或生产功能已完成。

## 1. 测试对象与权威

- [主PRD](../product/PRD.zh-CN.md)§0、FR-01—13；交易参考以§0范围映射裁剪。
- [后台PRD](../product/admin/PRD.zh-CN.md)与[指标采集契约](../product/admin/measurement-contract.zh-CN.md)。
- [Demo说明](../../demo/README.md)、[用户端交互契约](../../demo/UX-CONTRACT.md)、[后台交互契约](../../admin/UX-CONTRACT.md)及关键源码/既有测试。
- [核心方案](../engineering/core-development-plan.zh-CN.md)、[数据契约](../engineering/data-and-command-contract.zh-CN.md)、[接口契约](../engineering/api-and-client-contract.zh-CN.md)、[AI方案](../engineering/ai-development-plan.zh-CN.md)、[验证与发布](../engineering/validation-and-release.zh-CN.md)、[认可清单](../engineering/review-manifest.json)。

最新明确决定优先，P-02通知/P-03 DST/P-04软硬条件/P-05 host声明见核心方案§1。原PRD和Demo尚未回填的差异单列，QA不代改原产物。用例源文件SHA256保存在JSON，按Git基线内容校验，后续任务状态正常演进不会被当成测试计划伪造。

## 2. 层级、优先级与执行条件

| stage | 范围 | 证据与限制 |
| --- | --- | --- |
| demo | 现有页面及本地纯函数 | 仅证明模拟状态；虚构身份/内存/固定时钟；不证明后端或真实集成 |
| implementation | 后续API/DB/领域/跨端 | 依赖对应T/A任务；Postgres17双连接与barrier、真实鉴权代码、服务端时钟；不可用SQLite/随机sleep替代 |
| external | 9项真实门槛 | 负责人批准并提供隔离配置后执行；真收件箱、模型、设备、供应商设置、费用及恢复证据；Mock不关闭门槛 |
| review | 代码/配置审查 | 指定commit/diff与检查工具结果；代码阅读不能证明运行结果 |

P0：权限/隐私/超售/错误业务终态/跨端核心路径/成本硬闸；P1：常规功能和边界；P2：低影响表述及可维护性。用例优先级是测试风险排序，缺陷严重程度和修复排期另议。

统一fixture见JSON：角色H/A/B/C/D，日期London 2026-10-23 18:00（UTC17:00），截止UTC16:00，计划结束UTC19:00，默认minimum3/capacity4，含host。每个用例独立初始化；跨DST用显式UTC/墙钟/偏移，不依赖机器本地时区。声明仅一名guest的正常完成路径需将minimum设2或补齐另一guest，避免fixture在截止自动取消。

## 3. 功能完整度覆盖

| 需求/能力 | 用例组 | 既有资产可复用 | 后续必须补的执行证据 |
| --- | --- | --- | --- |
| FR-11登录/回流、FR-02资料 | AUTH / INPUT / API | domain.test.ts、现有认证入口 | T03—05/T24真实身份、字段投影、会话/关联、不同角色直调API |
| FR-01发现/FR-03详情 | DISCOVERY / TIME / API | domain、comments、地图选店测试 | T06—08/T31—32，纯读投影、分页、未知值、真实Places |
| FR-04申请审核/FR-05创建 | CREATE / INPUT / DB / TIME | readiness、restaurant-picker | T07—11/T25，双连接席位/时钟、轮次、安排锁与历史 |
| FR-06/07/08交易章节 | 首期外订/到店付由CREATE/DB/NOTIFY覆盖 | 旧支付退款领域测试仅保留完整Demo参考 | 平台预约/订金/退款非首期；不以未实现此项判首期缺功能；生产不得导入模拟交易 |
| FR-09 Inbox/群/私聊 | CHAT / JOURNEY | domain/readiness/browser | T12/T15/T26/T30，区间union、游标、撤回与并发授权 |
| FR-10饭后/评价/再约 | POST / CHAT / METRIC | postMeal、readiness | T13—15/T18，窗口、双盲、公评资格纠错传播 |
| FR-12设置/问卷/支持/删除 | SURVEY / PRIVACY / API | readiness、comments | T16/T18—19，真实receipt、同步撤权、删除重放与恢复 |
| FR-13 AC-AI01—04 | AI-001—012及AI-046—049 | assistant确定性测试只作参考 | A04/A08查询、排序、澄清、事实及真实样本 |
| FR-13 AC-AI05—09/13 | AI-013—023、JOURNEY、CODE | assistant草稿/面板测试 | A04—07，最小DTO、转入冲突、三阶段权限、spy无业务写 |
| FR-13 AC-AI10—12/14 | AI-024—034 | assistant TTL/偏好测试 | A01—02/A06—07，CAS、epoch、跨端与RAM清理 |
| FR-13 AC-AI12/15 | AI-035—045 / GATE | 当前无真实模型费用证据 | A03/A08—09，并发配额、预算、UNKNOWN、60样本评测 |
| 后台AC-01—13 | ADMIN / METRIC / API / PRIVACY | analytics.test.ts、dashboard.spec.ts | T20—23，统一快照/导出、角色、错误恢复/响应竞态、390px键盘 |
| 后台AC-14—16 | METRIC / POST / SURVEY / PRIVACY | 现有采集/问卷纯函数 | 两场独立手算、完整历史版本/接收时间、真实管道、独立问卷/评分 |
| 全部技术任务 | CODE / GATE / 各场景关联 | 现有Python文档检查 | T00—T32/A00—A09均有关联；关联代表测试责任，非已完成证明 |

每个JSON用例记录需求、原S/AI-S编号、任务、前置、步骤、预期、方法、层级、状态、证据。继承场景映射是主题追溯，不代表该组任意一条用例足以关闭整条S场景；必须审查其所有断言及相应细分用例。

## 4. 用户路径与回归顺序

JOURNEY提供12条跨端路径：加入者、主持者、退席/退群/重入、互选撤回、AI申请、AI创建/群草稿、问卷与评分、异常回流、举报删除、截止通知、支持纠错、后台分类。正常路径确保达到minimum后才跨截止；异常用例故意不足时另建场次。每条Web/iOS交换H/A角色，第三账号验证不可见数据；不能用单页面截图代替跨用户业务闭环。

建议按开发依赖执行：基础schema/迁移/鉴权 → 创建发现 → 申请并发与生命周期 → 群/私聊 → 饭后/问卷/支持删除 → 指标快照 → AI编排/生命周期/成本 → 双端真实联调与9门槛。改动后先跑原缺陷最小复现，再跑受影响组及核心路径；不无变化重复全套。

现有命令（在各目录）：根目录`python3 -m unittest discover -s tests -v`；demo的`npm run test:domain`、`npm run check:runtime`、`npm run test:sites`、`npm run test:runtime`、`npm run build`；admin的`npm test`、`npm run test:e2e`、`npm run build`。先检查package.json和测试服务版本，不假定PATH已有Node或浏览器。真实服务命令按实施阶段package.json落实；设计文档中未来pnpm命令不代表已经存在。

本轮测试资料校验：`python3 scripts/validate-qa-cases.py`；生成目录：`python3 scripts/render-qa-cases.py`。它们只检查用例结构、可追溯覆盖、基线哈希和展示一致性，不执行产品。

## 5. 执行记录与准入

计划与实际执行报告分离。执行者在新报告逐case记录PASS/FAIL/BLOCKED/NOT_RUN/N/A、实际结果、testedCommit、源版本、环境/设备/浏览器、时间、命令及退出码、截图/trace/SQL/日志位置、问题编号及复验结果。BLOCKED/N/A需原因；PASS/FAIL需证据。可使用JSON evidence字段格式，但不要把本次未执行设计包批量改为PASS。

跨边界用例每个变体独立记录结果；多步骤路径任一关键断言失败则整体失败。合成数据评测允许保存固定输入/实际输出，生产原文/凭据不得进公开仓库。代码静态通过、模拟行为通过、真实集成通过、用户发布授权分别记录。

完整发布需所有适用P0通过、剩余P1风险获明确处置、9项真实门槛闭合、无未解释跳过/不稳定结果、全部核心与AI联调证据齐备；本轮没有执行这些业务验收，也不关闭任何外部门槛。
