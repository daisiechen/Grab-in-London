# Claude核心开发执行入口

本轮只完成方案，不启动代码开发。P-04/P-05已明确偏好软硬与host可选声明；PRD/Demo待原会话回填，执行时同时读取决定附件。用户授权开发时，从[架构与决定](../docs/engineering/core-development-plan.zh-CN.md)开始，连同[数据命令](../docs/engineering/data-and-command-contract.zh-CN.md)、[API客户端](../docs/engineering/api-and-client-contract.zh-CN.md)、[验证发布](../docs/engineering/validation-and-release.zh-CN.md)、[双方审查](../docs/engineering/collaborative-review.zh-CN.md)、[真实AI方案](../docs/engineering/ai-development-plan.zh-CN.md)和[任务表](todo.md)读取。原PRD/Demo只读；真实AI按已增补FR-13和P-04/P-05共同基线设计，产品包含真实AI。

## 后续可直接交给Claude的启动指令

> 按本项目AGENTS.md执行tasks/todo.md的核心开发任务。先核对共同审查中的精确文件哈希与当前Git状态，读取主PRD§0和本方案P-01—05。保留其他任务改动。每次只领取依赖已满足的一个小切片，声明文件范围、测试与外部门槛；先T00再T01/T02；T30会话内核先于T07，T31生命周期函数先于T08/T09，T32按P-05实现，不改原PRD、demo/、admin/、shared/。实现必须包含列明验收和真实Postgres并发测试；没有凭据的外部任务标blocked_external，不伪装成功，也不阻塞独立本地切片。每个切片验证后仅提交自己文件、推送跟踪分支核对SHA，更新唯一tasks/todo.md状态与证据。发现未决产品冲突回交原会话，不替用户决定AI规则；核心完成仍不代表包含AI的产品可发布。

执行状态允许todo/in_progress/blocked_external/blocked_requirement/done，done必须含commit、验证命令/结果和证据路径。不得用对勾代替真实验收。目标目录和脚本目前大多尚不存在，按切片增量创建，不一次性空壳搭建。
