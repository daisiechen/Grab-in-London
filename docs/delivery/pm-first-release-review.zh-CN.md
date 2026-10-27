# 首发旅程PM候选与成对评审入口（r08）

本页由PJ维护交付索引，不改写各PM产出的需求或Demo。范围为r07、输入提交e7f2b89；只签发首发J01—J11的PM阶段。每条旅程独立供用户审阅，尚未接受为UX/RD输入。

当前状态：11个PM候选已交回，含本轮原作者PM-r02修订，均待用户审阅；acceptedForNextStage=false，后续专业阶段未签发。

## 逐旅程产物

| 旅程 | 作者 | 规划版本 | 需求 | Demo | 作者验证/清单 |
| --- | --- | --- | --- | --- | --- |
| J01 找到并申请一场合适的饭局 | PM-1 | IOS-0.1.0 | [PRD](../product/journeys/j01/requirements.zh-CN.md)／[原需求映射](../product/journeys/j01/coverage.json) | [独立Demo](../../demo/journeys/j01/index.html) | [验证](../product/journeys/j01/author-verification.zh-CN.md)／[固定清单](../product/journeys/j01/artifact-manifest.json) |
| J02 发起饭局并完成招募管理 | PM-2 | IOS-0.1.0 | [PRD](../product/journeys/j02/requirements.zh-CN.md)／[原需求映射](../product/journeys/j02/coverage.json) | [独立Demo](../../demo/journeys/j02/index.html) | [验证](../product/journeys/j02/author-verification.zh-CN.md)／[固定清单](../product/journeys/j02/artifact-manifest.json) |
| J03 赴约前沟通安排或调整参与 | PM-2 | IOS-0.1.0 | [PRD](../product/journeys/j03/requirements.zh-CN.md)／[原需求映射](../product/journeys/j03/coverage.json) | [独立Demo](../../demo/journeys/j03/index.html) | [验证](../product/journeys/j03/author-verification.zh-CN.md)／[固定清单](../product/journeys/j03/artifact-manifest.json) |
| J04 饭后记录体验并决定是否继续联系 | PM-2 | IOS-0.1.0 | [PRD](../product/journeys/j04/requirements.zh-CN.md)／[原需求映射](../product/journeys/j04/coverage.json) | [独立Demo](../../demo/journeys/j04/index.html) | [验证](../product/journeys/j04/author-verification.zh-CN.md)／[固定清单](../product/journeys/j04/artifact-manifest.json) |
| J05 更新个人介绍或隐私选择 | PM-1 | IOS-0.1.0 | [PRD](../product/journeys/j05/requirements.zh-CN.md)／[原需求映射](../product/journeys/j05/coverage.json) | [独立Demo](../../demo/journeys/j05/index.html) | [验证](../product/journeys/j05/author-verification.zh-CN.md)／[固定清单](../product/journeys/j05/artifact-manifest.json) |
| J06 提交或更新一份产品意见 | PM-1 | IOS-0.1.0 | [PRD](../product/journeys/j06/requirements.zh-CN.md)／[原需求映射](../product/journeys/j06/coverage.json) | [独立Demo](../../demo/journeys/j06/index.html) | [验证](../product/journeys/j06/author-verification.zh-CN.md)／[固定清单](../product/journeys/j06/artifact-manifest.json) |
| J07 举报问题并跟踪处理 | PM-3 | IOS-0.1.0 | [PRD](../product/journeys/j07/requirements.zh-CN.md)／[原需求映射](../product/journeys/j07/coverage.json) | [独立Demo](../../demo/journeys/j07/index.html) | [验证](../product/journeys/j07/author-verification.zh-CN.md)／[固定清单](../product/journeys/j07/artifact-manifest.json) |
| J08 删除账号并确认处理结果 | PM-3 | IOS-0.1.0 | [PRD](../product/journeys/j08/requirements.zh-CN.md)／[原需求映射](../product/journeys/j08/coverage.json) | [独立Demo](../../demo/journeys/j08/index.html) | [验证](../product/journeys/j08/author-verification.zh-CN.md)／[固定清单](../product/journeys/j08/artifact-manifest.json) |
| J09 支持人员处理一宗举报或出席纠错 | PM-3 | SUPPORT-0.1.0 | [PRD](../product/journeys/j09/requirements.zh-CN.md)／[原需求映射](../product/journeys/j09/coverage.json) | [独立Demo](../../demo/journeys/j09/index.html) | [验证](../product/journeys/j09/author-verification.zh-CN.md)／[固定清单](../product/journeys/j09/artifact-manifest.json) |
| J10 查看约饭转化和供需并追溯原因 | PM-3 | ADMIN-0.1.0 | [PRD](../product/journeys/j10/requirements.zh-CN.md)／[原需求映射](../product/journeys/j10/coverage.json) | [独立Demo](../../demo/journeys/j10/index.html) | [验证](../product/journeys/j10/author-verification.zh-CN.md)／[固定清单](../product/journeys/j10/artifact-manifest.json) |
| J11 调整统计分类并拿到可信导出 | PM-3 | ADMIN-0.1.0 | [PRD](../product/journeys/j11/requirements.zh-CN.md)／[原需求映射](../product/journeys/j11/coverage.json) | [独立Demo](../../demo/journeys/j11/index.html) | [验证](../product/journeys/j11/author-verification.zh-CN.md)／[固定清单](../product/journeys/j11/artifact-manifest.json) |

## 评审顺序与证据边界

先看J01完整参加流程，再看J02发起/招募与J03沟通；J04饭后/J05本人资料与AI偏好/J06产品问卷各自成对审阅。J07/J08/J09看举报、离开和支持处理闭环，J10/J11看内部分析与可信导出。不是先批所有页面再补用户旅程。

各Demo是独立内存模型：合成身份、角色、时间、饭局及数据，不跨Demo共享状态，不构成生产后端、真实AI、真实通知/删除或跨端联调。PRD和coverage明确区分可交互、文档约束和未测能力；不能用作者检查或PJ集成核对替代独立QA。所有外部真实门槛、原缺陷与未决项保持。

3个PM完成需求与Demo，PJ核对原文覆盖、文件哈希、阶段边界及各入口执行。初版交付时真实浏览器视觉、Figma冻结、真机及真实服务尚未验证（浏览器复核更新见文末）；UX、RD、QA仍未启动，J12—J15未签发。

本地路径可直接打开；统一私有预览已按用户明确授权发布，仅owner可访问，入口只在本聊天提供。托管副本来自未改写的PM候选提交`14db53257a2b4bb7610a3afad5e1ecfd735db605`；[发布摘要与逐包哈希](pm-preview-release.json)不包含私有URL或项目/版本/部署标识，完整部署元数据保留在被Git忽略的私有记录。Sites返回succeeded证明静态预览部署成功，不证明真实产品服务或浏览器视觉验收。


## 本轮验证

三位PM全部冻结并交接后，PJ运行 `python3 -m unittest discover -s tests -v`：181项通过（26.480s），并通过 `git diff --check`。检查包含作者状态/DOM操作、逐条范围、产物哈希、11个file入口执行和仅PM阶段边界；不是独立产品QA。原研究及旧QA未提交内容保留，未混入本轮候选。


## r02：PRD阅读入口修复

旧独立PRD子页在托管环境返回307重定向，用户报告无法打开。本轮将11份PRD全文内嵌在评审首页，点击查看需求仅改变片段路由，不再请求独立子页；支持直达片段、返回列表及焦点恢复。原PM需求/Demo未改写。新增DOM回归逐份比较全文与原文件，11份打开/返回均通过；发布后授权读取首页HTTP 200、11份文档模板与新入口均存在。自动真实浏览器在私有登录页停止，因此不宣称真实浏览器视觉验收通过。私有URL及精确部署标识继续不进公开仓库。


## 2026-10-27 PJ复核与候选修订

[逐旅程复核报告](../reviews/pm-journeys-pj-review-2026-10-27.zh-CN.md)记录真实浏览器发现和闭合。PRD、Demo分别版本化：以各包manifest的requirementsRevision/demoRevision为准，不能将修订后的文件仍当同一冻结产物；业务发布集合未变。用户未授权进入UX、RD、QA，全部下游阶段仍未启动。

本次私有线上候选已由PJ实开11份PRD及11个Demo，在1440px和390px完成22次代表流程，全部通过；22次PRD全文与源文件一致，浏览器页面异常、请求失败、控制台警告/错误及整页横向溢出均为0。194项仓库检查通过。详见上述报告与逐步证据；真实iOS、生产服务及独立QA不在本次验证范围，UX、RD、QA保持未启动。
