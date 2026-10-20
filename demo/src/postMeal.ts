import { DAY } from "./readiness.ts";

export type Attendance = "present" | "absent" | "unknown";
export type AttendanceRecord = { self?: Attendance; host?: Attendance };
export const attendanceStatus = (record: AttendanceRecord = {}): Attendance =>
  record.self && record.self !== "unknown" ? record.self : record.host ?? "unknown";
export function reportWindow(end: number, now: string) {
  const at = Date.parse(now);
  return at >= end && at < end + 7 * DAY;
}
export function feedbackEligible(eligibleAtStart: boolean, record: AttendanceRecord, end: number, now: string) {
  return eligibleAtStart && attendanceStatus(record) === "present" && reportWindow(end, now);
}
export const feedbackReasons = [
  ["coordination", "Organisation"], ["expectations", "Expectations"],
  ["company", "Company"], ["conversation", "Conversation"], ["venue", "Restaurant"], ["cost", "Cost"], ["other", "Other"],
] as const;
export type MealExperience = { score: number; again: boolean | null; reasons: string[]; saved?: boolean };
export function validateExperience(value: MealExperience) {
  if (!Number.isInteger(value.score) || value.score < 1 || value.score > 5 || value.again === null)
    return "Choose a score and whether you’d join another Fancy meal.";
  if (value.reasons.some((r) => !feedbackReasons.some(([key]) => key === r))) return "Choose one of the listed reasons.";
  return "";
}
export type Connection = { mine: boolean; theirs: boolean; sourceMeal?: string; sourceMeals?: string[] };
export const canMessage = (connection: Connection | undefined, blocked = false) => !!connection?.mine && !!connection.theirs && !blocked;
export const revokeConnection = (): Connection => ({ mine: false, theirs: false });

export function connectionHasAttendance(connection: Connection | undefined, memberId: string, records: Record<string, AttendanceRecord>, eligibility: Record<string, string[]>) {
  const sources = connection?.sourceMeals ?? (connection?.sourceMeal ? [connection.sourceMeal] : []);
  return sources.some((id) => eligibility[id]?.includes("alex") && eligibility[id]?.includes(memberId) && attendanceStatus(records[`${id}:alex`]) === "present" && attendanceStatus(records[`${id}:${memberId}`]) === "present");
}
