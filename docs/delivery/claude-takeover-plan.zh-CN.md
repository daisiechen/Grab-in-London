# Claude Code 接手开发计划

日期：2026-10-27（Europe/London）｜负责人：Claude Code｜状态：执行中

## 1. 背景与用户决定

此前由 Codex 实现的 iOS 客户端与已认可的 MVP Demo 视觉和交互对不上，重画 Figma 未获通过，测试长期卡在环境问题。用户决定由 Claude Code 接手主开发，并确认以下四项：

| 决定项 | 结论 |
| --- | --- |
| 开发路线 | 保留现有 Expo / React Native 工程骨架、`packages/contracts`、`packages/client` 与 API 等可用部分；iOS 界面逐屏对照 Demo 重做 |
| 业务口径 | 视觉与交互沿用 `demo/`；业务规则以[主 PRD](../product/PRD.zh-CN.md) r07 与 [MVP 需求](../product/fancy-requirements-baseline.zh-CN.md)为准：不做平台押金、支付、退款和代订位，host 在平台外订位、参加者到店各付 |
| 后端范围 | 第一阶段先用本地模拟数据把 iOS 首发旅程做到与 Demo 一致、可完整点通，第二阶段再接 API 与数据库 |
| 协作规则 | Claude Code 负责 `apps/`、`packages/` 及相关测试与研发文档；Codex 停止并行修改代码；`demo/` 只读 |

## 2. 环境基线

- 项目要求 Node 24 与 pnpm 11.25.0。容器默认的 Node 22 不满足 `engines`，这是此前测试环境反复失败的原因之一。改用 Node 24 后，`pnpm install --frozen-lockfile` 可以直接完成。
- 接手时基线（提交 `ecfb54e`）：`pnpm --filter @fancy/ios test` 54 个套件、379 项通过；`pnpm core:test:unit` 43 个文件、405 项通过。
- 云端容器无法运行 Xcode 和 iOS 模拟器。验证方式是：组件与流程测试（jest + Testing Library），再加上通过 react-native-web 在浏览器渲染 iOS 界面，用 Playwright 截图与 Demo 同一路径的截图逐屏对照。真机与模拟器的最终确认需要用户在 Mac 上执行 `expo run:ios`。

## 3. 范围与顺序

首发 iOS 旅程按依赖顺序交付，每条旅程完成后单独提交并推送：

| 顺序 | 旅程 | Demo 对照路径 |
| --- | --- | --- |
| 0 | 基础：设计令牌、字体、通用组件、底部导航、模拟数据层、Web 预览与截图对照工具 | 入口页、底部导航 |
| 1 | J01 找到并申请饭局 | 发现（地图/列表、筛选）→ 详情 → 成员主页 → 申请 → 申请状态 |
| 2 | J02 发起饭局并管理招募 | 发起饭局 → 发布 → 管理申请（批准/拒绝）→ 订位声明 |
| 3 | J03 赴约前沟通或调整参与 | 我的饭局 → 群聊 → 群设置、退席/取消 |
| 4 | J04 饭后反馈与继续联系 | 过往饭局 → 留下反馈 → 互选 → 私聊 |
| 5 | J05 个人资料与隐私 | 个人页 → 编辑资料 → 设置 |
| 6 | J06—J08 意见、举报、删除账号 | 问卷、举报、注销流程 |

J09（支持）、J10/J11（后台）在 iOS 首发旅程完成后另行安排；J12—J15 为后续版本。

## 4. 每屏验收口径

1. 布局、文案、颜色、字号、间距与 Demo 同一状态截图一致；Demo 中的押金、支付、退款、代订位元素按 PRD r07 替换为预计人均预算与 host 订位声明。
2. 主路径与异常路径可在模拟数据下完整点通，不出现死路。
3. 有对应的组件或流程测试；`pnpm --filter @fancy/ios test`、`typecheck` 与 `pnpm core:test:unit` 全部通过后才提交。
4. 截图对照证据保存在 `docs/reviews/claude/` 下，按旅程分目录。

## 5. 进度记录

| 日期 | 内容 | 提交 |
| --- | --- | --- |
| 2026-10-27 | 接手：环境基线确认，协作规则更新，本计划建立 | 见 Git 历史 |
