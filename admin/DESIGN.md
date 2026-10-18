---
version: 1
name: Fancy Product Insights
description: Internal product analytics for real-meal pilot decisions; fictional interactive demonstration.
---

# Fancy 产品洞察设计系统

## North star
一份围绕真实见面的产品观察笔记：左侧稳定导航，右侧从结果、证据到下一步验证。不是商家经营台，也不以消息量或停留时间装饰增长。保留 Fancy 森林绿和柑橘绿，以轻盈的数据墨水呈现漏斗、供给和队列。

## Context
Product/admin register；中文默认、英文可切换，伦敦试点内部团队。与手机端独立，不复用受保护的手机框架。业务来源为 `../docs/product/PRD.zh-CN.md` 及 `../docs/product/admin/PRD.zh-CN.md`，当前用户确认的精简范围优先。

## Tokens and typography
Canonical runtime owner: `src/styles.css` 的 `:root`。森林 `--forest:#123f35`；柑橘 `--citrus:#d7ee79`；内容底 `--cream:#f6f7f3`；文字 `--ink:#203d33`；辅助 `--muted:#758279`；分隔 `--border:#e4e9e2`；告警 `--amber:#9b6529`；面板半径 `--radius:14px`。
Fancy 字标使用本地 Georgia 斜体，分析内容使用 Arial/PingFang SC/Microsoft YaHei，数字使用 Avenir Next/Arial，事件与编号使用 SFMono/Consolas。主标题29px，面板标题16px，指标数字41px，表格与控制11–12px。显示单位和计算单位必须显式。

## Layout and signature
桌面228px浅色侧栏，69px顶部路径，内容最大1570px。指标三列；主要趋势与证据面板按1.85:1组织。特色是餐桌线描与真实见面趋势的呼应，避免无关装饰图。1000px以下侧栏收成图标，640px以下横向移动导航，表格自身水平滚动，页面无水平溢出。

## Components and visual states
`src/components.tsx` 统一 Icon、Panel、Badge、NativeSelect、DataTable、Empty、DetailDialog。状态同时有文字。筛选与日期采用原生控件：接受平台弹出样式与日期显示，原生日期本身的语言由浏览器/OS决定；产品文案由语言状态决定。抽屉使用原生 modal dialog 和背景遮罩，焦点限制、Escape、关闭恢复焦点。

## Motion, accessibility and data
操作反馈克制，尊重 reduced-motion。所有操作为语义按钮/链接，焦点轮廓清楚。图表配有可键盘操作的数据点及文本数值，不仅依赖颜色。无分母显示破折号；未成熟显示观察中。示例边界常驻，绝不假装真实数据已接入。

## Verification
`pnpm test`、`pnpm build`、`pnpm test:e2e`；Playwright 验证桌面与390px、语言、过滤/下钻、队列成熟、无数据与失败恢复。截图保存在 `qa/`。
