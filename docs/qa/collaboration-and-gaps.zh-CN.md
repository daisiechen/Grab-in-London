# QA 协作、差异及验证记录

日期：2026-10-21（Europe/London）。设计输入基线`4659fdb`；精确源哈希见[test-cases.json](test-cases.json)，执行策略见[测试计划](test-plan.zh-CN.md)。

## 协作分工与实际发生事项

用户授权Codex协同Claude产出测试用例。沿用Claude Desktop Code可见会话「项目配置只读验收」，交接明确了基线、唯一未提交竞品研究文件、只读PRD/Demo/技术包和测试文件写入边界。Claude在该会话实际使用qa-acceptance，读取相关规则、产品/后台/技术文档、Demo关键源码及测试，输出独立细分建议、4项回填缺口、4项Demo差异、代码清单与10条用户路径；回复显示10条命令和技能使用记录。

Claude未执行测试、构建或浏览器，未写文件。Codex负责整合、复核源代码与决定、结构化用例、可读目录、索引和资料校验。原始聊天和个人环境信息不发布到公开仓库。本记录是工作摘要，不是Claude对最终文件的全量验收签字；最终用例仍可随实施和评审增补。

另一Claude实施会话同时推进apps/packages/infra，已在其可见协调信息中排除本轮docs/qa、tests/test_qa_cases.py和docs/README.md范围；QA不修改tasks状态、技术manifest或业务代码，也不暂停其他会话工作。提交仅包含本轮文件。

## 差异登记（只读核证，未代修）

| ID/风险 | 证据及观察 | 用例/影响 | 建议负责人及关闭条件 |
| --- | --- | --- | --- |
| QA-GAP-01 / P0 | [readiness.ts](../../demo/src/readiness.ts) londonInstant使用迭代墙钟转换，无显式偏移选择/拒绝不存在时点；[PRD](../product/PRD.zh-CN.md)13.3仍有策略未冻结文字；核心P-03已冻结 | TIME-004—007；当前Demo不能证明DST新规则，静态发现尚未浏览器复现 | 原用户端会话最小回填；生产T07按P-03验收，严禁锁定旧行为作正确预期 |
| QA-GAP-02 / P0 | [assistant.ts](../../demo/src/assistant.ts) query合并preferences后直接传eligibleMeals；技术P-04规定仅soft排序 | AI-001—004；保存£35不该排除£45 | 原PRD/Demo负责人回填；A04用明确fixture验证soft/hard/CLEAR |
| QA-GAP-03 / P1 | [Prototype.tsx](../../demo/src/Prototype.tsx)创建meal时cuisine来自sample，dietary按restaurant.source推默认；技术P-05为host可选声明 | DISCOVERY-008、AI-006、S31；无host字段不能声称已符合来源契约 | 原会话回填表单/unknown，T32字典与来源验证 |
| QA-GAP-04 / P1 | 关键渠道目前写在[API契约](../engineering/api-and-client-contract.zh-CN.md)§4，原PRD仍偏Demo说明 | NOTIFY全组；P-02站内权威/关键邮件/iOS推送后置 | 原会话回填；真实收件箱与通知矩阵另验，不把本地回执当投递 |
| QA-GAP-05 / P1 | assistant.ts中cheaper直接把budget减5；FR-13要求建议后确认 | AI-008；不要把自动减价写成最终预期 | 原助手会话最小修订；A04明确澄清并保其他hard |
| QA-GAP-06 / P1 | Prototype向助手只按canRecruit传meals，助手query缺本人各轮申请状态投影 | AI-046；待审/已确认/DECLINED不应推荐为可新加入 | 原会话核对实际联线；A04依据真实申请权限排除；此项为静态覆盖缺口，未运行复现 |
| QA-GAP-07 / P1 | readiness.resolveLifecycle按当前confirmed及formationCheckedAt推断；无完整席位事件历史 | DB-009/010及S12/13；迟到作业生产权威不能复用此helper | T11/T31用历史与真实DB；Demo差异保留不以函数测试通过关闭 |
| QA-GAP-08 / P2 | [后台PRD](../product/admin/PRD.zh-CN.md)§4 coverage仍有“未知、冲突不计入分子”；同文§3.4及采集契约明确SELF优先无冲突状态 | POST-005、METRIC相应组；冲突源记录不能误排有效报告 | 原后台负责人清理文字；基于现行SELF优先规则写断言 |
| QA-GAP-09 / P1 / 已关闭 | 2026-10-21用户明确“恰好满5分钟时就无效了” | API-008：299999ms有效；300000ms及300001ms无效，REAUTH_REQUIRED，无敏感写入；状态恢复NOT_RUN | 规则澄清已关闭；有效条件0≤age<300000ms。该决定作为本包新增权威输入，后续实施契约与实现由技术负责人同步采用，不改写已审技术快照 |

补充：Claude指出助手today来自真实设备时钟而Demo业务使用固定DEMO_NOW；Codex已核对相关接线。这是测试fixture时钟必须统一的风险，真实服务时间以服务端为准；不把设备时钟当业务权威。

这些是“基线差异/回填待办/测试澄清”，不是新产品决定。P-03/04/05已决定，不能误写为产品尚未批准而阻塞技术实施。未运行的源码推断不标为已复现浏览器缺陷。

## 本轮验证边界

本轮运行用例资料验证与仓库Python测试、差异检查；命令及最终数量见交付记录。对产物实际核对：完整46场景及43任务可追溯，源SHA按固定Git快照验证，217条用例有前置、步骤、预期、方法与状态，可读目录从JSON确定性生成；反例测试拒绝未知引用、重复ID、空断言和无证据PASS。

业务用例尚未执行；没有模型调用、真实账户/收件箱、iOS设备、生产后端事务或外部门槛验收。本轮没有改PRD、Demo、后台源码、已认可技术规则或个人全局配置。后续实施提交不会追溯性改变本次源快照。

## 并行资源决定的增量纳入

`0dfd0c8`的[协调记录](../../tasks/mvp-coordination.md)明确DeepSeek及人民币50元/月，优先于旧技术候选。新增AI-050—052：模型切换ADR与全量复测、CNY预算上界并发及换算缺失fail closed、新供应商数据/参数验证。不继承OpenAI留存声明，不调用未批准真实服务。整体自测通过并交接确切版本后再启动独立执行，本轮不提前出具验收通过。

## 2026-10-21 再次认证边界决定

用户明确：恰好满5分钟无效。已解除QA-GAP-09的澄清阻塞并更新QA-API-008，217条用例全部NOT_RUN，无规则澄清BLOCKED。用例就绪不代表已执行通过；其他已登记回填差异和外部门槛仍按各自负责人推进。本次只更新测试包，不修改历史技术manifest及他人实现。
