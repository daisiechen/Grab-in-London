# P1.1 客户端 Claude Code 执行交接

2026-10-23。用户最新授权：先隔离核验、协调共享边界，通过后由Claude Code执行开发；Codex协调并整体负责验收，直至客户端/移动Web开发自测与必要测试环境完成。原“开发-MVP补丁版为唯一实施owner”是拆分/执行人调整前状态，以本次直接用户决定及本文为准。

## 固定输入与职责

- 产品版本P1.1，release.json；父封存2e33ca2bbdc838c85a36d2e3bbd9b5fe216478ae。方案plan.zh-CN.md SHA256 98dece0066dc75621d98f8484b1ae40167bdc10aece3e52bce1bb1c4e458c697，原独评8a4a3c5，三方PASS记于review。不得重写需求/冻结设计。
- 唯一执行工作区为本会话managed worktree `mvp-patch-p1/约饭App`，branch codex/mvp-patch-p1（读取交接时核HEAD/上游）。禁止在共享Desktop项目或后台worktree写业务代码。应用内Local环境绑定该专属目录，不启CLI，不用旧Claude detached目录。
- Claude独占用户端业务写入：apps/web、apps/ios及客户端所需social/dto、消息/通知/push/API与0027起迁移。Codex独占协调/验收/本测试rig文档，业务切片期间不并发改Claude负责文件。后台会话独占apps/admin、apps/api/src/admin、operations-admin及独立后台DTO，迁移0026。生成contracts/client、worker main及P03通用回执由客户端Claude执行，Codex串行转交后台源码commit，禁止两边并发生成。
- PATCH006/P09/P10不由本Claude实现；P01/P02中只承担用户端范围。后台环境64274–78；用户端Web64174/API64176，PG由本rig随机选择并核manifest。不得连接任一旧库/后台库。

## 执行方式

先只读确认CWD、branch、HEAD、dirty、已审输入及isolation记录，回执明确本地root/唯一owner/拟写文件，再开始首片。完整覆盖PATCH001–005/007/008及任务表受影响任务，不用完成分享一个按钮冒称整版完成。

1. P02逐页面/组件对照冻结设计与当前实现，形成delta-map：已符合、待改、证据不足分别列出。保留基础布局及未变业务，按冻结稿精准还原，不擅自全面重做。
2. P03先交统一actor+operation+key只读回执契约/基础路由commit供后台对接；不靠当前值相等猜原写成功；未知/处理中/确定拒绝/409版本冲突分开。
3. 纵向完成资料/发现创建/DST/反馈恢复/AI转入/分享/提及设置推送各路径，使用既有架构与新版本DTO。退群授权epoch永久REVOKED、重入不复活旧push为硬约束。每片明确实际文件、测试、状态与遗留，不把未实现页静态mock标通过。
4. tests靠近模块；真实PG/API测试只从清空继承环境并使用本补丁owned实例或本root临时独立testkit启动，TMPDIR必须专属；禁止沿用封存地址/控制通道/时钟/账本。不得运行当前shared checkout的compose或qa runner。
5. 每片适用unit/typecheck/API/DB/Web/iOS测试及build通过后单独commit/push，核远端SHA；保留失效红例及实际失败。遇新产品歧义只暂停该片并给PM/UX具体问题，不自改PRD/Demo或降低验收。
6. 交付Codex核验：提交SHA、改动列表、测试命令退出码、环境/构建清单、代表页面截图及未闭外部依赖。Codex可要求修复/复验，不以Claude自述替代验收。不得擅自合并main、改封存tag、部署或发布。

## 必须保留的验证

详见plan§10与inheritance的15条原ID/5遗留风险，原202/4/11不覆写。反馈空变更零写、OPEN确认前零写、串行部分/unknown/409/换人换账号/七天撤回；DST两个输入独立；AI Keep/Replace/失效/长度/满员/截止及F66/F68；分享同mealId回流/取消/复制失败/终态；提及同名/host Everyone伪造/退群降级/旧客户端兼容/静音409/已读/TTL/epoch/换绑；iOS与Web375–430、键盘safearea/焦点/语义/错误/只读隐私。真实推送/分享App/供应商/设备未测必须单列，不能以fake通过消除发布门槛。

## 测试环境操作边界

- 本rig `infra/patch-client/rig.ts`通过显式P1.1 opt-in、专属TMPDIR、无外部连接变量和依赖root守卫；API/worker仅自建合成PG，真实时钟，AI disabled，测试OTP000000，无外部邮件。私有manifest只存本地，不提交。
- Web主机`p11-client.localhost:64174`，新IAB上下文，无旧QA cookie导入。仅本机回环；不要改生产DNS/TLS。
- 原生用FANCY_APP_VARIANT=patch-p11、EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:64176，bundle uk.fancyabite.patch.p11、scheme fancyp11。DerivedData/Metro/TMP输出均设专属目录，Metro64178。先build-only，不安装/启动现行设备、不对旧模拟器执行命令；如需新独立模拟器，由Codex核其身份后安排。
- 不读取/复制真实密钥，不真实外呼，不自动充值，不删除真实账号，不部署，不推进旧测试钟。只停止自己在manifest登记且PID/CWD吻合的进程，不能按端口/进程名批量kill。

## Codex验收 P06-R02：组件必须真正清理账号内存

独立红例 `apps/web/src/test/p11-feedback-clear.unit.test.tsx`（Codex拥有，Claude只读运行勿stage）：reviewPerson在途时执行resetFeedbackMemory并卸载组件，放行响应后selectReconnect仍写1次，预期0。共享runner.clear的代际保护尚未接到组件：双端reset只将memory=null，替换account也未清旧runner；真实session-end无reset调用。请修双端账号切换/退出/401/删除的生命周期，真正清旧runner、draft、listener；同账号重登录不能恢复前会话草稿，迟到finish或内部retry不能继续后项或污染新scope。不要仅修测试helper。保持离开页面再返回同一会话恢复草稿的既定行为。修复、测试及提交由Claude执行；Codex组件红例不得混stage。

当前Codex Git待提交文件：上述组件测试、infra/patch-client/{feedback-late.unit.test.ts,receipt-recovery.api.test.ts}、isolation.zh-CN.md末尾记录，以及本交接补充。请在后台源码/生成/worker集成安全提交后暂停Git提交约一分钟并明确交还窗口给Codex，随后继续其余客户端P04/P05/P07/P08/P11–P17，不以P06局部完成替代全计划。
