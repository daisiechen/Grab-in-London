# Fancy MVP产品需求版本与功能范围

修订：r03｜本版：iOS App与管理后台Web｜移动Web后置。

## 1. 版本说明

[MVP项目需求](fancy-requirements-baseline.zh-CN.md)描述产品目标与使用者；本表将各模块功能分成可单独核对的需求版本。M编号代表业务模块，D编号代表功能范围，不代表每个编号单独上线。本版功能规则不因拆分改变，移动Web专属需求标为后续。

## 2. 功能版本目录

| 需求版 | 功能范围与说明 | 平台与本版状态 |
| --- | --- | --- |
| D01 | [M01 账号与资料闭环](modules/m01-account-profile.zh-CN.md) | 本版：iOS |
| D02 | [M02 发现与详情闭环](modules/m02-discovery-detail.zh-CN.md) | 本版：iOS |
| D03 | [M03 创建与安排闭环](modules/m03-hosting-arrangements.zh-CN.md) | 本版：iOS |
| D04 | [M04 申请与成员闭环](modules/m04-applications-membership.zh-CN.md) | 本版：iOS |
| D05 | [M05 基础沟通闭环](modules/m05-inbox-messaging.zh-CN.md) | 本版：iOS |
| D06 | [M06 出席与反馈](modules/m06-attendance-connections.zh-CN.md) | 本版：iOS |
| D07 | [M06 再约与连接](modules/m06-attendance-connections.zh-CN.md) | 本版：iOS |
| D08 | [M07 举报与支持纠错](modules/m07-support-deletion.zh-CN.md) | 本版：iOS |
| D09 | [M07 删除与结果恢复](modules/m07-support-deletion.zh-CN.md) | 本版：iOS |
| D10 | [M08 基础统计与追溯](modules/m08-analytics-admin.zh-CN.md) | 本版：管理后台 |
| D11 | [M08 分类、快照与导出](modules/m08-analytics-admin.zh-CN.md) | 本版：管理后台 |
| D12 | [M08 体验与留存](modules/m08-analytics-admin.zh-CN.md) | 本版：管理后台 |
| D13 | [M09 查询、解释与偏好](modules/m09-ai-assistant.zh-CN.md) | 本版：iOS |
| D14 | [M09 草稿与原编辑器转入](modules/m09-ai-assistant.zh-CN.md) | 本版：iOS |
| D15 | [M10 Web分享与接收](modules/m10-sharing-invitations.zh-CN.md) | 后续：移动Web |
| D16 | [M10 iOS分享与公开链接](modules/m10-sharing-invitations.zh-CN.md) | 本版：iOS；未安装App的邀请落地待明确 |
| D17 | [M11 站内提及与免打扰](modules/m11-mentions-muting.zh-CN.md) | 本版：iOS |
| D18 | [M12 iOS系统投递](modules/m12-system-notifications.zh-CN.md) | 本版：iOS |
| D19 | [M12 Web系统投递](modules/m12-system-notifications.zh-CN.md) | 后续：移动Web |

D16的iOS分享功能仍在本版范围，未安装App者如何接收邀请是单独待决的产品问题。本版不承诺存在移动Web邀请页，也不把一个分享菜单视为完整邀请体验。

## 3. 已有补丁需求的对应关系

| 旧范围 | 本次归属 |
| --- | --- |
| PATCH-001 | D01账号资料；D08举报支持；D09删除/公开支持出口 |
| PATCH-002 | D02发现详情；D04申请/成员 |
| PATCH-003 | D03发起安排；D04审核与成员变更联动 |
| PATCH-004 | D05基础沟通；D06/07饭后与连接；D08/09支持和删除联动 |
| PATCH-005 | D13/14 AI |
| PATCH-006 | D10/11/12后台 |
| PATCH-007 | D15/16分享 |
| PATCH-008 | D05基础可见已读/历史权限；D17提及与mute；D18/19系统通知 |

这张表只说明需求归属，不表示功能已经实现。移动Web对应部分保留为后续，iOS/后台部分保留原业务要求。

## 4. 文档关系

12份模块说明列出用户路径、业务规则和产品结果；[项目管理方案](../delivery/project-management-plan.zh-CN.md)单独说明项目人员、执行依赖、工作包、环境和验收取证。产品功能的先后与范围不赋予任何工程写入权限。
