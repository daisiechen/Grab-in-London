# 核心与真实AI共同设计审查（2026-10-21）

**结论：Codex与Claude Code均认可[manifest](review-manifest.json)列出的10个精确版本，可作为Claude后续核心与真实AI开发的技术基线；本次设计范围没有剩余阻塞。** 该认可不是业务实现、测试验收或发布通过。原PRD/Demo对用户决定的回填仍待原会话，不因本报告改写历史评审结论。

## 1. 基线、职责与实际过程

- 需求基线ce74f803121de64335db318a34f2e7447e3b1c0b（主PRD v0.8/AI增补0.2、后台v1.4、指标契约v4），并入本轮P-01—05用户明确决定。工作区基线97fb772043538f38ef40753c5bee5c5610946677只比需求基线新增QA技能配置，不改变PRD/Demo。
- Codex负责本包文档、任务、索引与内容校验；Claude仅独立只读审查。通过已有可见Claude桌面Code会话「项目配置只读验收」交接，不安装CLI、不伪装另一个Codex子Agent为Claude。原始聊天/认证/个人配置不上传公开仓库。
- Claude先独立提出模块化单体、Postgres、Expo、outbox、区间授权与快照方案；Codex核证并收紧取锁后时钟、有效时间等号、会话序号提交顺序和删除快照逻辑；之后以实际文件进行多轮反向审查。
- 初次核心审查提出C-01—12；修订后提出D-1—5的具体协议补齐。AI需求独立审查发现AI-B01/02，用户实际选择P-04/P-05后进入AI技术设计。完整AI稿提出F-01—07，全部修订并重新核对哈希。
- 2026-10-21 01:40 BST（00:40 UTC），Claude逐项计算10个文件实际SHA256，均与manifest一致，明确回复认可这些精确版本可以指导Claude后续核心与AI开发，且没有剩余阻塞。Codex核对相同文件与用户决定后明确认可。

## 2. 问题关闭记录（设计层，不是代码修复证明）

| ID | 原问题 | 当前设计关闭证据 |
| --- | --- | --- |
| C-01 | 预算/语言/筛选字段不全，菜系饮食无正式来源 | 已关闭：数据契约§5—6、API§6；min/max便士、BCP47、区域、氛围，P-05 host可选声明/unknown/同字典；S09/S31 |
| C-02 | 支持纠错可能覆盖窗口内本人报告 | 已关闭：数据命令/API限制effectiveNow≥end+7d、名单内未取消，S23 |
| C-03 | 账号链接和空壳账户处置缺失 | 已关闭：数据契约§5、API§7：LINK_REQUIRED/双proof/provisional/ACCOUNT_LINK_CONFLICT，不承诺不存在的支持合并 |
| C-04 | 发布入群/生命周期/worker/删除快照任务依赖倒置 | 已关闭：T02通用内核、T30区间、T31生命周期前置；T19与T23分层；43任务DAG无环 |
| C-05 | 公开读补齐写库引发无界锁竞争 | 已关闭：纯projectLifecycle、每页100/扫描500，worker和写命令持久补齐，S09写入0/无行锁 |
| C-06 | 本人Meals缺Hosting/Cancelled | 已关闭：API§6五分区及交集/终态归属 |
| C-07 | 删除后新快照及影响范围不明 | 已关闭：privacy_control最后锁/发布epoch复核，snapshot_subjects索引；新用户贡献退出，业务事实不重写；S25 |
| C-08 | 待审用户删除与审批并发漏撤权 | 已关闭：锁申请人ACTIVE，删除含pending WITHDRAWN；202前同步撤权；S24 |
| C-09 | 边界验收覆盖不足 | 已关闭：补S03/S09/S23/S24/S25/S31；场景状态明确planned_not_executed |
| C-10 | 分类枚举不一致 | 已关闭：统一regular/test/staff，旧枚举显式映射，不能客户端自报 |
| C-11 | 新增AI需求造成基线漂移 | 已关闭：主方案§1记录ce74f80/AI增补；报告不追认旧复评 |
| C-12 | DST旧待定与用户决定未衔接 | 已关闭：P-03优先级明确，T07/TimeInput歧义offset与不存在报错；原文待回填单列 |
| D-1 | LINK_REQUIRED缺回调票据协议 | 已关闭：API§7两结果分支、10分钟单次challenge ticket及link输入/错误；S03 |
| D-2 | 公开菜系字段与待决状态、reportedAt来源冲突 | 已关闭：P-05决定后DTO可含声明字段；reportedAt仅服务端产生 |
| D-3 | 通知表晚于审批命令 | 已关闭：T02创建notifications/outbox，T09/T10可事务写入，T17再做投递/客户端 |
| D-4 | 相同文件被多个切片重复创建 | 已关闭：任务表说明T02/T31创建、T27/T11仅扩展，单负责人串行集成 |
| D-5 | 删除者是否继续影响饭局人数指标 | 已关闭：数据契约§6/S25：新统计按剩余regular重算peak，原业务成团与取消不改 |
| F-01 | 游客主体/额度/CSRF未定义 | 已关闭：AI§8 guest_sessions固定24h、Web安全cookie/CSRF、iOS opaque bearer，刷新不重置，A02/AI-S07 |
| F-02 | RAM会话与多API/滚动部署矛盾 | 已关闭：T-05/G-HOST/T27/AI§8：API1副本Recreate不重叠；发布410/未发文字保留，扩容先ADR |
| F-03 | AI删除扩展先于核心删除模块 | 已关闭：A02显式依赖T19；AI-S10覆盖账户删除联调 |
| F-04 | UNKNOWN费用无对账入口 | 已关闭：AI§8：ai_budget_ops+MFA专用API/ops-cli、账单证据/CAS/幂等审计，A03/A09/AI-S08 |
| F-05 | AI锁顺序未纳入核心全局顺序 | 已关闭：AI§8完整user→meal→pair→业务会话→AI→quota/budget→privacy_control末锁 |
| F-06 | iOS重装可能恢复旧Keychain会话 | 已关闭：AI§8安装marker缺失清旧token，AI-S14 |
| F-07 | 编辑活动每秒持久写库且TTL可能漂移 | 已关闭：AI§3/§8 RAM服务端活动时刻权威、DB30秒合并不续期、重启不恢复正文 |

AI-B01/AI-B02：用户决定已明确，技术落地已核证；原PRD/Demo回填仍待原会话，状态不冒称原文已修订，详见[AI复评](../reviews/ai-development-readiness-2026-10-21.zh-CN.md)。P-05新增字段采用保守工程默认：首guest后与关键安排一起锁定，不声称用户逐项指定了该细节。

## 3. 认可文件与精确版本

以下10个文件为认可范围；manifest和本审查记录自身不参加自身哈希计算，避免循环。认可后未改这些文件。任何技术规则更改须记录diff并重新审查受影响范围，不能沿用旧sha冒称同一版本。任务状态/实施证据更新也应明确新版本及其与已审设计的差异。

| 文件 | SHA256 |
| --- | --- |
| [docs/engineering/core-development-plan.zh-CN.md](../../docs/engineering/core-development-plan.zh-CN.md) | `e9c1576852dbd05b53d165e57281dfb5b78961acbf59faafe327d441857a4ef2` |
| [docs/engineering/data-and-command-contract.zh-CN.md](../../docs/engineering/data-and-command-contract.zh-CN.md) | `a903277abf63c77d1dcf9b1d9ab033a3fdd62b6a05e574980a6945f1447473ef` |
| [docs/engineering/api-and-client-contract.zh-CN.md](../../docs/engineering/api-and-client-contract.zh-CN.md) | `1da659e8dd2e89578b0af9161bdcd4a9b4fbd543ecd008a2c3c61cebcaf5d5ea` |
| [docs/engineering/validation-and-release.zh-CN.md](../../docs/engineering/validation-and-release.zh-CN.md) | `4af4ee3cfe03310501c79469f32a6f82c1fbba08681b6aa82aaca72a0c5f2353` |
| [docs/engineering/ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) | `dd1be848cf4f4b737d0c6d9ca435febb57873c2c5cd84891894a7abafd2a7915` |
| [docs/engineering/acceptance-scenarios.json](../../docs/engineering/acceptance-scenarios.json) | `127bdd747447e3b1f9ac552eae09d272ac1c39d99c7212378f529cd369363afb` |
| [docs/engineering/ai-acceptance-scenarios.json](../../docs/engineering/ai-acceptance-scenarios.json) | `b27449f87d8c18768149678e5c5194423e8f370cbdf46535715f478039aaf6e0` |
| [tasks/plan.md](../../tasks/plan.md) | `25b12bef1d3a8c5f1991a14278c4808289b5f0c61bb0d469c4f52d6b9507b171` |
| [tasks/todo.md](../../tasks/todo.md) | `0ff055dce6c17024ff2223b4481f69b8d979b35fde8b42d619ee101cd60fd028` |
| [docs/reviews/ai-development-readiness-2026-10-21.zh-CN.md](../../docs/reviews/ai-development-readiness-2026-10-21.zh-CN.md) | `91c36c4179bc919ac0e284893067c84659ff77377b9117cbb44dd0795b1063a0` |

## 4. 本轮实际验证与没有发生的事项

- `python3 -m unittest discover -s tests -q`：56项仓库验证通过；本轮新增5项开发包内容检查，验证引用、任务依赖与反例（环/缺依赖）、核心/AI场景覆盖和实际文件哈希。它们不证明生产业务行为。
- 暂存快照独立验证也56项通过。第一次仅导出文件未提供Git上下文，历史评审/ignore检查出现2个error、1个fail；补充只读原Git历史与快照worktree环境后全部通过，未改断言或隐藏失败。这是验证环境修正，不是产品缺陷修复。
- `git diff --check`通过；原PRD、demo/、admin/、shared/与需求基线无本轮diff。31组核心+15组AI场景均为待实施，≥60条真实模型评测样本是A08后续工作，不冒称本轮已经运行。
- 未调用模型API、未创建收费资源、未部署、未改受保护Demo运行时、未开展原生真机或真实收件箱验收。
- Git仅交付本轮文档/任务/测试/索引，保留竞品研究的其他会话改动。提交与远程SHA以Git记录和交付消息为准。

## 5. 开发启动、回填交接及发布门槛

执行入口：[tasks/plan.md](../../tasks/plan.md)，唯一状态表：[tasks/todo.md](../../tasks/todo.md)。43个任务目前均未实施；本轮不自动启动开发。原会话应最小回填P-02邮件渠道、P-03 DST、P-04偏好软硬、P-05 host可选声明/字典/unknown/编辑锁，并复核diff；不重做原交互。执行者同时读主PRD与决定附件，不能只读旧文。

外部门槛：G-AUTH、G-PLACES、G-MAIL、G-IOS、G-PRIVACY、G-HOST及G-AI-MODEL、G-AI-DATA、G-AI-COST均未被本轮关闭。真实凭据、法律/供应商文本、预算金额、模型质量、费用、原生设备、备份恢复须后续实测/批准。设计认可与实现完成、真实验收和发布是不同阶段。

Claude额外实现提醒：A03结果发布必须CAS状态仍为PENDING；若deadline reaper已标FAILED则丢弃迟到结果，不二次扣成功轮。单API Recreate会短暂中断并使AI会话失效，G-HOST实测如实记录，不承诺无感发布。

本轮方法已由现有需求评审、任务拆解与接口设计技能覆盖，未新增/安装技能候选或修改个人配置。
