# 项目协作规则

GitHub 仓库：https://github.com/daisiechen/Grab-in-London

- 用户要求此项目的代码、需求、设计、决策和进度持续同步至该仓库。将有价值的项目讨论结论整理为仓库内文档。
- 每轮工作开始时检查本地状态并获取远程更新，保留现有内容和历史。
- 完成每轮有实质变更的工作后，检查变更、执行适用验证、创建清晰的提交并推送到当前分支的远程跟踪分支；用户暂停同步时遵循其最新要求。
- 仓库为公开仓库。仅同步适合公开的项目资料，排除密钥、凭据、个人资料、依赖和构建产物。
- 推送后核对本地与远程提交一致；若失败，明确报告尚未同步的内容和原因。

## 注意事项

- 每次改动完成后，都必须创建一个对应的 git commit，以便后续追踪和回滚。
- 每次改动后，都必须编写或更新相关测试，并在交付给用户前，确保所有测试和验证全部通过。
- 每次提交 git commit 后，都同步更新 GitHub，确保 GitHub 文件和项目版本与本地最新版本一致。

## 通用技能

- 商业模式设计、市场可行性、单位经济或投入决策分析：先阅读 [business-model-design](.agents/skills/business-model-design/SKILL.md)，再按任务加载其 references。具体业务事实、假设和决策记录在对应项目文档中。
- 需求发现、用户路径、PRD、优先级与产品验收：参考 [product-management](.agents/skills/product-management/SKILL.md)。
- 信息架构、交互、视觉系统、原型与设计审查：参考 [product-design](.agents/skills/product-design/SKILL.md)。
- 按当前任务加载相关 references；项目背景、具体规则和决策保存在 PRD、设计规范等项目文档中，不写入通用技能。

## 文档管理

- [文档索引](docs/README.md)列出现行文档和权威关系；项目知识按用途分类，主 PRD 为需求真源。
- 正式项目技能放 `.agents/skills/`，待审核草稿放 `.agents/candidates/`；批准前不安装、不添加正式引用。
- 移动文档时同步维护链接、图片、脚本、测试和索引；模块专属说明与截图就近保留，避免复制业务规则。

## 多 Agent 协作

- 本文件是所有 Agent 共用的项目规则；Claude Code 通过 `CLAUDE.md` 引用。任务交接、评审及文件边界遵循 [Agent 协作说明](docs/agent-collaboration.md)。
- PRD 与 Demo 的修改由原产出会话执行；协调会话与 Claude Code 负责评审、交接、复核和验收，不直接改写这些产物。变更先明确唯一文件负责人，完成后按协作说明串行提交与核对远程。
- 项目技能以 `.agents/skills/` 为权威源；`.claude/skills/` 仅保存相对链接，不复制正文。工具内置与个人全局配置不进入公开项目。
