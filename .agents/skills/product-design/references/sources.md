# 方法来源与维护

以下来源用于提炼方法，不是必须安装的依赖。官方指南、社区实现和标准的用途不同；引用某个来源不代表采纳其全部规则。来源核查日期：2026-10-18。

| 来源 | 借鉴与限制 |
| --- | --- |
| [Anthropic frontend-design](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md) | 参考有意图的视觉选择、内容与设计自查；不把具体审美偏好或工具流程作为普遍要求。 |
| [Design system skill](https://github.com/anthropics/knowledge-work-plugins/blob/main/design/skills/design-system/SKILL.md) | 参考设计变量、组件、状态和复用；不把文档覆盖率或零硬编码当作体验质量的替代指标。 |
| [Design handoff skill](https://github.com/anthropics/knowledge-work-plugins/blob/main/design/skills/design-handoff/SKILL.md) | 参考交互、内容边界、响应式和交付要素；不要求所有控件逐项填写完整规格。 |
| [User research skill](https://github.com/anthropics/knowledge-work-plugins/blob/main/design/skills/user-research/SKILL.md) | 参考研究方式与问题匹配；不固定研究样本量或执行周期。 |
| [NN/G usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) | 用于状态可见性、一致性、控制感和错误恢复检查；启发式审查不能替代真实用户研究。 |
| [WCAG quick reference](https://www.w3.org/WAI/WCAG22/quickref/) | 用于选择适用的无障碍检查；合规声明必须基于明确范围和充分验证。 |
| [Agent Skills specification](https://agentskills.io/specification) | 使用简短入口与按需参考，不将工具可用性当作用户偏好或授权。 |

正文经过重新组织，不是来源文件的整段复制。若采用第三方代码、模板或资产，应另查对应许可和署名要求；这些方法链接不授予资产使用权限。

维护时用真实任务检查：局部修改是否被扩大成重设计、交互是否存在断点、是否静默发明业务规则、审查结论是否有证据、交付是否可理解、内容是否仍可跨产品使用。只修正有依据的问题，不固化项目品牌、像素值、平台、仓库或机器路径。
