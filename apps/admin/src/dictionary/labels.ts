import type { Translate } from '../i18n.ts';
import { metrics } from './metrics.ts';

/**
 * Display copy for registry ids (contracts ADMIN_PAGE_KEYS / ADMIN_LISTS) and well-known series item
 * keys. Copy reuses the prototype wording. Unknown keys fall back to the raw stable id, never to a guess.
 */
const metricTitles: Record<string, [string, string]> = {
  ...Object.fromEntries(metrics.map((m) => [m.id, m.title])),
  impressionNoApply: ['看到饭局但 7 天内未申请', 'Saw meals, no application in 7 days'],
  applications: ['申请记录', 'Applications'],
  approved: ['获准申请', 'Approved applications'],
  confirmed: ['席位已确认', 'Confirmed seats'],
  applicationAttendance: ['申请后出席率', 'Attendance after application'],
  mealsWithAttendance: ['有出席记录的饭局', 'Meals with attendance records'],
  laterOpportunity: ['后续机会曝光', 'Later opportunity exposure'],
  missingRequired: ['缺失必需事件字段', 'Missing required event fields'],
  duplicates: ['重复排除事件', 'Deduplicated events'],
  excluded: ['测试/员工排除', 'Test/staff exclusions'],
  receiveLatencyP90: ['接收延迟 P90', 'P90 receive latency'],
};

const seriesTitles: Record<string, [string, string]> = {
  'weekly.trend': ['每周确认出席用户', 'Weekly attended users'],
  'funnel.join': ['从发现到席位已确认', 'From discovery to a confirmed seat'],
  'funnel.create': ['创建卡点', 'Creation friction'],
  'browse.people': ['浏览行为', 'Browsing behaviour'],
  'features.usage': ['功能使用诊断', 'Feature diagnostics'],
  'area.compare': ['区域比较', 'Area comparison'],
  'cancellation.reasons': ['取消原因', 'Cancellation reasons'],
  'attendance.distribution': ['出席状态分布', 'Attendance status'],
  'cohort.retention': ['首次赴约队列', 'First-attendance cohorts'],
  'rating.distribution': ['单场饭局评分分布', 'Meal rating distribution'],
  'survey.reasons': ['Fancy 整体体验问卷', 'Fancy product survey'],
  'quality.sources': ['数据来源', 'Data sources'],
};

const listTitles: Record<string, [string, string]> = {
  meals: ['饭局列表', 'Meals'],
  applications: ['申请列表', 'Applications'],
  'cohort.users': ['队列用户', 'Cohort users'],
  attendance: ['参与与出席证据', 'Participation and attendance evidence'],
  'quality.events': ['异常事件', 'Anomalous events'],
};

const itemLabels: Record<string, [string, string]> = {
  discovery: ['发现', 'Discover'], exposed: ['真实曝光', 'Exposed'], details: ['看详情', 'View details'],
  applications: ['申请', 'Apply'], approved: ['获准', 'Approved'], confirmed: ['确认', 'Confirmed'],
  createStarted: ['开始创建', 'Started'], createArranged: ['完成安排', 'Arranged'], createPublished: ['发布', 'Published'],
  present: ['出席', 'Present'], absent: ['未出席', 'Absent'], unknown: ['未知', 'Unknown'], conflict: ['来源不一致', 'Source differences'],
  host: ['发起人取消', 'Host cancelled'], booking: ['预约原因取消', 'Booking-related'], other: ['其他原因', 'Other'], insufficient: ['人数不足', 'Insufficient attendance'],
  company: ['同伴', 'Company'], conversation: ['交流', 'Conversation'], coordination: ['协调', 'Coordination'],
  expectations: ['预期', 'Expectations'], venue: ['场地', 'Venue'], cost: ['费用', 'Cost'], unspecified: ['未选择因素', 'No factor chosen'],
  user: ['用户自发', 'User-led'], assisted: ['平台协助', 'Assisted'],
  client: ['客户端行为', 'Client behaviour'], business: ['业务服务结果', 'Business results'], attendanceReports: ['线下出席确认', 'Attendance reports'],
  // Drill-down attribute columns.
  mealId: ['饭局', 'Meal'], userId: ['用户', 'User'], area: ['区域', 'Area'], startsAt: ['开始时间', 'Starts'],
  appliedAt: ['申请时间', 'Applied'], occurredAt: ['发生时间', 'Occurred'], status: ['状态', 'Status'], source: ['来源', 'Source'],
  role: ['角色', 'Role'], cohortWeek: ['队列周', 'Cohort week'], selfReport: ['本人自报', 'Self-report'], hostReport: ['发起人记录', 'Host report'],
};

const pick = (table: Record<string, [string, string]>, t: Translate, key: string) => {
  const copy = table[key];
  return copy ? t(copy[0], copy[1]) : key;
};

export const metricTitle = (t: Translate, id: string) => pick(metricTitles, t, id);
export const seriesTitle = (t: Translate, id: string) => pick(seriesTitles, t, id);
export const listTitle = (t: Translate, id: string) => (listTitles[id] ? pick(listTitles, t, id) : pick(metricTitles, t, id));
export const itemLabel = (t: Translate, key: string) => pick(itemLabels, t, key);
