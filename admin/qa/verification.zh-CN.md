# Fancy 产品数据后台验证

本文件记录初版交付验证；后续交互修订与最新验证见[可用性审查报告](../../docs/delivery/fancy-admin-usability-review.zh-CN.md)。

日期：2026-10-18。范围：独立 `admin/`；全部数据虚构，非真实经营分析结果。现有手机端及其运行时不属于本次修改。

## 验证环境
Node24、pnpm；React19/Vite8，与仓库手机端版本一致。使用本机 Google Chrome，Playwright `channel: chrome`；预览4180端口。桌面1440×1000，窄屏390×844；另在 Codex 内置浏览器检查实际呈现。

## 自动验证
- `pnpm test`：14项纯函数测试，涵盖事件去重、身份限定衔接、测试/员工/机器人排除、快照与迟到、缺字段隔离、London/DST、成熟窗口、跨场关联、取消分母、重复反馈、出席核实及可手算两场队列。
- `pnpm build`：TypeScript检查及Vite生产构建。
- `pnpm test:e2e`：7条浏览器路径，见下表。
- 仓库根目录 `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -v`：20项，包括新增后台结构与PRD交付测试。
- `audit_project.py admin --mode strict`：0 findings，结果见 `../premium-audit.json`。该静态结果不代替浏览器或服务端安全检查。
- `git diff --check`：提交前验证空白问题。

| 浏览器路径 | 结果 |
|---|---|
| 概览、模拟边界、指标定义、Escape和焦点恢复 | 通过；概览无pageerror |
| 区域筛选、申请记录、用户下钻、中英保留筛选、发起旅程 | 通过 |
| 区域缺口→饭局列表→分页→证据详情→搜索空态/清除 | 通过 |
| 28天未成熟→90天成熟、日期错误、重置与CSV导出 | 通过 |
| 异常事件隔离、字典检索、无数据、加载失败和重试 | 通过 |
| 390px、移动导航、原生筛选、中英切换、reduced-motion | 通过；页面无横向溢出 |
| 出席核实要求依据、保存重算、刷新恢复、不改真实数据 | 通过 |

## 视觉证据
- [中文概览](overview.zh-CN.png)
- [英文发起旅程](journey.en.png)
- [中文成熟队列](retention.zh-CN.png)
- [英文窄屏供需](supply.mobile.en.png)
- [出席核实证据](attendance-evidence.zh-CN.png)

## 已修复的问题
浏览器测试发现并修复原生选择控件的显式标签，以及StrictMode下原生dialog关闭后焦点恢复问题；补齐窄屏导航。指标验证同时覆盖了缺字段事件隔离、重复反馈去重和跨日期创建尝试跟踪。

## 验证边界
当前无生产认证、采集SDK、业务服务、持久化或定时作业。本轮没有发布到公网，也没有将虚构数据冒充真实数据。原生日期弹出层受浏览器/OS语言控制。未进行真实设备、屏幕阅读器人工验证、全浏览器兼容或独立安全审计；生产接入须按PRD完成服务端权限和真实数据对账。
