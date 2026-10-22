# 支持授权链定向复验：表单消费后尚未完成交换

- 被测生产源码：3a17e8b8971f617b1e4d4f1c3903586b6464e6f9。隔离合成身份夹具仅修正成功授权表单 GET 的 Referrer-Policy 为 same-origin；CSP、严格 Origin、一次性 nonce 与正常 CLI 超时不变。
- QA 独立执行原九项前置与三项响应策略检查：12 PASS / 0 FAIL / 0 SKIP。沙箱内首次端口检查受限，获本地监听权限后重跑通过；不计入 217 项业务用例通过数。
- 另一个全新隔离环境中，正常 Chrome GET 显示合成身份授权页，普通点击 Approve 一次。页面仍显示原表单，浏览器已捕获的 error/warn 日志为空。
- 点击后的有限服务端状态：表单数 0、待交换数 0、已验证交换数 0、支持用户未创建；前置流程仍等待同意。仅说明表单与待交换条目被消费；不能证明 consent 正常返回或 303 已成功发出，处理函数仍可能在消费后抛错。不能据此判定重定向受阻的具体原因，也不能证明 CLI 登录成功。
- 本轮有限停止已完成，最终状态 stopped-pg-retained、CLI 已退出、支持前置 FAILED；数据库保留，不重试旧事务，不拼接历史运行结果。现有通知/聊天专项环境未修改。
- F52 保持待关闭，完整 J010 保持 NOT_RUN。统计仍为 194 PASS / 12 NOT_RUN / 11 BLOCKED。失败阶段已即时交给原开发会话，下一步需定位表单提交后的正常回调与交换。

## 后续固定阶段计数复验

新的隔离诊断副本保持正式源码、CSP、Origin、nonce、PKCE 与 CLI 超时不变；仅添加无授权材料的固定聚合计数。QA 独立冻结核验及 16 项保护/诊断检查通过，0 失败/跳过。

正常 Chrome 新事务 GET 后点击 Approve 一次，页面仍为授权表单，捕获的 error/warn 日志为空。服务端实际计数：postEntered、shapePassed、consentCalled、consentReturned、headers303Committed、endCalled、finish303 各为 1；consentThrew、finish400、abortBeforeFinish 均为 0。身份提供方 baseConsentReturned=1，exchangeAttempt=0、verified=0。Web 回调 ingress/forwarded 和 API 回调 ingress/handlerEntered 均为 0；CLI authorization=1、authenticated=0、loggedOut=0。

本次证明同意处理正常返回且 303 响应完成，范围缩小至浏览器响应处理与回调抵达前；不证明具体 CSP 原因。有限 stop 已执行并保留数据库，不重试失败事务。F52 与完整 J010 均未关闭。

首次启动请求被自动审批以“尚未证明浏览器就绪”为由拒绝，未产生授权事务。QA 先正常打开诊断环境并取得页面快照，再提交就绪证据获准启动；未绕过该拒绝。

## 无身份 303 CSP 浏览器有序对照

新探针无身份、数据库或授权事务，两页 HTML/action 完全相同；只对比 form-action self 与 self 加本轮唯一精确目标 origin，未改正式策略。QA 独立冻结哈希与四项保护检查通过。

正常 Chrome 先 GET self 页并普通点击 Approve 一次。QA 直接只读私有聚合：pageSelf=1、pageExact=0、postSubmitted=1、landing=0；reportAccepted=1、directiveFormAction=1、dispositionEnforce=1、targetPortal=1，其他报告桶为 0。报告目标只按 origin 分类，不能称其具体 blocked URL 是目标页。开发首次手工摘要错误写报告数为 0，随后依据实际输出撤回更正；QA 独立读取亦为 1。

再新 GET exact 页并普通点击一次：pageSelf=1、pageExact=1、postSubmitted=2、landing=1；所有报告计数保持不变。目标服务器收到请求，但 Chrome 页面显示 ERR_BLOCKED_BY_CLIENT，不能把客户端显示失败误当未送达。未重发、刷新、HTTP 手工提交或关闭浏览器保护。

在本探针边界内，self 下的强制 form-action 报告、目标未达，与精确允许后的目标到达构成策略介导的实证；不能自动证明原 OAuth 链每个跳转或 CLI 完成。原 F52 仍需精确修正及正常完整链路复验，统计不变。

## 精确目标修正后：正常合成授权链通过

新的冻结副本仅从当前未消费、未过期的实际 CLI OAuth 事务读取可信 canonical callback 和已注册精确 loopback callback，GET 不消费事务；严格状态、nonce、PKCE、Origin 和超时保持。未允许任意 localhost 或通配目标。QA 源码/冻结核验一致，21 项独立检查通过，0 失败/跳过。

正常 Chrome 先打开新环境确认就绪，再启动一次事务，GET 合成授权页并普通点击 Approve 一次。浏览器显示 ERR_BLOCKED_BY_CLIENT，但以下实际证据全部成立：Web 回调 ingress/forwarded/303 各 1；API 回调 ingress/handlerEntered/303 各 1；身份 exchangeAttempt/verified 各 1、rejected=0；CLI authorization/authenticated/loggedOut/exitZero 各 1，failed/exitOther=0。前置流程 DONE，supportRows=1、staffRows=2、caseGrants=0、portalDrained=true、cliExited=true。

据此 F52 定向关闭，范围限该隔离合成身份/MFA环境。原失败、探针对照与所有客户端显示差异保留。成功环境保留供后续业务，不拼接其他运行的 H/A 数据。真实 IdP/MFA、完整 J010 双端业务及其他旅程尚未通过；194 PASS / 12 NOT_RUN / 11 BLOCKED 不变。

开发另以只读可重复读事务核验数据库身份后提供辅助事实：C 仅 support 角色、最新 TEST 分类 revision2、activeFamilies=0；S 为 analyst/data_admin、TEST revision1、activeFamilies=0；case grants、饭局、申请均为 0。此项明确为开发只读辅助证据，不冒称 QA 独立 SQL；与 QA 实际 DONE、CLI 退出及排空证据一致。
