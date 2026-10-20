# Fancy 产品洞察后台

五个模块：产品概览、用户旅程、饭局与供需、体验与留存、数据与定义。中文/英文切换，共享日期与业务筛选，指标字典、用户/饭局/事件下钻，CSV 汇总导出。

**这是使用确定性虚构数据的独立高保真交互 Demo，不是已接入真实数据的生产后台。** 不收集访问者埋点，不创建账号，不产生订位、支付或通知。生产接入见 [后台 PRD](../docs/product/admin/PRD.zh-CN.md)。

## Run and validate
使用 Node24、pnpm，与已有手机端的 React/Vite 版本保持一致。

```sh
cd admin
pnpm install --frozen-lockfile
pnpm dev
pnpm test
pnpm build
pnpm test:e2e
```

预览默认端口4180，手机端保持独立。浏览器测试使用已安装的 Google Chrome；CI 无 Chrome 时须先配置等价 Chromium channel。生产构建输出 `dist/`（不提交）。不含生产认证或服务连接，不可用此构建公开生产用户数据。

手机预览：保持 `pnpm dev` 运行，手机与电脑连接同一 Wi-Fi，打开终端输出的 `Network` 地址（`http://电脑局域网IP:4180/`）。`127.0.0.1` 和 `localhost` 只指向打开链接的设备，不能用于跨设备访问。电脑休眠或服务退出后链接不可用；切换网络后需使用新的局域网地址。这不是公网部署，移动数据网络无法直接访问。

## Four review paths
1. 用户旅程 → 按区域筛选 → 申请记录 → 用户及饭局详情，检查审核耗时。
2. 饭局与供需 → 选择 Camden → 无结果与关联饭局 → 查看出席证据。
3. 体验与留存 → 先看未成熟提示 → 选择90天 → 对照成熟队列、反馈与实际再赴约。
4. 数据与定义 → 异常事件 → 指标字典 → 无数据/加载失败场景与恢复。

## Data and code
- `src/analytics.ts`：纯函数计算、事件清洗、去重、London日期、队列及漏斗。
- `src/fixtures.ts`：虚构用户、饭局、申请、出席、反馈和事件；冻结快照2026-10-18T12:00:00Z。
- `src/metrics.ts`：中英文口径、来源、边界及决策说明。
- `src/components.tsx`：统一表格、筛选、抽屉等。
- [设计系统](DESIGN.md)、[交互契约](UX-CONTRACT.md)、[验证](qa/verification.zh-CN.md)。

真实数据适配必须由服务端提供去标识化分析快照，不应把真实数据复制进 fixture 或公开仓库。默认28天，观察窗口随指标分别成熟；30天重复率在默认窗口可能无成熟分母，显示“—”，不能显示0%。

## 当前版本的使用规则
“当前数据检查”按当前数据/筛选重算，不由经营分析Agent撰写，也不承诺每周自动出议题；产品负责人每周据此复核与确定迭代。没有Agent或定时经营任务接入。普通页面隐藏场景测试开关；需要验收时打开`?review=1#quality`。

[本轮审查报告](../docs/delivery/fancy-admin-usability-review.zh-CN.md)包含逐页问题、修复、截图和范围。`tests/browser-scenarios.mjs`为共享浏览器场景：可由现有Playwright包装器执行，也可在已选内置浏览器通过同一场景适配执行。本轮使用后者，无需另开Chrome。


指标v4与App采集入口见[采集契约](../docs/product/admin/measurement-contract.zh-CN.md)，[本轮19条批注修订](../docs/delivery/fancy-admin-measurement-review.zh-CN.md)记录验证。统计账号分类为会话内操作、刷新恢复；出席仅只读追溯；两端原型没有生产数据联通。

本轮按恢复版最小修订的[2026-10-20验证记录](qa/readiness-2026-10-20/verification.zh-CN.md)说明当前候选、评审项对应与生产依赖；旧R1验证仅保留历史引用，不代表当前版本通过研发准入。

单场评分与Settings产品问卷已分离：评分按饭局日期/出席人次，问卷按最新提交日期/用户；问卷不接受饭局维度过滤。当前口径v4，旧单场意愿不迁移。

[产品问卷拆分验证](qa/survey-2026-10-20/verification.zh-CN.md)记录指标v4的最小改动与回归结果。
