# Fancy MVP产品需求版本与功能范围

修订：r05｜本版：iOS App与管理后台Web｜移动Web后置。

## 1. 版本说明

[MVP项目需求](fancy-requirements-baseline.zh-CN.md)描述产品目标与使用者；本表将各模块功能分成可单独核对的需求版本。M编号代表业务模块，D编号代表功能范围，不代表每个编号单独上线。本表“本版”指完整MVP规划，首次对外发布取第6节的首发子集。功能规则不因拆分改变，移动Web专属需求标为后续。

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

## 3. 需求范围内的具体功能小批

D01—D19是需求归属，不再作为一次大包。各小批的完整做/不做、可用前提和完成结果见[分批功能范围](mvp-batch-scope.zh-CN.md)。

| 需求范围 | 具体小批 |
| --- | --- |
| D01 | [M01-01 访客入口与邮箱登录](mvp-batch-scope.zh-CN.md#m01-01)；[M01-02 Google登录](mvp-batch-scope.zh-CN.md#m01-02)；[M01-03 Apple登录](mvp-batch-scope.zh-CN.md#m01-03)；[M01-04 首次资料与参与门槛](mvp-batch-scope.zh-CN.md#m01-04)；[M01-05 公开主页与本人资料编辑](mvp-batch-scope.zh-CN.md#m01-05)；[M01-06 基本设置、可选统计与安全退出](mvp-batch-scope.zh-CN.md#m01-06) |
| D02 | [M02-01 地图和列表浏览](mvp-batch-scope.zh-CN.md#m02-01)；[M02-02 筛选、应用与取消](mvp-batch-scope.zh-CN.md#m02-02)；[M02-03 详情、权限状态与原路返回](mvp-batch-scope.zh-CN.md#m02-03) |
| D03 | [M03-01 创建草稿与选店](mvp-batch-scope.zh-CN.md#m03-01)；[M03-02 日期、时间、人数与截止](mvp-batch-scope.zh-CN.md#m03-02)；[M03-03 介绍、费用声明与发布](mvp-batch-scope.zh-CN.md#m03-03)；[M03-04 编辑安排与首次批准后的锁定](mvp-batch-scope.zh-CN.md#m03-04)；[M03-05 主动取消整场](mvp-batch-scope.zh-CN.md#m03-05)；[M03-06 截止、最低人数与开始资格](mvp-batch-scope.zh-CN.md#m03-06) |
| D04 | [M04-01 申请、待审与撤回](mvp-batch-scope.zh-CN.md#m04-01)；[M04-02 主持审核与最后名额](mvp-batch-scope.zh-CN.md#m04-02)；[M04-03 退席与新轮次申请](mvp-batch-scope.zh-CN.md#m04-03) |
| D05 | [M05-01 Inbox与既有业务通知](mvp-batch-scope.zh-CN.md#m05-01)；[M05-02 群消息收发与断网保稿](mvp-batch-scope.zh-CN.md#m05-02)；[M05-03 独立退群与只读历史](mvp-batch-scope.zh-CN.md#m05-03)；[M05-04 发起人解散群聊](mvp-batch-scope.zh-CN.md#m05-04)；[M05-05 可见已读与未读恢复](mvp-batch-scope.zh-CN.md#m05-05) |
| D06 | [M06-01 出席报告与host补缺](mvp-batch-scope.zh-CN.md#m06-01)；[M06-02 本顿饭的私密体验评分](mvp-batch-scope.zh-CN.md#m06-02)；[M06-03 公开个人文字评价](mvp-batch-scope.zh-CN.md#m06-03)；[M06-04 独立可选产品问卷](mvp-batch-scope.zh-CN.md#m06-04) |
| D07 | [M06-05 私密再约与互选资格](mvp-batch-scope.zh-CN.md#m06-05)；[M06-06 私聊发送与撤回联系](mvp-batch-scope.zh-CN.md#m06-06)；[M06-07 拉黑、解除与联系资格收回](mvp-batch-scope.zh-CN.md#m06-07) |
| D08 | [M07-01 私密举报与本人受理回执](mvp-batch-scope.zh-CN.md#m07-01)；[M07-02 支持人员的个案授权处理](mvp-batch-scope.zh-CN.md#m07-02)；[M07-03 逾期出席纠错与影响传播](mvp-batch-scope.zh-CN.md#m07-03) |
| D09 | [M07-04 重新认证申请删除与同步屏障](mvp-batch-scope.zh-CN.md#m07-04)；[M07-05 删除处理、结果恢复与公开支持出口](mvp-batch-scope.zh-CN.md#m07-05) |
| D10 | [M08-01 授权后台入口与查询范围](mvp-batch-scope.zh-CN.md#m08-01)；[M08-02 产品概览](mvp-batch-scope.zh-CN.md#m08-02)；[M08-03 用户旅程](mvp-batch-scope.zh-CN.md#m08-03)；[M08-04 饭局与供需](mvp-batch-scope.zh-CN.md#m08-04) |
| D11 | [M08-05 数据与定义的只读解释](mvp-batch-scope.zh-CN.md#m08-05)；[M08-06 账号分类保存与原次结果恢复](mvp-batch-scope.zh-CN.md#m08-06)；[M08-07 统计刷新、失败重试与就绪切换](mvp-batch-scope.zh-CN.md#m08-07)；[M08-08 聚合导出与失效撤销](mvp-batch-scope.zh-CN.md#m08-08) |
| D12 | [M08-09 体验与问卷分析](mvp-batch-scope.zh-CN.md#m08-09)；[M08-10 成熟队列与重复赴约](mvp-batch-scope.zh-CN.md#m08-10) |
| D13 | [M09-01 明确确认的偏好与助手会话](mvp-batch-scope.zh-CN.md#m09-01)；[M09-02 查找、比较与本人状态解释](mvp-batch-scope.zh-CN.md#m09-02) |
| D14 | [M09-03 AI申请草稿转入](mvp-batch-scope.zh-CN.md#m09-03)；[M09-04 AI创建草稿转入](mvp-batch-scope.zh-CN.md#m09-04)；[M09-05 AI群消息草稿转入](mvp-batch-scope.zh-CN.md#m09-05) |
| D15 | [M10-W01 移动Web分享与复制](mvp-batch-scope.zh-CN.md#m10-w01)；[M10-W02 移动Web邀请落地](mvp-batch-scope.zh-CN.md#m10-w02) |
| D16 | [M10-01 iOS分享菜单与复制](mvp-batch-scope.zh-CN.md#m10-01)；[M10-02 已安装iOS的邀请链接落地](mvp-batch-scope.zh-CN.md#m10-02)；[M10-03 外部邀请接收与未安装路径](mvp-batch-scope.zh-CN.md#m10-03) |
| D17 | [M11-01 提及选择与草稿实体](mvp-batch-scope.zh-CN.md#m11-01)；[M11-02 发送提及与本人站内记录](mvp-batch-scope.zh-CN.md#m11-02)；[M11-03 跨iOS会话群免打扰](mvp-batch-scope.zh-CN.md#m11-03)；[M11-04 应用内横幅与可见性矩阵](mvp-batch-scope.zh-CN.md#m11-04) |
| D18 | [M12-01 iOS通知授权与订阅生命周期](mvp-batch-scope.zh-CN.md#m12-01)；[M12-02 iOS普通消息与提及通知](mvp-batch-scope.zh-CN.md#m12-02)；[M12-03 排队提醒的抑制与恢复](mvp-batch-scope.zh-CN.md#m12-03) |
| D19 | [M12-W01 Web通知授权与订阅](mvp-batch-scope.zh-CN.md#m12-w01)；[M12-W02 Web通知投递与恢复](mvp-batch-scope.zh-CN.md#m12-w02) |

## 4. 已有补丁需求的对应关系

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

## 5. 文档关系

12份模块说明列出用户路径、业务规则和产品结果；[项目管理方案](../delivery/project-management-plan.zh-CN.md)单独说明项目人员、执行依赖、工作包、环境和验收取证。产品功能的先后与范围不赋予任何工程写入权限。

## 6. 首发产品组合

首发iOS为D01—D09、D13/D14的40小批；首发后台为D10/D11的M08-01—08共8小批。D12、D16、D17、D18共12小批为首发后增量，不取消需求。D15/D19的Web4批继续后置。对应可用功能见[MVP项目需求](fancy-requirements-baseline.zh-CN.md)，精确集合及依赖见[首次发布集合](../delivery/release-sets.zh-CN.md)。
