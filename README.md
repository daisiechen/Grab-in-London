# Fancy（暂定）
从自由约饭出发，认识合拍、靠谱的新朋友。仓库名称保留 Grab-in-London。

## 当前交付

- [中文版产品需求文档](docs/PRD.zh-CN.md)：背景、目标、用户路径、前后端模块、逐功能交互、输入输出、状态、异常与验收。
- [中美英竞品调研与机会策略](docs/research/competitive-landscape.zh-CN.md)及[证据附录](docs/research/competitor-evidence.zh-CN.md)：24 项候选、12 家核心档案、商业及功能对比、差异化假设与 90 天验证建议；核查日期 2026-10-16，非登录实测或经营结果保证。
- [高保真交互 Demo](demo/README.md)：地图/列表、个人主页、申请审核、模拟预订支付与退款、发起饭局、群聊和饭后互选。
- [视觉验证](demo/design-qa.md) 与 [浏览器验证](demo/qa/browser-results.md)。

Slogan：**吃个饭，认识一下。 / Meet new people over a meal.**

邀约文案：**Fancy a bite? / 一起吃点？**（首页、推广与活动邀请）。Fancy 尚未完成商标、域名与账号核查；当前 Demo 仍使用 Grab，本次仅更新文档。

商业方向：商家活动与引流为收入主线；个人端先验证按次服务，有重复购买后再考虑会员。AI 社交支持、A2A 和多活动扩展属于待验证方向，详见 PRD 第 1 节。

Demo 为英文手机式网页，所有人物和交易均为模拟。本轮不开发真实后端。使用 Node24 + pnpm，在 demo 目录执行 `pnpm install --frozen-lockfile` 和 `pnpm dev --host 127.0.0.1 --port 4173`。
