import { test } from "node:test";
import assert from "node:assert/strict";
import { initialMeals } from "../src/domain.ts";
import { DEMO_NOW, MINUTE, DAY, londonInstant, startsAt, endsAt, closesAt, canRecruit, resolveLifecycle, validateRecruitment, cancelWholeMeal, criticalEditAllowed, newApplicationRound, chatPermission } from "../src/readiness.ts";
import { attendanceStatus, feedbackEligible, reportWindow, validateExperience, canMessage, revokeConnection, connectionHasAttendance } from "../src/postMeal.ts";
const meal = { ...initialMeals[1], minimum: 2, capacity: 4, confirmed: 2, owned: true };
test("London wall times handle both sides of DST", () => {
  assert.equal(londonInstant("2026-10-23", "19:00"), "2026-10-23T18:00:00.000Z");
  assert.equal(londonInstant("2026-10-26", "19:00"), "2026-10-26T19:00:00.000Z");
  assert.equal(londonInstant("", ""), "");
});
test("custom minimum and deadline validation rejects invalid ranges and exact-now cutoff", () => {
  const cut = londonInstant(meal.date, "17:30");
  assert.equal(validateRecruitment(4, 2, cut, meal.date, meal.time, DEMO_NOW), "");
  for (const minimum of [1, 5, 2.5]) assert.ok(validateRecruitment(4, minimum, cut, meal.date, meal.time, DEMO_NOW));
  assert.ok(validateRecruitment(4, 2, DEMO_NOW, meal.date, meal.time, DEMO_NOW));
  assert.ok(validateRecruitment(4, 2, new Date(startsAt(meal) - 29 * MINUTE).toISOString(), meal.date, meal.time, DEMO_NOW));
});
test("at cutoff applications stop; low-count cancels, meeting minimum survives", () => {
  const cutoff = new Date(closesAt(meal)).toISOString();
  assert.equal(canRecruit(meal, new Date(closesAt(meal) - 1).toISOString()), true);
  assert.equal(canRecruit(meal, cutoff), false);
  assert.equal(resolveLifecycle(meal, cutoff).cancelledAt, undefined);
  const cancelled = resolveLifecycle({ ...meal, confirmed: 1 }, cutoff);
  assert.equal(cancelled.cancelReason, "insufficient");
  assert.equal(resolveLifecycle(cancelled, cutoff), cancelled);
  assert.equal(resolveLifecycle({ ...meal, confirmed: 1 }, new Date(startsAt(meal) - 1).toISOString()).cancelReason, "insufficient");
});
test("application rounds preserve withdrawals, reject declined reapplication and stop at deadline", () => {
  const first = newApplicationRound(meal, [], DEMO_NOW);
  assert.throws(() => newApplicationRound(meal, [first], DEMO_NOW));
  const second = newApplicationRound(meal, [{ ...first, state: "WITHDRAWN" }], DEMO_NOW);
  assert.notEqual(first.id, second.id);
  assert.throws(() => newApplicationRound(meal, [{ ...first, state: "DECLINED" }], DEMO_NOW));
  assert.throws(() => newApplicationRound(meal, [], new Date(closesAt(meal)).toISOString()));
});
test("critical edits lock after first approval, cancellation is host-only and pre-start", () => {
  assert.equal(criticalEditAllowed({ ...meal, confirmed: 1 }), true);
  assert.equal(criticalEditAllowed(meal), false);
  assert.throws(() => cancelWholeMeal({ ...meal, owned: false }, DEMO_NOW, "host"));
  assert.throws(() => cancelWholeMeal(meal, new Date(startsAt(meal)).toISOString(), "host"));
  const cancelled = cancelWholeMeal(meal, DEMO_NOW, "booking");
  assert.equal(cancelled.booking, meal.booking);
  assert.equal(cancelWholeMeal(cancelled, DEMO_NOW, "host"), cancelled);
});
test("chat departure is independent from participation and cancellation", () => {
  assert.equal(chatPermission(false), "locked");
  assert.equal(chatPermission(true), "write");
  assert.equal(chatPermission(true, { left: true }), "read-only");
  assert.equal(chatPermission(true, { closed: true }), "read-only");
});
test("self attendance wins, missing report stays unknown, feedback checks exact seven-day boundary", () => {
  const end = endsAt(meal);
  assert.equal(attendanceStatus(), "unknown");
  assert.equal(attendanceStatus({ host: "present" }), "present");
  assert.equal(attendanceStatus({ self: "absent", host: "present" }), "absent");
  assert.equal(reportWindow(end, new Date(end - 1).toISOString()), false);
  assert.equal(feedbackEligible(true, { self: "present" }, end, new Date(end).toISOString()), true);
  assert.equal(reportWindow(end, new Date(end + 7 * DAY).toISOString()), false);
  assert.equal(feedbackEligible(false, { self: "present" }, end, new Date(end).toISOString()), false);
});
test("meal experience requires explicit answers and connection revocation clears both consents", () => {
  assert.ok(validateExperience({ score: 4, again: null, reasons: [] }));
  assert.equal(validateExperience({ score: 4, again: false, reasons: [] }), "");
  assert.ok(validateExperience({ score: 4, again: true, reasons: ["invented"] }));
  const c = { mine: true, theirs: true };
  assert.equal(canMessage(c), true);
  assert.equal(canMessage(c, true), false);
  assert.equal(canMessage(revokeConnection()), false);
});

test("attendance correction on one meal preserves a connection backed by another", () => {
  const c = { mine: true, theirs: true, sourceMeal: "b", sourceMeals: ["a", "b"] };
  const records = { "a:alex": { self: "present" as const }, "a:maya": { self: "present" as const }, "b:alex": { self: "absent" as const }, "b:maya": { self: "present" as const } };
  assert.equal(connectionHasAttendance(c, "maya", records, { a: ["alex", "maya"], b: ["alex", "maya"] }), true);
  assert.equal(connectionHasAttendance(c, "emma", records, { a: ["alex", "maya"], b: ["alex", "maya"] }), false);
});
test("late deadline execution resolves missed cancellation without erasing a qualified started meal", () => {
  const now = new Date(startsAt(meal) + MINUTE).toISOString();
  const low = { ...meal, confirmed: 1 };
  assert.equal(resolveLifecycle(low, now).cancelledAt, new Date(closesAt(meal)).toISOString());
  assert.equal(resolveLifecycle({ ...low, formationCheckedAt: new Date(closesAt(meal)).toISOString() }, now).cancelledAt, undefined);
  assert.equal(criticalEditAllowed({ ...meal, confirmed: 1, arrangementsLocked: true }), false);
});
