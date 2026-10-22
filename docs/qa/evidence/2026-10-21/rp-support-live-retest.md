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
