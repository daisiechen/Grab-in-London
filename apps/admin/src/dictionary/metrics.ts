// Metric dictionary copy (definition text only) ported from admin/src/metrics.ts (prototype).
// Wording, not computation: production numbers always come from the sealed server snapshot.
// Ids follow the prototype; they become authoritative once the contracts key registry (G3) lands.
export type Copy = [string, string];
export type Metric = {
  id: string;
  title: Copy;
  definition: Copy;
  unit: Copy;
  window: Copy;
  source: Copy;
  decision: Copy;
  caveat: Copy;
};
export const metrics: Metric[] = [
  {
    id: "weekly",
    title: ["每周确认出席用户数", "Weekly attended users"],
    definition: [
      "按饭局开始时间归周，统计出席状态为出席的去重用户；包括发起人。同周多场只计一次。卡片取曲线中最近可见周，并标明周起始日期；筛选截断或该周未结束时标为周数据不完整。",
      "Distinct users with confirmed attendance, including hosts, grouped by meal start week. Multiple meals in one week count once. The card uses the latest visible week in the chart and identifies its start date; clipped or ongoing weeks are marked partial.",
    ],
    unit: ["用户 / 周", "Users / week"],
    window: [
      "周一至周日，伦敦时间；当前周未结束。",
      "Monday–Sunday, Europe/London; current week is incomplete.",
    ],
    source: [
      "参与记录 + 出席确认，按快照取最新版本。",
      "Participation and latest attendance record available at snapshot.",
    ],
    decision: [
      "判断真实见面规模及其变化。",
      "Understand the scale of real meetings.",
    ],
    caveat: [
      "未知不计出席；本人报告优先，须同时看记录覆盖。",
      "Unknown records are excluded; self reports take priority. Inspect coverage.",
    ],
  },
  {
    id: "activation",
    title: ["首次申请后 14 天内出席率", "14-day first attendance"],
    definition: [
      "先找每人的历史第一笔已提交申请；只选申请日期在当前范围、到数据截止已过完整 14×24 小时的人作为分母。其中在首次申请起 14 天内第一次实际出席饭局的人作为分子。例：10月1日12点首次申请，到10月15日12点才纳入分母；近期用户仍在观察，不算失败。发起人发布饭局不是提交申请，单看“发起饭局”的开始创建→完成安排→发布。",
      "Users first attending within 14 days of their first submitted application / first applicants whose full 14-day follow-up has elapsed by the cutoff. Select cohorts by first application date; recent applicants remain under observation. Hosts publishing a meal are measured in the host flow, not counted as applications.",
    ],
    unit: [
      "去重用户；例如选9月1–30日，就只选历史首次申请发生在9月的人，不要求出席也在9月。",
      "Users; cohort by first application date",
    ],
    window: ["从首次申请成功时间起算连续14×24小时；不足14天者另列观察中。", "14 × 24 hours; full follow-up only."],
    source: [
      "同时关联同一用户的申请提交成功业务记录和有效出席记录。申请成功是提交成功，不是获准；出席须是已确认成员或发起人、未提前退出、场次未取消，且饭后有出席报告。",
      "Authoritative applications and attendance.",
    ],
    decision: [
      "检查申请能否兑现为真实见面。",
      "Check whether applying leads to a real meeting.",
    ],
    caveat: [
      "不是点击申请转化；缺失出席记录会低估结果。",
      "Not a click conversion; incomplete attendance can understate results.",
    ],
  },
  {
    id: "retention",
    title: ["首次出席后 30 天内再赴约率", "30-day repeat attendance"],
    definition: [
      "分母：历史首次实际出席发生在所选日期，且到数据截止已过完整30天的用户。分子：这些人在首次出席后30天内又出席另一场饭局的人。首次出席后还没满30天的人单列“观察中”，不算流失。",
      "Users attending a different meal within 30 days of their first attendance / first attendees whose full 30-day follow-up has elapsed. Recent attendees remain under observation, not classified as churn.",
    ],
    unit: [
      "去重用户；所选日期筛选历史第一次出席发生的时间，后续出席可在所选日期之外。",
      "Users; cohort by first attendance date",
    ],
    window: [
      "从第一次实际出席的饭局开始时间起算30×24小时；未满30天单列观察中。",
      "30 × 24 hours; users still under observation reported separately.",
    ],
    source: [
      "去重出席事实，关联不同 mealId。",
      "Deduplicated attendance across different meal IDs.",
    ],
    decision: [
      "判断重复价值，而非重复打开 App。",
      "Measure repeat value rather than repeat app opens.",
    ],
    caveat: [
      "后续赴约可超出筛选日期，但不晚于快照；同时看后续曝光机会覆盖。",
      "Follow-up may fall after the selected cohort dates, up to snapshot; inspect opportunity exposure.",
    ],
  },
  {
    id: "coverage",
    title: ["出席结果记录覆盖率", "Attendance coverage"],
    definition: [
      "状态明确为出席或未出席的参与记录 ÷ 已结束且未取消饭局的应确认参与记录（发起人及未提前退出的确认成员）。",
      "Present or absent records / eligible participation records in ended, non-cancelled meals, including hosts and confirmed members who did not withdraw before start.",
    ],
    unit: ["用户 × 饭局", "User × meal"],
    window: [
      "按饭局开始日期；截至快照。",
      "By meal start date, as of snapshot.",
    ],
    source: [
      "饭后App“记录出席”：发起人逐人报告、本人自报；本人报告优先，发起人补缺；来源差异保留。逾期支持个案纠错单独审计。打开群聊或席位已确认都不能代替出席。",
      "Membership and host/self attendance reports.",
    ],
    decision: [
      "先修复证据缺失，再解释到场表现。",
      "Resolve evidence gaps before interpreting attendance.",
    ],
    caveat: [
      "未知不推断失约；来源不一致仍按本人报告统计，自报不等于独立核实。",
      "Unknown is not a no-show; source differences do not override self reports. Self-report is not independent verification.",
    ],
  },
  {
    id: "discovery",
    title: ["发现无结果率", "Zero-result discovery"],
    definition: [
      "返回零个可申请饭局的有效请求数 ÷ 有效发现请求数；按 eventId 去重。",
      "Valid discovery requests returning zero eligible meals / valid discovery requests, deduplicated by event ID.",
    ],
    unit: ["请求；另看去重用户", "Requests; also inspect distinct users"],
    window: ["按请求发生时间。", "By request occurrence time."],
    source: [
      "discovery_results，包含当次筛选与 resultCount。",
      "discovery_results with request filters and resultCount.",
    ],
    decision: [
      "识别区域、时段及预算供给缺口。",
      "Find supply gaps by area, time and budget.",
    ],
    caveat: [
      "是需求请求而非人数；报错请求不当作零结果。",
      "Requests are not users; failed requests are not zero results.",
    ],
  },
  {
    id: "formation",
    title: ["开始前招募达标率", "Formation rate"],
    definition: [
      "计划开始前，确认成员数（含发起人）曾达到最低成团人数的场次 ÷ 已到计划开始时间的已发布场次。门槛取发起人发布时选定且首位获准后锁定的minimum，2≤minimum≤capacity≤6；取消仍在分母。仅代表招募达标，不代表实际举行。",
      "Published meals reaching minimum confirmed size before start / published meals whose planned start has passed; cancellations stay in denominator.",
    ],
    unit: ["饭局", "Meals"],
    window: ["按计划开始日期。", "By planned start date."],
    source: [
      "饭局发布、席位状态变更。",
      "Meal publication and seat state transitions.",
    ],
    decision: [
      "检查招募、时间安排和人数门槛。",
      "Inspect recruitment, scheduling and group size.",
    ],
    caveat: [
      "曾成团不等于实际举行；与取消和出席并看。",
      "Formation does not prove a meal took place.",
    ],
  },
  {
    id: "cancellation",
    title: ["饭局取消率", "Meal cancellation"],
    definition: [
      "已取消场次 ÷ 已到计划开始时间的已发布场次。",
      "Cancelled meals / published meals whose planned start has passed.",
    ],
    unit: ["饭局", "Meals"],
    window: [
      "按计划开始日期，保留取消场次。",
      "By planned start date, including cancelled meals.",
    ],
    source: [
      "饭局取消业务结果及原因。",
      "Authoritative meal cancellation and reason.",
    ],
    decision: [
      "区分供给不足与协调问题。",
      "Distinguish supply and coordination failures.",
    ],
    caveat: [
      "用户退出与整场取消分开；原因未知时不推断。",
      "Individual withdrawal is separate; missing reasons stay unknown.",
    ],
  },
  {
    id: "approval",
    title: ["审核用时 P90（小时）", "Decision time P90 (hours)"],
    definition: [
      "从申请提交成功，到发起人第一次批准或拒绝的小时数。中位数=50%的已处理申请用时不超过此值；P90=90%不超过此值（最近秩法）。例如5.0h与12.0h表示一半在5小时内、九成在12小时内处理。待处理申请不计入，另列数量与等待用时。",
      "P90 hours from application success to the first valid approval or decline, using nearest rank without interpolation. Pending applications are excluded and reported separately. The approval key contains P90 hours, not a mean or milliseconds.",
    ],
    unit: ["申请 / 小时", "Application / hours"],
    window: [
      "申请日期在所选范围；结果截至快照。",
      "Application dates in range; decisions up to snapshot.",
    ],
    source: [
      "应用服务的申请与审核时间。",
      "Application and decision timestamps from service.",
    ],
    decision: [
      "检查发起人响应与提醒设计。",
      "Improve host response and reminders.",
    ],
    caveat: [
      "已处理样本有选择偏差；不能忽略仍等待的人。",
      "Completed decisions are selective; inspect pending waits too.",
    ],
  },
  {
    id: "discovery7",
    title: ["发现后 7 天申请率", "7-day discovery to application"],
    definition: [
      "分母：所选日期内至少有一次发现列表加载成功，且该次加载到截止时间已过完整7天的用户。分子：同一用户在这些加载中的任一次之后7天内提交成功至少一笔申请。每人只计一次，不是点击申请按钮的次数。",
      "Users applying within 7 days of at least one mature discovery request / users with a discovery request observed for 7 days.",
    ],
    unit: [
      "用户（含明确会话衔接的匿名身份）",
      "Users, including explicit session-linked identities",
    ],
    window: [
      "发现加载时间在所选范围、且已观察满7×24小时；后续申请可跨所选结束日但不能晚于数据截止。",
      "Mature discovery requests; cohort by discovery date.",
    ],
    source: [
      "发现事件 + 同一用户申请事实。",
      "Discovery events and applications for the same user.",
    ],
    decision: [
      "诊断从浏览到有意参与的门槛。",
      "Diagnose barriers between browsing and intent.",
    ],
    caveat: [
      "未登录且未衔接的身份不能推断为已注册用户。",
      "Unlinked anonymous identities are not inferred registered users.",
    ],
  },
  {
    id: "feedback",
    title: ["单场饭局评分覆盖率", "Meal rating coverage"],
    definition: ["有效1–5分评分人次 ÷ 有效出席人次；同人同场取截至快照最新评分。不要求回答再参加意愿或选择因素。", "Valid 1–5 meal ratings / attended participations; latest per user and meal. No survey answer is required."],
    unit: ["用户 × 饭局", "User × meal"],
    window: ["按饭局开始日期入组；计划结束后7天内自助评分，结果取截至快照。", "Cohort by meal start; self-service ratings within 7 days of scheduled end, as of snapshot."],
    source: ["App饭后私密整场评分，与出席资格关联；不读取公开个人评价或按人再约。", "Private post-meal rating and eligible attendance, independent of public references and person reconnects."],
    decision: ["了解单场体验及评分覆盖。", "Understand meal experience and rating coverage."],
    caveat: ["未评分者可能有不同体验；不与产品问卷交叉归因。", "Response bias; do not attribute product survey responses to a meal."],
  },
  {
    id: "survey",
    title: ["问卷：愿意再参加比例", "Survey: willingness to return"],
    definition: ["最新有效产品问卷中again=Yes的用户 ÷ 明确回答Yes或No的用户；只选因素而未回答again的用户单列，不当作No。因素按提交用户分别计数，可多选，不按饭局评分切片。", "Users answering Yes / users explicitly answering Yes or No in their latest valid product survey. Factors-only responses stay unanswered; factors may overlap and are never sliced by meal ratings."],
    unit: ["去重用户", "Distinct users"],
    window: ["先取截至快照每人最新有效问卷，再按该问卷提交日期筛选；用户分群生效，饭局维度不生效。", "Latest valid response per user at snapshot, then filter its submission date. User segment applies; meal dimensions do not."],
    source: ["Settings自愿ProductSurvey，登录即可提交，不绑定mealId、出席资格或饭后7天；不迁移旧单场again/reasons。", "Voluntary authenticated Settings ProductSurvey, independent of meals, attendance and the 7-day window. Legacy meal fields are not migrated."],
    decision: ["观察Fancy整体体验因素与意愿，作为访谈线索。", "Use product-level experience and intention to guide interviews."],
    caveat: ["展示提交、回答与未回答样本；不以问卷意愿替代实际再赴约。", "Show response and missing-answer counts; survey intent is not observed retention."],
  },
  {
    id:'formErrors',title:['表单校验错误事件','Form validation error events'],
    definition:['按事件发生日期筛选有效 form_error，按 eventId 去重计事件数，再按固定步骤与字段归类。同次尝试可以产生多次不同错误；不代表用户数或放弃率。','Valid form_error events in the selected occurrence period, deduplicated by eventId and grouped by fixed step and field. One attempt may have multiple errors; this is neither users nor abandonment rate.'],
    unit:['事件','Events'],window:['发生时间在筛选范围，发生和接收时间均不晚于快照。','Occurrence in range; occurrence and receipt no later than snapshot.'],source:['已同意采集的客户端固定错误代码；不含输入值。','Consented client events with fixed error codes; no input values.'],decision:['识别创建流程的校验卡点。','Identify validation friction in creation.'],caveat:['缺少适用尝试分母时不生成错误率；未同意与未送达事件不推断为成功。','No error rate without an applicable attempt denominator; unconsented or undelivered events do not imply success.'],
  },
  {
    id:'approvalP50',title:['审核用时 P50（小时）','Decision time P50 (hours)'],
    definition:['从申请成功到首次有效批准或拒绝的小时数，中位数取最近秩，不插值。待审不进入分布。','Median hours from successful application to first valid approval or decline; nearest rank, no interpolation. Pending applications are excluded.'],
    unit:['小时','Hours'],window:['期内申请，审核结果截至快照。','Applications in the selected period, decisions as of the snapshot.'],source:['申请与首次有效审核事实。','Application and first valid decision facts.'],decision:['结合 P90 与待审量检查响应。','Inspect response alongside P90 and pending counts.'],caveat:['无有效审核样本为 —，不表示零小时。','No valid decisions yields —, not zero hours.'],
  },
  {
    id:'pendingApplications',title:['仍在待审的申请','Pending applications'],
    definition:['期内申请中，截至快照仍为待审、饭局未取消且申请截止时间未到的申请数量。退出、拒绝、过期不继续计待审。','Applications in the selected period still pending as of the snapshot, for uncancelled meals before the application deadline. Withdrawn, declined and expired applications are excluded.'],
    unit:['申请记录','Applications'],window:['按申请日期入组，状态截至快照。','Cohort by application date, status as of snapshot.'],source:['申请状态与饭局截止时间。','Application state and meal deadline.'],decision:['识别仍需处理的积压。','Identify remaining review backlog.'],caveat:['有完整事实的 0 表示无待审；缺源为 —。','With complete facts, 0 means no pending applications; missing sources show —.'],
  },
  {
    id:'oldestPendingHours',title:['最久待审时长（小时）','Oldest pending wait (hours)'],
    definition:['上述仍在待审申请中，快照时间减申请时间的最大小时数。没有待审申请时为 —。','Maximum hours from application to snapshot among the remaining pending applications. With none pending, the value is —.'],
    unit:['小时','Hours'],window:['期内申请，等待截至快照，不是实时计时。','Applications in the period, wait as of snapshot, not a live clock.'],source:['待审申请与快照时间。','Pending applications and snapshot time.'],decision:['优先检查等待最久的申请。','Prioritise the longest waiting applications.'],caveat:['已结束的申请不继续累加等待时间。','Terminated applications do not continue accumulating wait.'],
  },
  // v5 (ops analytics review 2026-10-29): overview "this week" row, merged approval card, consent coverage.
  {
    id:'signups',title:['本周新注册','New members this week'],
    definition:['账号创建时间落在快照所在伦敦周（周一起）的成员，排除 test/staff 与非正常状态账号。脚注给出上周同口径人数和本周按注册平台拆分。','Accounts created in the London week (Monday start) containing the snapshot, excluding test/staff and inactive accounts. The footnote shows last week on the same basis and this week by sign-up platform.'],
    unit:['成员','Members'],window:['快照所在伦敦周；不受日期范围与用户分群影响，来源筛选生效。','London week of the snapshot; not narrowed by the date range or user segment. The source filter applies.'],
    source:['服务端 users.created_at；平台取该成员最早一条 Web/iOS 登录会话，来源取 users.signup_source（不需要分析授权）。','Server users.created_at; platform from the member\'s earliest Web/iOS session family, source from users.signup_source (no analytics consent needed).'],
    decision:['看获客规模和渠道变化。','Track acquisition volume and channel mix.'],
    caveat:['本周未结束；删号会清除会话记录，平台变为未知。','The current week is incomplete; account deletion removes session records, so platform becomes unknown.'],
  },
  {
    id:'mealsPublished',title:['本周新发布饭局','Meals published this week'],
    definition:['创建时间落在快照所在伦敦周的饭局，包括尚未开始和之后取消的场次；测试 host 的场次整场排除。','Meals created in the London week of the snapshot, including meals not yet started and meals later cancelled. Meals hosted by test accounts are excluded.'],
    unit:['饭局','Meals'],window:['快照所在伦敦周，按创建时间。','London week of the snapshot, by creation time.'],
    source:['服务端 meals.created_at。','Server meals.created_at.'],decision:['看供给的先行变化。','Watch leading supply.'],caveat:['区域、语言、人数、预算筛选生效；日期范围不生效。','Area, language, size and budget filters apply; the date range does not.'],
  },
  {
    id:'firstApplications',title:['本周首次申请的成员','First-time applicants this week'],
    definition:['全历史第一条申请落在快照所在伦敦周的成员。每人只计一次。','Members whose first-ever application falls in the London week of the snapshot. Each member counts once.'],
    unit:['成员','Members'],window:['快照所在伦敦周，按首次申请时间。','London week of the snapshot, by first application time.'],
    source:['服务端 applications。','Server applications.'],decision:['看新需求是否转化为行动。','See whether new demand turns into action.'],caveat:['饭局筛选作用于首次申请的那场饭局。','Meal filters apply to the meal of the first application.'],
  },
  {
    id:'mealsHeld',title:['本周成局场次','Meals held this week'],
    definition:['分母：本周计划开始且已到开始时间的场次（含取消）。分子：其中未取消、并至少有一条有效出席证据的场次。','Denominator: meals scheduled to start this week whose start time has passed (cancelled included). Numerator: those not cancelled with at least one valid present attendance record.'],
    unit:['饭局','Meals'],window:['快照所在伦敦周，按开始时间。','London week of the snapshot, by start time.'],
    source:['服务端 meals 与出席修订。','Server meals and attendance revisions.'],decision:['看供给是否真的变成见面。','See whether supply turns into real meetings.'],caveat:['出席报告在结束后 7 天内补齐，本周数字会偏低；先看出席覆盖。','Attendance reports arrive up to 7 days after a meal, so this week reads low; check attendance coverage first.'],
  },
  {
    id:'confirmed',title:['获准（即确认）','Approved (seat confirmed)'],
    definition:['期内申请中，已有席位确认事件的申请数量。首期获准即确认席位，原“获准申请”和“席位已确认”两张卡数值始终相同，v5 起合并为这一张。','Applications in the period with a seat confirmation. In the first release approval confirms the seat, so the former "approved" and "confirmed" cards were always equal; v5 merges them.'],
    unit:['申请记录','Applications'],window:['按申请日期入组，状态截至快照。','Cohort by application date, status as of snapshot.'],
    source:['服务端申请与席位事件。','Server applications and seat events.'],decision:['看审核通过的规模。','Track approval volume.'],caveat:['同一人截止前重新申请会生成新的申请记录；这是申请次数，不是人数。','Re-applying creates a new application record; this counts applications, not people.'],
  },
  {
    id:'consentCoverage',title:['分析授权覆盖率','Analytics consent coverage'],
    definition:['期内创建过登录会话、且至少一个会话已同意分析的成员 ÷ 期内创建过登录会话的成员。用来判断“仅授权样本”指标覆盖了多少成员。','Members with a login session created in the period where at least one session consented to analytics / members with a login session created in the period. Shows how much of the membership the consent-sample metrics cover.'],
    unit:['成员','Members'],window:['会话创建时间在筛选范围；授权状态截至快照（撤回后不计）。','Session creation in range; consent state as of snapshot (withdrawn consent does not count).'],
    source:['服务端 session_families 与 analytics_consents。','Server session_families and analytics_consents.'],decision:['决定授权样本指标能否用于判断趋势。','Decide whether consent-sample metrics are usable for trends.'],
    caveat:['游客不在分母中：iOS 游客无法授权，Web 游客尚不是成员。不要用它去“放大”授权样本数字。','Guests are not in the denominator: iOS guests cannot consent and Web guests are not members. Never use it to scale consent-sample numbers up.'],
  },
];
