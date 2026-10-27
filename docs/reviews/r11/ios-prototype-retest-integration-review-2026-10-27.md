# 四版iOS原型点击补测集成独立review

结论：**四版限定原型证据验收通过，可按本轮白名单提交PR10；无开放的本轮原型修复阻断。** 评审人为PJ-ADMIN，非这些版本本轮修复作者。本review只读核报告、状态、补充设计读回、截图、历史、链接与哈希，未重跑Browser或改设计。根PJ已在受控Chromium环境重跑完整308项检查，30.262秒全部通过、0 skip；本评审不将该文档/工程检查结果冒充产品QA，PR必需CI通过后才可合并main。

|版本|本轮列明case重算|验收结论|
|---|---|---|
|I1|20 PASS|实际连续链、偏好记忆及文字入口修复证据通过；本文件独立接受六控件补充。|
|I2|16 PASS、0 FAIL、0 BLOCKED、0 NOT_RUN|编辑/取消/固定值保存、批准后锁定、地图说明、minimum3及toast实际补测记录通过；任意改值持久化未验证。|
|I3|14 PASS、1 BLOCKED|群/席位/饭后/问卷/AI固定样例通过；公评任意自由输入仍BLOCKED。|
|I4|11 PASS、1 BLOCKED、0 FAIL、0 NOT_RUN|举报/删除/支持固定样例通过；举报任意自由输入仍BLOCKED。|
|合计|61 PASS、2 BLOCKED|只统计列明的63个原型case，不是全部需求、产品QA或真机验收。|

两个BLOCKED分别是公评与举报任意自由文本输入的固定热点限制，未降级产品需求，也未偷偷改为PASS。真实服务、任意输入、并发、持久化和真机未验；I2另29项工程产品场景仍NOT_RUN，不能由上述case汇总的0 NOT_RUN覆盖。

## 证据与历史核对

I1报告、MD、status重算20项一致。首次资料/文字入口受阻、保存后错误回空态以及文字/整行不一致均有阶段记录；最后实际文字命中、重复保存重入、Delete→Keep、删除再开均记实际结果。CLICK11连续链入口纠正为Discover5:17；18/19仍明确是孤立modal，不拿它们冒充认证连续链。旧none changed so far矛盾已删；早期running文案由phaseResultInterpretation标明历史阶段、被最终terminal证据替代。

独立核I1补充读回：11:2222整行与11:2223文字同用preferencesSavedSample条件；默认false，确认31:369置true再进已存态，删除13:499置false，Keep13:497保持true，取消31:371按已确认态返回。六控件修复没有扩大输入或持久化范围；status→报告/manifest/readback及manifest补充→报告/readback散列一致。原独立签署继续作为历史快照；原作者补充中independentlyApproved=false/待review是交接时状态，本文件提供新的独立补充签收，不反写旧签署或建立循环散列。

I2首次无Edit入口、永久toast、地图说明叠行和minimum2漂移的PROT01—04历史均保留；修复由原UX执行，PJ实际点击验证。前一轮编辑/保存时仍看见旧2–4的事实明确是旧候选证据，不伪装成最终3–4。最终同会话显式刷新、wheel后观察两条地图说明分离；约2.2秒后toast消失。Published3–4/1of4→Edit minimum3/capacity4→Cancel仍原日期/店/预算/3–4/1of4，Review Minimum3/Capacity4且未勾Save禁用。固定样例Save回执只证明该样例分支，未证明任意改变的字段被保存；未确认改选地图marker、稳定saving-screen、手动关闭toast等未测点如实保留。

I2源delta保留六处旧叠行位置和十四处minimum文案差异；说明行修为−.75/14.25（首行高15），新图实际可读。只同步原Arrange代表minimum3/capacity4，不改confirmed1/4或2/4、不禁止合法minimum2、不新增审批或支付范围。编辑页Cancel/Save changes不回原Publish创建流程，批准后两来源编辑仍.45无动作。静态滚动图不作计时或Presentation实点证据；最终刷新回执才是03/04最新可见文本与计时依据。

I3重算14/1，与JSON/MD/status一致，三个输入hash及status报告hash匹配。Yes/No-only初次只看样例保留NOT_RUN历史，后续Save/Update/Cancel/重开实际点击才改PASS；私密互选OPEN、guest已确认seat、host身份均明确为直达样例前提。公评固定稿与任意输入BLOCKED分开；AI完整末句、本人Send前无新bubble有实际步骤与结果。退群不等退席、退席不退群、host无guest退席、终态反复返回不复活写权均有列明检查。

I4重算11/1/0/0，与JSON/MD/status一致。Completed首次重复Contact support上方死入口FAIL保留；原作者删除5:377，当前5:348 root只留14:178→14:138，Back/Retry回同Completed5:348。5:377出现在删除说明不等于当前root仍有它。Pending/Needs support/Completed直达是外部前提，实际返回/Retry不声称worker真实推进。Received不表示调查完成，示例123456不表示真实验证码已发送。初始0975177与修后e53de6ea0be900830b23a7fc054b0aa38d64a629分开；新增四项postRepairInputSHA256独立核对全匹配。

## I2派生工程输入与旧签署

完整检查曾发现designSnapshot旧SHA与新设计manifest不符。原PJ只更新当前input-manifest设计绑定、prototypeSupplement依据及status.currentPlanSHA；historicalSHA256、旧independentEngineeringReview.reviewedInputSHA256和旧审阅文件摘要保留。当前sourceSHA256、designSnapshot.SHA256、outputSHA256、点击报告及独立工程review JSON/MD摘要逐项匹配实际文件；status.currentPlanSHA256四项也匹配。

本review在rebind前后独立比较三件工程决策，均逐字节不变：

|工程文件|不变SHA256|
|---|---|
|plan.zh-CN.md|48b141461fc30649a97146723466cb7bf5a6ed3934f6cc9bda961e6d34b6cb28|
|work-packages.json|f914c103ad27c76923451ae36ede327d65c2eec91b16a481154bb658452ad5e7|
|test-matrix.json|f84ebeb7ab9cc140cf9c018e47121d95054cb2b92f010642331b0aad5ead5724|

这是派生设计输入再绑定，不是重新工程签署、改变工作包/契约/测试矩阵或弱化测试。旧工程签署仅覆盖其历史输入；新原型差异由此次实际补测与本独立集成review覆盖。代码writer/精确租约、契约增量、环境和真实QA仍须后续签发，不因本文允许实现或部署。

## 验证方式及限制

实际执行公共test_ios_prototype_click_evidence.py 1项通过、I2 test_r11_ios2_plan.py 7项通过。公共测试明确只检查证据声明，不建立真实Browser执行；PASS需browser-click与步骤，所有case需observed/公开proto URL，且状态不启动实现或产品QA。它不充分验证计数、hash或历史语义，因此本review另行重算63个case、核对状态/历史和当前输入输出散列。未重跑Browser，不将原生节点/连线/静态测试冒充本人实际点击。

连接器截图按托管HTML/截图文件名记录，未伪造仓库本地PNG；这些托管文件名不是仓库内可直接打开的附件。公开/proto URL是可复现入口，各case标明直接样例前提；Figma仍可变，本文签收的是下表审阅时文件快照，不宣称命名Figma版本已冻结。无真实账号、OTP/邮件、AI/模型、通知、删除worker、数据库或真机证据，也未外发消息。

本轮不变更业务代码、原PRD/Demo、工程决策、旧签署或Git；现有research/旧QA改动未触碰。后续README/总览直接引用本文，不再把本文摘要写回被本文哈希绑定的status，避免循环散列。

## 最终审阅文件SHA256

|文件|SHA256|
|---|---|
|docs/reviews/r11/ios1-prototype-retest-2026-10-27.json|82f8f558182454ff5909d98db1d25d2d6a8502ab4525af538f624700f22c7f2e|
|docs/reviews/r11/ios1-prototype-retest-2026-10-27.md|6a45466fe0fc83465b22195ea83b69cfee9bb6aba60fbce0addb8c4feafe6c9a|
|docs/delivery/versions/ios-0.1.0-dev.1/status.json|9858d54155955c75ea77bec967a786270bb130ae37726898e2427cd354bfce8a|
|docs/design/r10/ios-0.1.0-dev.1/artifact-manifest.json|37b91e7192268246b5cda4eab2d0fd91592d9d31ade354f2f220f2bee08bb89a|
|docs/reviews/r11/ios2-prototype-retest-2026-10-27.json|fdfdc3e21df3a9d35925d7e8185adc786aceaa03a999588e49e79efde8b61d1b|
|docs/reviews/r11/ios2-prototype-retest-2026-10-27.md|13e96b591068c7b30d309b3c1cfec8cb67f93cab82da0e92e9cd09eba7bb46a2|
|docs/delivery/versions/ios-0.1.0-dev.2/status.json|266c88a9adac6541ac8caeeb1df3d76ea1976a779dea98a02ac5ede7832a5a49|
|docs/design/r10/ios-0.1.0-dev.2/artifact-manifest.json|feb061dbbce045d26c28db9b7cfa52e5fcffb6d9fddbabebee3aca68885d84b5|
|docs/reviews/r11/ios2-review.json|202c41e194e8fc4dc652abb007e722468fcf460b3e2700a77c83cfa3d59829cd|
|docs/reviews/r11/prototype-supplement-2026-10-27.json|704972da0d1dddd1d02b4dac0effc9630c6374302303ad70e101a842255ba1b6|
|docs/design/r10/ios-0.1.0-dev.2/evidence/r11-published-edit-readback.json|58d3db7ebf2f1b1f6eac9550e483d14d7b4cd01868218f87cb12d4b474e16b75|
|docs/design/r10/ios-0.1.0-dev.2/evidence/r11-published-layout-min3-readback.json|0dda7bb68cf93b61605924a2cba4680cadf16d5c138c866b019365b656dc3d91|
|docs/reviews/r11/ios3-prototype-retest-2026-10-27.json|d32627ac73aaf1766209cc09e50f3948b094accd3aec7a496c4ba37d45292b1f|
|docs/reviews/r11/ios3-prototype-retest-2026-10-27.md|bf27b64ed22e8088a456db5429860df8f1f654753702b6c1530b113dd357c45b|
|docs/delivery/versions/ios-0.1.0-dev.3/status.json|70b5a89cd6a6391e88790cc6fdac030327d3e05cffc98073efe4e99b1e40fbe2|
|docs/design/r10/ios-0.1.0-dev.3/artifact-manifest.json|84ad31dd95f27bfe604cb9ba2b8ded5f43bdea2981433275ff9923a9454404d3|
|docs/design/r10/ios-0.1.0-dev.3/figma-readback.json|3f88069758028eef6856960254656a71e07aac4d090471041faf94ea57377f00|
|docs/reviews/r11/ios34-review.json|8c6fa2bf340ac6cdb4f64fb75fd749b2d4193b76e9f533a9624ada5d22c44f2c|
|docs/reviews/r11/ios4-prototype-retest-2026-10-27.json|6d31ddc929883e2f2a0018b693318072b7038878d19d8be223dd2c913860fb24|
|docs/reviews/r11/ios4-prototype-retest-2026-10-27.md|cce8d4f2b6b9a22d57be337888dba24e93aad689a1b2fa997462f93d68dc75f6|
|docs/delivery/versions/ios-0.1.0-dev.4/status.json|281d5c6f67b685bc900ec09a787cf5d9240b14f1948c77aeae3a8ac640ffcc34|
|docs/design/r10/ios-0.1.0-dev.4/artifact-manifest.json|a367ef57b142b2acbba428d081ada4c316fecea3c4a418034a95eb45b6aed222|
|docs/design/r10/ios-0.1.0-dev.4/figma-readback.json|6c867bda135ad077d42885665f472c77083ededfca2c623e42b7f48fc27b2bca|
|docs/design/r10/ios-0.1.0-dev.4/evidence/r11-completed-single-support.png|0e7f31322effd2f96d90404ad7a223e5f274fe68281e75867dd65dfd7554e0fe|
|tests/test_r11_ios4_plan.py|1bb417bf493d21fa36336acbd60a42060263d90237022d14c8397aa08378fedd|
|docs/design/r10/ios-0.1.0-dev.1/evidence/r11-preferences-memory-readback.json|2cb5805a414bc356220494dcf5018dbeb7e5b842f9bb03008ce8fbaee7cb0b97|
|tests/test_ux_r10_ios12.py|eaf9caadae06cbe60818ccf8efdc1b91749f8e9fe24f00cfa80629df4814f6e3|
|docs/engineering/r11/ios-0.1.0-dev.2/input-manifest.json|395edb4ac420e04ea4b3cf58e5a270b590c80cd84506cde70a58c1b9e15131ba|
|docs/design/r10/ios-0.1.0-dev.2/coverage.json|c3342b36ba5f71e479825313434247b5e4c3c0aa20e4df77a32d9c1f8cb84c35|
|docs/design/r10/ios-0.1.0-dev.2/evidence/r11-published-layout-min3.png|17894244b5cbbe7a409ef2cf0e3a5cc0278a102c9d645d6c56da5d67954568c2|
|tests/test_ux_r10_ios2.py|b92a15c5a08988a9158d8e625ae6487e905b961bed2c539f46fc31494f9ad268|
|tests/test_r11_ios2_plan.py|91e4317f41343c5eebdffe41a653099b4f91c8b65a3dfa387edcacbdda722a3a|
|tests/test_ios_prototype_click_evidence.py|6bedc0c2f4472597bbdf9c04190fb2cf827ab7c9577e711566235c3c29df6167|

最终：61 PASS、2个明确原型限制BLOCKED，当前列明case无FAIL/NOT_RUN；开放的真实服务与任意输入范围仍保留。可提交本轮证据与修复白名单，必需CI及合并/发布闸不变。
