# Fancy 产品洞察后台

五个模块：产品概览、用户旅程、饭局与供需、体验与留存、数据与定义。中文/英文切换，共享日期与业务筛选，指标字典、用户/饭局/事件下钻，CSV 汇总导出。

**这是使用确定性虚构数据的独立高保真交互 Demo，不是已接入真实数据的生产后台。** 不收集访问者埋点，不创建账号，不产生订位、支付或通知。生产接入见 [后台 PRD](../docs/admin/PRD.zh-CN.md)。

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
