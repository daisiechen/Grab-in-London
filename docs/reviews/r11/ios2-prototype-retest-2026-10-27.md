# I2 / J02 公开原型实点补充复验

16项PASS、无FAIL/BLOCKED/NOT_RUN。结论仅列明固定原型代表路径；不是任意输入、真实服务或设备QA。四项新问题均由原UX修复后实际点击关闭，保留首次失败。

|用例|状态|实际可见结果|
|---|---|---|
|[I2-P01-arrange-costs](https://www.figma.com/proto/c04Fi5iarZm7gTPw4u2f7f?node-id=1-24&starting-point-node-id=1%3A24)|PASS|4 selected; minimum 3; Fri23Oct19:00 London, deadline18:00; pay at restaurant; £25–35/person. Reservation checkbox gates Continue.|
|[I2-P02-explicit-publish](https://www.figma.com/proto/c04Fi5iarZm7gTPw4u2f7f?node-id=1-24&starting-point-node-id=1%3A24)|PASS|Publish disabled before explicit check; enabled afterwards and reached published table with confirmation toast.|
|[I2-P03-pending](https://www.figma.com/proto/c04Fi5iarZm7gTPw4u2f7f?node-id=1-880&starting-point-node-id=1%3A880)|PASS|1of4 confirmed, Emma Pending; Keep preserved request. Confirmed cancellation persisted in cancelled parent, no active meal restored.|
|[I2-P03-approved](https://www.figma.com/proto/c04Fi5iarZm7gTPw4u2f7f?node-id=3-3809&starting-point-node-id=3%3A3809)|PASS|2of4 confirmed, Emma Confirmed; Keep preserved count. Confirmed cancellation persisted in cancelled parent, no active meal restored.|
|[I2-P03-declined](https://www.figma.com/proto/c04Fi5iarZm7gTPw4u2f7f?node-id=6-185&starting-point-node-id=6%3A185)|PASS|Emma Declined; no reapply action; Keep preserved declined state. Confirmed cancellation persisted in cancelled parent, no active meal restored.|
|[I2-P03-updated](https://www.figma.com/proto/c04Fi5iarZm7gTPw4u2f7f?node-id=3-4021&starting-point-node-id=3%3A4021)|PASS|Scroll revealed host-reported booking for2 people, Not verified by Fancy; Keep preserved2of4. Confirmed cancellation persisted in cancelled parent, no active meal restored.|
|[I2-P04-insufficient](https://www.figma.com/proto/c04Fi5iarZm7gTPw4u2f7f?node-id=3-4538&starting-point-node-id=3%3A4538)|PASS|Warning says below minimum and cancelled even if worker runs late; persistent cancelled card labelled Minimum not met. No Keep is offered in already-cancelled state.|
|[I2-P05-ai-replace](https://www.figma.com/proto/c04Fi5iarZm7gTPw4u2f7f?node-id=3-3526&starting-point-node-id=3%3A3526)|PASS|Draft A friendly local supper; Review opened explicit Replace your introduction?; Replace applied draft. Focused continuation separately verified editable destination/no auto-publish or consent (I2-P08).|
|[I2-P06-costs-scroll-helper](https://www.figma.com/proto/c04Fi5iarZm7gTPw4u2f7f?node-id=1-449&starting-point-node-id=1%3A449)|PASS|Both Costs screens: £25–35/person remained visible at top and actual scrolled positions; expanded/hidden helper did not cover budget. Browser reported desktop and phone widths.|
|[I2-P07-edit-cancel](https://www.figma.com/proto/c04Fi5iarZm7gTPw4u2f7f?node-id=1-719&starting-point-node-id=1%3A719)|PASS|Each reached Cancel returned original date Fri23Oct19:00London, The Little Table/Soho, budget£25–35, count1of4; no approval/duplicate publication. Older candidate showed2–4 range; this is explicitly not final03/04 range evidence. Alternate-map-marker selection was not confirmed; no arbitrary changed-draft rollback claimed.|
|[I2-P08-ai-keep-manual](https://www.figma.com/proto/c04Fi5iarZm7gTPw4u2f7f?node-id=3-3526&starting-point-node-id=3%3A3526)|PASS|Keep original retained A friendly local supper and An easy dinner with new neighbours and friendly conversation. Replace transferred draft to editable Introduction; no publishing or consent triggered.|
|[I2-P09-map-readable](https://www.figma.com/proto/c04Fi5iarZm7gTPw4u2f7f?node-id=1-719&starting-point-node-id=1%3A719)|PASS|Reservation reported by the host; not verified by the app. and Google Maps opens the neighbourhood. appeared on separated readable lines, no overlap.|
|[I2-P10-min-cap-consistency](https://www.figma.com/proto/c04Fi5iarZm7gTPw4u2f7f?node-id=1-719&starting-point-node-id=1%3A719)|PASS|Published3–4 including host,1of4; Edit4people/minimum3; Cancel retains Fri23Oct19:00London/The Little Table/SohoLondon/£25–35/3–4/1of4. Review Minimum3 · Capacity4(including you); unchecked Save disabled; no final-run save performed.|
|[I2-P11-fixed-sample-save](https://www.figma.com/proto/c04Fi5iarZm7gTPw4u2f7f?node-id=56-725&starting-point-node-id=56%3A725)|PASS|Unchecked gate stayed disabled; fixed existing values saved with Your changes are saved, count1of4 and original values. Does not demonstrate genuinely changed-field persistence or backend save. Direct56:1194 immediately redirects; stable saving screen not separately observed.|
|[I2-P12-first-approval-lock](https://www.figma.com/proto/c04Fi5iarZm7gTPw4u2f7f?node-id=3-3809&starting-point-node-id=3%3A3809)|PASS|Both grey Edit controls non-actionable, URL/state unchanged; visible permanent first-approval key-arrangement lock. No new editing authority after approval.|
|[I2-P13-toast-timeout](https://www.figma.com/proto/c04Fi5iarZm7gTPw4u2f7f?node-id=1-719&starting-point-node-id=1%3A719)|PASS|No success toast remained after about2.2s; lower Host booking and Edit arrangements unobscured. Tested actual timeout, not inferred native reaction. Manual-dismiss alternative not separately claimed.|

逐项步骤、历史失败、当前/历史输入hash见[JSON](ios2-prototype-retest-2026-10-27.json)。

原R11-I2-05遮挡现以两页真实wheel滚动和助手展开/折叠补证。R11-I2-PROT-01编辑入口缺失、02持续toast遮挡、03地图说明叠行、04最低人数样例漂移全部保留首次记录，后经同会话实际复验关闭。

首个编辑功能run早于03/04布局增量，曾观察旧2–4，不能作为最终人数证据。最后显式刷新后已实际看到地图两行分开、3–4/1of4、Edit最低3/容量4、Cancel原值及Review Minimum3。Toast实际等待约2.2秒消失。

Save仅固定既有样例显式勾选/按钮/成功回执，仍原值/1of4；未证实不同字段持久化、任意值输入或后端保存。直接saving56:1194瞬跳，未单独观察稳定saving画面。Cancel仅证实固定样例各检查点回原可见值，不虚称任意改稿回滚。

原历史独立设计/工程签署不改写；工程input-manifest仅重绑当前设计输入与本补充报告，开发包/契约/29项工程场景未改且NOT_RUN。不登录、不改Figma、不调用真实服务。真实身份/接口/供应商/AI/并发/通知/设备仍未验证。
