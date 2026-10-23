# PATCH-006 后台开发进度（Claude Code）

分支`codex/admin-patch-p11`，managed worktree `admin-patch-p11`。本文件只记录后台业务开发与自测；独立验收、真实服务和发布门槛由Codex另行关闭。A01–A13未经Codex独立执行前均不是PASS。

## 2026-10-23 首片：P09 统计刷新关联（源码已交，待统一生成）

起点`7dd417b`（与远端一致，工作区干净）。共3个提交，均已push并fetch核对远端：

| 提交 | 切片 | 文件 |
| --- | --- | --- |
| `63b088e` | P09a-DB | `packages/db/migrations/0026_admin_statistics_refresh.sql`、`packages/db/src/schema/admin-statistics.ts`（新Drizzle镜像）、`packages/db/src/schema/index.ts`（仅追加1行export，见边界说明） |
| `f3b0e0b` | P09a-API | `apps/api/src/admin/snapshots.ts`、`apps/api/src/admin/statistics-refresh.ts`、`apps/api/src/admin/statistics-refresh.api.test.ts` |
| `ea5a2e2` | P09b-契约/路由 | `packages/contracts/src/admin-dto.ts`（新）、`packages/contracts/src/operations/operations-admin.ts`、`apps/api/src/admin/routes.ts`、`apps/api/src/admin/statistics-refresh-routes.api.test.ts`、`packages/contracts/src/contracts.unit.test.ts`（列表追加2个operationId，见边界说明） |

### 已核实的差异与实现

- 现状缺陷：`classification_revision_seq`是全局序列，快照`classification_revision`取全局最大值。较小revision可能晚于较大revision提交，所以“快照revision ≥ 接受revision”不能证明该user已封入。
- 0026新增`analytics_snapshot_classification_inputs`。封存事务逐user写入它实际读到的revision和分类（含被排除的test/staff）。该表只追加，外键为(user_id,revision)。
- 0026新增`admin_statistics_refreshes`，绑定actor+原Idempotency-Key（唯一）、请求id、targetUserId和该user的acceptedRevision（复合外键防止跨用户revision），状态为PENDING/READY/FAILED。READY与snapshot_id、FAILED与failure_code各自由约束成对保证。
- Ready判定：同一target user的封存输入revision≥acceptedRevision，且快照未撤销、privacy epoch为当前值。绑定最新有效快照，不比较不同用户的revision。快照撤销或epoch变化时，Ready重新回到pending，不返回失效snapshot。
- `classifyUser`在同一事务内创建refresh，响应改为`ClassificationAccepted`（原字段保留＋`statisticsRefresh`）。该响应随原意图回执封存，重放时逐字一致。
- 新端点`GET /admin/statistics-refresh/{refreshId}`：data_admin，仅原actor可读，其他人一律404。
- 新端点`POST /admin/statistics-refresh/{refreshId}/retry`：data_admin，使用Idempotency-Key，事务内复核角色。只把FAILED重开为pending，Ready/Pending原样返回，零分类写入。
- `statisticsRefreshTick(pool, seal)`（独立模块）：有pending时封存一次快照。封存失败只将本次涉及的refresh标为`SNAPSHOT_FAILED`。封存成功但仍看不到未提交revision时继续pending，最多3次后标为`NOT_INCORPORATED`。分类不会被回滚。

### 自测（均通过隔离入口`infra/admin-patch/launch.mjs --test`，新owned PG）

- `--project api apps/api/src/admin/`：11个文件、38项通过；新增12项。覆盖：A04跨用户更大revision不误判Ready；A03统计失败与重试零分类及审计写入；原actor隔离、analyst 403、撤权后重试403；409失败方不产生refresh；重放回执一致；撤销/epoch回退；NOT_INCORPORATED；跨用户revision外键拒绝。
- `--project api --project db`（admin、deletion、worker、db）：24个文件、95项通过，含Drizzle列一致性检查与worker runtime。
- `pnpm -r typecheck`：仅`packages/client`的`src/http.ts`报错，原因是生成产物尚未包含新operation。在本地试生成后，typecheck 0错误，contracts/client/admin unit 9个文件、109项通过。试生成产物已`git restore`，未提交。
- eslint（admin API、db schema、contracts src）通过；`git diff --check`通过。
- 未运行：完整`pnpm core:check`（必然因生成门槛失败）、浏览器、四档布局、真实rig重启。API/worker运行进程仍为旧源码。

### 交接与阻塞（非完成）

1. **统一生成**：请原客户端会话cherry-pick `ea5a2e2`（依赖`63b088e`、`f3b0e0b`），再运行`pnpm --filter @fancy/contracts generate`，回传`packages/contracts/generated/openapi.json`与`packages/client/src/generated/operations.ts`的生成commit。生成前`check:generated`、client typecheck、`core:check`失败属预期。
2. **worker接入片段**（worker main归客户端会话，请串行集成到`apps/worker/src/main.ts`）：

   ```ts
   import {statisticsRefreshTick} from '../../api/src/admin/statistics-refresh.ts';
   // tick() 内，runner/mail 之后、每小时封存分支之前：
   const {rows:[coverage]}=await pool.query<{started_at:Date}>(`SELECT started_at FROM analytics_delivery_coverage WHERE id=1`);
   if(coverage){
    const declared=config.analyticsCoverageStart?new Date(config.analyticsCoverageStart):null;
    const start=declared&&declared>coverage.started_at?declared:coverage.started_at;
    const refresh=await statisticsRefreshTick(pool,()=>sealSourceSnapshot(pool,start,{verifiedDiscovery:!!declared,clientTelemetry:!!declared}));
    if(refresh.sealed)lastSnapshot=Date.now();
   }
   ```

   接入后应补worker runtime测试：有pending时封存一次，并在同一tick将其置为ready。
3. **边界说明（已由两方Codex锁定，见下节）**：`packages/db/src/schema/index.ts`追加的1行export是0026的Drizzle一致性要求（否则`migrate.db.test`失败）；`contracts.unit.test.ts`在“额外已审operation”列表中追加了`getStatisticsRefresh`、`retryStatisticsRefresh`两项。二者都是本切片最小必需改动。若需由原owner执行，可以单独revert这两处，交对方重做。
4. ~~P03依赖：回执返回已封存的classifyUser响应body~~（**已更正**：P03不返回body，该前提不成立，见下节P09-R01修复）。
5. **隐私保留**：两张新表保存user_id/revision，归类与`account_classifications`相同（删除流程不清除分类历史）。若隐私负责人要求删除时清除，需要在deletion handler（worker，客户端会话持有）中追加处理。
6. **运行环境**：本切片不要求重启rig。下一片做浏览器验证前，需要Codex按owner PID重启API（使0026迁移和新路由生效）。

## 后续切片计划（每片≤5文件）

- P09c：`ClassificationPanel`状态机（Unknown/Accepted/Pending/Failed/Ready）、冻结原payload/revision、切换用户或账号时拒绝迟到响应；`admin-api.ts`增加refresh读取/重试；纯组件测试。必须在生成回传后进行。
- P10a：console数据缓存key增加account/role/privacyEpoch/snapshot/filter/locale；Pending/Failed时隐藏旧统计、下钻和导出；locale切换不重置查询。
- P10b：410统一清除cache/selection/drawer/export ticket；401/403清除私密缓存并回到原route/query；429遵循绝对Retry-After，503保留appliedQuery。
- P10c：导出生成和下载时重验role/epoch，捕获snapshot/filter，不自动换快照；coverage本人优先、host补缺的手算fixture。
- 最后：四档浏览器、双语、焦点/键盘，以及A01–A13自测证据，交Codex独立验收。

## 2026-10-23 P09-R01修复：按原意图找回统计refresh

起点为本地`8c6e7e7`（Codex的审查记录）。共3个提交：

| 提交 | 内容 |
| --- | --- |
| `08912e1` | 串行cherry-pick P03固定提交`2e133da48695ca9520e0cf7c1078a483ebf8775d`（源码＋生成产物）。冲突只出现在`docs/README.md`和`contracts.unit.test.ts`的operation列表，已合并。README未纳入`claude-client-handoff.zh-CN.md`链接（本分支无该文件，否则会成为断链）。未读取客户端dirty。 |
| `2d7647f` | 修复：`classifyUser`标记`receipt: true`。新增`findStatisticsRefreshByIntent` `GET /admin/statistics-refresh-intents/{intentKey}/{targetUserId}/{acceptedRevision}`（data_admin＋MFA，仅原actor）。必须与原intent的target及revision一致，不一致、他人key或不存在一律404。不重放classify、不新建job、不返回body。文件：`operations-admin.ts`、`routes.ts`、`statistics-refresh.ts`、`contracts.unit.test.ts`（列表追加）。 |
| `b111c4c` | 单独的HTTP恢复测试`statistics-refresh-recovery.api.test.ts`：classify响应视为丢失→P03回执SUCCEEDED（无body）→用冻结target＋回执`resourceVersion`按原key定位→tick后Ready且refreshId不变。classification/audit/refresh各1行。另actor（回执NONE）、target错配、revision错配、未知key均404；角色撤销后回执与定位均403；查询不产生任何行。 |

更正：P03不返回保存的响应body，所以前文“依赖回执body取得refreshId”的前提不成立，已由上述按原意图找回替代。UI恢复路径为：回执SUCCEEDED→用冻结的targetUserId＋`resourceVersion`调用`findStatisticsRefreshByIntent`。回执NONE时保持未决，不自动重发（客户端helper的NONE问题由客户端修复）。

设计取舍：以query对象传参时，生成后`packages/client/src/http.ts:35`触发TS2590（RequestOf联合类型过于复杂）。经本地对照，去掉该operation即消失；改为仅用路径参数后同样消失。因此采用路径参数，不修改客户端`http.ts`。

自测（隔离入口）：admin＋receipts API 13个文件48项通过；deletion/worker/db 14个文件62项通过；本地试生成后`pnpm -r typecheck` 0错误，contracts/client/admin unit 10个文件115项通过（试生成产物已restore，未提交）；eslint与diff check通过。未运行：完整`core:check`（需统一生成）、浏览器。

共享文件归还：`packages/db/src/schema/index.ts`只在`63b088e`追加了`admin-statistics.ts`这1行export。此后本会话不再修改index，即日归还客户端。`admin-statistics.ts`仍由后台独占。

待统一生成：请客户端在P03基础上cherry-pick `63b088e`、`f3b0e0b`、`ea5a2e2`、`2d7647f`后生成，回传生成commit。生成前`check:generated`、client typecheck失败属预期。

## 2026-10-23 P09c：分类意图恢复状态机（纯逻辑）

`7cdff18`：`apps/admin/src/features/classification/intent.ts`和`intent.unit.test.ts`。这是纯状态，不含I/O；待生成客户端暴露新operation后，再接入`ClassificationPanel`与`admin-api.ts`。

- 每个target user对应一个冻结intent（`Object.freeze`；key与target小写），并绑定当前账号。后续草稿编辑不会改动已冻结的payload或revision。
- 保存时网络错误、503、429、未知错误→unknown(network)；401或重新验证→unknown(reauth)；409进行中→unknown(pending)；409版本冲突→conflict（需reload后显式重新确认）；403、404、422→rejected。unknown下唯一动作是查询回执；同一target的新submit被拒绝。
- 回执SUCCEEDED只有在`resourceId`等于冻结的target且带有revision时才接受，否则保持unknown(read_failed)。NONE保持unknown，不重发；读取失败保持unknown。PENDING按`retryAfterSeconds`等待；过期则转为rejected(expired)，只允许reload。REJECTED版本冲突→conflict。其他operation或key的回执一律忽略。
- Accepted之后只允许定位统计或重试统计（stats为pending时不能再次submit）。统计若属于其他user或revision则拒绝；Ready前`statisticsSettled=false`，供P10隐藏旧统计；未settled的条目不能dismiss。
- 账号切换会清空全部intent，旧账号的迟到saved/failed事件和submit一律丢弃。
- 自测：admin项目7个文件、56项通过（新增13项）。eslint通过。admin `tsc`仅剩`packages/client/src/http.ts`生成滞后错误（属客户端统一生成，生成前预期存在）。本轮未试生成，也未restore共享生成物。

## 2026-10-23 P10盘点（未实施）

| 项 | 现状（代码位置） | 差距 / 计划切片 |
| --- | --- | --- |
| 缓存key | `state/console.tsx`：页面缓存key为`snapshot|page|query`，410/401/403时全部清空 | 缺account/role/privacyEpoch/locale维度；`SnapshotInfo`未暴露privacy epoch，epoch变化目前只能依赖410感知。P10a：key加入account、角色集合与locale；epoch由410或快照列表刷新驱动全清 |
| 统计Pending/Failed | console不知道分类intent | P10a：console接入`statisticsSettled`；未settled时隐藏图表、下钻和导出，显示“统计更新中/失败可重试”，不显示旧图 |
| 410 | console清页面缓存、标记revoked、打开picker、清空URL快照；App在`c.snapshot?.id`变化时关闭全部drawer；导出遇410会清除pendingKey | 基本满足。缺回归测试：drawer内下钻或导出遇410时，drawer关闭、旧下载不可再触发。P10b补测试 |
| 401/403 | `isBlocking`→清缓存、清快照列表、gate失败；drawer因gate隐藏；401重试为`location.reload()`（URL保留route/query） | 满足“回原route/query”。缺：重新授权后旧`details`状态残留（reload后消失）。P10b补测试 |
| 503 | 页面失败时`FailureScreen onRetry=refreshSnapshots` | **缺陷**：重试只刷新快照列表；页面key未变，effect不会重跑，页面数据不会重新请求。P10b：重试对同一appliedQuery重新发起页面请求 |
| 429 | `ApiError.retryAfterSeconds`已解析，但admin未使用；429与503共用文案，可立即重试 | P10b：失败对象携带Retry-After绝对截止时间，按钮在截止前禁用并显示倒计时，不改appliedQuery |
| 导出 | 点击时捕获binding；ticket.snapshotId不一致即报错；下载需服务端重验role/epoch；成功后清key，网络错误时保留key | **缺陷**：网络错误后若binding或scope变化，仍复用旧key并发送不同body→`IDEMPOTENCY_CONFLICT`，被显示为通用失败。P10c：key绑定(scope,snapshot,filters,rows)，变化即作废；ticket无filterHash，前端无法核对filter（服务端以同key对body做哈希保证一致） |
| 焦点/键盘 | `DetailDialog`使用原生`showModal`、Escape经onCancel、关闭后焦点回到触发者、关闭按钮autoFocus | 满足基础要求。缺：409确认、错误提示的焦点移动，以及Esc嵌套返回的浏览器验证（A11），归入最终四档浏览器验收 |
| locale | `lang`为URL状态，与filters分开更新；下钻搜索和排序是组件本地状态，切换语言不会重新挂载 | 预期不会重置。P10a补测试证明，切换locale后query、搜索、排序保持不变 |
| coverage | `metrics.ts`按SELF/HOST来源处理attendance | P10c：用固定输入手算核对“本人优先、host补缺、unknown排除、分母为0” |

下一步：P10a（console缓存key＋统计settled门控，约3个文件＋测试），随后P10b（503重试、429倒计时、410/401测试）、P10c（导出key作废、coverage手算）。P09c的Panel接入等待生成回传。
