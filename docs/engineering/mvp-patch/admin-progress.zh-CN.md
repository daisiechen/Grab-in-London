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
3. **边界说明，请Codex确认**：`packages/db/src/schema/index.ts`追加的1行export是0026的Drizzle一致性要求（否则`migrate.db.test`失败）；`contracts.unit.test.ts`在“额外已审operation”列表中追加了`getStatisticsRefresh`、`retryStatisticsRefresh`两项。二者都是本切片最小必需改动。若需由原owner执行，可以单独revert这两处，交对方重做。
4. **P03依赖**：Unknown状态的“只查原意图”需要通用`GET /me/command-receipts/{operation}/{key}`返回已封存的`classifyUser`响应（其中带有statisticsRefresh）。未交付前，后台UI不自造第二套回执，Unknown只保留原intent并禁止重写。
5. **隐私保留**：两张新表保存user_id/revision，归类与`account_classifications`相同（删除流程不清除分类历史）。若隐私负责人要求删除时清除，需要在deletion handler（worker，客户端会话持有）中追加处理。
6. **运行环境**：本切片不要求重启rig。下一片做浏览器验证前，需要Codex按owner PID重启API（使0026迁移和新路由生效）。

## 后续切片计划（每片≤5文件）

- P09c：`ClassificationPanel`状态机（Unknown/Accepted/Pending/Failed/Ready）、冻结原payload/revision、切换用户或账号时拒绝迟到响应；`admin-api.ts`增加refresh读取/重试；纯组件测试。必须在生成回传后进行。
- P10a：console数据缓存key增加account/role/privacyEpoch/snapshot/filter/locale；Pending/Failed时隐藏旧统计、下钻和导出；locale切换不重置查询。
- P10b：410统一清除cache/selection/drawer/export ticket；401/403清除私密缓存并回到原route/query；429遵循绝对Retry-After，503保留appliedQuery。
- P10c：导出生成和下载时重验role/epoch，捕获snapshot/filter，不自动换快照；coverage本人优先、host补缺的手算fixture。
- 最后：四档浏览器、双语、焦点/键盘，以及A01–A13自测证据，交Codex独立验收。
