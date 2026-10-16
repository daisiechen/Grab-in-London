# Grab-in-London
Simply select your desired restaurant to easily arrange a meal with others

## 当前交付

- [中文版产品需求文档](docs/PRD.zh-CN.md)：背景、目标、用户路径、前后端模块、逐功能交互、输入输出、状态、异常与验收。
- [高保真交互 Demo](demo/README.md)：地图/列表、个人主页、申请审核、模拟预订支付与退款、发起饭局、群聊和饭后互选。
- [视觉验证](demo/design-qa.md) 与 [浏览器验证](demo/qa/browser-results.md)。

Slogan：**一起吃顿饭，认识新朋友。 / Meet new people over a meal.**

Demo 为英文手机式网页，所有人物和交易均为模拟。本轮不开发真实后端。使用 Node24 + pnpm，在 demo 目录执行 `pnpm install --frozen-lockfile` 和 `pnpm dev --host 127.0.0.1 --port 4173`。
