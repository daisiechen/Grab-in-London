# B03隔离准备记录（未关闭）

2026-10-23。本记录只证明已执行的准备，不代替运行环境完整核验。

## 已核证

- 三方独立签收：原提交8a4a3c50d773f18d08993d7e9c476618710b4bf2、方案SHA256 98dece0066dc75621d98f8484b1ae40167bdc10aece3e52bce1bb1c4e458c697；详见[评审记录](review.zh-CN.md)。
- 已创建并附加managed worktree `mvp-patch-p1`，分支`codex/mvp-patch-p1`，远程跟踪同名origin分支。实际绝对路径由本地worktree附件记录，不在公开文档披露用户主目录。
- 从精确封存父2e33ca2bbdc838c85a36d2e3bbd9b5fe216478ae创建，逐个cherry-pick已审方案及回执。准备时HEAD 10ee510db34fa986d5c1d2ef35df0c4619aa4f61与远端一致；merge-base正为封存父；方案内容哈希与签收版一致。cherry-pick改变Git提交ID，不改变受评文件内容。
- 与父提交比较，仅docs/README、补丁专属方案/任务/继承/验证/评审及B03报告改变，无apps/packages/infra/PRD/Demo源码变更。
- 使用Node24配套pnpm11.25.0，清空继承环境变量后执行`pnpm install --offline --frozen-lockfile --ignore-scripts`，13个workspace、1001包，复用不可变下载缓存，下载0，退出0；lockfile未变。安装脚本未执行，因此不声称所有构建工具二进制已可用。
- 新node_modules是实体目录，逐项检查根及apps/packages node_modules共3399条符号链接，0条解析到worktree以外；无封存可变依赖/源码链接。
- 候选64174—64178检查时无监听，仅瞬时观察，不是已预留。未启动任何服务、PG或客户端。
- 专用worktree中方案验证3项、文档引用验证3项及diff check通过。未运行DB/API/业务/设备测试，未调用供应商。

## 未完成，不得声称B03 PASS

1. 产品发布号待用户批准，工程标识P1不冒充发布版本；已向用户请求信息。三方方案PASS不依赖先批准发布号，但正式构建命名与交付前须关闭。
2. 专属env/运行配置、缓存与输出manifest、PG dataDir/角色/合成数据、API/worker端口PID/CWD、浏览器独立上下文、原生bundle/DerivedData等尚未建立或验证。没有使用封存环境的任何凭据、数据库、控制通道、钟、session或账本代替。
3. 新环境运行前按方案§9逐项与封存保护清单作不相交核验；所有供应商off，测试URL核验后才允许DB/API测试。不能复用默认5174/5175/3000/55417入口。
4. 实施owner为开发-MVP补丁版；各任务具体文件必须先按P02盘点并接受，共享contracts/client/db/lockfile串行。当前只有文档写权已执行，不开始业务实现。

原共享checkout的研究、B61/B62和qa目录未动。封存tag未移动，现行进程、设备、数据库和时间未操作。后续状态只在此补丁分支记录，不向旧MVP任务表写新状态。

## 后续更新：产品版本已确定

2026-10-23用户最新确认产品版本 **P1.1**，覆盖此前P1.0口头选择。上节第1项“发布号待批准”现已关闭，真源为[版本元数据](release.json)。运行配置、PG/API/worker、浏览器及原生产物隔离核验仍未关闭；不得将版本号确认视为B03整体PASS或发布批准。
