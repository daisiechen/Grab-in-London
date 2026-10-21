# 测试用例目录（待执行）

唯一结构化真源：[test-cases.json](test-cases.json)。本文件由同份数据渲染；用例均为计划，状态见各条；现有测试通过不自动改变状态。

基线：`4659fdb3b5e4779157ac45058cbf5134aea1b4d2`。共217条。夹具、源文件SHA256和证据字段见JSON。

## ADMIN

### QA-ADMIN-001 五页导航与筛选

- 优先级/阶段/方法：P1 / demo / browser_or_unit；状态：NOT_RUN
- 需求：后台AC-01、后台AC-09、后台AC-10、后台AC-11、后台AC-13；场景：S28；任务：T22、T23
- 前置：后台fixture，1440px和390px；键盘；中英文
- 步骤：遍历overview/journey/supply/retention/quality → 改多选和语言再回页
- 预期：五页无多余核实/运营页；条件和语言保持；同字段OR跨字段AND
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) 后台AC-01 后台AC-09 后台AC-10 后台AC-11 后台AC-13

### QA-ADMIN-002 字典弹层焦点

- 优先级/阶段/方法：P1 / demo / browser_or_unit；状态：NOT_RUN
- 需求：后台AC-01、后台AC-09、后台AC-10、后台AC-11、后台AC-13；场景：S28；任务：T22、T23
- 前置：后台fixture，1440px和390px；键盘；中英文
- 步骤：键盘打开指标字典 → Escape关闭 → 点外部关闭
- 预期：公式/单位/来源/分母可读；关闭后焦点回触发按钮
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) 后台AC-01 后台AC-09 后台AC-10 后台AC-11 后台AC-13

### QA-ADMIN-003 小屏和空态

- 优先级/阶段/方法：P1 / demo / browser_or_unit；状态：NOT_RUN
- 需求：后台AC-01、后台AC-09、后台AC-10、后台AC-11、后台AC-13；场景：S28；任务：T22、T23
- 前置：后台fixture，1440px和390px；键盘；中英文
- 步骤：390px遍历五页表格下钻 → 选空数据范围 → 恢复
- 预期：页面不横向溢出，表格可滚；空态不沿用旧图表；0和未知分清
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) 后台AC-01 后台AC-09 后台AC-10 后台AC-11 后台AC-13

### QA-ADMIN-004 导出元信息

- 优先级/阶段/方法：P1 / demo / browser_or_unit；状态：NOT_RUN
- 需求：后台AC-01、后台AC-09、后台AC-10、后台AC-11、后台AC-13；场景：S28；任务：T22、T23
- 前置：后台fixture，1440px和390px；键盘；中英文
- 步骤：筛选后导出CSV并核对图表
- 预期：snapshot/asOf/filter/definitionVersion一致；fixture明确；无消息/单方再约/联系方式
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) 后台AC-01 后台AC-09 后台AC-10 后台AC-11 后台AC-13

## AI

### QA-AI-001 偏好仅排序

- 优先级/阶段/方法：P1 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-13、AC-AI01、AC-AI02、AC-AI03、AC-AI04；场景：AI-S01、AI-S02、AI-S03；任务：A04、A08
- 前置：固定搜索fixture：Soho周五M35(£35)/M45(£45)、unknown饮食场U、21+可见场；冻结model/prompt/schema
- 步骤：保存budget35 → 输入周五Soho → 检查查询WHERE/结果集合
- 预期：M45仍有资格但soft分低；偏好不进入硬过滤
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI01 AC-AI02 AC-AI03 AC-AI04、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1

### QA-AI-002 显式预算是hard

- 优先级/阶段/方法：P1 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-13、AC-AI01、AC-AI02、AC-AI03、AC-AI04；场景：AI-S01、AI-S02、AI-S03；任务：A04、A08
- 前置：固定搜索fixture：Soho周五M35(£35)/M45(£45)、unknown饮食场U、21+可见场；冻结model/prompt/schema
- 步骤：输入£35以内 → 比较M35与M45
- 预期：M35可命中；M45完全排除；卡片金额来自事实
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI01 AC-AI02 AC-AI03 AC-AI04、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1

### QA-AI-003 CLEAR持续抑制

- 优先级/阶段/方法：P1 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-13、AC-AI01、AC-AI02、AC-AI03、AC-AI04；场景：AI-S01、AI-S02、AI-S03；任务：A04、A08
- 前置：固定搜索fixture：Soho周五M35(£35)/M45(£45)、unknown饮食场U、21+可见场；冻结model/prompt/schema
- 步骤：先hard35 → 不限预算 → 下一轮仅改日期
- 预期：budget hard和soft均不恢复；其他条件保留；Discover UI不改
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI01 AC-AI02 AC-AI03 AC-AI04、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1

### QA-AI-004 UNSET不是CLEAR

- 优先级/阶段/方法：P1 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-13、AC-AI01、AC-AI02、AC-AI03、AC-AI04；场景：AI-S01、AI-S02、AI-S03；任务：A04、A08
- 前置：固定搜索fixture：Soho周五M35(£35)/M45(£45)、unknown饮食场U、21+可见场；冻结model/prompt/schema
- 步骤：已确认Soho/周五 → 下一轮只说4人
- 预期：Soho/日期保留；仅人数改变且含host
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI01 AC-AI02 AC-AI03 AC-AI04、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1

### QA-AI-005 完整集合先排序

- 优先级/阶段/方法：P1 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-13、AC-AI01、AC-AI02、AC-AI03、AC-AI04；场景：AI-S01、AI-S02、AI-S03；任务：A04、A08
- 前置：固定搜索fixture：Soho周五M35(£35)/M45(£45)、unknown饮食场U、21+可见场；冻结model/prompt/schema
- 步骤：将soft最优场放初始顺序第21 → 请求推荐
- 预期：先全集合hard过滤及排序再top20；最优不被先截断；卡片≤3
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI01 AC-AI02 AC-AI03 AC-AI04、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1

### QA-AI-006 unknown饮食与soft

- 优先级/阶段/方法：P1 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-13、AC-AI01、AC-AI02、AC-AI03、AC-AI04；场景：AI-S01、AI-S02、AI-S03；任务：A04、A08
- 前置：固定搜索fixture：Soho周五M35(£35)/M45(£45)、unknown饮食场U、21+可见场；冻结model/prompt/schema
- 步骤：U饮食null → hard vegan后再Any并保存vegan偏好
- 预期：hard不命中U；Any下U可出现且soft0分；无过敏保证
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI01 AC-AI02 AC-AI03 AC-AI04、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1

### QA-AI-007 Spanish歧义

- 优先级/阶段/方法：P1 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-13、AC-AI01、AC-AI02、AC-AI03、AC-AI04；场景：AI-S01、AI-S02、AI-S03；任务：A04、A08
- 前置：固定搜索fixture：Soho周五M35(£35)/M45(£45)、unknown饮食场U、21+可见场；冻结model/prompt/schema
- 步骤：输入Spanish → 再明确language Spanish
- 预期：第一轮最少澄清不自选菜系；明确后使用es语言
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI01 AC-AI02 AC-AI03 AC-AI04、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1

### QA-AI-008 便宜些需确认

- 优先级/阶段/方法：P1 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-13、AC-AI01、AC-AI02、AC-AI03、AC-AI04；场景：AI-S01、AI-S02、AI-S03；任务：A04、A08
- 前置：固定搜索fixture：Soho周五M35(£35)/M45(£45)、unknown饮食场U、21+可见场；冻结model/prompt/schema
- 步骤：当前hard区域Soho/日期周五 → 输入便宜一点
- 预期：提出预算候选待确认；不直接换日期/区域或偷偷降低预算
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI01 AC-AI02 AC-AI03 AC-AI04、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1

### QA-AI-009 日期自然周

- 优先级/阶段/方法：P1 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-13、AC-AI01、AC-AI02、AC-AI03、AC-AI04；场景：AI-S01、AI-S02、AI-S03；任务：A04、A08
- 前置：固定搜索fixture：Soho周五M35(£35)/M45(£45)、unknown饮食场U、21+可见场；冻结model/prompt/schema
- 步骤：冻结London周一2026-10-19 → 分别本周五/下周五/未指定日期
- 预期：周五10-23、下周五10-30；默认7日10-19到10-25且显示日期窗口
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI01 AC-AI02 AC-AI03 AC-AI04、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1

### QA-AI-010 今晚和DST

- 优先级/阶段/方法：P1 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-13、AC-AI01、AC-AI02、AC-AI03、AC-AI04；场景：AI-S01、AI-S02、AI-S03；任务：A04、A08
- 前置：固定搜索fixture：Soho周五M35(£35)/M45(£45)、unknown饮食场U、21+可见场；冻结model/prompt/schema
- 步骤：冻结今晚18点后 → 输入今晚 → 再输入秋季重复01:30/春季不存在时间
- 预期：仅当日18:00—23:59未来场；歧义先选偏移/不存在报错，无可提交错误时点
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI01 AC-AI02 AC-AI03 AC-AI04、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1

### QA-AI-011 无结果与不可用

- 优先级/阶段/方法：P1 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-13、AC-AI01、AC-AI02、AC-AI03、AC-AI04；场景：AI-S01、AI-S02、AI-S03；任务：A04、A08
- 前置：固定搜索fixture：Soho周五M35(£35)/M45(£45)、unknown饮食场U、21+可见场；冻结model/prompt/schema
- 步骤：hard预算不足返回0 → 注入discovery失败 → 未知金额场
- 预期：0说明无匹配；失败显示不可用不谎称0结果；未知金额不称预算内
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI01 AC-AI02 AC-AI03 AC-AI04、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1

### QA-AI-012 只比较明确三场

- 优先级/阶段/方法：P1 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-13、AC-AI01、AC-AI02、AC-AI03、AC-AI04；场景：AI-S01、AI-S02、AI-S03；任务：A04、A08
- 前置：固定搜索fixture：Soho周五M35(£35)/M45(£45)、unknown饮食场U、21+可见场；冻结model/prompt/schema
- 步骤：选择3个公开候选 → 再指定第四/未知mealId/隐藏场
- 预期：≤3按同快照事实比较；无权对象拒绝不回显；不读取人格或行程
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI01 AC-AI02 AC-AI03 AC-AI04、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1

### QA-AI-013 解释本人状态

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-13、AC-AI05、AC-AI06、AC-AI07、AC-AI08、AC-AI09、AC-AI13；场景：AI-S11、AI-S12、AI-S13；任务：A04、A05、A06、A08
- 前置：模型spy和全部核心写命令spy；A为合格登录用户；一个pending场、一个有写权限群
- 步骤：pending时问批准了没/要付款吗 → 状态API失败再问
- 预期：pending不称批准；外订到店付不索预付；失败保留未知
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI05 AC-AI06 AC-AI07 AC-AI08 AC-AI09 AC-AI13、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1

### QA-AI-014 申请草稿无副作用

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-13、AC-AI05、AC-AI06、AC-AI07、AC-AI08、AC-AI09、AC-AI13；场景：AI-S11、AI-S12、AI-S13；任务：A04、A05、A06、A08
- 前置：模型spy和全部核心写命令spy；A为合格登录用户；一个pending场、一个有写权限群
- 步骤：生成→转入→重试同draft→本人Submit
- 预期：前三步业务写spy=0；转入同份替换不追加；只有本人提交创建一申请
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI05 AC-AI06 AC-AI07 AC-AI08 AC-AI09 AC-AI13、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1

### QA-AI-015 创建草稿不默认同意

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-13、AC-AI05、AC-AI06、AC-AI07、AC-AI08、AC-AI09、AC-AI13；场景：AI-S11、AI-S12、AI-S13；任务：A04、A05、A06、A08
- 前置：模型spy和全部核心写命令spy；A为合格登录用户；一个pending场、一个有写权限群
- 步骤：请求组局且地点/时间不明确 → 转入Create → Review前查DB
- 预期：place/time未确认留空或澄清；外订/条款/Review不勾；无自动发布
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI05 AC-AI06 AC-AI07 AC-AI08 AC-AI09 AC-AI13、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1

### QA-AI-016 非空编辑器冲突

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-13、AC-AI05、AC-AI06、AC-AI07、AC-AI08、AC-AI09、AC-AI13；场景：AI-S11、AI-S12、AI-S13；任务：A04、A05、A06、A08
- 前置：模型spy和全部核心写命令spy；A为合格登录用户；一个pending场、一个有写权限群
- 步骤：原申请编辑器文字v1 → 生成draft后编辑v2 → 转入 → 取消替换
- 预期：EDITOR_CONFLICT或确认保留/替换；取消保持v2；不能静默覆盖/追加
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI05 AC-AI06 AC-AI07 AC-AI08 AC-AI09 AC-AI13、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1

### QA-AI-017 生成转入发送三次鉴权

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-13、AC-AI05、AC-AI06、AC-AI07、AC-AI08、AC-AI09、AC-AI13；场景：AI-S11、AI-S12、AI-S13；任务：A04、A05、A06、A08
- 前置：模型spy和全部核心写命令spy；A为合格登录用户；一个pending场、一个有写权限群
- 步骤：群草稿生成后退群 → 再转入 → 另一次转入后解散再Send
- 预期：各阶段独立重检；失权转入/Send拒绝；无读群正文
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI05 AC-AI06 AC-AI07 AC-AI08 AC-AI09 AC-AI13、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1

### QA-AI-018 取消饭局仍可协调

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-13、AC-AI05、AC-AI06、AC-AI07、AC-AI08、AC-AI09、AC-AI13；场景：AI-S11、AI-S12、AI-S13；任务：A04、A05、A06、A08
- 前置：模型spy和全部核心写命令spy；A为合格登录用户；一个pending场、一个有写权限群
- 步骤：M取消但A仍群成员 → 请求并转入群草稿
- 预期：仍可起草及转入；不得把取消当退群；发送依原权限
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI05 AC-AI06 AC-AI07 AC-AI08 AC-AI09 AC-AI13、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1

### QA-AI-019 目标切换与过期卡片

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-13、AC-AI05、AC-AI06、AC-AI07、AC-AI08、AC-AI09、AC-AI13；场景：AI-S11、AI-S12、AI-S13；任务：A04、A05、A06、A08
- 前置：模型spy和全部核心写命令spy；A为合格登录用户；一个pending场、一个有写权限群
- 步骤：M1生成后切M2 → 或M1满员/截止 → 再打开卡片转入
- 预期：目标不串；最新状态提示并剔除不可申请；旧draft不锁位
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI05 AC-AI06 AC-AI07 AC-AI08 AC-AI09 AC-AI13、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1

### QA-AI-020 最小上下文

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-13、AC-AI05、AC-AI06、AC-AI07、AC-AI08、AC-AI09、AC-AI13；场景：AI-S11、AI-S12、AI-S13；任务：A04、A05、A06、A08
- 前置：模型spy和全部核心写命令spy；A为合格登录用户；一个pending场、一个有写权限群
- 步骤：普通查询后明确要求结合本人介绍，再明确润色编辑器
- 预期：普通查询无资料/未发稿；仅显式请求才包含白名单本人字段或该次编辑文字
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI05 AC-AI06 AC-AI07 AC-AI08 AC-AI09 AC-AI13、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1

### QA-AI-021 注入与伪身份

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-13、AC-AI05、AC-AI06、AC-AI07、AC-AI08、AC-AI09、AC-AI13；场景：AI-S11、AI-S12、AI-S13；任务：A04、A05、A06、A08
- 前置：模型spy和全部核心写命令spy；A为合格登录用户；一个pending场、一个有写权限群
- 步骤：描述/输入包含ignore rules、他人userId、群正文索取、未知tool/URL
- 预期：不扩大DTO或工具权限；业务写spy0；无他人资料/隐藏数据
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI05 AC-AI06 AC-AI07 AC-AI08 AC-AI09 AC-AI13、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1

### QA-AI-022 模型虚构与无效schema

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-13、AC-AI05、AC-AI06、AC-AI07、AC-AI08、AC-AI09、AC-AI13；场景：AI-S11、AI-S12、AI-S13；任务：A04、A05、A06、A08
- 前置：模型spy和全部核心写命令spy；A为合格登录用户；一个pending场、一个有写权限群
- 步骤：provider返回不存在ID/金额错误/多余字段/虚构职业/业务已完成
- 预期：整轮FAILED或事实模板校验拒绝；无可操作残片和业务写；实际费用仍计
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI05 AC-AI06 AC-AI07 AC-AI08 AC-AI09 AC-AI13、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1

### QA-AI-023 纯文本输出

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-13、AC-AI05、AC-AI06、AC-AI07、AC-AI08、AC-AI09、AC-AI13；场景：AI-S11、AI-S12、AI-S13；任务：A04、A05、A06、A08
- 前置：模型spy和全部核心写命令spy；A为合格登录用户；一个pending场、一个有写权限群
- 步骤：模型返回HTML/script及非允许URL
- 预期：作为文本显示或拒绝；链接只由允许ID构造；不执行脚本
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI05 AC-AI06 AC-AI07 AC-AI08 AC-AI09 AC-AI13、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1

### QA-AI-024 确认记忆与日期排除

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-13、AC-AI10、AC-AI11、AC-AI12、AC-AI14；场景：AI-S04、AI-S05、AI-S06、AI-S10、AI-S14；任务：A01、A02、A06、A07、A08
- 前置：A/B及Web双tab+iOS；服务端可控活动时刻、epoch/generation；provider可挂起
- 步骤：普通查询预算/日期 → 生成偏好提案 → 拒绝 → 重新明确Confirm
- 预期：前两步不持久写；确认只存允许字段不含日期/原文；拒绝不影响查找
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI10 AC-AI11 AC-AI12 AC-AI14、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1

### QA-AI-025 跨设备CAS

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-13、AC-AI10、AC-AI11、AC-AI12、AC-AI14；场景：AI-S04、AI-S05、AI-S06、AI-S10、AI-S14；任务：A01、A02、A06、A07、A08
- 前置：A/B及Web双tab+iOS；服务端可控活动时刻、epoch/generation；provider可挂起
- 步骤：两端读v1 → Web保存v2 → iOS拿v1保存
- 预期：旧If-Match冲突返回需重核；v2不被静默覆盖
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI10 AC-AI11 AC-AI12 AC-AI14、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1

### QA-AI-026 删除偏好与迟到结果

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-13、AC-AI10、AC-AI11、AC-AI12、AC-AI14；场景：AI-S04、AI-S05、AI-S06、AI-S10、AI-S14；任务：A01、A02、A06、A07、A08
- 前置：A/B及Web双tab+iOS；服务端可控活动时刻、epoch/generation；provider可挂起
- 步骤：provider挂起 → 删偏好 → 放行旧响应 → 另一设备恢复
- 预期：epoch升、旧引用RAM清、旧结果SUPERSEDED不发布；他端先同步；未发文字保留
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI10 AC-AI11 AC-AI12 AC-AI14、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1

### QA-AI-027 模型停用仍删偏好

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-13、AC-AI10、AC-AI11、AC-AI12、AC-AI14；场景：AI-S04、AI-S05、AI-S06、AI-S10、AI-S14；任务：A01、A02、A06、A07、A08
- 前置：A/B及Web双tab+iOS；服务端可控活动时刻、epoch/generation；provider可挂起
- 步骤：AI_ENABLED=false → 分别GET/DELETE本人偏好 → 其他账号尝试
- 预期：本人仍可读删；他人拒绝；不依赖provider；已提交业务不删除
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI10 AC-AI11 AC-AI12 AC-AI14、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1

### QA-AI-028 恰好30分钟

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-13、AC-AI10、AC-AI11、AC-AI12、AC-AI14；场景：AI-S04、AI-S05、AI-S06、AI-S10、AI-S14；任务：A01、A02、A06、A07、A08
- 前置：A/B及Web双tab+iOS；服务端可控活动时刻、epoch/generation；provider可挂起
- 步骤：lastActivity=t0 → t0+30min−1ms及等号读取 → 后台定时器停用
- 预期：前可Continue；等号新generation清临时条件/草稿；保留账号偏好和未发文字
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI10 AC-AI11 AC-AI12 AC-AI14、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1

### QA-AI-029 活动真实性与重放

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-13、AC-AI10、AC-AI11、AC-AI12、AC-AI14；场景：AI-S04、AI-S05、AI-S06、AI-S10、AI-S14；任务：A01、A02、A06、A07、A08
- 前置：A/B及Web双tab+iOS；服务端可控活动时刻、epoch/generation；provider可挂起
- 步骤：SEND/EDIT/显式操作后记时 → 只打开/poll/heartbeat/重试 → 重放activityEventId
- 预期：仅真实活动续期；重复event不续时；DB30秒flush不使用flush时刻延长TTL
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI10 AC-AI11 AC-AI12 AC-AI14、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1

### QA-AI-030 NEW与自动到期不同

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-13、AC-AI10、AC-AI11、AC-AI12、AC-AI14；场景：AI-S04、AI-S05、AI-S06、AI-S10、AI-S14；任务：A01、A02、A06、A07、A08
- 前置：A/B及Web双tab+iOS；服务端可控活动时刻、epoch/generation；provider可挂起
- 步骤：保留助手未发字、业务申请未发字 → New → 另一轮等TTL
- 预期：New清助手未发字但保留账号偏好/业务编辑器；TTL保留两类未发字
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI10 AC-AI11 AC-AI12 AC-AI14、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1

### QA-AI-031 刷新与设备隔离

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-13、AC-AI10、AC-AI11、AC-AI12、AC-AI14；场景：AI-S04、AI-S05、AI-S06、AI-S10、AI-S14；任务：A01、A02、A06、A07、A08
- 前置：A/B及Web双tab+iOS；服务端可控活动时刻、epoch/generation；provider可挂起
- 步骤：Web刷新 → 旧session/token读取 → 另一tab/设备尝试sessionId
- 预期：刷新撤旧并新建；sessionId单独不能访问；正文不跨设备同步或持久化
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI10 AC-AI11 AC-AI12 AC-AI14、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1

### QA-AI-032 退出切账号与账号删除

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-13、AC-AI10、AC-AI11、AC-AI12、AC-AI14；场景：AI-S04、AI-S05、AI-S06、AI-S10、AI-S14；任务：A01、A02、A06、A07、A08
- 前置：A/B及Web双tab+iOS；服务端可控活动时刻、epoch/generation；provider可挂起
- 步骤：A退出登录B → 再A其他端 → 删除A与AI发布并发
- 预期：B不见A上下文；普通退出保留A账号偏好；删除清所有偏好/上下文且屏障阻旧发布
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI10 AC-AI11 AC-AI12 AC-AI14、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1

### QA-AI-033 游客登录不迁偏好

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-13、AC-AI10、AC-AI11、AC-AI12、AC-AI14；场景：AI-S04、AI-S05、AI-S06、AI-S10、AI-S14；任务：A01、A02、A06、A07、A08
- 前置：A/B及Web双tab+iOS；服务端可控活动时刻、epoch/generation；provider可挂起
- 步骤：游客确认偏好后登录A → 再退出重新游客
- 预期：游客上下文凭据撤销；不迁入A；A原偏好保留；新游客独立主体
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI10 AC-AI11 AC-AI12 AC-AI14、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1

### QA-AI-034 iOS重装与冷启动

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-13、AC-AI10、AC-AI11、AC-AI12、AC-AI14；场景：AI-S04、AI-S05、AI-S06、AI-S10、AI-S14；任务：A01、A02、A06、A07、A08
- 前置：A/B及Web双tab+iOS；服务端可控活动时刻、epoch/generation；provider可挂起
- 步骤：RAM会话有效冷启动 → 重装保留Keychain但无install marker → 再API重启
- 预期：正常可显式Continue；重装先清旧token；RAM丢失410不从日志恢复，未发字保留
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI10 AC-AI11 AC-AI12 AC-AI14、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1

### QA-AI-035 主体1在途

- 优先级/阶段/方法：P0 / implementation / postgres_provider_fault_injection；状态：NOT_RUN
- 需求：FR-13、AC-AI12、AC-AI15；场景：AI-S07、AI-S08、AI-S09、AI-S15；任务：A00、A03、A08、A09
- 前置：两DB连接、受控provider记录callId与计费用量；用户每日已49成功轮/上限50，游客9/10；费用microUSD上界可控
- 步骤：同账号不同设备同时不同requestId → 检查provider调用
- 预期：最多1个在途；另一被限流/冲突且不加call；会话也1在途
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI12 AC-AI15、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1

### QA-AI-036 requestId去重

- 优先级/阶段/方法：P0 / implementation / postgres_provider_fault_injection；状态：NOT_RUN
- 需求：FR-13、AC-AI12、AC-AI15；场景：AI-S07、AI-S08、AI-S09、AI-S15；任务：A00、A03、A08、A09
- 前置：两DB连接、受控provider记录callId与计费用量；用户每日已49成功轮/上限50，游客9/10；费用microUSD上界可控
- 步骤：同ID同payload同时/结束后重试 → 改payload → RAM清后重试
- 预期：不重复call或扣轮；改body409；清除后410而非再生成
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI12 AC-AI15、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1

### QA-AI-037 最后成功轮竞争

- 优先级/阶段/方法：P0 / implementation / postgres_provider_fault_injection；状态：NOT_RUN
- 需求：FR-13、AC-AI12、AC-AI15；场景：AI-S07、AI-S08、AI-S09、AI-S15；任务：A00、A03、A08、A09
- 前置：两DB连接、受控provider记录callId与计费用量；用户每日已49成功轮/上限50，游客9/10；费用microUSD上界可控
- 步骤：两端争第50轮 → 失败/有效澄清/成功分别终结
- 预期：原子预留不超50；有效NEEDS_INPUT与SUCCEEDED扣1；FAILED/SUPERSEDED不扣
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI12 AC-AI15、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1

### QA-AI-038 游客额度主体

- 优先级/阶段/方法：P0 / implementation / postgres_provider_fault_injection；状态：NOT_RUN
- 需求：FR-13、AC-AI12、AC-AI15；场景：AI-S07、AI-S08、AI-S09、AI-S15；任务：A00、A03、A08、A09
- 前置：两DB连接、受控provider记录callId与计费用量；用户每日已49成功轮/上限50，游客9/10；费用microUSD上界可控
- 步骤：同guest刷新/NEW/多tab提交 → 清cookie或24h到期 → 匿名错Origin/CSRF
- 预期：同guest不重置10轮；新guest可新主体并明确可规避；错来源请求拒绝
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI12 AC-AI15、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1

### QA-AI-039 跨日和DST额度

- 优先级/阶段/方法：P0 / implementation / postgres_provider_fault_injection；状态：NOT_RUN
- 需求：FR-13、AC-AI12、AC-AI15；场景：AI-S07、AI-S08、AI-S09、AI-S15；任务：A00、A03、A08、A09
- 前置：两DB连接、受控provider记录callId与计费用量；用户每日已49成功轮/上限50，游客9/10；费用microUSD上界可控
- 步骤：London23:59:59受理后次日完成 → 秋季重复时刻请求
- 预期：归受理日一次扣轮；不按UTC日或重复小时重置
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI12 AC-AI15、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1

### QA-AI-040 第2调用费用预留

- 优先级/阶段/方法：P0 / implementation / postgres_provider_fault_injection；状态：NOT_RUN
- 需求：FR-13、AC-AI12、AC-AI15；场景：AI-S07、AI-S08、AI-S09、AI-S15；任务：A00、A03、A08、A09
- 前置：两DB连接、受控provider记录callId与计费用量；用户每日已49成功轮/上限50，游客9/10；费用microUSD上界可控
- 步骤：预算仅够第1call → 触发解析+生成 → 另连接争最后预算
- 预期：每call先原子预留；第2预算不足不发网络；无超hardCap/漏解析费用
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI12 AC-AI15、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1

### QA-AI-041 UNKNOWN与失败计费

- 优先级/阶段/方法：P0 / implementation / postgres_provider_fault_injection；状态：NOT_RUN
- 需求：FR-13、AC-AI12、AC-AI15；场景：AI-S07、AI-S08、AI-S09、AI-S15；任务：A00、A03、A08、A09
- 前置：两DB连接、受控provider记录callId与计费用量；用户每日已49成功轮/上限50，游客9/10；费用microUSD上界可控
- 步骤：provider超时/断网无usage → 失败有usage → API崩溃重启
- 预期：UNKNOWN最大reserve保留且不重发；失败照实际结算；用户成功轮及在途位释放
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI12 AC-AI15、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1

### QA-AI-042 reaper迟到发布竞争

- 优先级/阶段/方法：P0 / implementation / postgres_provider_fault_injection；状态：NOT_RUN
- 需求：FR-13、AC-AI12、AC-AI15；场景：AI-S07、AI-S08、AI-S09、AI-S15；任务：A00、A03、A08、A09
- 前置：两DB连接、受控provider记录callId与计费用量；用户每日已49成功轮/上限50，游客9/10；费用microUSD上界可控
- 步骤：deadline reaper先CAS PENDING→FAILED → 随后模型返回成功尝试发布
- 预期：发布须CAS仍PENDING；迟到丢弃、不扣成功轮、不恢复正文
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI12 AC-AI15、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1

### QA-AI-043 未配置预算和停用

- 优先级/阶段/方法：P0 / implementation / postgres_provider_fault_injection；状态：NOT_RUN
- 需求：FR-13、AC-AI12、AC-AI15；场景：AI-S07、AI-S08、AI-S09、AI-S15；任务：A00、A03、A08、A09
- 前置：两DB连接、受控provider记录callId与计费用量；用户每日已49成功轮/上限50，游客9/10；费用microUSD上界可控
- 步骤：缺daily/monthly/call cap → 或在途时人工停用
- 预期：fail closed不发新call；在途结果停止发布；业务路径和偏好删除可用
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI12 AC-AI15、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1

### QA-AI-044 对账权限与幂等

- 优先级/阶段/方法：P0 / implementation / postgres_provider_fault_injection；状态：NOT_RUN
- 需求：FR-13、AC-AI12、AC-AI15；场景：AI-S07、AI-S08、AI-S09、AI-S15；任务：A00、A03、A08、A09
- 前置：两DB连接、受控provider记录callId与计费用量；用户每日已49成功轮/上限50，游客9/10；费用microUSD上界可控
- 步骤：support无ai_budget_ops → 缺MFA/账单引用 → 合法reconcile重复同key
- 预期：前者拒绝；合法核对有版本原因审计且只释放一次；UNKNOWN不猜0或重发解锁
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI12 AC-AI15、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1

### QA-AI-045 长度token及deadline

- 优先级/阶段/方法：P0 / implementation / postgres_provider_fault_injection；状态：NOT_RUN
- 需求：FR-13、AC-AI12、AC-AI15；场景：AI-S07、AI-S08、AI-S09、AI-S15；任务：A00、A03、A08、A09
- 前置：两DB连接、受控provider记录callId与计费用量；用户每日已49成功轮/上限50，游客9/10；费用microUSD上界可控
- 步骤：输入空白/2000/2001字符 → 输入token超16000 → 模型输出超2000token → 模拟总耗时30秒
- 预期：空白不发；2000可受理2001保留原文报错；上限前拒绝/安全失败；30秒内终结不输出部分可用草稿
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI12 AC-AI15、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1

### QA-AI-046 已有申请不再推荐

- 优先级/阶段/方法：P1 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-13、AC-AI03、AC-AI09、AC-AI15；场景：AI-S02、AI-S03、AI-S12；任务：A04、A05、A06、A08
- 前置：固定today/输入语言/本人历史状态；可选结果少于3场
- 步骤：A对不同场为pending/confirmed/declined → 明确查找再明确解释这些场
- 预期：不作为可新加入结果；明确解释可读本人状态；withdrawn可按新轮规则重新推荐
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI03 AC-AI09 AC-AI15、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1

### QA-AI-047 结果不足三张

- 优先级/阶段/方法：P1 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-13、AC-AI03、AC-AI09、AC-AI15；场景：AI-S02、AI-S03、AI-S12；任务：A04、A05、A06、A08
- 前置：固定today/输入语言/本人历史状态；可选结果少于3场
- 步骤：可见合格集合只有1场 → 查询推荐
- 预期：仅1张卡不凑数；不自造ID或把低soft未知当排除
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI03 AC-AI09 AC-AI15、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1

### QA-AI-048 当日与未确认目标

- 优先级/阶段/方法：P1 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-13、AC-AI03、AC-AI09、AC-AI15；场景：AI-S02、AI-S03、AI-S12；任务：A04、A05、A06、A08
- 前置：固定today/输入语言/本人历史状态；可选结果少于3场
- 步骤：用户英文/中文问这顿饭但无明确mealId → Discover旧选中M
- 预期：先要求选择目标；旧选中不自动当当前明确对象；按当前输入语言回复
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI03 AC-AI09 AC-AI15、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1

### QA-AI-049 创建与群草稿长度

- 优先级/阶段/方法：P1 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-13、AC-AI03、AC-AI09、AC-AI15；场景：AI-S02、AI-S03、AI-S12；任务：A04、A05、A06、A08
- 前置：固定today/输入语言/本人历史状态；可选结果少于3场
- 步骤：申请输出301字 → 创建标题81/说明1001 → 群草稿1001 → 转入原编辑器
- 预期：不产生超核心限制可提交内容；校验拒绝/安全失败；不可凭PRD AI上限500绕过申请300
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI03 AC-AI09 AC-AI15、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1

### QA-AI-050 DeepSeek模型替换准入

- 优先级/阶段/方法：P0 / implementation / postgres_provider_fault_injection；状态：NOT_RUN
- 需求：FR-13、AC-AI12、AC-AI15；场景：AI-S08、AI-S15；任务：A00、A03、A08、A09
- 前置：最新资源决定为DeepSeek及人民币50/月；仅隔离受控provider，未获真实账户/金额配置不发真实调用
- 步骤：读取最新资源决定与旧OpenAI候选差异 → 冻结DeepSeek model/SDK/schema/价格/数据配置，经ADR记录后运行原60样本
- 预期：不静默沿用旧供应商model/参数或留存声明；全量原质量/延迟/零容忍门槛保持；真实可用性未测则G-AI-MODEL未关闭
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI12 AC-AI15、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1、[mvp-coordination.md](../../tasks/mvp-coordination.md) 用户已明确资源决定及验收交接

### QA-AI-051 人民币50月上限并发预留

- 优先级/阶段/方法：P0 / implementation / postgres_provider_fault_injection；状态：NOT_RUN
- 需求：FR-13、AC-AI12、AC-AI15；场景：AI-S08、AI-S15；任务：A00、A03、A08、A09
- 前置：最新资源决定为DeepSeek及人民币50/月；仅隔离受控provider，未获真实账户/金额配置不发真实调用
- 步骤：配置月预算CNY50，已用与reserved合计49.99元，构造两笔各0.01元上界并发 → 再请求0.01元；模拟价格/汇率版本缺失
- 预期：前两笔最多一笔准入且used+reserved≤50.00元；后续停止新call；无可审查保守币种换算/价格版本则fail closed；不把50设为USD50
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI12 AC-AI15、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1、[mvp-coordination.md](../../tasks/mvp-coordination.md) 用户已明确资源决定及验收交接

### QA-AI-052 新供应商数据参数兼容

- 优先级/阶段/方法：P0 / implementation / postgres_provider_fault_injection；状态：NOT_RUN
- 需求：FR-13、AC-AI12、AC-AI15；场景：AI-S08、AI-S15；任务：A00、A03、A08、A09
- 前置：最新资源决定为DeepSeek及人民币50/月；仅隔离受控provider，未获真实账户/金额配置不发真实调用
- 步骤：检查DeepSeek实际响应schema/拒答/usage/token上界及账户地区/留存 → 尝试把OpenAI store:false传入并当作零留存凭据
- 预期：只用已验证适配参数；不支持能力显式阻塞/ADR替代；不能继承其他供应商数据承诺或用无效参数关闭G-AI-DATA
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-13 AC-AI12 AC-AI15、[ai-development-plan.zh-CN.md](../../docs/engineering/ai-development-plan.zh-CN.md) §1—8；P-04/P-05见核心方案§1、[mvp-coordination.md](../../tasks/mvp-coordination.md) 用户已明确资源决定及验收交接

## API

### QA-API-001 公开字段白名单

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.6；场景：S05、S23、S28；任务：T05、T08、T18、T22、T23、T24
- 前置：服务端test adapter；匿名/A/H/analyst/data_admin/support及MFA状态；每条API用合法与不合法主体
- 步骤：游客GET公开资料及meal → 用A令牌猜B me/申请/私密资源
- 预期：仅公开DTO；他人私密资源404/403；不序列化email/contact/消息/偏好/行程
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.6、[api-and-client-contract.zh-CN.md](../../docs/engineering/api-and-client-contract.zh-CN.md) §1—7

### QA-API-002 后台角色隔离

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.6；场景：S05、S23、S28；任务：T05、T08、T18、T22、T23、T24
- 前置：服务端test adapter；匿名/A/H/analyst/data_admin/support及MFA状态；每条API用合法与不合法主体
- 步骤：analyst改classification → data_admin正常带reason/version → support访问非case数据
- 预期：analyst拒绝；管理员成功但不改变业务权限；support不能全表读取
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.6、[api-and-client-contract.zh-CN.md](../../docs/engineering/api-and-client-contract.zh-CN.md) §1—7

### QA-API-003 错误版本与额外字段

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.6；场景：S05、S23、S28；任务：T05、T08、T18、T22、T23、T24
- 前置：服务端test adapter；匿名/A/H/analyst/data_admin/support及MFA状态；每条API用合法与不合法主体
- 步骤：用旧If-Match写 → 伪actorId/users.status/客户端reportedAt/未知枚举
- 预期：版本冲突无覆盖；非白名单字段拒绝；actor/时钟由服务端控制
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.6、[api-and-client-contract.zh-CN.md](../../docs/engineering/api-and-client-contract.zh-CN.md) §1—7

### QA-API-004 游标篡改和大序号

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.6；场景：S05、S23、S28；任务：T05、T08、T18、T22、T23、T24
- 前置：服务端test adapter；匿名/A/H/analyst/data_admin/support及MFA状态；每条API用合法与不合法主体
- 步骤：伪造另一snapshot/filter cursor → seq超过2^53 → 请求超过page limit
- 预期：篡改拒绝；seq以字符串往返不丢精度；分页上限生效
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.6、[api-and-client-contract.zh-CN.md](../../docs/engineering/api-and-client-contract.zh-CN.md) §1—7

### QA-API-005 CSV注入与下载授权

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.6；场景：S05、S23、S28；任务：T05、T08、T18、T22、T23、T24
- 前置：服务端test adapter；匿名/A/H/analyst/data_admin/support及MFA状态；每条API用合法与不合法主体
- 步骤：合成公开字段以=、+、-、@开头 → 导出后撤角色再下载
- 预期：CSV转义不执行公式；每次下载重新校验role/epoch；无私密字段
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.6、[api-and-client-contract.zh-CN.md](../../docs/engineering/api-and-client-contract.zh-CN.md) §1—7

### QA-API-006 重放仍检查授权

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.6、FR-11；场景：S03、S04、S23；任务：T03、T04、T18、T24
- 前置：隔离API，固定鉴权时钟与actor；合法资源先执行成功后撤权
- 步骤：成功执行并缓存响应 → 撤角色/注销/删除后同幂等key重放
- 预期：不能用旧响应取私密数据或恢复业务权限
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.6 FR-11、[api-and-client-contract.zh-CN.md](../../docs/engineering/api-and-client-contract.zh-CN.md) §1—7

### QA-API-007 缺版本与429退避

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.6、FR-11；场景：S03、S04、S23；任务：T03、T04、T18、T24
- 前置：隔离API，固定鉴权时钟与actor；合法资源先执行成功后撤权
- 步骤：缺If-Match编辑 → 超频收到429 → 原intent带原key退避重试
- 预期：缺版本428；429带Retry-After；不换key制造重复写
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.6 FR-11、[api-and-client-contract.zh-CN.md](../../docs/engineering/api-and-client-contract.zh-CN.md) §1—7

### QA-API-008 五分钟再次认证

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.6、FR-11；场景：S03、S04、S23；任务：T03、T04、T18、T24
- 前置：隔离API；固定服务端鉴权时钟；合法删除及身份关联请求的其他条件均满足；用户于2026-10-21明确满5分钟无效
- 步骤：认证时间固定authTime，分别设置服务端effectiveNow−authTime为299999、300000、300001毫秒 → 每个变体在独立fixture分别提交账号删除及身份关联，记录响应与副作用
- 预期：299999毫秒：通过再次认证新鲜度校验；其他条件满足时允许操作；300000和300001毫秒：再次认证无效，拒绝敏感操作并要求重新认证（REAUTH_REQUIRED）；无删除受理或身份关联写入；有效条件为0≤effectiveNow−authTime<300000毫秒；未来authTime不能绕过校验
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.6 FR-11、[api-and-client-contract.zh-CN.md](../../docs/engineering/api-and-client-contract.zh-CN.md) §1—7

### QA-API-009 空壳身份迁移

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.6、FR-11；场景：S03、S04、S23；任务：T03、T04、T18、T24
- 前置：隔离API，固定鉴权时钟与actor；合法资源先执行成功后撤权
- 步骤：已有空资料provisional和原账户 → 双proof链接
- 预期：仅无业务事实空壳可迁identity；旧session撤销且空壳墓碑；无重复业务user
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.6 FR-11、[api-and-client-contract.zh-CN.md](../../docs/engineering/api-and-client-contract.zh-CN.md) §1—7

### QA-API-010 支持CLI回调

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.6、FR-11；场景：S03、S04、S23；任务：T03、T04、T18、T24
- 前置：隔离API，固定鉴权时钟与actor；合法资源先执行成功后撤权
- 步骤：SUPPORT_CLI登录 → 换未登记host/path或过期handoff → 正常PKCE兑换
- 预期：只允许登记loopback；60秒绑定challenge；15分钟session无refresh；case/MFA每次重验
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.6 FR-11、[api-and-client-contract.zh-CN.md](../../docs/engineering/api-and-client-contract.zh-CN.md) §1—7

## AUTH

### QA-AUTH-001 游客浏览与敏感入口门禁

- 优先级/阶段/方法：P1 / demo / browser_or_unit；状态：NOT_RUN
- 需求：FR-11、§0.6；场景：S03、S04、S05；任务：T03、T04、T05、T08、T24
- 前置：全新本地Demo，游客；仅虚构邮箱及示例资料
- 步骤：Explore tables first → 浏览地图、详情及公开主页 → 分别点Create/Apply/Meals/Inbox
- 预期：公开路径可达；受限动作进入认证；没有自动申请或创建
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-11 §0.6、[api-and-client-contract.zh-CN.md](../../docs/engineering/api-and-client-contract.zh-CN.md) §1—7

### QA-AUTH-002 邮箱失败与恢复

- 优先级/阶段/方法：P1 / demo / browser_or_unit；状态：NOT_RUN
- 需求：FR-11、§0.6；场景：S03、S04、S05；任务：T03、T04、T05、T08、T24
- 前置：全新本地Demo，游客；仅虚构邮箱及示例资料
- 步骤：输入非法邮箱 → 改为 qa@example.invalid → 输入错误验证码再输入123456
- 预期：非法邮箱不能继续；错误码不登录；合法示例码回到初始操作且标为模拟
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-11 §0.6、[api-and-client-contract.zh-CN.md](../../docs/engineering/api-and-client-contract.zh-CN.md) §1—7

### QA-AUTH-003 验证码过期和重发

- 优先级/阶段/方法：P1 / demo / browser_or_unit；状态：NOT_RUN
- 需求：FR-11、§0.6；场景：S03、S04、S05；任务：T03、T04、T05、T08、T24
- 前置：全新本地Demo，游客；仅虚构邮箱及示例资料
- 步骤：控制Demo时钟，签发后5分钟验证 → 尝试30秒内重发 → 冷却后重发
- 预期：到期拒绝；冷却说明明确；新轮可继续且不丢邮箱
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-11 §0.6、[api-and-client-contract.zh-CN.md](../../docs/engineering/api-and-client-contract.zh-CN.md) §1—7

### QA-AUTH-004 供应商取消回流

- 优先级/阶段/方法：P1 / demo / browser_or_unit；状态：NOT_RUN
- 需求：FR-11、§0.6；场景：S03、S04、S05；任务：T03、T04、T05、T08、T24
- 前置：全新本地Demo，游客；仅虚构邮箱及示例资料
- 步骤：在Apply触发Google/Apple模拟 → 取消 → 重新完成登录
- 预期：取消不产生申请；饭局目标保留；完成后仍需主动提交
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-11 §0.6、[api-and-client-contract.zh-CN.md](../../docs/engineering/api-and-client-contract.zh-CN.md) §1—7

### QA-AUTH-005 资料门槛

- 优先级/阶段/方法：P1 / demo / browser_or_unit；状态：NOT_RUN
- 需求：FR-11、§0.6；场景：S03、S04、S05；任务：T03、T04、T05、T08、T24
- 前置：全新本地Demo，游客；仅虚构邮箱及示例资料
- 步骤：留空姓名/介绍/兴趣/语言/生活状态/18+或社区确认，逐项尝试提交 → 补齐
- 预期：缺项就地提示；全部合法才完成；公开主页与录入一致
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-11 §0.6、[api-and-client-contract.zh-CN.md](../../docs/engineering/api-and-client-contract.zh-CN.md) §1—7

### QA-AUTH-006 退出及刷新边界

- 优先级/阶段/方法：P1 / demo / browser_or_unit；状态：NOT_RUN
- 需求：FR-11、§0.6；场景：S03、S04、S05；任务：T03、T04、T05、T08、T24
- 前置：全新本地Demo，游客；仅虚构邮箱及示例资料
- 步骤：登录后取消一次Sign out → 再次确认退出 → 刷新
- 预期：取消保持登录；确认变游客；刷新不冒称真实持久登录
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-11 §0.6、[api-and-client-contract.zh-CN.md](../../docs/engineering/api-and-client-contract.zh-CN.md) §1—7

### QA-AUTH-007 OTP尝试次数与一次消费

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-11、§0.6；场景：S03、S04；任务：T03、T04、T24
- 前置：隔离身份适配器；两个账号H/A；可控制时钟、challenge与网络
- 步骤：同challenge连续5次错码后再正确验证 → 对已成功challenge重放
- 预期：不得绕过服务端尝试上限；重放不签新session
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-11 §0.6、[api-and-client-contract.zh-CN.md](../../docs/engineering/api-and-client-contract.zh-CN.md) §1—7

### QA-AUTH-008 OTP丢响应

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-11、§0.6；场景：S03、S04；任务：T03、T04、T24
- 前置：隔离身份适配器；两个账号H/A；可控制时钟、challenge与网络
- 步骤：成功验证后丢弃响应 → 重放clientRequestId
- 预期：不从通用幂等表返回旧明文token；提示重新认证或重新start
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-11 §0.6、[api-and-client-contract.zh-CN.md](../../docs/engineering/api-and-client-contract.zh-CN.md) §1—7

### QA-AUTH-009 同邮箱链接

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-11、§0.6；场景：S03、S04；任务：T03、T04、T24
- 前置：隔离身份适配器；两个账号H/A；可控制时钟、challenge与网络
- 步骤：新issuer/sub带已验证同邮箱登录 → 取消后重新双proof
- 预期：先LINK_REQUIRED且无业务session/重复user；双proof后映射到原账号
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-11 §0.6、[api-and-client-contract.zh-CN.md](../../docs/engineering/api-and-client-contract.zh-CN.md) §1—7

### QA-AUTH-010 链接票据边界

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-11、§0.6；场景：S03、S04；任务：T03、T04、T24
- 前置：隔离身份适配器；两个账号H/A；可控制时钟、challenge与网络
- 步骤：10分钟到期验证、另一challenge兑换、重复消费
- 预期：过期/错绑定/重放拒绝；不返回旧身份列表
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-11 §0.6、[api-and-client-contract.zh-CN.md](../../docs/engineering/api-and-client-contract.zh-CN.md) §1—7

### QA-AUTH-011 非空账户冲突

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-11、§0.6；场景：S03、S04；任务：T03、T04、T24
- 前置：隔离身份适配器；两个账号H/A；可控制时钟、challenge与网络
- 步骤：两个各有业务数据账户执行链接
- 预期：ACCOUNT_LINK_CONFLICT；原业务及会话不被静默合并
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-11 §0.6、[api-and-client-contract.zh-CN.md](../../docs/engineering/api-and-client-contract.zh-CN.md) §1—7

### QA-AUTH-012 CSRF与开放重定向

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-11、§0.6；场景：S03、S04；任务：T03、T04、T24
- 前置：隔离身份适配器；两个账号H/A；可控制时钟、challenge与网络
- 步骤：缺CSRF或恶意Origin写请求 → OAuth换state/nonce/returnTo
- 预期：请求拒绝无写入；不跳未登记域名
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-11 §0.6、[api-and-client-contract.zh-CN.md](../../docs/engineering/api-and-client-contract.zh-CN.md) §1—7

### QA-AUTH-013 refresh轮换重用

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-11、§0.6；场景：S03、S04；任务：T03、T04、T24
- 前置：隔离身份适配器；两个账号H/A；可控制时钟、challenge与网络
- 步骤：合法refresh轮换 → 重放旧refresh → 再用同family新token
- 预期：旧token重用撤销family；后续请求不可用
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-11 §0.6、[api-and-client-contract.zh-CN.md](../../docs/engineering/api-and-client-contract.zh-CN.md) §1—7

### QA-AUTH-014 退出后缓存和深链

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-11、§0.6；场景：S03、S04；任务：T03、T04、T24
- 前置：隔离身份适配器；两个账号H/A；可控制时钟、challenge与网络
- 步骤：设备退出 → 重放消息写及缓存详情 → 另一设备继续
- 预期：本设备family撤销且私密缓存清理；未授权写失败；其他合法设备不被普通退出注销
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-11 §0.6、[api-and-client-contract.zh-CN.md](../../docs/engineering/api-and-client-contract.zh-CN.md) §1—7

## CHAT

### QA-CHAT-001 pending无群权限

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.4、FR-09；场景：S14、S15、S19、S20；任务：T12、T15、T18、T26、T30
- 前置：H/A/B，独立GROUP及DIRECT；记录每条消息seq和授权区间
- 步骤：A=PENDING → 直接猜conversationId读写
- 预期：无授权404/403；无历史/摘要/成员消息泄露
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.4 FR-09、[data-and-command-contract.zh-CN.md](../../docs/engineering/data-and-command-contract.zh-CN.md) §1—4

### QA-CHAT-002 群区间空档分页

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.4、FR-09；场景：S14、S15、S19、S20；任务：T12、T15、T18、T26、T30
- 前置：H/A/B，独立GROUP及DIRECT；记录每条消息seq和授权区间
- 步骤：JOIN A → M1 → LEAVE A → 隐藏M2 → 重入 → M3 → 小分页HISTORY和LIVE
- 预期：仅M1/M3；不泄露M2正文/发送者/数量；scannedThroughSeq推进不死循环
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.4 FR-09、[data-and-command-contract.zh-CN.md](../../docs/engineering/data-and-command-contract.zh-CN.md) §1—4

### QA-CHAT-003 退群与解散独立

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.4、FR-09；场景：S14、S15、S19、S20；任务：T12、T15、T18、T26、T30
- 前置：H/A/B，独立GROUP及DIRECT；记录每条消息seq和授权区间
- 步骤：A确认席位后退群 → H解散 → 尝试重申JOIN
- 预期：退群不退席位；HISTORY可读，LIVE写拒绝；解散不可重新开放
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.4 FR-09、[data-and-command-contract.zh-CN.md](../../docs/engineering/data-and-command-contract.zh-CN.md) §1—4

### QA-CHAT-004 取消和结束可发言

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.4、FR-09；场景：S14、S15、S19、S20；任务：T12、T15、T18、T26、T30
- 前置：H/A/B，独立GROUP及DIRECT；记录每条消息seq和授权区间
- 步骤：M取消或结束但群未解散 → 当前成员发消息
- 预期：正常发送；不因饭局终态误关群
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.4 FR-09、[data-and-command-contract.zh-CN.md](../../docs/engineering/data-and-command-contract.zh-CN.md) §1—4

### QA-CHAT-005 消息去重

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.4、FR-09；场景：S14、S15、S19、S20；任务：T12、T15、T18、T26、T30
- 前置：H/A/B，独立GROUP及DIRECT；记录每条消息seq和授权区间
- 步骤：同clientMessageId和body重试 → 换body → 跨会话重用
- 预期：不重复消息；不同body409；不借唯一键读取他会话响应
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.4 FR-09、[data-and-command-contract.zh-CN.md](../../docs/engineering/data-and-command-contract.zh-CN.md) §1—4

### QA-CHAT-006 撤回与发送并发

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.4、FR-09；场景：S14、S15、S19、S20；任务：T12、T15、T18、T26、T30
- 前置：H/A/B，独立GROUP及DIRECT；记录每条消息seq和授权区间
- 步骤：双方consent有效 → barrier交错revoke与sendDirect
- 预期：锁序决定可观察顺序；撤回提交之后无新消息；双方consent清空
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.4 FR-09、[data-and-command-contract.zh-CN.md](../../docs/engineering/data-and-command-contract.zh-CN.md) §1—4

### QA-CHAT-007 拉黑解除不恢复

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.4、FR-09；场景：S14、S15、S19、S20；任务：T12、T15、T18、T26、T30
- 前置：H/A/B，独立GROUP及DIRECT；记录每条消息seq和授权区间
- 步骤：双方已私聊 → A拉黑B后解除 → 仅A再次选择
- 预期：解除后仍不可发送；双方重新选才恢复；共享群不受影响
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.4 FR-09、[data-and-command-contract.zh-CN.md](../../docs/engineering/data-and-command-contract.zh-CN.md) §1—4

### QA-CHAT-008 多场资格纠错

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.4、FR-09；场景：S14、S15、S19、S20；任务：T12、T15、T18、T26、T30
- 前置：H/A/B，独立GROUP及DIRECT；记录每条消息seq和授权区间
- 步骤：两共同出席场 → 纠错其中一场absent → 再纠错唯一剩余依据
- 预期：第一步仍可发；无有效依据后只读历史；不要求发送仍在7天选择窗
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.4 FR-09、[data-and-command-contract.zh-CN.md](../../docs/engineering/data-and-command-contract.zh-CN.md) §1—4

### QA-CHAT-009 轮询中断与恢复

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.4、FR-09；场景：S14、S15、S19、S20；任务：T12、T15、T18、T26、T30
- 前置：H/A/B，独立GROUP及DIRECT；记录每条消息seq和授权区间
- 步骤：前台→后台→离线→回前台 → 期间撤权限
- 预期：后台停poll；退避到30秒；恢复先鉴权再补拉；403转历史不发待队列
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.4 FR-09、[data-and-command-contract.zh-CN.md](../../docs/engineering/data-and-command-contract.zh-CN.md) §1—4

### QA-CHAT-010 JOIN消息LEAVE提交顺序

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.4、FR-09；场景：S14、S15、S19；任务：T12、T15、T26、T30
- 前置：同conversation两连接、固定barrier；可注入事务回滚
- 步骤：连接1分配seq后暂停 → 连接2发送 → 回滚连接1再拉取
- 预期：无已发布空洞导致漏读；seq与提交顺序一致；边界授权不受未提交事件影响
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.4 FR-09、[data-and-command-contract.zh-CN.md](../../docs/engineering/data-and-command-contract.zh-CN.md) §1—4

### QA-CHAT-011 单方同意投影

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.4、FR-09；场景：S14、S15、S19；任务：T12、T15、T26、T30
- 前置：同conversation两连接、固定barrier；可注入事务回滚
- 步骤：A已选B → 从B/A公共主页、WAITING响应、后台/通知查询
- 预期：B不能推断A单方同意；后台/通知无私密选择
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.4 FR-09、[data-and-command-contract.zh-CN.md](../../docs/engineering/data-and-command-contract.zh-CN.md) §1—4

### QA-CHAT-012 消息输入边界

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.4、FR-09；场景：S14、S15、S19；任务：T12、T15、T26、T30
- 前置：同conversation两连接、固定barrier；可注入事务回滚
- 步骤：trim后0/1/2000/2001字符和HTML文本 → 分别发送
- 预期：空白及2001拒绝；1和2000保存一次；HTML纯文本不执行
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.4 FR-09、[data-and-command-contract.zh-CN.md](../../docs/engineering/data-and-command-contract.zh-CN.md) §1—4

## CODE

### QA-CODE-001 生产隔离

- 优先级/阶段/方法：P0 / review / static_review；状态：NOT_RUN
- 需求：§0.1、FR-13；场景：S29、AI-S11；任务：T00、T27
- 前置：待实现代码与锁文件、迁移、schema、SDK、日志配置；当前仅检查已有资产及目标差距
- 步骤：检查生产构建环境变量和imports → 尝试启用TEST_AUTH/FIXTURE_PLACES/固定OTP/review工具
- 预期：生产启动拒绝fixture；不整体迁移5300行原型、模拟键盘/付款及旧shared权威
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.1 FR-13、[validation-and-release.zh-CN.md](../../docs/engineering/validation-and-release.zh-CN.md) §1—4

### QA-CODE-002 数据库真约束

- 优先级/阶段/方法：P0 / review / static_review；状态：NOT_RUN
- 需求：§0.1、FR-13；场景：S29、AI-S11；任务：T01、T02
- 前置：待实现代码与锁文件、迁移、schema、SDK、日志配置；当前仅检查已有资产及目标差距
- 步骤：迁移空库/升级库 → 直接SQL插重复活跃申请、越界人数、重复message和非法FK
- 预期：Postgres CHECK/partial unique/FK真实拒绝；不只靠TS类型；迁移回滚兼容不丢数据
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.1 FR-13、[validation-and-release.zh-CN.md](../../docs/engineering/validation-and-release.zh-CN.md) §1—4

### QA-CODE-003 事务与锁顺序

- 优先级/阶段/方法：P0 / review / static_review；状态：NOT_RUN
- 需求：§0.1、FR-13；场景：S29、AI-S11；任务：T02、A02、A03
- 前置：待实现代码与锁文件、迁移、schema、SDK、日志配置；当前仅检查已有资产及目标差距
- 步骤：审阅所有写命令/删除/支持/AI提交 → 注入反向加锁与provider延迟
- 预期：固定user→meal→pair→conversation→AI→privacy最终锁；网络不在长事务；拿锁后DB时钟
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.1 FR-13、[validation-and-release.zh-CN.md](../../docs/engineering/validation-and-release.zh-CN.md) §1—4

### QA-CODE-004 权限和响应schema

- 优先级/阶段/方法：P0 / review / static_review；状态：NOT_RUN
- 需求：§0.1、FR-13；场景：S29、AI-S11；任务：T01、T04
- 前置：待实现代码与锁文件、迁移、schema、SDK、日志配置；当前仅检查已有资产及目标差距
- 步骤：检查所有route的认证、角色、输入/响应schema → 绕过allowedActions直接请求
- 预期：服务端独立校验；不信actorId；禁止整行序列化；错误不泄密
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.1 FR-13、[validation-and-release.zh-CN.md](../../docs/engineering/validation-and-release.zh-CN.md) §1—4

### QA-CODE-005 SDK契约漂移

- 优先级/阶段/方法：P0 / review / static_review；状态：NOT_RUN
- 需求：§0.1、FR-13；场景：S29、AI-S11；任务：T00、T01
- 前置：待实现代码与锁文件、迁移、schema、SDK、日志配置；当前仅检查已有资产及目标差距
- 步骤：从schema生成OpenAPI/SDK → 改字段不再生成 → 跑typecheck/lint
- 预期：漂移被检查捕获；Web/iOS/admin共享同一DTO与错误类型
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.1 FR-13、[validation-and-release.zh-CN.md](../../docs/engineering/validation-and-release.zh-CN.md) §1—4

### QA-CODE-006 日志与存储泄露

- 优先级/阶段/方法：P0 / review / static_review；状态：NOT_RUN
- 需求：§0.1、FR-13；场景：S29、AI-S11；任务：T20、A01、A02
- 前置：待实现代码与锁文件、迁移、schema、SDK、日志配置；当前仅检查已有资产及目标差距
- 步骤：合成文本埋唯一canary → 模拟错误/APM/崩溃 → 检查DB/WAL/缓存/日志fixture
- 预期：无OTP/token/email/chat/AI原文/偏好值；仅允许最小元数据；合成评测原文另隔离
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.1 FR-13、[validation-and-release.zh-CN.md](../../docs/engineering/validation-and-release.zh-CN.md) §1—4

### QA-CODE-007 测试可信度

- 优先级/阶段/方法：P0 / review / static_review；状态：NOT_RUN
- 需求：§0.1、FR-13；场景：S29、AI-S11；任务：T02、T28、A08
- 前置：待实现代码与锁文件、迁移、schema、SDK、日志配置；当前仅检查已有资产及目标差距
- 步骤：审查skip/only、无断言、过度mock、随机sleep和截图更新 → 重跑最小反例
- 预期：关键DB用双连接barrier；mock不关闭真实门槛；断言来自需求，不降低标准掩盖缺陷
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.1 FR-13、[validation-and-release.zh-CN.md](../../docs/engineering/validation-and-release.zh-CN.md) §1—4

## CREATE

### QA-CREATE-001 创建四步与返回保稿

- 优先级/阶段/方法：P1 / demo / browser_or_unit；状态：NOT_RUN
- 需求：FR-05、§0.2；场景：S06、S07、S08、S31；任务：T06、T07、T10、T25、T32
- 前置：新建四步Arrange/Introduce/Costs/Review；已确认示例餐厅
- 步骤：逐步输入 → Review返回Arrange → 取消退出后重开
- 预期：返回保持本次输入；未Review确认不能发布；新发布后新草稿不复用旧值
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-05 §0.2

### QA-CREATE-002 外订声明与预算

- 优先级/阶段/方法：P1 / demo / browser_or_unit；状态：NOT_RUN
- 需求：FR-05、§0.2；场景：S06、S07、S08、S31；任务：T06、T07、T10、T25、T32
- 前置：新建四步Arrange/Introduce/Costs/Review；已确认示例餐厅
- 步骤：不勾外订确认尝试继续 → 勾选 → 改变人数后检查声明
- 预期：确认未做不可继续；预算与到店付说明明确；安排改变旧声明需重做
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-05 §0.2

### QA-CREATE-003 人数范围

- 优先级/阶段/方法：P1 / demo / browser_or_unit；状态：NOT_RUN
- 需求：FR-05、§0.2；场景：S06、S07、S08、S31；任务：T06、T07、T10、T25、T32
- 前置：新建四步Arrange/Introduce/Costs/Review；已确认示例餐厅
- 步骤：输入minimum2/capacity2、3/4、6/6 → 尝试1/4、5/4、3/7、小数
- 预期：合法范围可继续且含host；非法拒绝且保留其他草稿
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-05 §0.2

### QA-CREATE-004 时间菜单恢复

- 优先级/阶段/方法：P1 / demo / browser_or_unit；状态：NOT_RUN
- 需求：FR-05、§0.2；场景：S06、S07、S08、S31；任务：T06、T07、T10、T25、T32
- 前置：新建四步Arrange/Introduce/Costs/Review；已确认示例餐厅
- 步骤：开时间菜单 → 键盘上下选择 → Escape和点外部 → 切餐厅
- 预期：菜单在手机边界内且聚焦选中项；取消保持旧值；不可用时段清除并说明
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-05 §0.2

## DB

### QA-DB-001 最后一席双审批

- 优先级/阶段/方法：P0 / implementation / postgres_concurrency；状态：NOT_RUN
- 需求：§0.2、§0.3、FR-04、FR-05；场景：S01、S02、S08、S10、S11、S12、S13；任务：T09、T10、T11、T25、T31
- 前置：Postgres17双连接barrier；H主持M，minimum3/capacity4；A/B/C合格，时间均服务端可控
- 步骤：预置H+A+B三席 → 两个连接同时审批C/D → 提交后查席位事件/JOIN/outbox
- 预期：恰一成功且另一被拒；confirmed=4；成功方仅一席/一个JOIN/各一通知
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.2 §0.3 FR-04 FR-05、[data-and-command-contract.zh-CN.md](../../docs/engineering/data-and-command-contract.zh-CN.md) §1—4

### QA-DB-002 锁等待跨截止

- 优先级/阶段/方法：P0 / implementation / postgres_concurrency；状态：NOT_RUN
- 需求：§0.2、§0.3、FR-04、FR-05；场景：S01、S02、S08、S10、S11、S12、S13；任务：T09、T10、T11、T25、T31
- 前置：Postgres17双连接barrier；H主持M，minimum3/capacity4；A/B/C合格，时间均服务端可控
- 步骤：连接1持meal锁 → 连接2开始审批 → 等数据库时钟跨closesAt后放锁
- 预期：以取得锁后时钟裁定拒绝；EXPIRED及不足取消补齐仍提交
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.2 §0.3 FR-04 FR-05、[data-and-command-contract.zh-CN.md](../../docs/engineering/data-and-command-contract.zh-CN.md) §1—4

### QA-DB-003 补齐后业务拒绝事务

- 优先级/阶段/方法：P0 / implementation / postgres_concurrency；状态：NOT_RUN
- 需求：§0.2、§0.3、FR-04、FR-05；场景：S01、S02、S08、S10、S11、S12、S13；任务：T09、T10、T11、T25、T31
- 前置：Postgres17双连接barrier；H主持M，minimum3/capacity4；A/B/C合格，时间均服务端可控
- 步骤：截止不足minimum时触发不合法审批 → 读取取消事实
- 预期：审批409；生命周期补齐不因业务409回滚；非预期异常则整体回滚
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.2 §0.3 FR-04 FR-05、[data-and-command-contract.zh-CN.md](../../docs/engineering/data-and-command-contract.zh-CN.md) §1—4

### QA-DB-004 同键重试与变body

- 优先级/阶段/方法：P0 / implementation / postgres_concurrency；状态：NOT_RUN
- 需求：§0.2、§0.3、FR-04、FR-05；场景：S01、S02、S08、S10、S11、S12、S13；任务：T09、T10、T11、T25、T31
- 前置：Postgres17双连接barrier；H主持M，minimum3/capacity4；A/B/C合格，时间均服务端可控
- 步骤：同actor/operation/key并发申请两次 → 变message再用同key
- 预期：仅一applicationId/轮次；同body重放不写；变body409
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.2 §0.3 FR-04 FR-05、[data-and-command-contract.zh-CN.md](../../docs/engineering/data-and-command-contract.zh-CN.md) §1—4

### QA-DB-005 撤回与拒绝不同终局

- 优先级/阶段/方法：P0 / implementation / postgres_concurrency；状态：NOT_RUN
- 需求：§0.2、§0.3、FR-04、FR-05；场景：S01、S02、S08、S10、S11、S12、S13；任务：T09、T10、T11、T25、T31
- 前置：Postgres17双连接barrier；H主持M，minimum3/capacity4；A/B/C合格，时间均服务端可控
- 步骤：A撤回后重申 → B被拒后重申
- 预期：A新round且旧轮保留；B本场永不重申；不因换key绕过
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.2 §0.3 FR-04 FR-05、[data-and-command-contract.zh-CN.md](../../docs/engineering/data-and-command-contract.zh-CN.md) §1—4

### QA-DB-006 先批准再全部退出

- 优先级/阶段/方法：P0 / implementation / postgres_concurrency；状态：NOT_RUN
- 需求：§0.2、§0.3、FR-04、FR-05；场景：S01、S02、S08、S10、S11、S12、S13；任务：T09、T10、T11、T25、T31
- 前置：Postgres17双连接barrier；H主持M，minimum3/capacity4；A/B/C合格，时间均服务端可控
- 步骤：首guest批准 → 全部guest退出 → 编辑容量/餐厅/时间/预算/截止/饮食
- 预期：arrangement_locked_at不清；所有关键字段仍拒绝更改
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.2 §0.3 FR-04 FR-05、[data-and-command-contract.zh-CN.md](../../docs/engineering/data-and-command-contract.zh-CN.md) §1—4

### QA-DB-007 开始前跌破minimum

- 优先级/阶段/方法：P0 / implementation / postgres_concurrency；状态：NOT_RUN
- 需求：§0.2、§0.3、FR-04、FR-05；场景：S01、S02、S08、S10、S11、S12、S13；任务：T09、T10、T11、T25、T31
- 前置：Postgres17双连接barrier；H主持M，minimum3/capacity4；A/B/C合格，时间均服务端可控
- 步骤：截止时H+A+B达标 → 开饭前A退出
- 预期：本次退出同事务整场取消；群成员不受影响；通知不重复
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.2 §0.3 FR-04 FR-05、[data-and-command-contract.zh-CN.md](../../docs/engineering/data-and-command-contract.zh-CN.md) §1—4

### QA-DB-008 开始后主持取消

- 优先级/阶段/方法：P0 / implementation / postgres_concurrency；状态：NOT_RUN
- 需求：§0.2、§0.3、FR-04、FR-05；场景：S01、S02、S08、S10、S11、S12、S13；任务：T09、T10、T11、T25、T31
- 前置：Postgres17双连接barrier；H主持M，minimum3/capacity4；A/B/C合格，时间均服务端可控
- 步骤：到startsAt → host发cancel → 参与者尝试leaveMeal
- 预期：不改变已发生资格；拒绝普通取消/退出；支持路径单独受理
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.2 §0.3 FR-04 FR-05、[data-and-command-contract.zh-CN.md](../../docs/engineering/data-and-command-contract.zh-CN.md) §1—4

### QA-DB-009 迟到worker按历史重放

- 优先级/阶段/方法：P0 / implementation / postgres_concurrency；状态：NOT_RUN
- 需求：§0.2、§0.3、FR-04、FR-05；场景：S01、S02、S08、S10、S11、S12、S13；任务：T09、T10、T11、T25、T31
- 前置：Postgres17双连接barrier；H主持M，minimum3/capacity4；A/B/C合格，时间均服务端可控
- 步骤：截止时2人不足 → worker停到end后 → 期间模拟历史有效事件再恢复
- 预期：按closesAt历史取消；不以恢复时现人数补成团；任务重试不重复事件
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.2 §0.3 FR-04 FR-05、[data-and-command-contract.zh-CN.md](../../docs/engineering/data-and-command-contract.zh-CN.md) §1—4

### QA-DB-010 退出恰好开始

- 优先级/阶段/方法：P0 / implementation / postgres_concurrency；状态：NOT_RUN
- 需求：§0.2、§0.3、FR-04、FR-05；场景：S01、S02、S08、S10、S11、S12、S13；任务：T09、T10、T11、T25、T31
- 前置：Postgres17双连接barrier；H主持M，minimum3/capacity4；A/B/C合格，时间均服务端可控
- 步骤：分别插leftAt=start−1ms/start/start+1ms的历史 → 重建roster
- 预期：前两者排除；后者保留资格；删除不抹他人名单
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.2 §0.3 FR-04 FR-05、[data-and-command-contract.zh-CN.md](../../docs/engineering/data-and-command-contract.zh-CN.md) §1—4

### QA-DB-011 预约失败独立

- 优先级/阶段/方法：P0 / implementation / postgres_concurrency；状态：NOT_RUN
- 需求：§0.2、§0.3、FR-04、FR-05；场景：S01、S02、S08、S10、S11、S12、S13；任务：T09、T10、T11、T25、T31
- 前置：Postgres17双连接barrier；H主持M，minimum3/capacity4；A/B/C合格，时间均服务端可控
- 步骤：host声明FAILED → 再声明人数与现席位不符
- 预期：不自动cancel或关闭群；人数变化声明NEEDS_UPDATE；无供应商已订位假成功
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.2 §0.3 FR-04 FR-05、[data-and-command-contract.zh-CN.md](../../docs/engineering/data-and-command-contract.zh-CN.md) §1—4

### QA-DB-012 截止字段发布边界

- 优先级/阶段/方法：P1 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.2、§0.3；场景：S08、S10、S11、S12；任务：T09、T10、T11、T25、T31
- 前置：M全量合法；独立DB时钟及事件历史
- 步骤：截止=start−30min → 再start−29min → 再等于发布effectiveNow
- 预期：前者允许；后两者拒绝；未选时默认start−60min
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.2 §0.3、[data-and-command-contract.zh-CN.md](../../docs/engineering/data-and-command-contract.zh-CN.md) §1—4

### QA-DB-013 开始前修改与旧job

- 优先级/阶段/方法：P1 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.2、§0.3；场景：S08、S10、S11、S12；任务：T09、T10、T11、T25、T31
- 前置：M全量合法；独立DB时钟及事件历史
- 步骤：无guest时改starts/closes → 运行旧dueAt job及新dueAt job
- 预期：新安排重新校验且声明stale；旧job不得错误取消新时点场；每有效计划只一事实
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.2 §0.3、[data-and-command-contract.zh-CN.md](../../docs/engineering/data-and-command-contract.zh-CN.md) §1—4

### QA-DB-014 host不能退本人席位

- 优先级/阶段/方法：P1 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.2、§0.3；场景：S08、S10、S11、S12；任务：T09、T10、T11、T25、T31
- 前置：M全量合法；独立DB时钟及事件历史
- 步骤：host调用leaveMeal → guest调用cancelMeal并伪insufficient
- 预期：均拒绝；不削减host席位或写系统取消原因
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.2 §0.3、[data-and-command-contract.zh-CN.md](../../docs/engineering/data-and-command-contract.zh-CN.md) §1—4

### QA-DB-015 状态分区与历史轮次

- 优先级/阶段/方法：P1 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.2、§0.3；场景：S08、S10、S11、S12；任务：T09、T10、T11、T25、T31
- 前置：M全量合法；独立DB时钟及事件历史
- 步骤：构造host/confirmed/declined/expired/withdrawn/个人退出/整场取消/已结束名单
- 预期：逐项核对API§6五分区；允许有意交集；EXPIRED不伪装整场取消；轮次分别显示
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.2 §0.3、[data-and-command-contract.zh-CN.md](../../docs/engineering/data-and-command-contract.zh-CN.md) §1—4

## DISCOVERY

### QA-DISCOVERY-001 地图列表与返回保持

- 优先级/阶段/方法：P1 / demo / browser_or_unit；状态：NOT_RUN
- 需求：FR-01、FR-03；场景：S05、S09、S31；任务：T05、T08、T24、T31、T32
- 前置：默认五场示例；记录初始筛选/地图区域/选中卡片
- 步骤：选区域并翻卡 → 切列表 → 进详情及头像 → 返回
- 预期：地图数为饭局数非人数；列表同集合；返回保留筛选区域和卡片
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-01 FR-03

### QA-DISCOVERY-002 日期OR与跨字段AND

- 优先级/阶段/方法：P1 / demo / browser_or_unit；状态：NOT_RUN
- 需求：FR-01、FR-03；场景：S05、S09、S31；任务：T05、T08、T24、T31、T32
- 前置：默认五场示例；记录初始筛选/地图区域/选中卡片
- 步骤：选两个不连续日期 → 加语言及人数 → Apply → 关闭未应用的新改动
- 预期：日期取并集且维度交集；取消草稿不改变已应用条件
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-01 FR-03

### QA-DISCOVERY-003 空结果恢复

- 优先级/阶段/方法：P1 / demo / browser_or_unit；状态：NOT_RUN
- 需求：FR-01、FR-03；场景：S05、S09、S31；任务：T05、T08、T24、T31、T32
- 前置：默认五场示例；记录初始筛选/地图区域/选中卡片
- 步骤：选无场次未来日期 → Clear filters
- 预期：显示真实空态；清除恢复结果而非伪造推荐
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-01 FR-03

### QA-DISCOVERY-004 地图拖动与点选

- 优先级/阶段/方法：P1 / demo / browser_or_unit；状态：NOT_RUN
- 需求：FR-01、FR-03；场景：S05、S09、S31；任务：T05、T08、T24、T31、T32
- 前置：默认五场示例；记录初始筛选/地图区域/选中卡片
- 步骤：拖动地图后点击标记 → Search this area → 再点餐厅候选
- 预期：拖动不误触详情；已选位置与预览分开；确认前不改创建草稿
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-01 FR-03

### QA-DISCOVERY-005 选店无结果与旧选中

- 优先级/阶段/方法：P1 / demo / browser_or_unit；状态：NOT_RUN
- 需求：FR-01、FR-03；场景：S05、S09、S31；任务：T05、T08、T24、T31、T32
- 前置：默认五场示例；记录初始筛选/地图区域/选中卡片
- 步骤：先选现有示例餐厅 → 搜索不存在名称 → 关闭搜索
- 预期：无手动新增假餐厅入口；旧确认选择保留；未确认候选不可发布
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-01 FR-03

### QA-DISCOVERY-006 预算上限和双语去重

- 优先级/阶段/方法：P1 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-01、§0.6；场景：S09、S31；任务：T08、T31、T32
- 前置：独立查询fixture：双语en/zh、预算max=2000/2001/3000/3001/4000/4001便士、unknown、已满/本人/截止场
- 步骤：依次上限20/30/40筛选 → 双语任一/两种语言筛选
- 预期：预算比较max而非min/平均；双语一次命中不重复
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-01 §0.6

### QA-DISCOVERY-007 分页扫描无副作用

- 优先级/阶段/方法：P1 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-01、§0.6；场景：S09、S31；任务：T08、T31、T32
- 前置：独立查询fixture：双语en/zh、预算max=2000/2001/3000/3001/4000/4001便士、unknown、已满/本人/截止场
- 步骤：worker暂停跨截止 → GET列表/详情 → 记录DB写计数和锁
- 预期：到期不可申请；GET无写和行锁；≤100页/≤500扫描且nextCursor不谎报结束
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-01 §0.6

### QA-DISCOVERY-008 未提供菜系饮食

- 优先级/阶段/方法：P1 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-01、§0.6；场景：S09、S31；任务：T08、T31、T32
- 前置：独立查询fixture：双语en/zh、预算max=2000/2001/3000/3001/4000/4001便士、unknown、已满/本人/截止场
- 步骤：host字段null → 选具体菜系/饮食 → 再Any
- 预期：具体hard排除unknown；Any保留；显示host声明而非过敏保证
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-01 §0.6

### QA-DISCOVERY-009 坐标区域边界

- 优先级/阶段/方法：P1 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-01、§0.6；场景：S09、S31；任务：T08、T31、T32
- 前置：独立查询fixture：双语en/zh、预算max=2000/2001/3000/3001/4000/4001便士、unknown、已满/本人/截止场
- 步骤：同一坐标命中两polygon边界 → 无区域坐标
- 预期：固定areaCode排序决定唯一归属；无匹配unknown不默认Soho
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-01 §0.6

## GATE

### QA-GATE-001 G-AUTH真实三方式

- 优先级/阶段/方法：P0 / external / gate_evidence；状态：NOT_RUN
- 需求：§0.1、FR-13；场景：S03、S06、S22、S29、S30、AI-S15；任务：A00、A08、A09、T03、T04、T06、T17、T24、T25、T27、T28、T29
- 前置：由负责人提供已批准隔离测试环境/账号/预算与合法条款；未具备不调用真实服务
- 步骤：真实邮箱OTP/Google/Apple、同邮箱链接 → iOS系统浏览器回流
- 预期：真实提供方有效及PKCE/回调/身份映射证据；模拟按钮/Expo Go不能替代
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.1 FR-13、[validation-and-release.zh-CN.md](../../docs/engineering/validation-and-release.zh-CN.md) §1—4

### QA-GATE-002 G-PLACES任意餐厅

- 优先级/阶段/方法：P0 / external / gate_evidence；状态：NOT_RUN
- 需求：§0.1、FR-13；场景：S03、S06、S22、S29、S30、AI-S15；任务：A00、A08、A09、T03、T04、T06、T17、T24、T25、T27、T28、T29
- 前置：由负责人提供已批准隔离测试环境/账号/预算与合法条款；未具备不调用真实服务
- 步骤：搜索非示例伦敦餐厅和同名分店 → 选中确认 → 到期缓存及provider故障
- 预期：真实placeId正确；地址坐标服务端验证；Google地图/照片署名、许可表及缓存符合已批准配置
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.1 FR-13、[validation-and-release.zh-CN.md](../../docs/engineering/validation-and-release.zh-CN.md) §1—4

### QA-GATE-003 G-MAIL真实收件箱

- 优先级/阶段/方法：P0 / external / gate_evidence；状态：NOT_RUN
- 需求：§0.1、FR-13；场景：S03、S06、S22、S29、S30、AI-S15；任务：A00、A08、A09、T03、T04、T06、T17、T24、T25、T27、T28、T29
- 前置：由负责人提供已批准隔离测试环境/账号/预算与合法条款；未具备不调用真实服务
- 步骤：批准/拒绝/取消真实测试场 → 检索测试收件箱及退信回调
- 预期：收件人渠道符合P-02；实际收件箱可追踪去重；provider accepted不能单独通过
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.1 FR-13、[validation-and-release.zh-CN.md](../../docs/engineering/validation-and-release.zh-CN.md) §1—4

### QA-GATE-004 G-IOS原生双端

- 优先级/阶段/方法：P0 / external / gate_evidence；状态：NOT_RUN
- 需求：§0.1、FR-13；场景：S03、S06、S22、S29、S30、AI-S15；任务：A00、A08、A09、T03、T04、T06、T17、T24、T25、T27、T28、T29
- 前置：由负责人提供已批准隔离测试环境/账号/预算与合法条款；未具备不调用真实服务
- 步骤：Expo开发构建真机，系统登录/键盘/地图/前后台/断网/删除receipt
- 预期：原生证据包含构建号/OS/设备；WebView或DOM测试不能充当iOS完成
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.1 FR-13、[validation-and-release.zh-CN.md](../../docs/engineering/validation-and-release.zh-CN.md) §1—4

### QA-GATE-005 G-PRIVACY保留删除

- 优先级/阶段/方法：P0 / external / gate_evidence；状态：NOT_RUN
- 需求：§0.1、FR-13；场景：S03、S06、S22、S29、S30、AI-S15；任务：A00、A08、A09、T03、T04、T06、T17、T24、T25、T27、T28、T29
- 前置：由负责人提供已批准隔离测试环境/账号/预算与合法条款；未具备不调用真实服务
- 步骤：核对隐私/社区文本、供应商处理及保留策略批准 → 演练支持/删除/备份恢复
- 预期：有责任人批准及实际执行证据；无凭据/生产原文进公开仓库
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.1 FR-13、[validation-and-release.zh-CN.md](../../docs/engineering/validation-and-release.zh-CN.md) §1—4

### QA-GATE-006 G-HOST恢复与负载

- 优先级/阶段/方法：P0 / external / gate_evidence；状态：NOT_RUN
- 需求：§0.1、FR-13；场景：S03、S06、S22、S29、S30、AI-S15；任务：A00、A08、A09、T03、T04、T06、T17、T24、T25、T27、T28、T29
- 前置：由负责人提供已批准隔离测试环境/账号/预算与合法条款；未具备不调用真实服务
- 步骤：100并发/1000账号/10000消息隔离压测 → 备份恢复 → API部署配置
- 预期：记录p95/错误率/worker延迟及实测RPO/RTO对比24h/4h设计目标；API1副本Recreate无重叠，旧AI410保未发字
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.1 FR-13、[validation-and-release.zh-CN.md](../../docs/engineering/validation-and-release.zh-CN.md) §1—4

### QA-GATE-007 G-AI-MODEL真实评测

- 优先级/阶段/方法：P0 / external / gate_evidence；状态：NOT_RUN
- 需求：§0.1、FR-13；场景：S03、S06、S22、S29、S30、AI-S15；任务：A00、A08、A09、T03、T04、T06、T17、T24、T25、T27、T28、T29
- 前置：由负责人提供已批准隔离测试环境/账号/预算与合法条款；未具备不调用真实服务
- 步骤：冻结SDK/model/prompt/schema/fixture → 至少60合成中英样本，分组20/10/10/10/10 → 并发5
- 预期：四项零容忍0例；其他意图字段≥90%、草稿人工可用≥90%；P95≤10秒、30秒终结；保留逐样本实际偏差
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.1 FR-13、[validation-and-release.zh-CN.md](../../docs/engineering/validation-and-release.zh-CN.md) §1—4

### QA-GATE-008 G-AI-DATA供应商边界

- 优先级/阶段/方法：P0 / external / gate_evidence；状态：NOT_RUN
- 需求：§0.1、FR-13；场景：S03、S06、S22、S29、S30、AI-S15；任务：A00、A08、A09、T03、T04、T06、T17、T24、T25、T27、T28、T29
- 前置：由负责人提供已批准隔离测试环境/账号/预算与合法条款；未具备不调用真实服务
- 步骤：审查真实租户地区/训练/留存配置及用户说明审批
- 预期：store:false不冒称零留存；第三方边界有明确批准；未闭合不向真实用户开放
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.1 FR-13、[validation-and-release.zh-CN.md](../../docs/engineering/validation-and-release.zh-CN.md) §1—4

### QA-GATE-009 G-AI-COST实账

- 优先级/阶段/方法：P0 / external / gate_evidence；状态：NOT_RUN
- 需求：§0.1、FR-13；场景：S03、S06、S22、S29、S30、AI-S15；任务：A00、A08、A09、T03、T04、T06、T17、T24、T25、T27、T28、T29
- 前置：由负责人提供已批准隔离测试环境/账号/预算与合法条款；未具备不调用真实服务
- 步骤：批准金额/价格版本后在额度内受控并发预留、UNKNOWN对账
- 预期：实际usage/账单与call一致；无超已批准应用上界；未批准金额保持关闭；最终CNY等值不超过人民币50/月；不是域名/签名/其他云资源或自动充值授权
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.1 FR-13、[validation-and-release.zh-CN.md](../../docs/engineering/validation-and-release.zh-CN.md) §1—4

## INPUT

### QA-INPUT-001 姓名长度1

- 优先级/阶段/方法：P1 / implementation / api_and_unit；状态：NOT_RUN
- 需求：FR-02、FR-04、FR-05、FR-11；场景：S05、S10；任务：T05、T08、T09、T24、T25
- 前置：其他字段均合法；API契约§6长度；构造1个ASCII字符
- 步骤：提交姓名 → 检查响应和数据库
- 预期：字段校验拒绝；无业务记录和成功事件
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-02 FR-04 FR-05 FR-11

### QA-INPUT-002 姓名长度2

- 优先级/阶段/方法：P1 / implementation / api_and_unit；状态：NOT_RUN
- 需求：FR-02、FR-04、FR-05、FR-11；场景：S05、S10；任务：T05、T08、T09、T24、T25
- 前置：其他字段均合法；API契约§6长度；构造2个ASCII字符
- 步骤：提交姓名 → 检查响应和数据库
- 预期：接受且原文保存一次
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-02 FR-04 FR-05 FR-11

### QA-INPUT-003 姓名长度40

- 优先级/阶段/方法：P1 / implementation / api_and_unit；状态：NOT_RUN
- 需求：FR-02、FR-04、FR-05、FR-11；场景：S05、S10；任务：T05、T08、T09、T24、T25
- 前置：其他字段均合法；API契约§6长度；构造40个ASCII字符
- 步骤：提交姓名 → 检查响应和数据库
- 预期：接受且原文保存一次
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-02 FR-04 FR-05 FR-11

### QA-INPUT-004 姓名长度41

- 优先级/阶段/方法：P1 / implementation / api_and_unit；状态：NOT_RUN
- 需求：FR-02、FR-04、FR-05、FR-11；场景：S05、S10；任务：T05、T08、T09、T24、T25
- 前置：其他字段均合法；API契约§6长度；构造41个ASCII字符
- 步骤：提交姓名 → 检查响应和数据库
- 预期：字段校验拒绝；无业务记录和成功事件
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-02 FR-04 FR-05 FR-11

### QA-INPUT-005 介绍长度19

- 优先级/阶段/方法：P1 / implementation / api_and_unit；状态：NOT_RUN
- 需求：FR-02、FR-04、FR-05、FR-11；场景：S05、S10；任务：T05、T08、T09、T24、T25
- 前置：其他字段均合法；API契约§6长度；构造19个ASCII字符
- 步骤：提交介绍 → 检查响应和数据库
- 预期：字段校验拒绝；无业务记录和成功事件
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-02 FR-04 FR-05 FR-11

### QA-INPUT-006 介绍长度20

- 优先级/阶段/方法：P1 / implementation / api_and_unit；状态：NOT_RUN
- 需求：FR-02、FR-04、FR-05、FR-11；场景：S05、S10；任务：T05、T08、T09、T24、T25
- 前置：其他字段均合法；API契约§6长度；构造20个ASCII字符
- 步骤：提交介绍 → 检查响应和数据库
- 预期：接受且原文保存一次
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-02 FR-04 FR-05 FR-11

### QA-INPUT-007 介绍长度1000

- 优先级/阶段/方法：P1 / implementation / api_and_unit；状态：NOT_RUN
- 需求：FR-02、FR-04、FR-05、FR-11；场景：S05、S10；任务：T05、T08、T09、T24、T25
- 前置：其他字段均合法；API契约§6长度；构造1000个ASCII字符
- 步骤：提交介绍 → 检查响应和数据库
- 预期：接受且原文保存一次
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-02 FR-04 FR-05 FR-11

### QA-INPUT-008 介绍长度1001

- 优先级/阶段/方法：P1 / implementation / api_and_unit；状态：NOT_RUN
- 需求：FR-02、FR-04、FR-05、FR-11；场景：S05、S10；任务：T05、T08、T09、T24、T25
- 前置：其他字段均合法；API契约§6长度；构造1001个ASCII字符
- 步骤：提交介绍 → 检查响应和数据库
- 预期：字段校验拒绝；无业务记录和成功事件
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-02 FR-04 FR-05 FR-11

### QA-INPUT-009 标题长度4

- 优先级/阶段/方法：P1 / implementation / api_and_unit；状态：NOT_RUN
- 需求：FR-02、FR-04、FR-05、FR-11；场景：S05、S10；任务：T05、T08、T09、T24、T25
- 前置：其他字段均合法；API契约§6长度；构造4个ASCII字符
- 步骤：提交标题 → 检查响应和数据库
- 预期：字段校验拒绝；无业务记录和成功事件
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-02 FR-04 FR-05 FR-11

### QA-INPUT-010 标题长度5

- 优先级/阶段/方法：P1 / implementation / api_and_unit；状态：NOT_RUN
- 需求：FR-02、FR-04、FR-05、FR-11；场景：S05、S10；任务：T05、T08、T09、T24、T25
- 前置：其他字段均合法；API契约§6长度；构造5个ASCII字符
- 步骤：提交标题 → 检查响应和数据库
- 预期：接受且原文保存一次
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-02 FR-04 FR-05 FR-11

### QA-INPUT-011 标题长度80

- 优先级/阶段/方法：P1 / implementation / api_and_unit；状态：NOT_RUN
- 需求：FR-02、FR-04、FR-05、FR-11；场景：S05、S10；任务：T05、T08、T09、T24、T25
- 前置：其他字段均合法；API契约§6长度；构造80个ASCII字符
- 步骤：提交标题 → 检查响应和数据库
- 预期：接受且原文保存一次
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-02 FR-04 FR-05 FR-11

### QA-INPUT-012 标题长度81

- 优先级/阶段/方法：P1 / implementation / api_and_unit；状态：NOT_RUN
- 需求：FR-02、FR-04、FR-05、FR-11；场景：S05、S10；任务：T05、T08、T09、T24、T25
- 前置：其他字段均合法；API契约§6长度；构造81个ASCII字符
- 步骤：提交标题 → 检查响应和数据库
- 预期：字段校验拒绝；无业务记录和成功事件
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-02 FR-04 FR-05 FR-11

### QA-INPUT-013 饭局说明长度19

- 优先级/阶段/方法：P1 / implementation / api_and_unit；状态：NOT_RUN
- 需求：FR-02、FR-04、FR-05、FR-11；场景：S05、S10；任务：T05、T08、T09、T24、T25
- 前置：其他字段均合法；API契约§6长度；构造19个ASCII字符
- 步骤：提交饭局说明 → 检查响应和数据库
- 预期：字段校验拒绝；无业务记录和成功事件
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-02 FR-04 FR-05 FR-11

### QA-INPUT-014 饭局说明长度20

- 优先级/阶段/方法：P1 / implementation / api_and_unit；状态：NOT_RUN
- 需求：FR-02、FR-04、FR-05、FR-11；场景：S05、S10；任务：T05、T08、T09、T24、T25
- 前置：其他字段均合法；API契约§6长度；构造20个ASCII字符
- 步骤：提交饭局说明 → 检查响应和数据库
- 预期：接受且原文保存一次
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-02 FR-04 FR-05 FR-11

### QA-INPUT-015 饭局说明长度1000

- 优先级/阶段/方法：P1 / implementation / api_and_unit；状态：NOT_RUN
- 需求：FR-02、FR-04、FR-05、FR-11；场景：S05、S10；任务：T05、T08、T09、T24、T25
- 前置：其他字段均合法；API契约§6长度；构造1000个ASCII字符
- 步骤：提交饭局说明 → 检查响应和数据库
- 预期：接受且原文保存一次
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-02 FR-04 FR-05 FR-11

### QA-INPUT-016 饭局说明长度1001

- 优先级/阶段/方法：P1 / implementation / api_and_unit；状态：NOT_RUN
- 需求：FR-02、FR-04、FR-05、FR-11；场景：S05、S10；任务：T05、T08、T09、T24、T25
- 前置：其他字段均合法；API契约§6长度；构造1001个ASCII字符
- 步骤：提交饭局说明 → 检查响应和数据库
- 预期：字段校验拒绝；无业务记录和成功事件
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-02 FR-04 FR-05 FR-11

### QA-INPUT-017 申请留言长度19

- 优先级/阶段/方法：P1 / implementation / api_and_unit；状态：NOT_RUN
- 需求：FR-02、FR-04、FR-05、FR-11；场景：S05、S10；任务：T05、T08、T09、T24、T25
- 前置：其他字段均合法；API契约§6长度；构造19个ASCII字符
- 步骤：提交申请留言 → 检查响应和数据库
- 预期：字段校验拒绝；无业务记录和成功事件
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-02 FR-04 FR-05 FR-11

### QA-INPUT-018 申请留言长度20

- 优先级/阶段/方法：P1 / implementation / api_and_unit；状态：NOT_RUN
- 需求：FR-02、FR-04、FR-05、FR-11；场景：S05、S10；任务：T05、T08、T09、T24、T25
- 前置：其他字段均合法；API契约§6长度；构造20个ASCII字符
- 步骤：提交申请留言 → 检查响应和数据库
- 预期：接受且原文保存一次
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-02 FR-04 FR-05 FR-11

### QA-INPUT-019 申请留言长度300

- 优先级/阶段/方法：P1 / implementation / api_and_unit；状态：NOT_RUN
- 需求：FR-02、FR-04、FR-05、FR-11；场景：S05、S10；任务：T05、T08、T09、T24、T25
- 前置：其他字段均合法；API契约§6长度；构造300个ASCII字符
- 步骤：提交申请留言 → 检查响应和数据库
- 预期：接受且原文保存一次
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-02 FR-04 FR-05 FR-11

### QA-INPUT-020 申请留言长度301

- 优先级/阶段/方法：P1 / implementation / api_and_unit；状态：NOT_RUN
- 需求：FR-02、FR-04、FR-05、FR-11；场景：S05、S10；任务：T05、T08、T09、T24、T25
- 前置：其他字段均合法；API契约§6长度；构造301个ASCII字符
- 步骤：提交申请留言 → 检查响应和数据库
- 预期：字段校验拒绝；无业务记录和成功事件
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-02 FR-04 FR-05 FR-11

## JOURNEY

### QA-JOURNEY-001 加入者完整闭环

- 优先级/阶段/方法：P0 / implementation / cross_client_e2e；状态：NOT_RUN
- 需求：FR-01、FR-02、FR-04、FR-05、FR-09、FR-10、FR-11、FR-12、FR-13；场景：S05、S10、S14、S16、S21、S24、S28、S30、AI-S12、AI-S13；任务：A05、A06、A08、T05、T08、T09、T12、T13、T16、T19、T21、T22、T23、T24、T25、T26、T28、T29、T30
- 前置：两真实/隔离账号H与A，另用B验证隐私；Web与iOS互换角色各走一次；DB/站内通知/后台同一测试环境；正常完成路径单guest场minimum=2，或在截止前由H批准A/B达到minimum=3；取消专项另建不足场；不可让默认未达标场误入饭后。
- 步骤：游客筛选→详情→Apply登录回流→补资料→主动申请→H批准→A群消息→结束自报→评分/公评/再约→后台核账
- 预期：每一步目标不丢；申请/席位/消息各一次；pending不入群；出席才反馈；后台同一事实可追溯
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-01 FR-02 FR-04 FR-05 FR-09 FR-10 FR-11 FR-12 FR-13、[api-and-client-contract.zh-CN.md](../../docs/engineering/api-and-client-contract.zh-CN.md) §1—7

### QA-JOURNEY-002 主持者完整闭环

- 优先级/阶段/方法：P0 / implementation / cross_client_e2e；状态：NOT_RUN
- 需求：FR-01、FR-02、FR-04、FR-05、FR-09、FR-10、FR-11、FR-12、FR-13；场景：S05、S10、S14、S16、S21、S24、S28、S30、AI-S12、AI-S13；任务：A05、A06、A08、T05、T08、T09、T12、T13、T16、T19、T21、T22、T23、T24、T25、T26、T28、T29、T30
- 前置：两真实/隔离账号H与A，另用B验证隐私；Web与iOS互换角色各走一次；DB/站内通知/后台同一测试环境；正常完成路径单guest场minimum=2，或在截止前由H批准A/B达到minimum=3；取消专项另建不足场；不可让默认未达标场误入饭后。
- 步骤：Create四步→餐厅确认→最低/上限/截止→Review发布→审批→声明stale→重新声明→截止达标→饭后host报告
- 预期：无支付/平台库存依赖；首guest锁关键安排；host报告不压self；不默认所有人出席
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-01 FR-02 FR-04 FR-05 FR-09 FR-10 FR-11 FR-12 FR-13、[api-and-client-contract.zh-CN.md](../../docs/engineering/api-and-client-contract.zh-CN.md) §1—7

### QA-JOURNEY-003 取消与聊天独立路径

- 优先级/阶段/方法：P0 / implementation / cross_client_e2e；状态：NOT_RUN
- 需求：FR-01、FR-02、FR-04、FR-05、FR-09、FR-10、FR-11、FR-12、FR-13；场景：S05、S10、S14、S16、S21、S24、S28、S30、AI-S12、AI-S13；任务：A05、A06、A08、T05、T08、T09、T12、T13、T16、T19、T21、T22、T23、T24、T25、T26、T28、T29、T30
- 前置：两真实/隔离账号H与A，另用B验证隐私；Web与iOS互换角色各走一次；DB/站内通知/后台同一测试环境；正常完成路径单guest场minimum=2，或在截止前由H批准A/B达到minimum=3；取消专项另建不足场；不可让默认未达标场误入饭后。
- 步骤：成员获准→本人退席位→仍群聊→主动退群→重申获准→解散
- 预期：席位和群分别变化；只读已授权union历史；解散不可重开
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-01 FR-02 FR-04 FR-05 FR-09 FR-10 FR-11 FR-12 FR-13、[api-and-client-contract.zh-CN.md](../../docs/engineering/api-and-client-contract.zh-CN.md) §1—7

### QA-JOURNEY-004 互选私密路径

- 优先级/阶段/方法：P0 / implementation / cross_client_e2e；状态：NOT_RUN
- 需求：FR-01、FR-02、FR-04、FR-05、FR-09、FR-10、FR-11、FR-12、FR-13；场景：S05、S10、S14、S16、S21、S24、S28、S30、AI-S12、AI-S13；任务：A05、A06、A08、T05、T08、T09、T12、T13、T16、T19、T21、T22、T23、T24、T25、T26、T28、T29、T30
- 前置：两真实/隔离账号H与A，另用B验证隐私；Web与iOS互换角色各走一次；DB/站内通知/后台同一测试环境；正常完成路径单guest场minimum=2，或在截止前由H批准A/B达到minimum=3；取消专项另建不足场；不可让默认未达标场误入饭后。
- 步骤：A单方再约→B访问→B互选→私聊→A撤回→解除拉黑
- 预期：单方不可推断；互选才可发；撤回后历史只读；解除不复活同意
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-01 FR-02 FR-04 FR-05 FR-09 FR-10 FR-11 FR-12 FR-13、[api-and-client-contract.zh-CN.md](../../docs/engineering/api-and-client-contract.zh-CN.md) §1—7

### QA-JOURNEY-005 AI申请路径

- 优先级/阶段/方法：P0 / implementation / cross_client_e2e；状态：NOT_RUN
- 需求：FR-01、FR-02、FR-04、FR-05、FR-09、FR-10、FR-11、FR-12、FR-13；场景：S05、S10、S14、S16、S21、S24、S28、S30、AI-S12、AI-S13；任务：A05、A06、A08、T05、T08、T09、T12、T13、T16、T19、T21、T22、T23、T24、T25、T26、T28、T29、T30
- 前置：两真实/隔离账号H与A，另用B验证隐私；Web与iOS互换角色各走一次；DB/站内通知/后台同一测试环境
- 步骤：显式查找→选明确M→生成申请→转入已有编辑器→本人确认提交
- 预期：AI阶段无写；不覆盖未发字；提交时重验名额/截止；服务失败可继续原路径
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-01 FR-02 FR-04 FR-05 FR-09 FR-10 FR-11 FR-12 FR-13、[api-and-client-contract.zh-CN.md](../../docs/engineering/api-and-client-contract.zh-CN.md) §1—7

### QA-JOURNEY-006 AI创建及群草稿路径

- 优先级/阶段/方法：P0 / implementation / cross_client_e2e；状态：NOT_RUN
- 需求：FR-01、FR-02、FR-04、FR-05、FR-09、FR-10、FR-11、FR-12、FR-13；场景：S05、S10、S14、S16、S21、S24、S28、S30、AI-S12、AI-S13；任务：A05、A06、A08、T05、T08、T09、T12、T13、T16、T19、T21、T22、T23、T24、T25、T26、T28、T29、T30
- 前置：两真实/隔离账号H与A，另用B验证隐私；Web与iOS互换角色各走一次；DB/站内通知/后台同一测试环境
- 步骤：生成Create草稿→原四步补选地点/条款→主动发布→群草稿→主动Send
- 预期：没有模型代办；所有人工确认实际发生；生成/转入/发送分别授权
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-01 FR-02 FR-04 FR-05 FR-09 FR-10 FR-11 FR-12 FR-13、[api-and-client-contract.zh-CN.md](../../docs/engineering/api-and-client-contract.zh-CN.md) §1—7

### QA-JOURNEY-007 反馈问卷独立路径

- 优先级/阶段/方法：P0 / implementation / cross_client_e2e；状态：NOT_RUN
- 需求：FR-01、FR-02、FR-04、FR-05、FR-09、FR-10、FR-11、FR-12、FR-13；场景：S05、S10、S14、S16、S21、S24、S28、S30、AI-S12、AI-S13；任务：A05、A06、A08、T05、T08、T09、T12、T13、T16、T19、T21、T22、T23、T24、T25、T26、T28、T29、T30
- 前置：两真实/隔离账号H与A，另用B验证隐私；Web与iOS互换角色各走一次；DB/站内通知/后台同一测试环境
- 步骤：未出席账号填产品问卷 → 合格账号填单场评分 → 后台分别下钻CSV
- 预期：问卷不要求资格、不归meal；评分仅合格人次；不混用公开评价或再约
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-01 FR-02 FR-04 FR-05 FR-09 FR-10 FR-11 FR-12 FR-13、[api-and-client-contract.zh-CN.md](../../docs/engineering/api-and-client-contract.zh-CN.md) §1—7

### QA-JOURNEY-008 异常返回路径

- 优先级/阶段/方法：P0 / implementation / cross_client_e2e；状态：NOT_RUN
- 需求：FR-01、FR-02、FR-04、FR-05、FR-09、FR-10、FR-11、FR-12、FR-13；场景：S05、S10、S14、S16、S21、S24、S28、S30、AI-S12、AI-S13；任务：A05、A06、A08、T05、T08、T09、T12、T13、T16、T19、T21、T22、T23、T24、T25、T26、T28、T29、T30
- 前置：两真实/隔离账号H与A，另用B验证隐私；Web与iOS互换角色各走一次；DB/站内通知/后台同一测试环境
- 步骤：申请编辑中401→登录 → 审批409 → 群403 → 后台snapshot410 → 断网恢复
- 预期：原稿/目标保留但不自动重放写；403转历史；410清旧缓存选新snapshot；无假成功
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-01 FR-02 FR-04 FR-05 FR-09 FR-10 FR-11 FR-12 FR-13、[api-and-client-contract.zh-CN.md](../../docs/engineering/api-and-client-contract.zh-CN.md) §1—7

### QA-JOURNEY-009 支持删除闭环

- 优先级/阶段/方法：P0 / implementation / cross_client_e2e；状态：NOT_RUN
- 需求：FR-01、FR-02、FR-04、FR-05、FR-09、FR-10、FR-11、FR-12、FR-13；场景：S05、S10、S14、S16、S21、S24、S28、S30、AI-S12、AI-S13；任务：A05、A06、A08、T05、T08、T09、T12、T13、T16、T19、T21、T22、T23、T24、T25、T26、T28、T29、T30
- 前置：两真实/隔离账号H与A，另用B验证隐私；Web与iOS互换角色各走一次；DB/站内通知/后台同一测试环境
- 步骤：举报→查本人回执→support个案→reauth删除→断网丢202→receipt查→后台快照撤销
- 预期：受理不称处理完成；202同步屏障；receipt无私密数据；旧导出不可再读
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-01 FR-02 FR-04 FR-05 FR-09 FR-10 FR-11 FR-12 FR-13、[api-and-client-contract.zh-CN.md](../../docs/engineering/api-and-client-contract.zh-CN.md) §1—7

### QA-JOURNEY-010 截止不足通知路径

- 优先级/阶段/方法：P1 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-01、FR-05、FR-09、FR-10、P-02；场景：S11、S22、S23、S28、S30；任务：T10、T17、T18、T22、T23、T25、T27、T28、T29
- 前置：H/A及授权support；已配置真实/受控邮件；跨Web/iOS
- 步骤：H创建min3 → 仅A确认 → 到截止 → 查站内及邮件 → 群发消息
- 预期：原因insufficient；当前成员通知各一次；群仍可发言；无退款承诺
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-01 FR-05 FR-09 FR-10 P-02、[api-and-client-contract.zh-CN.md](../../docs/engineering/api-and-client-contract.zh-CN.md) §1—7

### QA-JOURNEY-011 支持纠错全路径

- 优先级/阶段/方法：P1 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-01、FR-05、FR-09、FR-10、P-02；场景：S11、S22、S23、S28、S30；任务：T10、T17、T18、T22、T23、T25、T27、T28、T29
- 前置：H/A及授权support；已配置真实/受控邮件；跨Web/iOS
- 步骤：CLI OAuth+MFA→授权case→end+7d纠错→新快照→私聊重验→审计
- 预期：逐步权限重验；保留原报告；新资格传播，旧普通快照不改；不开放全表/消息正文
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-01 FR-05 FR-09 FR-10 P-02、[api-and-client-contract.zh-CN.md](../../docs/engineering/api-and-client-contract.zh-CN.md) §1—7

### QA-JOURNEY-012 后台分析分类路径

- 优先级/阶段/方法：P1 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：FR-01、FR-05、FR-09、FR-10、P-02；场景：S11、S22、S23、S28、S30；任务：T10、T17、T18、T22、T23、T25、T27、T28、T29
- 前置：H/A及授权support；已配置真实/受控邮件；跨Web/iOS
- 步骤：分析者过滤S0下钻CSV → data_admin改分类生成S1 → 显式切换
- 预期：旧链路S0一致；分类不改登录权限；新快照排除测试贡献且保留筛选
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) FR-01 FR-05 FR-09 FR-10 P-02、[api-and-client-contract.zh-CN.md](../../docs/engineering/api-and-client-contract.zh-CN.md) §1—7

## METRIC

### QA-METRIC-001 零分母

- 优先级/阶段/方法：P1 / implementation / independent_fixture_reconciliation；状态：NOT_RUN
- 需求：§0.5；场景：S17、S21、S25、S26、S27、S28；任务：T13、T16、T20、T21、T22、T23、T26、T27
- 前置：使用独立可手算fixture和固定asOf，不复用页面计算作为oracle
- 步骤：无任何成熟申请/明确问卷答案，查询比率与CSV
- 预期：分母0→null/—而非0%；CSV与页面同值同单位
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.5、[measurement-contract.zh-CN.md](../../docs/product/admin/measurement-contract.zh-CN.md) §4—8

### QA-METRIC-002 重复事件与伪成功

- 优先级/阶段/方法：P1 / implementation / independent_fixture_reconciliation；状态：NOT_RUN
- 需求：§0.5；场景：S17、S21、S25、S26、S27、S28；任务：T13、T16、T20、T21、T22、T23、T26、T27
- 前置：使用独立可手算fixture和固定asOf，不复用页面计算作为oracle
- 步骤：同eventId投递两次 → 客户端发送application_success
- 预期：首条accepted第二duplicate；伪业务成功rejected且不进指标
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.5、[measurement-contract.zh-CN.md](../../docs/product/admin/measurement-contract.zh-CN.md) §4—8

### QA-METRIC-003 迟到接收

- 优先级/阶段/方法：P1 / implementation / independent_fixture_reconciliation；状态：NOT_RUN
- 需求：§0.5；场景：S17、S21、S25、S26、S27、S28；任务：T13、T16、T20、T21、T22、T23、T26、T27
- 前置：使用独立可手算fixture和固定asOf，不复用页面计算作为oracle
- 步骤：occurredAt<asOf但receivedAt>asOf → 构建S0和晚S1
- 预期：S0排除；S1可纳入；S0不可变
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.5、[measurement-contract.zh-CN.md](../../docs/product/admin/measurement-contract.zh-CN.md) §4—8

### QA-METRIC-004 首次申请14天等号

- 优先级/阶段/方法：P1 / implementation / independent_fixture_reconciliation；状态：NOT_RUN
- 需求：§0.5；场景：S17、S21、S25、S26、S27、S28；任务：T13、T16、T20、T21、T22、T23、T26、T27
- 前置：使用独立可手算fixture和固定asOf，不复用页面计算作为oracle
- 步骤：首申请10月1日12Z → 首次出席14天内 → asOf=10月15日12Z−1ms/等号
- 预期：前者观察中不入分母；等号成熟；首次从全历史求而非选期首条
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.5、[measurement-contract.zh-CN.md](../../docs/product/admin/measurement-contract.zh-CN.md) §4—8

### QA-METRIC-005 30天复赴约窗口

- 优先级/阶段/方法：P1 / implementation / independent_fixture_reconciliation；状态：NOT_RUN
- 需求：§0.5；场景：S17、S21、S25、S26、S27、S28；任务：T13、T16、T20、T21、T22、T23、T26、T27
- 前置：使用独立可手算fixture和固定asOf，不复用页面计算作为oracle
- 步骤：首出席后0、30天、30天+1ms分别出席另一场 → 再设同mealId重复
- 预期：0不算后续，30天算，超过不算；同场重复不算回访
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.5、[measurement-contract.zh-CN.md](../../docs/product/admin/measurement-contract.zh-CN.md) §4—8

### QA-METRIC-006 申请出席成熟26小时

- 优先级/阶段/方法：P1 / implementation / independent_fixture_reconciliation；状态：NOT_RUN
- 需求：§0.5；场景：S17、S21、S25、S26、S27、S28；任务：T13、T16、T20、T21、T22、T23、T26、T27
- 前置：使用独立可手算fixture和固定asOf，不复用页面计算作为oracle
- 步骤：start=10月1日18Z、end20Z → asOf10月2日20Z−1ms/等号
- 预期：前不成熟；等号纳入申请结果分母；不错误用start+24h
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.5、[measurement-contract.zh-CN.md](../../docs/product/admin/measurement-contract.zh-CN.md) §4—8

### QA-METRIC-007 申请轮次归因

- 优先级/阶段/方法：P1 / implementation / independent_fixture_reconciliation；状态：NOT_RUN
- 需求：§0.5；场景：S17、S21、S25、S26、S27、S28；任务：T13、T16、T20、T21、T22、T23、T26、T27
- 前置：使用独立可手算fixture和固定asOf，不复用页面计算作为oracle
- 步骤：A撤回r1重申r2并出席 → B被拒r3 → M取消申请r4
- 预期：分母按四轮；出席仅r2计1；拒绝/撤回/取消仍保留适用分母
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.5、[measurement-contract.zh-CN.md](../../docs/product/admin/measurement-contract.zh-CN.md) §4—8

### QA-METRIC-008 成团与取消分开

- 优先级/阶段/方法：P1 / implementation / independent_fixture_reconciliation；状态：NOT_RUN
- 需求：§0.5；场景：S17、S21、S25、S26、S27、S28；任务：T13、T16、T20、T21、T22、T23、T26、T27
- 前置：使用独立可手算fixture和固定asOf，不复用页面计算作为oracle
- 步骤：M开始前peak3/min3后来取消 → N正式host+2测试成员
- 预期：M可招募达标但取消；N测试成员不能撑成团；不把招募达标叫实际举行
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.5、[measurement-contract.zh-CN.md](../../docs/product/admin/measurement-contract.zh-CN.md) §4—8

### QA-METRIC-009 问卷最新再筛

- 优先级/阶段/方法：P1 / implementation / independent_fixture_reconciliation；状态：NOT_RUN
- 需求：§0.5；场景：S17、S21、S25、S26、S27、S28；任务：T13、T16、T20、T21、T22、T23、T26、T27
- 前置：使用独立可手算fixture和固定asOf，不复用页面计算作为oracle
- 步骤：A9月25Yes，10月2No → asOf10月18查9月 → 再asOf9月30
- 预期：前者不回捞9月旧答；后者Yes有效；null只计未答不计No
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.5、[measurement-contract.zh-CN.md](../../docs/product/admin/measurement-contract.zh-CN.md) §4—8

### QA-METRIC-010 问卷独立过滤

- 优先级/阶段/方法：P1 / implementation / independent_fixture_reconciliation；状态：NOT_RUN
- 需求：§0.5；场景：S17、S21、S25、S26、S27、S28；任务：T13、T16、T20、T21、T22、T23、T26、T27
- 前置：使用独立可手算fixture和固定asOf，不复用页面计算作为oracle
- 步骤：日期/分群固定 → 改变饭局区域、语言、人数、预算
- 预期：问卷样本和值均不变；UI/CSV声明surveyScope
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.5、[measurement-contract.zh-CN.md](../../docs/product/admin/measurement-contract.zh-CN.md) §4—8

### QA-METRIC-011 评分和问卷粒度

- 优先级/阶段/方法：P1 / implementation / independent_fixture_reconciliation；状态：NOT_RUN
- 需求：§0.5；场景：S17、S21、S25、S26、S27、S28；任务：T13、T16、T20、T21、T22、T23、T26、T27
- 前置：使用独立可手算fixture和固定asOf，不复用页面计算作为oracle
- 步骤：A两场评分1和5，问卷Yes且cost+venue → 导出
- 预期：评分2人次、问卷1用户；因素可多选比例不要求100%；不按单场星级切问卷
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.5、[measurement-contract.zh-CN.md](../../docs/product/admin/measurement-contract.zh-CN.md) §4—8

### QA-METRIC-012 预算互斥分段

- 优先级/阶段/方法：P1 / implementation / independent_fixture_reconciliation；状态：NOT_RUN
- 需求：§0.5；场景：S17、S21、S25、S26、S27、S28；任务：T13、T16、T20、T21、T22、T23、T26、T27
- 前置：使用独立可手算fixture和固定asOf，不复用页面计算作为oracle
- 步骤：max20/20.01/30/30.01/40/40.01/unknown各1场 → 选择各分段及并集
- 预期：每场只落一个预算段；unknown独列；双语并集无重复
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.5、[measurement-contract.zh-CN.md](../../docs/product/admin/measurement-contract.zh-CN.md) §4—8

### QA-METRIC-013 测试员工分类恢复

- 优先级/阶段/方法：P1 / implementation / independent_fixture_reconciliation；状态：NOT_RUN
- 需求：§0.5；场景：S17、S21、S25、S26、S27、S28；任务：T13、T16、T20、T21、T22、T23、T26、T27
- 前置：使用独立可手算fixture和固定asOf，不复用页面计算作为oracle
- 步骤：data_admin将A regular→test→regular → 含host和参与记录
- 预期：新快照排除A贡献及其host整场；正式host他人事实保留；恢复重新构建，旧快照不常规改写
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.5、[measurement-contract.zh-CN.md](../../docs/product/admin/measurement-contract.zh-CN.md) §4—8

### QA-METRIC-014 删除后peak重算

- 优先级/阶段/方法：P1 / implementation / independent_fixture_reconciliation；状态：NOT_RUN
- 需求：§0.5；场景：S17、S21、S25、S26、S27、S28；任务：T13、T16、T20、T21、T22、T23、T26、T27
- 前置：使用独立可手算fixture和固定asOf，不复用页面计算作为oracle
- 步骤：正式3席/min3已发生业务达标 → 删除1用户 → 新快照
- 预期：分析peak=2；用户贡献从分子分母退出；原业务成团事实不改
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.5、[measurement-contract.zh-CN.md](../../docs/product/admin/measurement-contract.zh-CN.md) §4—8

### QA-METRIC-015 London周跨DST

- 优先级/阶段/方法：P1 / implementation / independent_fixture_reconciliation；状态：NOT_RUN
- 需求：§0.5；场景：S17、S21、S25、S26、S27、S28；任务：T13、T16、T20、T21、T22、T23、T26、T27
- 前置：使用独立可手算fixture和固定asOf，不复用页面计算作为oracle
- 步骤：用秋季重复01:30两UTC与周日/周一边界构建周报
- 预期：两01:30同London日；周一开周；14/30天用连续UTC时长
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.5、[measurement-contract.zh-CN.md](../../docs/product/admin/measurement-contract.zh-CN.md) §4—8

### QA-METRIC-016 同快照全链路

- 优先级/阶段/方法：P1 / implementation / independent_fixture_reconciliation；状态：NOT_RUN
- 需求：§0.5；场景：S17、S21、S25、S26、S27、S28；任务：T13、T16、T20、T21、T22、T23、T26、T27
- 前置：使用独立可手算fixture和固定asOf，不复用页面计算作为oracle
- 步骤：固定S0+filterHash翻页/下钻/CSV → 期间产生S1
- 预期：本次链路仍S0+原filters+v4；显式切换才S1
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.5、[measurement-contract.zh-CN.md](../../docs/product/admin/measurement-contract.zh-CN.md) §4—8

### QA-METRIC-017 审核分位数

- 优先级/阶段/方法：P1 / implementation / independent_fixture_reconciliation；状态：NOT_RUN
- 需求：§0.5；场景：S17、S21、S25、S26、S27、S28；任务：T13、T16、T20、T21、T22、T23、T26、T27
- 前置：使用独立可手算fixture和固定asOf，不复用页面计算作为oracle
- 步骤：四申请首次决策延迟1/2/3/10小时 → 重复决定及pending/expired混入
- 预期：最近秩P50=2、P90=10；仅首次批准/拒绝入分布；终止轮不计pending
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.5、[measurement-contract.zh-CN.md](../../docs/product/admin/measurement-contract.zh-CN.md) §4—8

### QA-METRIC-018 采集曝光阈值

- 优先级/阶段/方法：P1 / implementation / independent_fixture_reconciliation；状态：NOT_RUN
- 需求：§0.5；场景：S17、S21、S25、S26、S27、S28；任务：T13、T16、T20、T21、T22、T23、T26、T27
- 前置：使用独立可手算fixture和固定asOf，不复用页面计算作为oracle
- 步骤：49%1000ms、50%999ms、50%1000ms → 中途后台/移出 → 同session再曝
- 预期：仅连续前台50%且1000ms合格；中断重计；session+meal首次去重且不可申请不发
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.5、[measurement-contract.zh-CN.md](../../docs/product/admin/measurement-contract.zh-CN.md) §4—8

## NOTIFY

### QA-NOTIFY-001 渠道收件人矩阵

- 优先级/阶段/方法：P1 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.3、P-02；场景：S22；任务：T17、T27
- 前置：H主持M，P=pending，C=confirmed，W=withdrawn，L=left；worker可故障；邮件为受控adapter
- 步骤：批准/拒绝/过期P → 取消M → 发群/私聊 → 查看outbox及站内
- 预期：审批/拒绝/过期申请人站内+邮件；整场取消H及当前P/C；W/L不邮件；消息只有站内未读
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.3 P-02

### QA-NOTIFY-002 邮件失败不回滚席位

- 优先级/阶段/方法：P1 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.3、P-02；场景：S22；任务：T17、T27
- 前置：H主持M，P=pending，C=confirmed，W=withdrawn，L=left；worker可故障；邮件为受控adapter
- 步骤：批准提交后provider拒绝或UNKNOWN → 重复领取outbox → 超过8次/24h
- 预期：席位/站内已成立；UNKNOWN先查询/提供方同幂等ID；重试尽头dead-letter告警
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.3 P-02

### QA-NOTIFY-003 通知隐私

- 优先级/阶段/方法：P1 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.3、P-02；场景：S22；任务：T17、T27
- 前置：H主持M，P=pending，C=confirmed，W=withdrawn，L=left；worker可故障；邮件为受控adapter
- 步骤：申请带敏感标记文本 → 举报带详情 → 发送消息
- 预期：邮件无申请/消息/举报正文/单方再约；通知唯一event+recipient+channel
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.3 P-02

## POST

### QA-POST-001 结束前

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.5、FR-10；场景：S16、S17、S18；任务：T13、T14、T21
- 前置：M未取消；A/B开始名单且present；其他输入合法
- 步骤：设DB有效时刻为end−1ms → 分别提交SELF、host报告、体验、公评及再约
- 预期：自助提交均拒绝；不写修订与业务成功事件
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.5 FR-10

### QA-POST-002 结束等号

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.5、FR-10；场景：S16、S17、S18；任务：T13、T14、T21
- 前置：M未取消；A/B开始名单且present；其他输入合法
- 步骤：设DB有效时刻为end → 分别提交SELF、host报告、体验、公评及再约
- 预期：允许且版本增加一次
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.5 FR-10

### QA-POST-003 窗口最后

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.5、FR-10；场景：S16、S17、S18；任务：T13、T14、T21
- 前置：M未取消；A/B开始名单且present；其他输入合法
- 步骤：设DB有效时刻为end+7d−1ms → 分别提交SELF、host报告、体验、公评及再约
- 预期：允许且版本增加一次
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.5 FR-10

### QA-POST-004 七天等号

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.5、FR-10；场景：S16、S17、S18；任务：T13、T14、T21
- 前置：M未取消；A/B开始名单且present；其他输入合法
- 步骤：设DB有效时刻为end+7d → 分别提交SELF、host报告、体验、公评及再约
- 预期：自助提交均拒绝；不写修订与业务成功事件
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.5 FR-10

### QA-POST-005 self优先与unknown

- 优先级/阶段/方法：P1 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.5、FR-10；场景：S16、S17、S18、S20、S23；任务：T13、T14、T15、T18、T21
- 前置：M已结束，H/A/B开始名单；可控制end及修订版本
- 步骤：host报A present → A自报absent → B双方未报
- 预期：A有效absent且保留两来源；B unknown不当absent或第四冲突态
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.5 FR-10

### QA-POST-006 评分范围与upsert

- 优先级/阶段/方法：P1 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.5、FR-10；场景：S16、S17、S18、S20、S23；任务：T13、T14、T15、T18、T21
- 前置：M已结束，H/A/B开始名单；可控制end及修订版本
- 步骤：本人present → 提交0/1/5/6/1.5 → 同意图重试后改分
- 预期：仅1/5合法；每人每场一个最新有效评分；保留版本不重复计数
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.5 FR-10

### QA-POST-007 无资格和自评

- 优先级/阶段/方法：P1 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.5、FR-10；场景：S16、S17、S18、S20、S23；任务：T13、T14、T15、T18、T21
- 前置：M已结束，H/A/B开始名单；可控制end及修订版本
- 步骤：非开始名单、cancelled、unknown分别提交 → A评价A
- 预期：均拒绝；不得从历史样例补资格
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.5 FR-10

### QA-POST-008 公评双盲与到期发布

- 优先级/阶段/方法：P1 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.5、FR-10；场景：S16、S17、S18、S20、S23；任务：T13、T14、T15、T18、T21
- 前置：M已结束，H/A/B开始名单；可控制end及修订版本
- 步骤：A给B公评 → B未提交 → 到end+7d → 另一场双方提前提交
- 预期：单方到期前不公开；到期或双方提交可公开；单方再约始终不公开
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.5 FR-10

### QA-POST-009 资格修订传播

- 优先级/阶段/方法：P1 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.5、FR-10；场景：S16、S17、S18、S20、S23；任务：T13、T14、T15、T18、T21
- 前置：M已结束，H/A/B开始名单；可控制end及修订版本
- 步骤：先评分/公评/互选 → 支持合法纠错present→absent→present
- 预期：新有效投影重算；不合格公评撤公开、评分退出统计、唯一依据私聊停止；恢复不重复计数
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.5 FR-10

### QA-POST-010 支持窗与最小权限

- 优先级/阶段/方法：P1 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.5、FR-10；场景：S16、S17、S18、S20、S23；任务：T13、T14、T15、T18、T21
- 前置：M已结束，H/A/B开始名单；可控制end及修订版本
- 步骤：end+7d−1ms支持修订 → 等号有MFA/case/reason/version再修订 → analyst尝试
- 预期：窗内409 CORRECTION_WINDOW_OPEN；等号合法修订且有审计；analyst拒绝，不读聊天
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.5 FR-10

## PRIVACY

### QA-PRIVACY-001 举报回执与本人范围

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.6；场景：S23、S24、S25；任务：T18、T19、T23、T26、T27
- 前置：A为ACTIVE，主持未来M、参与未来N、仅pending场Q、已开始场R；两连接及受影响快照S0/导出E0
- 步骤：A举报 → B猜receipt → A查询处理状态
- 预期：A只见已收到/处理中/已回复允许结果；B拒绝；无假称已经处理或通知带正文
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.6、[data-and-command-contract.zh-CN.md](../../docs/engineering/data-and-command-contract.zh-CN.md) §1—4

### QA-PRIVACY-002 删除同步屏障

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.6；场景：S23、S24、S25；任务：T18、T19、T23、T26、T27
- 前置：A为ACTIVE，主持未来M、参与未来N、仅pending场Q、已开始场R；两连接及受影响快照S0/导出E0
- 步骤：并发A发送/host审批A及A删除 → 删除事务提交202
- 预期：202前撤全部session/公开资料/联系；未来host取消、成员退出、pending撤回；提交后无新业务写
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.6、[data-and-command-contract.zh-CN.md](../../docs/engineering/data-and-command-contract.zh-CN.md) §1—4

### QA-PRIVACY-003 删除失败与丢响应

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.6；场景：S23、S24、S25；任务：T18、T19、T23、T26、T27
- 前置：A为ACTIVE，主持未来M、参与未来N、仅pending场Q、已开始场R；两连接及受影响快照S0/导出E0
- 步骤：故障注入事务失败 → 重试成功但丢弃202 → 用预存receipt查询
- 预期：失败不返回202且无半删除；已撤session仍可凭receipt查最小状态；token不在URL/log
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.6、[data-and-command-contract.zh-CN.md](../../docs/engineering/data-and-command-contract.zh-CN.md) §1—4

### QA-PRIVACY-004 开始后删除

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.6；场景：S23、S24、S25；任务：T18、T19、T23、T26、T27
- 前置：A为ACTIVE，主持未来M、参与未来N、仅pending场Q、已开始场R；两连接及受影响快照S0/导出E0
- 步骤：R开始后删host或成员
- 预期：不抹他人出席/业务成团；仅删除者身份及贡献按政策清理
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.6、[data-and-command-contract.zh-CN.md](../../docs/engineering/data-and-command-contract.zh-CN.md) §1—4

### QA-PRIVACY-005 快照导出撤销

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.6；场景：S23、S24、S25；任务：T18、T19、T23、T26、T27
- 前置：A为ACTIVE，主持未来M、参与未来N、仅pending场Q、已开始场R；两连接及受影响快照S0/导出E0
- 步骤：S0生成CSV后删A → 查图/下钻/分页/下载E0
- 预期：受影响整份S0均410；旧缓存清除；无长期公开下载；不承诺抹掉已下载文件
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.6、[data-and-command-contract.zh-CN.md](../../docs/engineering/data-and-command-contract.zh-CN.md) §1—4

### QA-PRIVACY-006 MVCC构建与删除竞争

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.6；场景：S23、S24、S25；任务：T18、T19、T23、T26、T27
- 前置：A为ACTIVE，主持未来M、参与未来N、仅pending场Q、已开始场R；两连接及受影响快照S0/导出E0
- 步骤：构建读旧epoch → 删除提交 → 旧构建尝试SEALED
- 预期：旧构建不能发布；重算新snapshot；无删除主体复活
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.6、[data-and-command-contract.zh-CN.md](../../docs/engineering/data-and-command-contract.zh-CN.md) §1—4

### QA-PRIVACY-007 供应商删除分步失败

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.6；场景：S23、S24、S25；任务：T18、T19、T23、T26、T27
- 前置：A为ACTIVE，主持未来M、参与未来N、仅pending场Q、已开始场R；两连接及受影响快照S0/导出E0
- 步骤：Auth0或Apple撤销失败 → 重复worker后恢复
- 预期：回执显示PROCESSING/NEEDS_SUPPORT而非COMPLETED；步骤幂等且不影响他人数据
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.6、[data-and-command-contract.zh-CN.md](../../docs/engineering/data-and-command-contract.zh-CN.md) §1—4

### QA-PRIVACY-008 备份恢复删除台账

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.6；场景：S23、S24、S25；任务：T18、T19、T23、T26、T27
- 前置：A为ACTIVE，主持未来M、参与未来N、仅pending场Q、已开始场R；两连接及受影响快照S0/导出E0
- 步骤：恢复含A的旧备份 → 未重放台账尝试ready → 重放后开放
- 预期：台账先于流量；撤销导出/身份不复活；有恢复时间和最小审计
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.6、[data-and-command-contract.zh-CN.md](../../docs/engineering/data-and-command-contract.zh-CN.md) §1—4

## SURVEY

### QA-SURVEY-001 全空与仅因素

- 优先级/阶段/方法：P1 / demo / browser_or_unit；状态：NOT_RUN
- 需求：§0.5、FR-12；场景：S21；任务：T16、T21、T26
- 前置：已登录但无出席记录；Settings Product survey
- 步骤：默认again=null → 全空Save → 只选company后Save
- 预期：全空拒绝；仅因素可保存且again仍null
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.5 FR-12

### QA-SURVEY-002 No与清除不同

- 优先级/阶段/方法：P1 / demo / browser_or_unit；状态：NOT_RUN
- 需求：§0.5、FR-12；场景：S21；任务：T16、T21、T26
- 前置：已登录但无出席记录；Settings Product survey
- 步骤：明确No保存 → 清除again并选cost → 重复选因素
- 预期：false不当null；清除后未答；reasons去重且仅七枚举
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.5 FR-12

### QA-SURVEY-003 问卷与单场分离

- 优先级/阶段/方法：P1 / demo / browser_or_unit；状态：NOT_RUN
- 需求：§0.5、FR-12；场景：S21；任务：T16、T21、T26
- 前置：已登录但无出席记录；Settings Product survey
- 步骤：在饭后页填score → 设置填问卷 → 超过饭后7天再更新问卷
- 预期：单场仅score不问整体意愿；问卷无需出席或7天资格；不迁移旧单场答案
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.5 FR-12

## TIME

### QA-TIME-001 截止相对-1ms

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.2；场景：S01、S09；任务：T08、T10、T11、T31
- 前置：M截止2026-10-23T17:00:00Z；有空位；用户资料齐全
- 步骤：有效时刻=closesAt-1ms → 分别申请/审批
- 预期：可申请和审批一次
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.2

### QA-TIME-002 截止相对0ms

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.2；场景：S01、S09；任务：T08、T10、T11、T31
- 前置：M截止2026-10-23T17:00:00Z；有空位；用户资料齐全
- 步骤：有效时刻=closesAt+0ms → 分别申请/审批
- 预期：申请审批均拒绝；待审EXPIRED；不增加席位
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.2

### QA-TIME-003 截止相对1ms

- 优先级/阶段/方法：P0 / implementation / api_db_or_unit；状态：NOT_RUN
- 需求：§0.2；场景：S01、S09；任务：T08、T10、T11、T31
- 前置：M截止2026-10-23T17:00:00Z；有空位；用户资料齐全
- 步骤：有效时刻=closesAt+1ms → 分别申请/审批
- 预期：申请审批均拒绝；待审EXPIRED；不增加席位
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.2

### QA-TIME-004 秋季未选偏移

- 优先级/阶段/方法：P0 / implementation / timezone_unit_and_api；状态：NOT_RUN
- 需求：§0.2、P-03；场景：S07；任务：T07、T25
- 前置：两份完全合法Create DTO分别测试startsAt与closesAt；另外字段时间保持合法
- 步骤：输入London墙钟2026-10-25 01:30及偏移无 → 分别提交开始和截止
- 预期：要求选择BST或GMT；不自动提交UTC
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.2 P-03

### QA-TIME-005 秋季BST

- 优先级/阶段/方法：P0 / implementation / timezone_unit_and_api；状态：NOT_RUN
- 需求：§0.2、P-03；场景：S07；任务：T07、T25
- 前置：两份完全合法Create DTO分别测试startsAt与closesAt；另外字段时间保持合法
- 步骤：输入London墙钟2026-10-25 01:30及偏移60 → 分别提交开始和截止
- 预期：UTC=2026-10-25T00:30:00Z
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.2 P-03

### QA-TIME-006 秋季GMT

- 优先级/阶段/方法：P0 / implementation / timezone_unit_and_api；状态：NOT_RUN
- 需求：§0.2、P-03；场景：S07；任务：T07、T25
- 前置：两份完全合法Create DTO分别测试startsAt与closesAt；另外字段时间保持合法
- 步骤：输入London墙钟2026-10-25 01:30及偏移0 → 分别提交开始和截止
- 预期：UTC=2026-10-25T01:30:00Z
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.2 P-03

### QA-TIME-007 春季不存在

- 优先级/阶段/方法：P0 / implementation / timezone_unit_and_api；状态：NOT_RUN
- 需求：§0.2、P-03；场景：S07；任务：T07、T25
- 前置：两份完全合法Create DTO分别测试startsAt与closesAt；另外字段时间保持合法
- 步骤：输入London墙钟2027-03-28 01:30及偏移任意 → 分别提交开始和截止
- 预期：422；不平移到02:30
- 依据：[PRD.zh-CN.md](../../docs/product/PRD.zh-CN.md) §0.2 P-03
