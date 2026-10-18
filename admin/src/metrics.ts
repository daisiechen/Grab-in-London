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
      "未知和冲突不计出席；须同时看记录覆盖。",
      "Unknown and conflicting records are excluded; inspect coverage.",
    ],
  },
  {
    id: "activation",
    title: ["14 天首次赴约率", "14-day first attendance"],
    definition: [
      "首次申请后 14 天内首次确认赴约的成熟用户 ÷ 首次申请已观察满 14 天的用户。发起人单独看创建漏斗。",
      "Mature first applicants whose first attendance occurs within 14 days / first applicants observed for a full 14 days. Host-only users use the create funnel.",
    ],
    unit: [
      "用户；首次申请归入所选日期",
      "Users; cohort by first application date",
    ],
    window: ["14×24 小时；只计成熟用户。", "14 × 24 hours; mature users only."],
    source: [
      "申请成功业务记录 + 出席确认。",
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
    title: ["30 天重复赴约率", "30-day repeat attendance"],
    definition: [
      "首次出席后 30 天内参加另一场饭局的成熟用户 ÷ 首次出席已观察满 30 天的用户。",
      "Mature first attendees attending another meal within 30 days / first attendees observed for 30 days.",
    ],
    unit: [
      "用户；首次出席归入所选日期",
      "Users; cohort by first attendance date",
    ],
    window: [
      "30×24 小时；未成熟用户单列。",
      "30 × 24 hours; immature users reported separately.",
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
    title: ["出席确认覆盖率", "Attendance coverage"],
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
      "参与关系 + 发起人确认 / 本人自报。",
      "Membership and host/self attendance reports.",
    ],
    decision: [
      "先修复证据缺失，再解释到场表现。",
      "Resolve evidence gaps before interpreting attendance.",
    ],
    caveat: [
      "未知与冲突分别展示，不推断失约；自报不等于独立核实。",
      "Unknown/conflict are not no-shows; self-report is not independent verification.",
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
    title: ["成团率", "Formation rate"],
    definition: [
      "计划开始前曾达到最低确认人数的场次 ÷ 已到计划开始时间的已发布场次；取消仍在分母。",
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
      "申请成功到首次有效审核的小时数，展示中位数及 P90；待处理申请另看当前等待。",
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
      "至少有一次成熟发现请求且在该请求后 7 天内成功申请的用户 ÷ 有成熟发现请求的用户；用户去重。",
      "Users applying within 7 days of at least one mature discovery request / users with a discovery request observed for 7 days.",
    ],
    unit: [
      "用户（含明确会话衔接的匿名身份）",
      "Users, including explicit session-linked identities",
    ],
    window: [
      "成熟发现请求；按发现日期入组。",
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
      "反馈覆盖=提交反馈的出席人次/确认出席人次；愿再参加=选择愿意的反馈/有效反馈。",
      "Coverage = feedback submissions / attended participations; return intent = positive answers / valid feedback.",
    ],
    unit: ["用户 × 饭局", "User × meal"],
    window: [
      "饭局开始日期在所选范围；反馈截至快照。",
      "Meal dates in range; feedback up to snapshot.",
    ],
    source: [
      "确认出席 + feedback_submitted 业务结果。",
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
