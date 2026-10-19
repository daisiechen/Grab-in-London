export type AttendanceValue = "present" | "absent";
export type AttendanceReport = { mealId: string; userId: string; actorId: string; source: "self" | "host"; value: AttendanceValue; at: string };
export type MealContext = { id: string; ended: boolean; cancelled: boolean; hostId: string; participantIds: string[] };
export const experienceReasons = ["company", "conversation", "coordination", "expectations", "venue", "cost", "other"] as const;
export type ExperienceReason = typeof experienceReasons[number];
export type MealExperience = { mealId: string; userId: string; score: number; again: boolean; reasons: ExperienceReason[]; at: string };
export function reportAttendance(reports: AttendanceReport[], meal: MealContext, actorId: string, userId: string, value: AttendanceValue, at: string): AttendanceReport[] {
  if (!meal.ended || meal.cancelled || !meal.participantIds.includes(userId)) throw new Error("Attendance is available only for eligible participants after the meal.");
  if (actorId !== userId && actorId !== meal.hostId) throw new Error("Only the participant or host may report attendance.");
  if (value !== "present" && value !== "absent") throw new Error("Choose attended or did not attend.");
  return [...reports, { mealId: meal.id, userId, actorId, source: actorId === userId ? "self" : "host", value, at }];
}
export function attendanceResult(reports: AttendanceReport[], mealId: string, userId: string) {
  const relevant = reports.filter((r) => r.mealId === mealId && r.userId === userId).sort((a,b) => a.at.localeCompare(b.at));
  const self = relevant.filter((r) => r.source === "self").at(-1)?.value;
  const host = relevant.filter((r) => r.source === "host").at(-1)?.value;
  return self && host && self !== host ? "conflict" : self || host || "unknown";
}
export function saveExperience(rows: MealExperience[], reports: AttendanceReport[], meal: MealContext, userId: string, score: number, again: boolean, reasons: ExperienceReason[], at: string): MealExperience[] {
  if (!meal.ended || meal.cancelled || !meal.participantIds.includes(userId) || attendanceResult(reports, meal.id, userId) !== "present") throw new Error("Record your attendance before rating the meal.");
  if (!Number.isInteger(score) || score < 1 || score > 5 || typeof again !== "boolean" || reasons.some((r) => !experienceReasons.includes(r))) throw new Error("Choose a score from 1 to 5 and whether you would join another Fancy meal.");
  return [...rows.filter((r) => r.mealId !== meal.id || r.userId !== userId), { mealId: meal.id, userId, score, again, reasons: [...new Set(reasons)], at }];
}
