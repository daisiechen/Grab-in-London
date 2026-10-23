# P1.1 PATCH-006 后台职责接收与实施门槛

2026-10-23。仅后台 P09/P10 及对应回归；用户端 PATCH001–005/007/008 归原开发会话。本记录优先于拆分前 tasks.json owner 表，不改变已签方案正文。

## 基线与准备

- 专属 managed worktree：`admin-patch-p11`；分支 `codex/admin-patch-p11`。
- 精确父：`2e33ca2bbdc838c85a36d2e3bbd9b5fe216478ae`，annotated tag `mvp-freeze-2026-10-23`。封存非发布通过；继承202 PASS / 4 NOT_RUN / 11 BLOCKED、15原ID及F60/F63/F68/D08/可选统计观察。
- 从 origin/codex/mvp-patch-p1 逐个继承文档提交：cab2358→945f0a7、3b55bde→0b699c1、e3a56c3→c0d9904、10ee510→71c3eaa、4c50268→eeaabf0、2e9ca66→a414a6c。plan/review/tasks/inheritance/release/isolation与源分支逐字核对；方案SHA256仍为98dece0066dc75621d98f8484b1ae40167bdc10aece3e52bce1bb1c4e458c697。
- 独立node_modules：离线 frozen-lockfile、ignore-scripts安装1001包，下载0、lockfile不变。禁止把安装成功当构建工具或运行环境验收。
- 本分支继承的 isolation.zh-CN.md 是用户端准备历史，不证明后台隔离完成。
- 后台候选64214–64218尚未绑定或预留。PG/API/worker/浏览器尚未启动；未创建env/运行manifest，B03未PASS。后续专属TMPDIR、PG dataDir/角色/DB、API origin、输出与浏览器上下文须逐项负向核证；只合成数据，供应商off，不接旧QA/控制通道/时钟/账本/设备。

## 文件边界与待交接清单

| 范围 | 本会话职责 / 门槛 |
| --- | --- |
| apps/admin/** | 后台唯一实现owner；复用五页与现有snapshot/export/classification |
| apps/api/src/admin/** | 后台增量候选owner；与通用写入/回执入口依赖先串行交接 |
| packages/contracts/src/operations/operations-admin.ts | 后台提出accepted receipt及statistics-refresh最小契约；当前未获共享owner回执，不写 |
| packages/contracts/src/{registry,declarations,openapi}.ts及生成产物 | 原会话候选串行生成owner，未锁定；不得双方同时生成 |
| packages/client/src/generated/operations.ts | 与contracts生成同一owner/同一原子提交；未移交不写 |
| packages/db/migrations/** | 原会话分配新编号；当前封存最大0025，禁止自行预占编号 |
| apps/worker/src/main.ts及公共运行入口 | 统计作业与用户端通知共用，须精确到文件/片段移交后修改 |
| 通用P03 receipt及apps/api公共写入入口 | 原会话候选owner；后台只消费同一原actor/operation/key回执，不复制通用系统 |
| 根lockfile/配置、共用tasks.json | 串行owner未锁定；当前保持原样；docs/README.md仅补本记录链接，后续集成串行核对 |
| PRD/Demo/Figma、apps/web、apps/ios | 本会话不修改，需求变化交原负责人 |

跨会话交接消息被自动审批拒绝，原因是可信用户指令未明确授权本次跨线程发送。因此上述共享owner分配是提案，不能冒称已达成双方锁定；取得授权并收到原owner回执前不业务实施。

## 已读代码差异与切片顺序

1. ClassificationPanel网络失败保留key但可再次classify，且统计Pending继续旧图。需原intent固定payload/revision查询与Unknown/Accepted/Pending/Failed/Ready状态；同值不证明原意图成功。
2. admin routes当前classify返回revision与snapshotPending，无绑定原intent的统计作业回执。P09先验证现有schema，再最小新增targetUserId+原request/intent+该user acceptedRevision关联；Ready密封输入不得用跨用户revision或最新时间猜。
3. Accepted仅重试统计；Pending/Failed禁旧统计/下钻/导出。P10统一snapshot/filter，410清所有旧缓存与ticket，下载重验role/privacy epoch；coverage本人优先host补缺。
4. 锁定共享owner并通过后台B03后，先P09 API/DB契约测试，再P10 UI/导出及手算fixture，最后1440/1024/864/390浏览器、locale、表内滚动、焦点/错误恢复与独立后台验收。每片超过5文件或跨子系统先细分。

AF01–05按已审冻结记录关闭，不重新引用历史初评阻塞。方案PASS不等真实服务、独立验收或上线通过。当前仅准备，无功能实施。
