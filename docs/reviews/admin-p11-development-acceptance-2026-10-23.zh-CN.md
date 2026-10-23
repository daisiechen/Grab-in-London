# P1.1 PATCH-006 管理后台开发与本地验收

日期：2026-10-23。结论：**管理后台 PATCH-006 开发、自测及受控本地验收通过**。这份结论覆盖后台五页、分类原意图恢复、统计关联、查询/下钻/导出及本地测试环境；不覆盖客户端其余补丁、真实供应商、设备验收或发布批准。

用户在 Claude 到限后明确授权本后台会话接手剩余实现。原冻结父基线为 `2e33ca2bbdc838c85a36d2e3bbd9b5fe216478ae`，产品版本 P1.1，方案哈希仍为 `98dece0066dc75621d98f8484b1ae40167bdc10aece3e52bce1bb1c4e458c697`。PRD、Demo、Figma未由本轮改写。封存 QA 的 202 PASS / 4 NOT_RUN / 11 BLOCKED 及既有真实验收门槛保持原状，releaseApproved 仍为 false。

## 1. 固定实现与职责

- `63b088e`、`f3b0e0b`：0026迁移、Drizzle镜像、逐用户密封分类输入、独立统计刷新job。
- `ea5a2e2`、`2d7647f`、`b111c4c`：分类接受回执、统计读取/重试、按原actor/key/target/revision找回同一job、HTTP丢响应恢复测试。
- `db36f76`、`d8e2b4a`、`c849ac7`：串行取回统一生成、worker接线及P03安全NONE语义。生成和worker/main原owner为客户端；本后台没有并行重生成。
- `7cdff18`、`e0e1b34`、`ff6901a`、`6a13583`：冻结意图状态机、SDK适配、只读轮询及真实面板。
- `01baf59`、`168839c`、`b91b486`：导出迟到保护、按最新回执截止时间轮询、503同查询重试、429等待。
- `02338fd`、`af14b58`、`85a24c3`：Ready必须与所选有效快照一致并覆盖全部接受意图，不能通过Dismiss显示旧统计。
- `844e532`、`9b24880`：默认按实际日期倒序、coverage手算回归。
- `3147fd9`：分类表单账号/目标/卸载代际保护，迟到保存不清除后编辑草稿；当前版本更新为实际接受revision。
- `04f1cd2`：客户端交接的共享London投影精度修复，UTC与wall统一分钟精度，保留instant秒毫秒。独立提交已交回客户端，time.ts临时写锁归还；这不替代分享功能验收。
- `1f7cff4`、`efc2308`、`048e6e3`、`7027aff`：干净源码固定构建、同源一次性测试故障/延迟、专用正常停止信号。

后台独占范围为 apps/admin、apps/api/src/admin、admin DTO/operations、admin-statistics schema、0026及本验收环境。schema/index单行export锁已归还；用户端0027起、双端UI与共享生成物仍按客户端owner串行交接。P13–P16服务端扩展不在本报告的通过范围。

## 2. A01–A13 验收矩阵

| ID | 结果 | 实际证据与范围 |
|---|---|---|
| A01 原意图恢复 | PASS | 真实API提交已落库后丢弃代理响应；浏览器进入Unknown且仅查原key，恢复同一job至Ready；分类/audit/job各1行。NONE不自动重发由纯状态、组件与HTTP测试覆盖。 |
| A02 冻结与迟到隔离 | PASS | 真实浏览器延迟读取时切目标，旧结果不回填；延迟提交时后编辑Staff/新原因，DB仍保存冻结Test/原原因，返回后新草稿保留。账号切换与错key/target迟到事件由状态机回归覆盖。两项原表单缺陷均先红后绿。 |
| A03 统计失败只重试统计 | PASS | 合成DB暂时拒绝snapshot INSERT，真实worker产生FAILED/SNAPSHOT_FAILED；浏览器保留分类accepted并隐藏旧数据；移除测试触发器后只点统计重试，分类/audit/job仍各2行，两个job收敛同一Ready快照。触发器和函数均已撤销。 |
| A04 逐用户revision绑定 | PASS | 0026输入表、API/DB并发用例验证同user接受或更晚revision；其他user更大revision不能冒充纳入；原actor/key/target/revision错配不返回job。 |
| A05 Ready整页绑定 | PASS | Pending/Failed和Ready尚未切换都隐藏旧页面/明细/导出；显式选中含接受revision的有效快照后解锁。真实coverage依次64/80→48/64→32/48；多target最终指向同一snapshot。 |
| A06 410撤销 | PASS | 已打开Meal明细时撤销当前合成snapshot，下一次下钻返回410；drawer关闭、内容清空、Export禁用、URL清选择，picker撤销项disabled。API回归证明旧ticket下载继续410，不能回退旧字节。 |
| A07 导出 | PASS | 真实CSV的snapshotId、canonicalFilterHash、过滤条件与页面一致，coverage48/64，不包含原分类原因。API/unit覆盖创建及下载时角色/MFA/隐私epoch复核、期限、脱敏、防公式注入与no-store。 |
| A08 失败恢复 | PASS | 浏览器一次503后保持原URL/查询重试；429初始禁用、截止后可读；真实暂撤合成角色后403清内容/导出，恢复角色后重试回原route/query。401/reauth分支由API/组件回归覆盖，不声称真实身份供应商通过。 |
| A09 coverage | PASS | 16餐×5人固定输入：SELF优先、HOST补缺、冲突以SELF为准，48present/16absent/16unknown，64/80。排除测试参与者后的48/64、32/48均与手算一致；零分母/缺失源回归通过，ProductSurvey保持独立。 |
| A10 四档/双语 | PASS | 1440/1024/864/390 document宽度均等于viewport；长表容器overflow:auto，窄档表格约986px而容器分别732/696/324px。语言切换保留URL、已提交soho搜索及startsAt排序，未重置过滤。布局截图来自1f7cff4；最终CSS哈希相同，之后仅表单恢复逻辑变化，无响应式样式变化。 |
| A11 键盘/确认 | PASS | 真实明细初始焦点Close details，Escape关闭后回初始View按钮；409显示最新Staff/rev2，键盘Reload后显式新保存可提交。组件进一步断言新PUT使用最新If-Match与不同key；并非重放旧保存。嵌套返回由已有组件回归覆盖。 |
| A12 既有能力回归 | PASS | 五页、筛选/分页/字典/权限/导出及统计全部适用admin回归82项；实际饭局17日至12日、下一页11日至6日无重复。后台API/DB/unit102项。共享时间依赖28项。没有把客户端历史未测旅程改为PASS。 |
| A13 环境与构建 | PASS | 专属checkout/branch/依赖/PG/temp/origin，provider均synthetic或disabled。built入口要求源码干净，构建前后HEAD/dirty不变；源码与产物摘要见下节。SIGUSR2正常关闭集成测试退出0、两端口关闭、manifest写APP_STOPPED_PG_PRESERVED，PG保留。运行实例交付时重新启动。 |

## 3. 可重现验证

以下命令均在后台独立工作树，Node24/pnpm11.25.0、已确认PG17二进制。测试不接受继承的数据库/凭据/QA时钟。各组可能重叠，**不相加为唯一测试总数**。

- `pnpm core:check`：完整typecheck、生成一致性、lint、secret scan通过；最终执行源码包含共享时间修复。
- 独立 `--project admin apps/admin/src/`：13文件82项通过。
- 独立 admin API、迁移、worker runtime、seed、guard的 api/db/unit组：22文件102项通过。首次因系统共享内存ID额度导致PG未启动，未当作业务失败；仅停止本会话已退役且owner marker/PID/dataDir一致的PG（数据保留），重跑通过。
- time6＋meals API18＋lifecycle4：28项通过，5个非零秒毫秒投影原实现全红；修复后BST/GMT/DST折返与跨日正确。
- `--config infra/admin-patch/acceptance.config.mjs`：原迟到CSV与首个PENDING等待2项通过，断言未放宽。
- 隔离故障控制6项、环境guard11项通过；独立runtime及acceptance tsconfig、相关eslint通过。
- 项目Python回归94项通过；新增报告/索引交付前再次执行文档校验。

实际执行入口：

```sh
# 使用已安装Node/pnpm，PG_BIN必须是经确认的PG17 bin目录。
env -i HOME="$HOME" PATH="$PATH" ADMIN_PATCH_PG_BIN="$PG_BIN" node infra/admin-patch/launch.mjs --built
env -i HOME="$HOME" PATH="$PATH" ADMIN_PATCH_PG_BIN="$PG_BIN" node infra/admin-patch/launch.mjs --test --project admin
env -i HOME="$HOME" PATH="$PATH" ADMIN_PATCH_PG_BIN="$PG_BIN" node infra/admin-patch/launch.mjs --test --config infra/admin-patch/acceptance.config.mjs
```

前端 `http://p11-admin.localhost:64275`，API loopback64276。测试身份入口 `/fixture-login.html` 明确标记synthetic，只存在本rig的ignored构建；故障控制必须同源POST，只影响下一次指定请求，普通后台没有测试开关。无真实邮件、OAuth/MFA、Places、AI或push供应商调用。

运行manifest在本工作树 `dist/admin-patch/run-*/manifest.json`（ignored，私有路径/owner信息不进公开Git）。以当前进程/CWD/端口及manifest共同核验活性；历史RUNNING字段不能替代活进程。停止时先核验PID/CWD/端口，再向该PID发送SIGUSR2；这会正常关闭应用、写停止状态并保留PG。若需停止保留PG，另核对其owner marker与postmaster PID/dataDir后使用对应pg_ctl。

固定浏览器执行代码 `048e6e3`，后续执行代码 `7027aff`仅增加rig停止协议；前端业务产物一致：JS SHA256 `9c045041a107f29b25ba4c60e0e4a2220bad9058d057eb0e7058906b96810a00`，CSS SHA256 `ff96821e47abf773756a6f813c3de589cc82778078e048df523e84274c6633ed`。交付运行会包含后续纯文档提交，业务/环境源码差异应为空，具体HEAD以新manifest为准。

## 4. 审阅证据

截图全部来自合成账号和合成饭局，无真实个人信息。四档已逐张检查。

- [1440px](../qa/evidence/2026-10-23/admin-p11/responsive-1440.jpg)
- [1024px](../qa/evidence/2026-10-23/admin-p11/responsive-1024.jpg)
- [864px](../qa/evidence/2026-10-23/admin-p11/responsive-864.jpg)
- [390px](../qa/evidence/2026-10-23/admin-p11/responsive-390.jpg)
- [后编辑草稿与接受版本](../qa/evidence/2026-10-23/admin-p11/late-draft-preserved.jpg)
- [统计失败重试后的32/48](../qa/evidence/2026-10-23/admin-p11/statistics-retry-recovered.jpg)

详细过程与历史缺陷关闭条件在[开发进度](../engineering/mvp-patch/admin-progress.zh-CN.md)及[执行/验收交接](../engineering/mvp-patch/claude-admin-handoff.zh-CN.md)。本报告取代这些历史记录中“P09等待生成/P10未实施”的当前状态，不抹除历史。

## 5. 交付边界

本地合成实施与开发验收完成，不代表真实服务/生产发布通过。没有执行部署、DNS、真实provider配置、原生安装或更改封存QA环境。P13–P16服务端新增承接若获用户确认，按新的共享owner、迁移及生成锁继续；不能把PATCH-006通过扩展为整个P1.1客户端/服务端通过。原有真实供应商、设备、性能/成本/发布门槛仍需各自证据和批准。
