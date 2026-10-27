# r11 分版本进度与交付入口

2026-10-27评审与开发方案快照。每版的实时状态以其status.json、独立评审和PR为准；本页不把设计、方案、业务实现、真实测试及发布混为一个“完成”。

## 负责人

| 版本PJ | 独立责任范围 |
| --- | --- |
| PJ-IOS1 | iOS dev.1：发现、完整注册登录、申请与个人偏好 |
| PJ-IOS-DEV2 | iOS dev.2：发起饭局与招募；新接管工程和台账，原Figma作者保留设计修复职责 |
| PJ-IOS2 | iOS dev.3与dev.4：沟通、饭后、问卷、安全及删除，分别交付 |
| PJ-ADMIN | Admin dev.1、dev.2与Support dev.1，分别交付 |

总PJ负责接口writer、资源排班、跨版依赖、Git集成和商店发布组合；原作者修复，其他负责人独立复验。设计通过哪版就推进哪版方案，不等待全部七版，也不把局部接口缺口传递成整版等待。

## 七版交付

| 内部开发版本 | 设计评审 | 独立工程方案 | 专属交付PR |
| --- | --- | --- | --- |
| IOS-0.1.0-dev.1 | 通过 | 通过，7包/28个未执行业务场景 | [PR #6](https://github.com/daisiechen/Grab-in-London/pull/6) |
| IOS-0.1.0-dev.2 | 通过，5项设计问题已关闭 | 通过，7包/29个未执行业务场景 | [PR #8](https://github.com/daisiechen/Grab-in-London/pull/8) |
| IOS-0.1.0-dev.3 | 通过 | 通过，7包/22个未执行业务场景 | [PR #7](https://github.com/daisiechen/Grab-in-London/pull/7) |
| IOS-0.1.0-dev.4 | 通过 | 通过，14个未执行业务场景 | [PR #2](https://github.com/daisiechen/Grab-in-London/pull/2) |
| SUPPORT-0.1.0-dev.1 | 通过 | 通过，独立包与测试计划 | [PR #5](https://github.com/daisiechen/Grab-in-London/pull/5) |
| ADMIN-0.1.0-dev.1 | 通过 | 通过，独立包与测试计划 | [PR #3](https://github.com/daisiechen/Grab-in-London/pull/3) |
| ADMIN-0.1.0-dev.2 | 通过 | 通过，独立包与测试计划 | [PR #4](https://github.com/daisiechen/Grab-in-London/pull/4) |

各PR仅集成本版已冻结产物与必要共享登记，独立worktree验证，必需CI通过才合main。PR中的CI及合并状态是实时权威，不用本表的静态文字推断已经部署。已修共享CI的过期日期夹具及旧PM Node入口，没有跳过失败断言或修改生产功能来取得绿灯。

## 下一阶段与版本追问

本轮完成设计修复、独立评审、开发方案及测试矩阵；新版本业务实现、按版真实验收、部署和商店提交均未启动。已执行的设计证据/计划检查及既有代码CI回归，不等于这些新版本的产品验收矩阵已运行。

每版下一步是按既定小包落实实际RD人员、精确文件租约、共享契约增量和最小环境，再记录代码候选、单版测试、影响回归与实际跨版联调。I1统计接口只卡对应P03/最终完整性，I3群名单增量只卡对应名单接入；其他已核定合同的小包不互等整版。不得把“方案通过”解释成实际已开发。

后续按版本报告：当前阶段、已完成、正在执行、真正阻塞、下一步、代码/构建/测试证据和发布归属；不再每次重新展开整项目。

首个商店候选0.1.0合并四个iOS内部迭代与最小支持能力，保持完整使用及安全闭环。每次iOS迭代有独立build与目标商店版本登记；可以按审核状态合并发布，不伪造固定更新间隔。完整规则见[版本PJ并行工作流](parallel-version-workflow-r11.zh-CN.md)和[执行登记](execution-r11.json)。Logo候选仍独立，不自动替换已认可的MVP界面。
