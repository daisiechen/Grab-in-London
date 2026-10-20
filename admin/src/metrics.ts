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
      "按饭局开始时间归周，统计出席状态为出席的去重用户；包括发起人。同周多场只计一次。",
      "Distinct users with confirmed attendance, including hosts, grouped by meal start week. Multiple meals in one week count once.",
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
    title: ["申请处理耗时", "Application response time"],
    definition: [
      "从申请提交成功，到发起人第一次批准或拒绝的小时数。中位数=50%的已处理申请用时不超过此值；P90=90%不超过此值（最近秩法）。例如5.0h与12.0h表示一半在5小时内、九成在12小时内处理。待处理申请不计入，另列数量与等待用时。",
      "Hours from application success to first valid decision, median and P90; pending wait is separate.",
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
    title: ["饭后反馈与再参加意愿", "Feedback and return intent"],
    definition: [
      "反馈覆盖=提交整场体验评分的出席人次÷确认出席人次；愿再参加=选择“愿意再参加Fancy饭局”的有效反馈÷回答该问题的有效反馈。原因按评分与固定多选标签分析，未填写原因单列，不推断为无问题。",
      "Coverage = feedback submissions / attended participations; return intent = positive answers / valid feedback.",
    ],
    unit: ["用户 × 饭局", "User × meal"],
    window: [
      "饭局开始日期在所选范围；反馈截至快照。",
      "Meal dates in range; feedback up to snapshot.",
    ],
    source: [
      "确认出席人次 + App饭后“整场饭局体验”私密反馈（1–5分、愿否再参加、可选多项原因）。不读取公开评价正文或针对某人的私密互选。",
      "Attendance and authoritative feedback submissions.",
    ],
    decision: [
      "对照实际重复参与，理解体验问题。",
      "Understand experience alongside observed return.",
    ],
    caveat: [
      "存在响应偏差；意愿不是实际留存。",
      "Subject to response bias; intention is not retention.",
    ],
  },
];
