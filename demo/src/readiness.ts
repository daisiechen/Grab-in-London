import type { JoinState, Meal } from "./domain.ts";

/** Local product simulation. The production service owns clock and transitions. */
export const DEMO_NOW = "2026-10-20T09:00:00.000Z";
export const MINUTE = 60_000;
export const DAY = 86_400_000;

export function londonInstant(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return "";
  const target = Date.parse(`${date}T${time}:00Z`);
  if (!Number.isFinite(target)) return "";
  let instant = target;
  const format = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  for (let i = 0; i < 3; i++) {
    const p = Object.fromEntries(format.formatToParts(instant).map((x) => [x.type, x.value]));
    const wall = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`);
    instant += target - wall;
  }
  return new Date(instant).toISOString();
}
export const startsAt = (meal: Pick<Meal, "date" | "time">) => Date.parse(londonInstant(meal.date, meal.time));
export const endsAt = (meal: Pick<Meal, "date" | "time">) => startsAt(meal) + 120 * MINUTE;
export const minimumFor = (meal: Meal) => meal.minimum ?? (meal.capacity === 2 ? 2 : 3);
export const closesAt = (meal: Meal) => meal.closesAt ? Date.parse(meal.closesAt) : startsAt(meal) - 60 * MINUTE;
export function validateRecruitment(capacity: number, minimum: number, deadline: string, date: string, time: string, now: string) {
  if (!Number.isInteger(capacity) || !Number.isInteger(minimum) || minimum < 2 || minimum > capacity || capacity > 6)
    return "Choose a minimum and maximum of 2–6 people, including you.";
  const cutoff = Date.parse(deadline);
  if (!Number.isFinite(cutoff) || cutoff <= Date.parse(now) || cutoff > startsAt({ date, time }) - 30 * MINUTE)
    return "Choose a future deadline at least 30 minutes before the meal.";
  return "";
}
export function canRecruit(meal: Meal, now: string) {
  return !meal.cancelledAt && Date.parse(now) < closesAt(meal);
}
export function resolveLifecycle(meal: Meal, now: string): Meal {
  const at = Date.parse(now);
  if (meal.cancelledAt || at < closesAt(meal)) return meal;
  if (meal.confirmed >= minimumFor(meal)) return meal.formationCheckedAt ? meal : { ...meal, formationCheckedAt: new Date(closesAt(meal)).toISOString() };
  if (meal.formationCheckedAt && at >= startsAt(meal)) return meal;
  return { ...meal, cancelledAt: at >= startsAt(meal) ? new Date(closesAt(meal)).toISOString() : now, cancelReason: "insufficient" };
}
export function cancelWholeMeal(meal: Meal, now: string, reason: NonNullable<Meal["cancelReason"]>) {
  if (!meal.owned) throw new Error("Only the host can cancel this meal.");
  if (Date.parse(now) >= startsAt(meal)) throw new Error("This meal has started. Contact support about what happened.");
  return meal.cancelledAt ? meal : { ...meal, cancelledAt: now, cancelReason: reason };
}
export function criticalEditAllowed(meal: Meal) {
  return meal.owned && !meal.cancelledAt && !meal.arrangementsLocked && meal.confirmed === 1;
}
export type ApplicationRound = { id: string; mealId: string; state: JoinState; appliedAt: string };
export function newApplicationRound(meal: Meal, prior: ApplicationRound[], now: string): ApplicationRound {
  if (!canRecruit(meal, now)) throw new Error("Applications have closed.");
  const previous = prior.filter((r) => r.mealId === meal.id).at(-1);
  if (previous && !["WITHDRAWN", "CANCELLED"].includes(previous.state)) throw new Error("This application cannot be reopened.");
  return { id: `${meal.id}-alex-${prior.length + 1}`, mealId: meal.id, state: "PENDING", appliedAt: now };
}
export type GroupMembership = { left?: boolean; closed?: boolean; history?: string[] };
export function chatPermission(admitted: boolean, membership: GroupMembership = {}) {
  if (!admitted) return "locked";
  return membership.left || membership.closed ? "read-only" : "write";
}
