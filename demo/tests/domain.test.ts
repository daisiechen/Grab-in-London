import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initialMeals,
  eligibleMeals,
  applyToMeal,
  approveApplication,
  completePayment,
  refundAmount,
  groupReady,
  validateMeal,
} from "../src/domain.ts";
const meal = initialMeals[0];
test("apply, approval and payment are distinct; failure is recoverable", () => {
  const pending = applyToMeal(
    meal,
    "NONE",
    "I am new to London and would love to join.",
  );
  assert.equal(pending, "PENDING");
  const approved = approveApplication(meal, pending);
  assert.equal(approved, "APPROVED_PAYMENT_PENDING");
  const failed = completePayment(approved, "UNPAID", false);
  assert.equal(failed.join, approved);
  assert.equal(failed.payment, "FAILED");
  assert.deepEqual(completePayment(failed.join, failed.payment, true), {
    join: "CONFIRMED",
    payment: "PAID",
  });
});
test("repeated successful payment does not add another seat", () =>
  assert.deepEqual(completePayment("CONFIRMED", "PAID", true), {
    join: "CONFIRMED",
    payment: "PAID",
  }));
test("full, duplicate, incomplete profile and invalid applications rejected", () => {
  assert.throws(() =>
    applyToMeal(
      { ...meal, confirmed: 4 },
      "NONE",
      "An introduction of sufficient length.",
    ),
  );
  assert.throws(() =>
    applyToMeal(meal, "PENDING", "An introduction of sufficient length."),
  );
  assert.throws(() =>
    applyToMeal(meal, "NONE", "An introduction of sufficient length.", false),
  );
  assert.throws(() => applyToMeal(meal, "NONE", "short"));
  assert.throws(() => approveApplication({ ...meal, confirmed: 4 }, "PENDING"));
  assert.throws(() => completePayment("DECLINED", "UNPAID", true));
});
test("offline approval confirms without payment", () =>
  assert.equal(approveApplication(initialMeals[1], "PENDING"), "CONFIRMED"));
test("filters compose and zero results are recoverable", () => {
  assert.equal(
    eligibleMeals(initialMeals, {
      date: "2026-10-24",
      budget: "30",
      size: "duo",
    }).length,
    1,
  );
  assert.equal(
    eligibleMeals(initialMeals, { date: "2026-10-23", budget: "10", size: "" })
      .length,
    0,
  );
  assert.equal(
    eligibleMeals(initialMeals, { date: "", budget: "", size: "" }).length,
    4,
  );
});
test("refund respects event terms and platform cancellation", () => {
  assert.equal(refundAmount(10, true), 10);
  assert.equal(refundAmount(10, false), 0);
  assert.equal(refundAmount(35, false, true), 35);
});
test("three-person tables cannot silently become two-person groups", () => {
  assert.equal(groupReady(4, 2), false);
  assert.equal(groupReady(2, 2), true);
  assert.equal(groupReady(6, 3), true);
});
test("create validation rejects invalid size and inverted budget", () => {
  assert.ok(
    validateMeal(
      "Friday dinner",
      "A friendly dinner with new people.",
      1,
      20,
      30,
    ),
  );
  assert.ok(
    validateMeal(
      "Friday dinner",
      "A friendly dinner with new people.",
      4,
      40,
      20,
    ),
  );
  assert.equal(
    validateMeal(
      "Friday dinner",
      "A friendly dinner with new people.",
      2,
      20,
      30,
    ),
    "",
  );
});
