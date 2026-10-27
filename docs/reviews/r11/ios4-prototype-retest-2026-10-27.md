# iOS dev.4 · 2026-10-27 实际原型点击补测

范围：公开 Figma 固定合成样例。逐项真实鼠标点击；不把节点、连线、截图或静态测试当作流程通过。基线 `0975177`；Figma 可变，本次修复由原 UX-2 执行。

当前：11 项 PASS，1 项 BLOCKED；首次发现的重复无效支持入口已由原 UX 修复，并以真实点击复测关闭。不是产品 QA 或真机验收。

## I4-REPORT-CANCEL · PASS

[打开本项原型](https://www.figma.com/proto/TxashjRfQDvnc4jQieeaWu?node-id=2-4&starting-point-node-id=2%3A4)

实际操作：Report or block this member → Cancel。

可见结果：空表单Cancel实际回Maya2:4。

## I4-REPORT-DRAFT · PASS

[打开本项原型](https://www.figma.com/proto/TxashjRfQDvnc4jQieeaWu?node-id=2-4&starting-point-node-id=2%3A4)

实际操作：Report or block this member → Choose a reason → Cancel → Report or block this member。

可见结果：Safety concern与预置I felt unsafe during this conversation.重进保留；仅固定样例，不含自由文本。

## I4-REPORT-FREETEXT · BLOCKED

[打开本项原型](https://www.figma.com/proto/TxashjRfQDvnc4jQieeaWu?node-id=2-4&starting-point-node-id=2%3A4)

实际操作：Report or block this member → Choose a reason → Click description → Attempt Synthetic only note 123。

可见结果：文本未改变，原型只能使用固定示例，任意输入和自由文本草稿保留不可验证。

## I4-REPORT-RECEIPT · PASS

[打开本项原型](https://www.figma.com/proto/TxashjRfQDvnc4jQieeaWu?node-id=2-4&starting-point-node-id=2%3A4)

实际操作：Report or block this member → Choose a reason → Send private report → Your reports → View report。

可见结果：R-104 / Maya；Received · awaiting review；本人记录可查看原原因及说明；回执不表示调查完成。

## I4-DELETE-CANCEL · PASS

[打开本项原型](https://www.figma.com/proto/TxashjRfQDvnc4jQieeaWu?node-id=5-16&starting-point-node-id=5%3A16)

实际操作：Delete account → Continue to verify identity → Cancel deletion。

可见结果：从Verify identity取消实际返回Settings5:16。

## I4-DELETE-CONSENT · PASS

[打开本项原型](https://www.figma.com/proto/TxashjRfQDvnc4jQieeaWu?node-id=5-16&starting-point-node-id=5%3A16)

实际操作：Delete account → Continue to verify identity → Verify identity (fixed example 123456) → Request account deletion while unchecked。

可见结果：Final confirmation未勾选时禁用、点击不跳转；未发送真实验证码。

## I4-DELETE-PENDING · PASS

[打开本项原型](https://www.figma.com/proto/TxashjRfQDvnc4jQieeaWu?node-id=5-16&starting-point-node-id=5%3A16)

实际操作：Delete account → Continue to verify identity → Verify identity (fixed example) → Explicitly check confirmation → Request account deletion → Contact support → Back to deletion status → Check deletion status。

可见结果：D-204 / Request accepted / PENDING；支持无需登录；返回及查询保留原Pending；仅模拟访问关闭文案。

## I4-SUPPORT-PENDING · PASS

[打开本项原型](https://www.figma.com/proto/TxashjRfQDvnc4jQieeaWu?node-id=5-182&starting-point-node-id=5%3A182)

实际操作：Contact support → Back to deletion status。

可见结果：回5:182/PENDING。直达只建立外部事件前置。

## I4-SUPPORT-NEEDS-SUPPORT · PASS

[打开本项原型](https://www.figma.com/proto/TxashjRfQDvnc4jQieeaWu?node-id=5-275&starting-point-node-id=5%3A275)

实际操作：Contact support → Back to deletion status。

可见结果：回5:275/NEEDS_SUPPORT，无状态倒退。直达不等于worker真实推进。

## I4-SUPPORT-COMPLETED · PASS

[打开本项原型](https://www.figma.com/proto/TxashjRfQDvnc4jQieeaWu?node-id=5-348&starting-point-node-id=5%3A348)

实际操作：Refresh Completed5:348 → Observe exactly one Contact support → Click unique Contact support → Back to deletion status → Contact support → Retry saved receipt。

可见结果：修后唯一Contact support实际进入14:138；Back及Retry均回5:348，保持COMPLETED与D-204。

首次结果保留：FAIL。两个同名入口；上方无反馈，下方进入14:138并返回5:348/COMPLETED。确定原型死入口，已交原UX-2最小修复。

原 UX 最小修复：删除无动作的重复入口；修后独立浏览器刷新、点击唯一入口、返回及 Retry，状态保持，关闭 R11-I4-PROT-01。

## I4-RETRY-NEEDS-SUPPORT · PASS

[打开本项原型](https://www.figma.com/proto/TxashjRfQDvnc4jQieeaWu?node-id=5-275&starting-point-node-id=5%3A275)

实际操作：Open representative state as precondition → Contact support → Retry saved receipt。

可见结果：实际查询后保留NEEDS_SUPPORT / D-204；不模拟worker推进。

## I4-RETRY-PENDING · PASS

[打开本项原型](https://www.figma.com/proto/TxashjRfQDvnc4jQieeaWu?node-id=5-182&starting-point-node-id=5%3A182)

实际操作：Open representative state as precondition → Contact support → Retry saved receipt。

可见结果：实际查询后保留PENDING / D-204；不模拟worker推进。

## 剩余未验证范围

- Arbitrary report free text and free-text draft persistence (fixed-sample prototype limitation)
- Real authentication/code delivery, server-side access closure, token revocation and data deletion
- Real cleanup worker, network retries/concurrency, receipt expiry and cross-device persistence
- Native iOS device/keyboard/VoiceOver/dynamic type
- Real support email/contact; no mail sent

说明：直达 Pending / Needs support / Completed 仅建立外部事件代表前置，不表示真实清理已发生；示例码不是已验证真实认证；回执文案不是服务端访问关闭证据。

[结构化记录](ios4-prototype-retest-2026-10-27.json)。旧设计评审签署保留为历史快照，本次补充覆盖本次变更，不重写旧签署。
