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
  groupMealsByArea,
  emptyFilters,
  googleMapsAreaUrl,
  monthDates,
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
    5,
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

test("map numbers count meals in an area, not table capacity", () => {
  const groups = groupMealsByArea(initialMeals);
  assert.equal(groups.find((g) => g.area === "Soho")?.meals.length, 2);
  assert.equal(
    groups.reduce((sum, g) => sum + g.meals.length, 0),
    initialMeals.length,
  );
  assert.equal(groups.find((g) => g.area === "Fitzrovia")?.meals.length, 1);
  const filtered = eligibleMeals(initialMeals, {
    ...emptyFilters,
    date: "2026-10-23",
  });
  assert.equal(
    groupMealsByArea(filtered).find((g) => g.area === "Soho")?.meals.length,
    1,
  );
});
test("exact table size and extended filters compose without losing other conditions", () => {
  assert.equal(
    eligibleMeals(initialMeals, { ...emptyFilters, size: "2" }).length,
    1,
  );
  assert.equal(
    eligibleMeals(initialMeals, {
      ...emptyFilters,
      area: "Soho",
      date: "2026-10-24",
      size: "5",
      budget: "35",
      language: "English",
      time: "dinner",
      cuisine: "European",
      dietary: "Vegetarian options",
    }).length,
    1,
  );
  assert.equal(
    eligibleMeals(initialMeals, { ...emptyFilters, language: "Mandarin" })
      .length,
    0,
  );
  assert.equal(
    eligibleMeals(initialMeals, {
      ...emptyFilters,
      cuisine: "Japanese",
      dietary: "Vegetarian options",
    }).length,
    0,
  );
  assert.equal(
    eligibleMeals(initialMeals, { ...emptyFilters, time: "lunch" }).length,
    1,
  );
});
test("a date without events yields no results; clearing it restores region events", () => {
  assert.equal(
    eligibleMeals(initialMeals, { ...emptyFilters, date: "2026-10-25" }).length,
    0,
  );
  assert.equal(
    eligibleMeals(initialMeals, { ...emptyFilters, area: "Soho" }).length,
    2,
  );
});
test("calendar dates have correct Monday-first alignment and month lengths", () => {
  const october = monthDates("2026-10");
  assert.equal(october.offset, 3);
  assert.equal(october.dates.length, 31);
  assert.equal(october.dates[22], "2026-10-23");
  assert.equal(monthDates("2028-02").dates.length, 29);
});
test("Google Maps link opens the neighbourhood without inventing a restaurant location", () => {
  const url = new URL(googleMapsAreaUrl("St James’s"));
  assert.equal(url.hostname, "www.google.com");
  assert.equal(url.searchParams.get("api"), "1");
  assert.equal(url.searchParams.get("query"), "St James’s, London");
});
