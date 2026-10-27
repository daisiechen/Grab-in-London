# I1 真实原型点击补测（2026-10-27）

20 项列举固定样例实际点击均通过。保留最初受阻、偏好保存重入失败及修后结果；不代表真实服务或任意输入验收。原 UX 修复本人包，补充不是新的独立 UX 自签。

[Discover 原型](https://www.figma.com/proto/CS9oRCq8h3Clg09up2aISj?node-id=5-17&starting-point-node-id=5%3A17) · [Profile 原型](https://www.figma.com/proto/CS9oRCq8h3Clg09up2aISj?node-id=11-1513&starting-point-node-id=11%3A1513)

偏好修复：保存标记为真、删除标记为假；整行/文字入口和取消读取已确认状态。仅改6个控件连线与1个原型变量，没有视觉、PRD、Demo、工程方案或业务代码变化。原独立评审及其 final-readback 作为历史快照保留，新候选见包 manifest.prototypeSupplement20261027。

## I1-CLICK-01 · PASS

[本项入口](https://www.figma.com/proto/CS9oRCq8h3Clg09up2aISj?node-id=5-17&starting-point-node-id=5%3A17)

实际点击：Click An easy Friday supper meal card → Click Ask Fancy → Click Continue manually → Click Apply to join。

观察：Permission closes to same guest meal5:195. Apply opens Good to meet you account gate10:65; rejecting AI does not authenticate guest.

## I1-CLICK-02 · PASS

[本项入口](https://www.figma.com/proto/CS9oRCq8h3Clg09up2aISj?node-id=5-17&starting-point-node-id=5%3A17)

实际点击：Reload Discover → Meal card→Ask Fancy→Allow and continue。

观察：Assistant33:152 shows What sounds good? / Nothing is sent until you choose Send. No generated result visible.

## I1-CLICK-03 · PASS

[本项入口](https://www.figma.com/proto/CS9oRCq8h3Clg09up2aISj?node-id=5-17&starting-point-node-id=5%3A17)

实际点击：Click Draft an application suggestion → Click visible composer Send arrow。

观察：Result12:97 contains full draft ending Is there anything I should know before joining? and nothing has been sent notice. Simulated response, not model execution.

## I1-CLICK-04 · PASS

[本项入口](https://www.figma.com/proto/CS9oRCq8h3Clg09up2aISj?node-id=5-17&starting-point-node-id=5%3A17)

实际点击：Click Edit application → Continue with email → Send code → Verify & continue on representative123456。

观察：Synthetic email/code screens5:355→10:134→10:236. No actual mail or personal data.

## I1-CLICK-05 · PASS

[本项入口](https://www.figma.com/proto/CS9oRCq8h3Clg09up2aISj?node-id=5-17&starting-point-node-id=5%3A17)

实际点击：At incomplete checked profile27:272 click visible selected avatar sample → Observe populated introduction27:132 with agreement retained → Click Take your seat。

观察：Reached request editor with existing original sample introduction. First incomplete-field stop was valid disabled-state behavior, not a design repair.

首次结果保留：BLOCKED。Still27:272 with empty required introduction/At least20 characters. Native follow-up confirms intentionally incomplete state; continuation will click avatar sample. First attempt is retained, no downstream pass inferred.

## I1-CLICK-06 · PASS

[本项入口](https://www.figma.com/proto/CS9oRCq8h3Clg09up2aISj?node-id=11-1513&starting-point-node-id=11%3A1513)

实际点击：Profile→Settings → Toggle Off→On → Cancel changes。

观察：Returned confirmedOff

## I1-CLICK-07 · PASS

[本项入口](https://www.figma.com/proto/CS9oRCq8h3Clg09up2aISj?node-id=11-1513&starting-point-node-id=11%3A1513)

实际点击：Toggle On → Save privacy choice → Back→Profile→Settings。

观察：Privacy choice saved On; reentry remainedOn

## I1-CLICK-08 · PASS

[本项入口](https://www.figma.com/proto/CS9oRCq8h3Clg09up2aISj?node-id=11-1513&starting-point-node-id=11%3A1513)

实际点击：Toggle On→Off → Cancel changes。

观察：Preserved prior confirmedOn

## I1-CLICK-09 · PASS

[本项入口](https://www.figma.com/proto/CS9oRCq8h3Clg09up2aISj?node-id=11-1513&starting-point-node-id=11%3A1513)

实际点击：Toggle Off → Save privacy choice → Back→Profile→Settings。

观察：Privacy choice saved Off; reentry remainedOff

## I1-CLICK-10 · PASS

[本项入口](https://www.figma.com/proto/CS9oRCq8h3Clg09up2aISj?node-id=11-1513&starting-point-node-id=11%3A1513)

实际点击：From allowed J05assistant11:2113 click full My preferences row。

观察：Opened11:1854. First label-only non-navigation retained; full row successful, no Figma edits.

首次结果保留：BLOCKED。No navigation. Actual current sheet node not specified by first run, so do not attribute to J05 native11:2222 yet. Continuation isolates correct J05 entry.

## I1-CLICK-11 · PASS

[本项入口](https://www.figma.com/proto/CS9oRCq8h3Clg09up2aISj?node-id=5-17&starting-point-node-id=5%3A17)

实际点击：Discover→meal→Ask Fancy→Allow → Draft application→Send→Edit application → Continue email→Send code→Verify → Click avatar sample→explicit18+/community→Take your seat。

观察：Actual uninterrupted5:17→5:195→12:313→33:152→33:285→12:97→10:65→5:355→10:134→10:236→10:375→27:132→12:574. Keep→11:753 preserves old text. Signed-in repeat reaches12:574→Replace15:212, full final sentence retained, explicit arrangement15:308→manualSend11:978. No URL switches/reloads during chain. Earlier nonappearance is not confirmed design defect.

首次结果保留：NOT_RUN。No Keep/Replace prompt was exposed in this main-chain continuation. Existing text remained, but this is NOT proof of explicit Keep/Replace. Isolated control clicks pending. Native conditional remains inspection only.

## I1-CLICK-12 · PASS

[本项入口](https://www.figma.com/proto/CS9oRCq8h3Clg09up2aISj?node-id=11-978&starting-point-node-id=11%3A978)

实际点击：On existing introduction request editor explicitly tick host-arrangements consent → Click Send request → Pending11:978 Back → Pending meal32:156 Back。

观察：Your hello is on its way / Application pending; returned to same Pending meal then Inbox Applications31:394 with Application pending, no new guestApply in this path.

首次结果保留：NOT_RUN。Pending Back→same meal→Inbox with Pending not executed in initial run; continuation pending.

## I1-CLICK-13 · PASS

[本项入口](https://www.figma.com/proto/CS9oRCq8h3Clg09up2aISj?node-id=11-1854&starting-point-node-id=11%3A1854)

实际点击：My preferences→click natural-language input sample → Observe six-field proposed summary → Confirm and remember → Delete preferences → Confirm deletion。

观察：Review lists Soho/up to£35/table4/English/easy conversation/vegetarian options; explicit confirmation shows saved summary; deletion confirmation13:355 returns No saved preferences yet. Arbitrary typing not certified.

首次结果保留：NOT_RUN。Six-field proposal/Cancel/Save/reenter/Delete Keep/confirm/reenter not executed in initial run; continuation pending.

## I1-CLICK-14 · PASS

[本项入口](https://www.figma.com/proto/CS9oRCq8h3Clg09up2aISj?node-id=11-1854&starting-point-node-id=11%3A1854)

实际点击：Profile→Settings→assistant→My preferences → Click input→six-field proposal31:257 → Cancel。

观察：Returned11:1854 No saved preferences yet.

## I1-CLICK-15 · PASS

[本项入口](https://www.figma.com/proto/CS9oRCq8h3Clg09up2aISj?node-id=11-1854&starting-point-node-id=11%3A1854)

实际点击：Hard-refresh Profile→Settings→assistant→My preferences → Input→proposal→Confirm remember → Back assistant→click broader My preferences row。

观察：Saved11:1982 reopened correctly after repair. Literal label hit still routed empty in this attempt, tracked separatelyI1-CLICK-20 and not hidden by broad-row PASS.

首次结果保留：FAIL。Reopened11:1854 No saved preferences yet despite no delete. Deterministic confirmed state loss. Original author Figma repair issued; actual repair retest running.

## I1-CLICK-16 · PASS

[本项入口](https://www.figma.com/proto/CS9oRCq8h3Clg09up2aISj?node-id=11-1854&starting-point-node-id=11%3A1854)

实际点击：Saved preferences11:1982 → Delete preferences13:355 → Keep。

观察：Returned11:1982 saved six-field summary unchanged.

## I1-CLICK-17 · PASS

[本项入口](https://www.figma.com/proto/CS9oRCq8h3Clg09up2aISj?node-id=11-1854&starting-point-node-id=11%3A1854)

实际点击：Saved preferences→Delete→confirm → Back assistant → My preferences。

观察：Reopened11:1854 No saved preferences yet after explicit delete.

## I1-CLICK-18 · PASS

[本项入口](https://www.figma.com/proto/CS9oRCq8h3Clg09up2aISj?node-id=12-574&starting-point-node-id=12%3A574)

实际点击：Open12:574 isolated start → Click Keep my text。

观察：Returned11:753 original editor text, unchecked arrangement and disabled Send. Isolated modal test only, not upstream auth proof.

## I1-CLICK-19 · PASS

[本项入口](https://www.figma.com/proto/CS9oRCq8h3Clg09up2aISj?node-id=12-574&starting-point-node-id=12%3A574)

实际点击：Open12:574 isolated start → Replace draft → Compare full text → Try Send unchecked → Explicitly tick arrangement → Send request。

观察：15:212 exact draft ends Is there anything I should know before joining? Unchecked Send inert. Checkbox→15:308; manualSend→Pending11:978. Isolated modal test only.

## I1-CLICK-20 · PASS

[本项入口](https://www.figma.com/proto/CS9oRCq8h3Clg09up2aISj?node-id=11-1513&starting-point-node-id=11%3A1513)

实际点击：Hard refresh Profile→Settings→helper→My preferences → Input→proposal→Confirm remember → Back assistant→click exact My preferences letters(x888,y428) → Back→click exact letters again → Delete→Keep→Back→exact letters → Delete confirm→Back→exact letters。

观察：Saved11:1982 remained on both repeat reentries and after Keep. Explicit delete13:355→11:1854 then Back11:2113→label reopened11:1854 empty. URL exposes screen IDs not control IDs; control identities are separately native-inspected, not browser DOM claims.

首次结果保留：FAIL。Literal label routed empty11:1854 while full row opened saved11:1982. Original author now binds11:2223 to same conditional as11:2222; final actual label retest running.

## 未验证边界

- Real OTP/email/OAuth/backend session and persistence
- Actual model/provider calls, metering and budget
- Native device/keyboard/VoiceOver and arbitrary inputs
- Current six-control prototype repair supplement awaits independent review; original independent signature remains a historical snapshot
- Cross-refresh/cross-device preference persistence: prototype session sample only
- Current original-author supplement has actual Browser Use retest, not a new independent UX signature

9 项设计证据检查通过，包含状态记忆的保存/取消/Keep/删除/文字入口反例；静态测试不计作点击 PASS。浏览器全部任务终态，无真实账号/邮件/模型调用。

历史阶段说明：JSON evidence.continuation/targetedContinuation 中的 running 是原阶段记录，已由 finalLiteralLabelRetest 与 freshAuthRetest 的终态结果替代；当前无运行中的浏览器任务。
