# R1 用户端候选核验（2026-10-19）

状态：实现基线 `e9c90fa` 已由协调会话统一提交并同步 GitHub；Claude 固定 SHA 只读复核通过，未发现开发设计阻塞。最终准入签核由协调会话单独记录；本轮未部署线上。本轮默认R1，`?scope=future`保留早期收费/代订探索。没有接入生产服务，不将当前结果称为原生iOS或真实多人系统完成。

## 文件与范围

- `demo/src/Prototype.tsx`、`prototype.css`：复用品牌/地图/字段/BottomSheet/精灵/移动运行时，增加R1默认流程；future路径保留旧域模型。
- `shared/pilot.ts`、`shared/README.md`：内存领域模型、时间/轮次/权限/投影与研发契约。
- `docs/product/PRD.zh-CN.md`、`product-brief.md`：v0.8正文；FR-01至FR-13唯一，无旧规则附录覆盖正文。
- `demo/tests/pilot.test.ts`、`r1.spec.ts`：领域边界与独立R1 UI脚本；旧assistant/map/post-meal脚本显式归future，截图写本轮独立目录，未改旧历史截图。
- `demo/package.json`、`demo/README.md`、根文档测试：验证入口与引用更新。
- 未修改后台、协调规则、评审报告、竞品研究。新文档`shared/README.md`可由协调会话加入docs索引。

## 已执行证据

| 验证 | 结果/边界 |
| --- | --- |
| `cd demo && npm run test:domain` | 最终82项（含29项R1）；覆盖原future、助手、餐后及新R1。以本轮最终命令输出为准 |
| `cd demo && npm run build` | TypeScript/Vite/Sites打包通过；28个受保护运行时文件完整；约650KB主包有性能warning，未提高阈值掩盖 |
| `cd demo && npm run test:sites` | 6项静态Worker/打包检查通过；不表示已部署 |
| `python3 -m unittest tests.test_prd tests.test_readiness_review` | 10项结构、规则/权威引用、协作边界检查通过；最终全仓 `python3 -m unittest discover -s tests` 39项通过；不是业务充分性证明 |
| `node --test admin/tests/handoff.test.ts` | 最终5项通过，包含**实际projectAnalytics→parseHandoff**与普通虚构人仍在分析分母；后台文件只读 |
| CUA in-app browser | 本地iPhone实际走查如下；非全平台/读屏/原生验收 |
| 全量Playwright | **最终实现基线 `e9c90fa`**：协调会话在全部 F 修正冻结后执行 `PLAYWRIGHT_CHANNEL=chrome pnpm exec playwright test --workers=1 --global-timeout=180000`，**31 passed (1.3m)，exec session 90625，exit 0**。覆盖最终用户端代码，不仅是旧候选或定向复测。初轮历史另有31项多worker4.6m及5项R1定向34.4s正常退出；初轮退出清理延迟已记录，没有修改源码、断言、配置或阈值来规避 |

浏览器已走查：访客→申请前登录→Facebook/Google预览返回原申请；Apple失败/关联冲突可恢复；申请后Inbox待审不可入群；切maya批准→外订声明→切alex群聊发送；餐厅候选先确认→双人创建四步→发布独立mealId；地图Soho标记筛为两场，范围搜索/重置及人数快筛；餐后评分与again空初始校验、多原因保存、切人不继承、回本人恢复；双方互选开私聊，撤回后历史只读；助手当前饭局生成申请草稿，回原编辑器且不自动提交，R1无语音入口。

截图：

- [待审Inbox](inbox-pending.png)、[批准后的群聊](group-confirmed.png)、[双人饭局发布](duo-published.png)。
- [Apple失败提示首屏可见](provider-failure.png)：提示移到登录动作前，出错滚入可见区域并收键盘；截图为稳定后状态。另修复外层device-screen滚动：复用原有screenRef锚定，实际检查scrollTop=0、keyboard data-visible=false，避免隐藏键盘因父容器偏移露出。
- [Soho区域筛选](map-soho.png)、[Pixel发现页](pixel-discovery.png)、[反馈恢复](feedback-restored.png)、[撤回后私聊只读](direct-retracted.png)。

这些截图来自本地虚构数据，阶段性命令前后的小修以最终源码及最终重跑为准。截图不证明服务器权限、真实投递或所有时间边界；对应规则以领域测试补充。

## R01–R22 对应证据及限制

| 发现 | 已补内容 | 仍需复核/真实研发 |
| --- | --- | --- |
| R-01 | PRD§2分期矩阵；R1默认、future独立；四登录、确定性助手 | provider/邮件/iOS均未接入 |
| R-02 | PRD§5；advanceLifecycle/cutoffAt；精确等号、延迟任务/重复tick测试 | 服务端定时任务、可靠事务/outbox |
| R-03 | apply每轮新ID；撤回/退出可重申、拒绝不可；稳定intent/version测试 | 持久幂等记录、冲突恢复网络验收 |
| R-04 | 外订声明人数；关键安排曾确认后锁定；取消新ID重发；host不可leave | UI当前管理可改标题/说明；首次确认前关键安排编辑由契约/领域覆盖，尚未独立编辑页走查 |
| R-05 | withdraw/leave/cancel独立；席位释放、取消与消息冻结；必要通知 | 真邮件及餐厅外部动作无自动调用 |
| R-06 | projectMember访客/登录/block字段投影与测试；PRD权限表 | Demo含全部fixture，不构成生产字段安全 |
| R-07 | 四登录预览、失败/取消/冲突/回意图；18+声明与资料规格；删除/导出模拟 | 真实账号关联、session、通知邮箱补验证、重新认证 |
| R-08 | 最新本人优先，host仅补缺失；来源序列；七天窗口；无operator verify | 生产revision持久化与完整重放 |
| R-09 | valid present控制反馈与DM；present→absent即时禁发/退统计；撤回跨七天 | 已补两个共同饭局双向同意→撤回即清本人全部旧同意→双向禁发/历史保留→对方同意不恢复→窗口内新选择可恢复/窗口外不可；生产需持久化同一规则 |
| R-10 | readableMessages授权区间并集，同毫秒用确认/退出/消息序列；历史只读；block | 服务端消息分页/cursor/限流/推送、真实多会话回流 |
| R-11 | 用户提交case回执；PRD最小处置状态与依据、安全/支持前置 | 用户Demo只received；后台处置由另一会话复核，真实联系/检测待配置 |
| R-12 | 站内应用/审核/过期/声明/群消息通知；PRD完整渠道矩阵 | 邮件/push、重试/偏好/失效深链均是服务要求，未虚称投递 |
| R-13 | actor对象检查与导出字段；管理员allowlist规格 | 后台会话所有；生产授权必须服务端 |
| R-14 | 手动脱敏JSON与不可变asOf交接；解析失败保旧要求 | 后台快照/审计/重算由后台会话复核；非实时连接 |
| R-15 | PRD明确startsAt+24h观察与end+7天封窗不同 | 后台指标用同一输入独立核验 |
| R-16 | 当前发现筛选/地图聚合、Inbox/多轮、helper当前数据；seed分母可手算 | 新建/取消推荐、长历史、匿名事件SDK完整E2E待复核 |
| R-17 | shared schema/CRUD/API/error/version/幂等/私密排除；JSON roundtrip通过 | 无HTTP/DB实现；当前hash非生产抗碰撞摘要 |
| R-18 | 复用受保护手机壳/键盘/滚动；离线503模拟保输入；语义按钮、alert/status | native iOS、全设备、弱网恢复/读屏未验；完整31项Web运行时/交互回归已exit 0；仍不能外推为原生与全设备验收 |
| R-19 | 当前PRD正文重写、唯一FR标识、研发契约引用、追踪表 | 协调会话更新索引与总评审状态；不由此宣告准入 |
| R-20 | 手工venue、budget整数便士、语言代码、London DST解析与测试 | 真实地址/外链验证、库存不在R1 |
| R-21 | 本人导出；确认后删除取消hosting/退出参与/去资料正文/撤互选；保留政策 | 当前模拟重新认证、无真实会话/备份作业；consent是每人内存设置，r1-1 events空 |
| R-22 | 名字/简介/申请长度、人数/预算必填、历史unknown与传输映射 | 正式API需显式typed validation，不依赖当前英文错误归类 |

## 最终核验状态

实现候选已冻结在 `e9c90fa`，由协调会话统一提交并同步 GitHub；全部 F 修正后完整31项浏览器回归 exit 0，Claude 针对该固定 SHA 只读复核通过。最终22项关闭矩阵及准入签核由协调会话维护；本报告提供用户端证据，不将研发前置通过等同生产上线。既有线上站点保持此前版本。


## 独立审查后的边界修订

- F1：取消命令只收host/host_changed/other；拒绝自由文本reason。私密note不入通知；收件人只含host及当前CONFIRMED/PENDING，排除已拒/撤回/退出/过期。专门测试校验收件人集合与私密文本不出现在通知。
- F3/S1：删除账号只取消未开始主持桌、退出未开始参与；已开始桌保持生命周期和开始时成员关系、他人餐后资格，host去标识。测试覆盖host/guest开饭后删除、他人结束后仍可自报、不产生晚到低人数任务。
- S3/S4：apply/publish均要求adult===true；缺失/false拒绝。attendanceStatus只保留present/absent/unknown，反馈不再接受死conflict分支。
- F2/S2：每次pending/continue以人数/时间/命令序列追加历史；再次减员清空当前旧决定字段。开饭未决定保留pending+lowCountUnresolvedAtStart，一次通知、不自动取消、不推定同意，界面只读，不再给不可执行按钮。r1-1仅传原pending和既有startsAt/cancelled/asOf；后台派生pending且未取消且asOf<startsAt才可操作。内部历史不加到白名单；新增实际解析往返测试。
- 全部边界修订已纳入 `e9c90fa`：82项领域测试不变，构建/28文件运行时完整性及适用文档/交接验证通过；协调会话对最终代码完整重跑31项浏览器回归，1.3分钟、exit 0（session 90625）。此结果覆盖 F 修正后的实现，不再以初轮或定向证据代替。

### 最终文件白名单（交协调会话统一原子提交）

```text
demo/README.md
demo/package.json
demo/src/Prototype.tsx
demo/src/prototype.css
demo/tests/assistant.spec.ts
demo/tests/map-prototype.spec.ts
demo/tests/post-meal-scenario.mjs
demo/tests/pilot.test.ts
demo/tests/r1.spec.ts
demo/qa/r1/**
shared/pilot.ts
shared/README.md
docs/product/PRD.zh-CN.md
docs/product/product-brief.md
tests/test_prd.py
tests/test_readiness_review.py
```

`demo/qa/r1/**`仅包含本轮虚构场景报告与截图；旧`qa/map-helper-update/preferences.png`的测试覆盖已恢复为HEAD，不在提交清单。后台文件、总评审/索引、协作规则、竞品研究不属于本会话写入范围。当前用户端新测试直接使用后台handoff解析器；后台测试亦使用shared投影，已由协调会话将互相依赖的候选统一原子提交为 `e9c90fa`，避免中间版本测试断裂。

最终方案：取消代码白名单/必要收件人；删除仅自动取消或退出未开始桌，已开始历史及他人资格保留并去标识；低人数每轮历史追加、当前旧值清空、开饭未决定只读且一次通知；adult严格true；无死conflict类型。最终82项领域、39项Python、5项handoff、build/28文件runtime完整性、6项Sites包装检查通过；全部F修正后的完整31项浏览器回归1.3分钟、exit 0，对应实现基线 `e9c90fa`。实现已由协调会话提交同步；本会话本次仅更新QA证据文字，未自行暂存、提交、推送或发布。
