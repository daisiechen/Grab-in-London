# Claude Code 后台P1.1开发交接与验收矩阵

2026-10-23。用户授权Claude Code执行PATCH-006业务开发，Codex负责隔离环境、共享文件协调、整体验收。仅本分支`codex/admin-patch-p11`、专属managed worktree `admin-patch-p11`；禁止共享main业务写入。先核CWD/branch/HEAD/dirty，异常只读报告。

## 准入与唯一文件负责人

已审方案[plan](plan.zh-CN.md) SHA256 `98dece0066dc75621d98f8484b1ae40167bdc10aece3e52bce1bb1c4e458c697`，三方独立PASS；产品P1.1，封存父/15原ID/风险见[继承](inheritance.json)。AF01–05方案层关闭，不因历史初评重新阻塞，也不称真实验收完成。

共享owner现已确认，取代拆分前任务表：

- Claude后台：apps/admin/**、apps/api/src/admin/**、packages/contracts/src/operations/operations-admin.ts、后台独立DTO新文件、packages/db/migrations/0026_*、独立统计模块及对应测试；不写公共dto.ts。
- 客户端原会话：通用P03 command receipt协议/基础路由、用户端dto/social、contracts/client共享生成产物、worker main公共入口。后台源码commit交Codex转交原会话cherry-pick生成，生成commit回传后后台集成。禁止双方同时生成；worker新增import/tick精确片段交原会话集成。
- Codex：infra/admin-patch/**环境入口、本交接/验收记录、admin-handoff。Claude不混stage这些文件。业务进度只写admin-progress.zh-CN.md及后台差异表，新增文档维护索引；任务表旧owner不扩大写权。
- 不改PRD、Demo、Figma、apps/web、apps/ios、用户端迁移0027起、root lockfile/共享配置；需要产品变更交原负责人。

## 后台B03实测准入：PASS（仅本地合成实施环境）

本轮已验证独立实体依赖3399条symlink均未越出root；lockfile未改，离线ignore-scripts安装。guard10项负向测试、独立tsconfig、eslint、core:check通过。专属runner在新owned PG运行既有admin.api.test.ts 5项通过，不接受继承FANCY_TEST_DATABASE_URL。

新运行root位于`dist/admin-patch/run-SwUGi9`（ignored，权限受限），manifest在该目录。前端`http://p11-admin.localhost:64275`、API`http://127.0.0.1:64276`，两监听PID52681；新PG在该runtime/tmp下、独立数据库，PID/端口与CWD逐项核对。具体端口/DB以当前manifest为准，不凭历史记录连接。旧试运行进程仅按owner PID停止，旧试运行PG保留，不触封存/客户端PG。

API health ready=200；本会话IAB新tab1先signed_out，再通过`/fixture-login.html`合成管理员登录，进入真实后台quality页并取得新snapshot `520c9a3b-0c98-482b-8e57-a84ce75065b7`；独立库核对users=2、data_admin=1、active合成MFA family=1。仅测试身份/fixture Places/outbox mail，AI disabled，无供应商外呼，无设备。N/A原生构建是后台范围结论，不代签客户端B03。

上项只证明本地后台实施入口隔离，非产品功能或上线验收。manifest含本地路径不进公开Git，不打印cookie/owner/token/secret，不读旧QA钟/控制通道/会话/账本。运行中代码不会因源码变更自动重载API/worker；需重启本rig时先在进度记录说明由Codex按当前owner PID操作，不能批量kill。

## 执行顺序

1. 读主PRD/补丁PRD后台部分、冻结稿映射与当前apps/admin/API/schema，先写后台差异盘点；复用五页，不无关重建。每片超过5文件或跨子系统先细分、列精确文件。
2. P09先独立契约/0026 schema与统计模块；等待P03基础路由交付后适配原意图读取。accepted必须绑定targetUserId+原intent/requestId+该user acceptedRevision；snapshot密封输入逐user包含该接受或更晚revision，不能用global max/最新时间证明。
3. 未知只查询原intent；不以相同当前值或missing receipt判断成功/失败，不换key重写。409区分进行中/payload冲突/版本冲突。Accepted后只重试统计；pending/failed隐藏旧统计、明细、导出。恢复/切用户/换账号的迟到响应按原scope隔离。
4. P10 Ready全页/下钻/导出采用同snapshotId+canonicalFilterHash。410作废该snapshot全部缓存/ticket与已开drawer，403/401清私密缓存并正确恢复；429遵绝对Retry-After、503保appliedQuery。创建和下载均重验role/privacy epoch；下载不能静默换快照。
5. coverage本人明确值优先、host只补本人unknown/缺失；不一致仍按本人，unknown排除，用固定输入手算。四档1440/1024/864/390、双语locale保持查询/搜索/排序、长表内部滚动、键盘焦点与错误恢复。
6. 每片更新进度与证据，验证、对应commit、push、fetch核SHA。源码契约交生成owner阶段可以明确标为待集成，不能声称完整core:check或功能完成；生成集成后所有适用检查必须通过。不要停在计划；存在不依赖P03/生成的授权工作则继续推进，确定接口不凭空造第二套。

## 隔离命令

使用Node24/pnpm11.25.0（路径由已安装runtime确定）；环境必须清空继承secret/DB。PG只指向不可变17二进制，不能读旧PG配置。例（PG_BIN是操作者确认的本机17二进制目录，不是数据库地址）：

```sh
env -i HOME="$HOME" PATH="$PATH" ADMIN_PATCH_PG_BIN="$PG_BIN" node infra/admin-patch/launch.mjs --test --project api apps/api/src/admin/
env -i HOME="$HOME" PATH="$PATH" ADMIN_PATCH_PG_BIN="$PG_BIN" node infra/admin-patch/launch.mjs --test --project unit --project admin
pnpm exec tsc -p infra/admin-patch/tsconfig.json
pnpm core:check
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests
```

新启动rig须Codex核已运行进程/端口后执行`launch.mjs`，不自行复制manifest/复用旧库。测试输出/cache/TMPDIR保留本root的dist/admin-patch专属运行根。

## Codex独立验收矩阵（业务均待执行）

| ID | 必须证明的结果 | 最少证据 |
| --- | --- | --- |
| A01 | unknown仅查询同actor/operation/key，missing保未决；同值不能清原intent | API+组件+真实浏览器断网恢复 |
| A02 | 原payload/revision冻结，后编辑草稿独立，切人/换号拒迟到 | 状态机及浏览器 |
| A03 | 分类accepted后统计失败/重试零新增分类写 | DB分类/audit行数与API |
| A04 | Ready绑定targetUser+原request+该user revision，跨用户更大revision不得误PASS | DB密封输入+API并发测试 |
| A05 | Pending/Failed隐藏旧统计/下钻/导出，Ready同snapshot/filter | 组件+浏览器+API投影 |
| A06 | 410清cache/selection/drawer/export ticket；旧下载持续不可读 | API+浏览器 |
| A07 | 导出生成/下载重验role与privacy epoch，同filter，CSV防公式脱敏no-store | API+unit |
| A08 | 401/403清私密缓存，重鉴权回原route/query；429/503恢复不改appliedQuery | API/组件/浏览器 |
| A09 | coverage本人优先host补缺，冲突/unknown/分母零正确 | 固定fixture手算+unit/API |
| A10 | 四档布局无页级横溢，长表内滚动，locale不重置查询/搜索/排序 | 四档浏览器截图与DOM尺寸 |
| A11 | 弹层/错误/409确认/键盘Escape及焦点恢复 | 浏览器键盘与无障碍树 |
| A12 | 既有五页/筛选/分页/权限及受影响继承旅程回归 | 适用unit/admin/API/build |
| A13 | 最终commit/build/运行源码一致、测试环境可复用且未接触封存环境 | SHA+manifest+进程/DB证据 |

当前业务A01–A13均NOT_RUN，不以入口测试替代。最终必须分别报告开发/自测、独立验收、真实服务/发布门槛，禁止把未测改PASS。

## Codex独立审查P09-R01（待修复，不阻塞其他独立工作）

固定已审P03初版`2e133da48695ca9520e0cf7c1078a483ebf8775d`仅返回脱敏`resourceId`与`resourceVersion`，不返回保存响应body。后台classify响应携带服务端生成的`statisticsRefresh.refreshId`，而目前统计读取只接收refreshId。若classify响应丢失，读原意图即使SUCCEEDED，也无法从该脱敏回执取得原统计job ID；通过当前用户同值猜成功或重放classify取job违反既定Unknown约束。

最小关闭条件：提供受同原actor/data_admin/MFA约束的按原intent key找回同一个统计refresh的后台读取（或等效脱敏关联），返回且验证targetUserId及acceptedRevision；不复制P03、不返回完整body、不创建新job。加入真正HTTP测试：保存响应丢失模拟→原P03回执SUCCEEDED→原intent定位refresh→Ready，分类/audit/job均仅一条；另actor、角色撤销、target错配及不存在intent保持不可误判。请求原始payload/revision与后来编辑稿隔离仍保留。

0026迁移与统计模块固定提交`63b088e`/`f3b0e0b`已由Codex独立复跑：迁移/schema一致性10项与统计关联7项，共17 PASS。统计模块测试不等于上述HTTP恢复路径或worker正式接线通过。现有后台基线19文件96项API/unit/admin通过，不代替增量验收。

共享补充已明确：后台Drizzle文件实际名`packages/db/src/schema/admin-statistics.ts`，`schema/index.ts`临时仅授权增加该export；0026切片交付后明确停止该index写入并归还客户端。后台不得代写生成文件。P03客户端helper的NONE旧意图重发问题由客户端修复，后台先默认NONE保未决，不自动重发。

## Codex验收P10-R01：撤销后迟到CSV仍触发下载（已复现，待修）

固定业务基线`434e80e`，Codex独占`infra/admin-patch/export-revocation.acceptance.test.ts`及`acceptance.config.mjs`，Claude只读运行勿stage。真实ConsoleProvider和ExportButton：开始导出，downloadExport响应在途；另一调用报告410后，console撤销选择且ExportButton已卸载；再放行原CSV，HTMLAnchorElement.click仍执行1次，预期0。用`launch.mjs --test --config infra/admin-patch/acceptance.config.mjs`运行，1项真实业务断言失败，非超时或配置错误。

请在P10修复响应代际/liveness及binding保护：撤销、401/403、账号切换/卸载之后，迟到ticket/CSV不能触发后续下载或成功提示，也不能污染新scope。保留服务端生成与下载时role/privacy epoch检查，不用客户端替代。补ticket在途、CSV在途及正常有效导出对照，不能只隐藏按钮。此测试与配置属Codex文件，请勿修改断言或混stage；业务修复后由Codex复跑。

正式待集成提交：客户端统一生成`9b3a7d0d42cac44a14240e4bd4ecb538b98845da`；worker接线和runtime测试`b683eb0b326ee7e794c1ba3f709fd26676ab75a6`；P03安全NONE helper `48df2cc`（仅intents.ts和其测试，可单独取，不需P06）。由Claude在自己切片安全提交后串行cherry-pick，禁止读取客户端dirty或自行重写生成。客户端独立worker3+恢复HTTP3共6项PASS，仍不替代后台UI验收。

P10-R01复核更新：Claude业务修复`01baf59`落地后，Codex原迟到CSV断言不变独立复跑1/1 PASS；独立验收配置与runtime分别tsc通过、infra eslint通过、文档Python94项通过。此为该缺陷组件层关闭证据；真实浏览器及账号/权限/整页P10验收仍待完成。正式集成后Codex独立worker runtime3+恢复HTTP3=6/6 PASS；P09纯意图状态机13/13 PASS。
