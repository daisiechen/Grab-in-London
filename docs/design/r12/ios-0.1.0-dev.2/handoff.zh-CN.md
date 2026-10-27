# I2 r12 用户批注修复候选

原业务baseline14db532；视觉沿MVP v13/app361ab04，新增用户授权C15单一人数范围与C20可选拒绝原因按正式r12产品增量。旧文件/签署不改写，本包仅新增候选。

C14仅place pin/选中marker与原native restaurant cards，不把饭局聚合人数当Places；实际Google SDK/provider/任意Places状态未接。

C15默认3–4、含host、2≤min≤max≤6；单一outline点击minimum或maximum打开90:399。合法2保留；非法组合提示且保原值。Cancel picker只回原source。创建、编辑、picker与已发布snapshot独立；Edit入口重载published snapshot，Cancel edit不写published，Save changes56:1194才提交；原first-guest-approval锁保持。Figma数字变量与组合字符串为原型逻辑，真实持久化/权限与并发需原服务。

C16四receipt统一18px内边距；C17全部6个check居中；C18普通32 vs host44，公开profile92:363无申请私文，返回同一源，公开缺失信息不编造；C19三个Save label单行，原button触区351×45，检查/保存语义不变。长正文只扩content，不扩852px设备或750px滚动viewport，全本版同类容器已审计。

C20 1:880 Decline1:931→94:373。三个radio首次均未选，未选可确认；显式No reason=reasonTouched true/null，两个exact preset可改选。取消94:493→Pending1:880，再打开重置草稿。Confirm94:490才保存合成已确认code/receipt并进Declined6:185。Host/本人申请人文案保不可重申，不增加席位/群权限/批准锁。申请人有原因94:497、无原因/旧记录94:513为独立read-only角色样例（直接proto前置，不是产品切换身份按钮）。原因不进入公开Meal、其他申请人、群或分析。

现decideApplication只decision；declineReasonCode与DTO/store/authorized projection/notification adapter均proposed-not-implemented。该原型没有调用真实服务或发送真实通知。UNKNOWN/409/截止/取消/迟到响应状态见状态合同，为documented-only，未搭异步假服务器，不宣称全量可点。后续RD须单独签发准确合同及迁移后真实接入。

真实点击root独立复测中；本作者BrowserUse余额不足，没有业务点击PASS。截图/原生布局检查与浏览器记录分开。文件可编辑、namedVersionId=null，未Owner批准、不冒称不可变冻结或代码/QA通过。I3 C21已独立移交root，本包不改其签署/status。

## Final consistency corrections

C04/C05 cross-version: six actual Meal detail hero copies now facts/title/date/current confirmed/host first,110px secondary photo after host; same I1 exact money icon source93:178. Twenty-one native management/cancelled/readonly summary cards have budget/minimum; no new photo or role flow. Published minimum node1:804 reused with its original published snapshot binding; confirmed numerator unchanged. Roster duplicate range removed, only deadline retained. See shared-detail-final-readback.json; it supersedes earlier layout coordinates in initial visual-readback/screenshot stages.

C18 correction: Alex public bio/interests/life were already known in demo/src/domain.ts:93–101. The old missing-data placeholder was wrong and is retained only as failure-history PNG. Final public profile has the exact known bio, Food/Photography/Travel, New to London, English; no application/private/contact data. Profile Auto-layout body560/HUG and fixedscroll750 are separately asserted.

C20 correction: privacy line is fixed Only you and Emma can see this reason, unbound from old diagnostic selection text. Three native ELLIPSE outer14/inner6 with BOOLEAN selected visibility replace Unicode○/●. Reopen and Cancel clear dots; one selection lights one, code/touched/final confirm semantics unchanged. Old local diagnostic variable may still be assigned but is unbound/unrendered and must not become production state/schema. Final reason sheet PNG is c20-confirm-native-radio.png.

C15 shadows:3:2492/3:2803/56:1235 original range fields had no click reactions. New single-range visual/value copies remain inert. No new Error picker/Cancel/Use branch was invented; illegal date/prompt and original restaurant Use/Cancel source targets stay. Main create/edit controls retain actual existing interactive min/max model.

Final caption delta:90:641 source header is bound to UI-only title137:376. Create open90:380/381 sets Create a meal, Edit open90:391/392 sets Edit meal beside the existing context BOOL. Removing that one SET makes before/after actions exactly equal. Use90:705/Cancel90:667/Save56:1194/Publish3:2447 unchanged; no new scalar or business branch. Recheck Edit title by entering from Edit56:290, not direct starting at an empty-context sheet.

Author Figma/package writes stopped; I2 and I3 status files now root-only writers. Root independent click acceptance stays separate from author BrowserUse blocked history.
