# Fancy按用户旅程组织的产品版本

修订：r06｜当前方案；原按60切片逐批交付方案已停止使用。

## 首发与后续模块

每行是一份完整用户操作旅程的产品交付包，详细定义见[MVP需求](fancy-requirements-baseline.zh-CN.md)及[旅程说明](journey-modules.zh-CN.md)。认证方式、资料表单、消息弹窗、后台页面及服务方法不再单独当作PM模块。

| 模块 | 用户目标 | 发布集合 |
| --- | --- | --- |
| J01 | [找到并申请一场合适的饭局](journey-modules.zh-CN.md#j01) | ios-first |
| J02 | [发起饭局并完成招募管理](journey-modules.zh-CN.md#j02) | ios-first |
| J03 | [赴约前沟通安排或调整参与](journey-modules.zh-CN.md#j03) | ios-first |
| J04 | [饭后记录体验并决定是否继续联系](journey-modules.zh-CN.md#j04) | ios-first |
| J05 | [更新个人介绍或隐私选择](journey-modules.zh-CN.md#j05) | ios-first |
| J06 | [提交或更新一份产品意见](journey-modules.zh-CN.md#j06) | ios-first |
| J07 | [举报问题并跟踪处理](journey-modules.zh-CN.md#j07) | ios-first |
| J08 | [删除账号并确认处理结果](journey-modules.zh-CN.md#j08) | ios-first |
| J09 | [支持人员处理一宗举报或出席纠错](journey-modules.zh-CN.md#j09) | support-first |
| J10 | [查看约饭转化和供需并追溯原因](journey-modules.zh-CN.md#j10) | admin-first |
| J11 | [调整统计分类并拿到可信导出](journey-modules.zh-CN.md#j11) | admin-first |
| J12 | [分析饭后体验与后续赴约](journey-modules.zh-CN.md#j12) | later |
| J13 | [邀请朋友查看并申请饭局](journey-modules.zh-CN.md#j13) | later |
| J14 | [提及成员并让对方看到提醒](journey-modules.zh-CN.md#j14) | later |
| J15 | [减少群消息打扰但保留重要提及](journey-modules.zh-CN.md#j15) | later |

首发iOS为J01—J08加支持运营J09，首发后台为J10/J11；后续J12—J15，移动Web不进入本版。旧能力和规则没有删除，变的是交付边界。

## 旧补丁需求映射

| 旧范围 | 当前旅程归属 |
| --- | --- |
| PATCH-001 | J01完整注册/登录、J05资料、J07/J08/J09支持与删除 |
| PATCH-002 | J01发现/申请、J03参与状态 |
| PATCH-003 | J02发起/招募、J01申请、J03参与 |
| PATCH-004 | J03沟通、J04饭后联系、J07/J08/J09支持 |
| PATCH-005 | J01/J02/J03的AI辅助路径 |
| PATCH-006 | J10/J11后台首发、J12后续体验与留存 |
| PATCH-007 | J13完整邀请旅程（后续） |
| PATCH-008 | J03基础权限与已读、J14/J15提醒增量 |

## 说明

旧M01—M12和D01—D19只作为领域规则/历史资产索引，不能继续签发为PM交付批次。当前只重拆规划，不启动新旅程或修补旧登录Demo；执行状态见[旅程方案](../delivery/journey-execution.zh-CN.md)。
