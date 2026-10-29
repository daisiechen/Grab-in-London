import { MODERATION_SLA_HOURS } from '@fancy/contracts';
import type { ModerationAction, ModerationSummary } from '../../api/admin-api.ts';
import type { Translate } from '../../i18n.ts';

export const targetLabel = (t: Translate, type: ModerationSummary['targetType']) =>
  ({ USER: t('成员资料', 'Profile'), MEAL: t('饭局', 'Meal'), MESSAGE: t('聊天消息', 'Message') })[type];

export const caseStatusLabel = (t: Translate, status: string) =>
  ({ OPEN: t('待处理', 'Open'), IN_REVIEW: t('处理中', 'In review'), RESOLVED: t('已关闭', 'Closed') } as Record<string, string>)[status] ?? status;

export const accountLabel = (t: Translate, status: string | null) =>
  status === null ? '—' : ({ ACTIVE: t('正常', 'Active'), SUSPENDED: t('已停用', 'Suspended'), DELETING: t('删除中', 'Deleting'), DELETED: t('已删除', 'Deleted') } as Record<string, string>)[status] ?? status;

export const actionLabel = (t: Translate, action: string) => ({
  UPHOLD: t('维持限制并关闭', 'Uphold & close'),
  RESTORE: t('恢复内容并关闭', 'Restore & close'),
  HIDE_CONTENT: t('隐藏内容', 'Hide content'),
  CANCEL_MEAL: t('取消饭局', 'Cancel meal'),
  RESET_PROFILE_TEXT: t('清除昵称与简介', 'Clear name & bio'),
  REMOVE_PROFILE_PHOTO: t('移除头像', 'Remove photo'),
  SUSPEND_USER: t('停用账号', 'Suspend account'),
  UNSUSPEND_USER: t('恢复账号', 'Lift suspension'),
  AUTO_HIDE: t('系统自动限制', 'Automatically limited'),
  AUTO_CLOSE: t('30天未处理自动关闭', 'Auto-closed after 30 days'),
  CASE_STATUS: t('更新处理结果', 'Case outcome updated'),
  ATTENDANCE_CORRECTED: t('出席纠错', 'Attendance corrected'),
} as Record<string, string>)[action] ?? action;

/** Actions that close the case by themselves (server rule). */
export const CLOSING_ACTIONS: readonly ModerationAction[] = ['UPHOLD', 'RESTORE', 'SUSPEND_USER'];
/** Actions that need a second confirmation click. */
export const CONFIRM_ACTIONS: readonly ModerationAction[] = ['SUSPEND_USER', 'CANCEL_MEAL', 'REMOVE_PROFILE_PHOTO', 'RESET_PROFILE_TEXT'];

/** Internal-note presets for one-tap decisions (staff can edit them in the detail view). */
export const presetNote = (action: ModerationAction) => ({
  UPHOLD: 'Upheld: content breaks the community guidelines; limit kept.',
  RESTORE: 'Restored: no breach of the community guidelines found.',
  HIDE_CONTENT: 'Hidden while under review.',
  CANCEL_MEAL: 'Meal cancelled: listing breaks the community guidelines.',
  RESET_PROFILE_TEXT: 'Profile name and bio cleared: break the community guidelines.',
  REMOVE_PROFILE_PHOTO: 'Profile photo removed: breaks the community guidelines.',
  SUSPEND_USER: 'Account suspended for a serious or repeated breach of the community guidelines.',
  UNSUSPEND_USER: 'Suspension lifted after review.',
})[action];

/** Remaining time to the response target; negative = overdue. */
export function sla(summary: Pick<ModerationSummary, 'dueAt' | 'caseStatus'>, now = Date.now()) {
  const remainingMs = Date.parse(summary.dueAt) - now;
  const hours = Math.abs(remainingMs) / 3600_000;
  const tone: 'green' | 'amber' | 'red' | 'neutral' = summary.caseStatus === 'RESOLVED' ? 'neutral' : remainingMs < 0 ? 'red' : remainingMs < 6 * 3600_000 ? 'amber' : 'green';
  return { remainingMs, hours, tone };
}

export function slaText(t: Translate, summary: Pick<ModerationSummary, 'dueAt' | 'caseStatus'>, now = Date.now()) {
  if (summary.caseStatus === 'RESOLVED') return t('已关闭', 'Closed');
  const { remainingMs, hours } = sla(summary, now);
  const span = hours < 1 ? t(`${Math.max(1, Math.round(hours * 60))} 分钟`, `${Math.max(1, Math.round(hours * 60))} min`) : t(`${Math.floor(hours)} 小时`, `${Math.floor(hours)} h`);
  return remainingMs < 0 ? t(`已超时 ${span}`, `Overdue by ${span}`) : t(`剩余 ${span}`, `${span} left`);
}

export const ageText = (t: Translate, createdAt: string, now = Date.now()) => {
  const minutes = Math.max(0, Math.floor((now - Date.parse(createdAt)) / 60_000));
  if (minutes < 60) return t(`${minutes} 分钟前`, `${minutes} min ago`);
  const hours = Math.floor(minutes / 60);
  return hours < 48 ? t(`${hours} 小时前`, `${hours} h ago`) : t(`${Math.floor(hours / 24)} 天前`, `${Math.floor(hours / 24)} d ago`);
};

export const SLA_HOURS = MODERATION_SLA_HOURS;
