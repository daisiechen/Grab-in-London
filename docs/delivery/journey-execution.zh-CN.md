# Fancy用户旅程的执行与联调方案

> 当前执行更新（r10）：按[开发版本方案](development-versions-r10.zh-CN.md)复用已认可MVP Demo视觉，UX补通用规范/版本路径，RD仅并行做技术方案；上一批UX-r01仅历史，业务实现和QA未启动。
执行修订：r10｜业务范围仍r07，正式产品编号不变，内部dev.N及逐版本Ready以[版本登记](development-versions-r10.json)为准。

## 1. 当前产品模块与优先级

[产品旅程](../product/journey-modules.zh-CN.md)定义每个完整目标；此处只规定团队输入、职责与交接，不重写用户规则。每行作为一个PM需求＋Demo交付包，之后独立经过UX、RD、QA；可分技术子任务，但不能把子任务当用户模块交付。

| 优先级 | 旅程 | 产品发布范围 | 业务联调对象 |
| --- | --- | --- | --- |
| 1 | [J01 找到并申请一场合适的饭局](../product/journey-modules.zh-CN.md#j01) | ios-first | J02、J03、J05 |
| 2 | [J02 发起饭局并完成招募管理](../product/journey-modules.zh-CN.md#j02) | ios-first | J01、J03、J04 |
| 3 | [J03 赴约前沟通安排或调整参与](../product/journey-modules.zh-CN.md#j03) | ios-first | J01、J02、J04、J08 |
| 4 | [J04 饭后记录体验并决定是否继续联系](../product/journey-modules.zh-CN.md#j04) | ios-first | J02、J03、J09、J10、J12 |
| 5 | [J05 更新个人介绍或隐私选择](../product/journey-modules.zh-CN.md#j05) | ios-first | J01、J02、J06、J08 |
| 6 | [J06 提交或更新一份产品意见](../product/journey-modules.zh-CN.md#j06) | ios-first | J05、J12 |
| 7 | [J07 举报问题并跟踪处理](../product/journey-modules.zh-CN.md#j07) | ios-first | J09 |
| 8 | [J08 删除账号并确认处理结果](../product/journey-modules.zh-CN.md#j08) | ios-first | J03、J04、J09、J11 |
| 9 | [J09 支持人员处理一宗举报或出席纠错](../product/journey-modules.zh-CN.md#j09) | support-first | J07、J08、J04、J11 |
| 10 | [J10 查看约饭转化和供需并追溯原因](../product/journey-modules.zh-CN.md#j10) | admin-first | J01、J02、J04、J11 |
| 11 | [J11 调整统计分类并拿到可信导出](../product/journey-modules.zh-CN.md#j11) | admin-first | J10、J08、J09 |
| 12 | [J12 分析饭后体验与后续赴约](../product/journey-modules.zh-CN.md#j12) | later | J04、J06、J09、J11 |
| 13 | [J13 邀请朋友查看并申请饭局](../product/journey-modules.zh-CN.md#j13) | later | J01 |
| 14 | [J14 发送普通群消息或提及并让对方收到提醒](../product/journey-modules.zh-CN.md#j14) | later | J03、J15 |
| 15 | [J15 减少群消息打扰但保留重要提及](../product/journey-modules.zh-CN.md#j15) | later | J03、J14 |

优先级不意味着所有旅程全串行。支持/后台在固定合同下可先准备，不等另一旅程全部代码完成；实际验收必须有对应事实，或在联合组同时关闭，不能用合成故事冒称真实通过。

## 2. 共用合同与唯一写入者

这些是RD内部共用能力，不是单独对用户交付的模块。签发前分配真实owner/文件白名单、固定输入/输出与版本；当前writer/revision为空，不能擅自认领全部文件。

| 合同 | 范围 | 消费旅程 |
| --- | --- | --- |
| C-AUTH | 身份、完整注册/资料门槛、会话与回流 | J01、J02、J03、J04、J05、J06、J07、J08、J09、J10、J11、J13 |
| C-PUBLIC | 餐厅和公开饭局/主页读取 | J01、J02、J13 |
| C-MEAL | 安排、声明、截止/最低人数/开始资格 | J02、J03、J04、J08、J10 |
| C-MEMBERSHIP | 申请轮次、审核、席位及群授权事件 | J01、J02、J03、J04、J08、J10、J13 |
| C-MESSAGE | 群/私聊授权、历史区间、可见已读 | J03、J04、J08、J14、J15 |
| C-FEEDBACK | 出席来源、私评分、公评、互选与产品问卷 | J04、J06、J09、J10、J12 |
| C-SUPPORT | 个案授权、举报受理、纠错/删除与回执 | J07、J08、J09 |
| C-ANALYTICS | 指标、分类、快照、隐私撤销与导出 | J08、J09、J10、J11、J12 |
| C-AI | 获准上下文、偏好、草稿、预算及会话 | J01、J02、J03、J05、J08 |
| C-NOTIFY | 首发站内业务通知及关键审批/取消邮件；后续普通群消息/提及、mute、订阅和系统投递，按版本分段 | J01、J02、J03、J07、J08、J09、J14、J15 |
| C-PROFILE | 公开资料、首次必填与本人资料/隐私保存 | J05、J06 |

## 3. 版本间联调

| 联调组 | 旅程 | 终点 |
| --- | --- | --- |
| T-MEET | J01、J02、J03 | 真实同库发布→申请→注册/资料→审批→群沟通；席位/安排/截止一致 |
| T-AFTER | J03、J04、J06、J10、J12 | 饭后、联系与统计；J12只在其后续发布阶段加入，不强迫首发依赖未发布体验/留存页 |
| T-SAFETY | J04、J07、J08、J09、J11 | 举报处理、纠错和删除的权限/联系/统计/导出传播 |
| T-REMIND | J03、J14、J15 | 发送→实际提醒→定位及mute/退群/重入抑制，后续增量验证 |

互为生产者/消费者的旅程采用固定共用合同和联调，不做循环“全模块先完成”门禁。准备阶段可模拟饭局供给或对方审批，但必须标明，完整业务断言在T-MEET等组取实际证据。首发只联验其包含旅程，T-AFTER的J12及T-REMIND后续能力不强行带回首发。

## 4. 并行、工作包和状态

PM工作包需包含一名用户的一次完整目标、触发/终点、正常路径与必要分支、前置数据/角色、做与不做、业务规则、Demo及验收。若必须读同一旅程的几份页面文档才能拼成结果，PM负责将其整合为一份完整说明。

并行须有固定输入与兼容候选，无文件/状态/环境/时钟/配额冲突。原通用版本/迁移/单writer规则见[项目管理方案](project-management-plan.zh-CN.md)。执行数据见[journey-execution.json](journey-execution.json)，首发PM业务输入固定，上一批UX-r01视觉被否定，当前按r10版本登记重新交UX规范/设计；RD只并行做架构准备，业务实现和QA未启动。

## 5. 旧产物迁移

旧领域说明仅供原业务规则与代码路径参考，旧60切片已全部映射。原主PRD/旧Demo的唯一作者保持不变；新旅程PM作者与本轮UX作者分别以各自派工登记为准。历史只登录候选PM-r01保留但不获批准，不继续以它作为新需求的设计/开发输入。无需恢复旧模拟环境或为了重拆重跑封存业务测试。


逐条范围和规划版本以[审计台账](../product/requirements-audit.zh-CN.md)为工作包输入，不能仅按本页旅程摘要展开PM。共享C-AI需覆盖J05偏好与J08清理，C-NOTIFY首发业务通知/邮件与后续群push分版实现。
