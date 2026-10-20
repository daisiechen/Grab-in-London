import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initialMeals,
  groupChatAccess,
  inboxStage,
  conversationPreview,
  validateDemoEmail,
  validateDemoCode,
  needsAccount,
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
  availableCreateSlots,
  plannedCreateSlots,
  validateArrangement,
  createDueNow,
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

const arrangement = {
  venue: "The Little Table",
  date: "2026-10-23",
  time: "19:00",
  capacity: 4,
  min: 25,
  max: 35,
  deposit: 10,
  cost: "deposit",
  booking: "in-app",
  externalConfirmed: false,
};
test("legacy sample availability remains separate from planned meal times", () => {
  assert.deepEqual(availableCreateSlots("Unknown", "2026-10-23", 4), []);
  assert.deepEqual(
    availableCreateSlots(arrangement.venue, "2026-10-19", 4),
    [],
  );
  assert.deepEqual(
    availableCreateSlots(arrangement.venue, "2026-11-16", 4),
    [],
  );
  assert.equal(validateArrangement(arrangement), "");
  assert.equal(validateArrangement({ ...arrangement, time: "18:30", capacity: 6 }), "");
  assert.equal(validateArrangement({ ...arrangement, venue: "The Garden Kitchen" }), "");
  assert.equal(plannedCreateSlots("2026-10-26", 6).length, 48);
  assert.equal(validateArrangement({ ...arrangement, time: "23:30" }), "");
  assert.ok(validateArrangement({ ...arrangement, time: "12:17" }));
  assert.equal(validateArrangement({ ...arrangement, capacity: 2 }), "");
});
test("create payment mode separates budget from amount due", () => {
  assert.equal(createDueNow(arrangement), 10);
  assert.equal(createDueNow({ ...arrangement, cost: "offline" }), 0);
  assert.equal(createDueNow({ ...arrangement, cost: "menu" }), 25);
  for (const deposit of [0, 26, NaN, 1.234])
    assert.match(
      validateArrangement({ ...arrangement, deposit }, "costs"),
      /deposit/,
    );
  assert.match(
    validateArrangement({ ...arrangement, max: 20 }, "costs"),
    /budget/,
  );
  assert.equal(
    validateArrangement({ ...arrangement, deposit: 12.5 }, "costs"),
    "",
  );
  assert.equal(
    validateArrangement({ ...arrangement, deposit: 0.29 }, "costs"),
    "",
  );
});
test("external reservation requires host attestation separate from slot selection", () => {
  assert.match(
    validateArrangement({ ...arrangement, booking: "external" }, "costs"),
    /Confirm your external/,
  );
  assert.equal(
    validateArrangement(
      { ...arrangement, booking: "external", externalConfirmed: true },
      "costs",
    ),
    "",
  );
});

test("demo email and one-time code validation preserve recoverable failure states", () => {
  for (const email of ["", "alex", "a b@example.com", "alex@domain"])
    assert.notEqual(validateDemoEmail(email), "");
  assert.equal(validateDemoEmail(" alex@example.com "), "");
  assert.notEqual(validateDemoCode("000000"), "");
  assert.notEqual(validateDemoCode("123456", true), "");
  assert.equal(validateDemoCode("123456"), "");
});
test("guests can discover tables but participation needs an account", () => {
  for (const page of ["discover", "detail", "member"])
    assert.equal(needsAccount(page), false);
  for (const page of [
    "create",
    "apply",
    "profile",
    "meals",
    "inbox",
    "checkout",
  ])
    assert.equal(needsAccount(page), true);
});

test("Inbox tracks pending applications without granting premature chat access", () => {
  assert.equal(inboxStage(meal, "NONE"), "none");
  assert.equal(inboxStage(meal, "PENDING"), "approval");
  const approval = approveApplication(meal, "PENDING");
  assert.equal(inboxStage(meal, approval), "payment");
  const failed = completePayment(approval, "UNPAID", false);
  assert.equal(inboxStage(meal, failed.join), "payment");
  const paid = completePayment(failed.join, failed.payment, true);
  assert.equal(inboxStage(meal, paid.join), "chat");
  for (const state of ["DECLINED", "WITHDRAWN", "CANCELLED"] as const)
    assert.equal(inboxStage(meal, state), "none");
});
test("offline approval opens group directly and hosts can open their own group", () => {
  const offline = { ...meal, deposit: 0 };
  assert.equal(
    inboxStage(offline, approveApplication(offline, "PENDING")),
    "chat",
  );
  assert.equal(inboxStage({ ...meal, owned: true }), "chat");
});
test("Inbox previews use the correct host, latest sent message and privacy setting", () => {
  assert.match(conversationPreview(initialMeals[1], []), /^Leo:/);
  assert.equal(
    conversationPreview(meal, ["First", "See you soon"]),
    "You: See you soon",
  );
  assert.equal(
    conversationPreview(meal, ["Private contents"], false),
    "Message previews are hidden",
  );
  assert.equal(needsAccount("settings"), true);
});

test("group admission requires host-approved confirmed membership, not restaurant booking", () => {
  for (const state of [
    "NONE",
    "PENDING",
    "DECLINED",
    "WITHDRAWN",
    "APPROVED_PAYMENT_PENDING",
    "CANCELLED",
  ] as const)
    assert.equal(
      groupChatAccess({ ...meal, booking: "CONFIRMED" }, state),
      "locked",
    );
  assert.equal(
    groupChatAccess({ ...meal, booking: "PENDING" }, "CONFIRMED"),
    "write",
  );
  assert.equal(
    groupChatAccess({ ...meal, booking: "FAILED" }, "CONFIRMED"),
    "write",
  );
  assert.equal(groupChatAccess({ ...meal, owned: true }, "NONE"), "write");
});
test("only admitted guests keep chatting after participation or reservation cancellation", () => {
  assert.equal(groupChatAccess(meal, "CANCELLED", true), "write");
  assert.equal(groupChatAccess(meal, "CANCELLED", false), "locked");
  assert.equal(inboxStage(meal, "CANCELLED", true), "chat");
  assert.equal(inboxStage(meal, "CANCELLED", false), "none");
  assert.equal(groupChatAccess(meal, "PENDING", true), "write");
  assert.equal(
    groupChatAccess(meal, "CONFIRMED", true, "CANCELLED"),
    "write",
  );
});

import { isReviewMode } from "../src/presentation.ts";
import { BRAND } from "../src/brand.ts";
test("product presentation defaults to clean Fancy branding; review tools require explicit opt-in", () => {
  assert.equal(BRAND.wordmark, "Fancy");
  for (const query of ["", "?review=0", "?review=true", "?preview=1"])
    assert.equal(isReviewMode(query), false);
  assert.equal(isReviewMode("?review=1"), true);
  assert.equal(isReviewMode("?device=pixel&review=1"), true);
});

import {
  settleSeatPayment,
  addConfirmedMember,
  bookingStatusLabel,
  blockedMemberIds,
} from "../src/domain.ts";
test("seat payment preserves every independent restaurant state", () => {
  for (const booking of ["PENDING", "CONFIRMED", "FAILED"] as const) {
    assert.deepEqual(
      settleSeatPayment("APPROVED_PAYMENT_PENDING", "UNPAID", true, booking),
      { join: "CONFIRMED", payment: "PAID", booking },
    );
    assert.deepEqual(
      settleSeatPayment("APPROVED_PAYMENT_PENDING", "UNPAID", false, booking),
      { join: "APPROVED_PAYMENT_PENDING", payment: "FAILED", booking },
    );
  }
});
test("confirming guests is idempotent and cannot overbook a table", () => {
  const next = addConfirmedMember(meal, "alex");
  assert.equal(next.confirmed, meal.confirmed + 1);
  assert.equal(addConfirmedMember(next, "alex"), next);
  assert.throws(() => addConfirmedMember(next, "new-person"), /full/);
  assert.equal(next.members.filter((id) => id === "alex").length, 1);
});
test("reservation copy distinguishes failed and cancelled states", () => {
  assert.equal(bookingStatusLabel("FAILED"), "Reservation needs attention");
  assert.equal(bookingStatusLabel("CANCELLED"), "Reservation cancelled");
});
test("blocking a member does not mark other members blocked", () => {
  assert.deepEqual(blockedMemberIds({ emma: true, maya: false }), ["emma"]);
  assert.deepEqual(blockedMemberIds({ emma: true, maya: true }), [
    "emma",
    "maya",
  ]);
  assert.deepEqual(blockedMemberIds({ emma: false }), []);
});
test("authentication errors contain product copy rather than prototype guidance", () => {
  for (const error of [
    validateDemoCode("000000"),
    validateDemoCode("123456", true),
  ]) {
    assert.doesNotMatch(error, /demo|123456|prototype/i);
    assert.ok(error.length > 10);
  }
});

test("currency inputs reject fractions smaller than one penny", () => {
  const arrangement = {
    venue: "The Little Table",
    date: "2026-10-23",
    time: "19:00",
    capacity: 4,
    min: 25,
    max: 35,
    cost: "menu",
    deposit: 10,
    booking: "in-app",
    externalConfirmed: false,
  };
  assert.match(
    validateArrangement({ ...arrangement, min: 25.001 }, "costs"),
    /two decimals/,
  );
  assert.match(
    validateArrangement({ ...arrangement, max: 35.001 }, "costs"),
    /two decimals/,
  );
  assert.equal(
    validateArrangement({ ...arrangement, min: 25.01 }, "costs"),
    "",
  );
});

import { mealInCategory } from "../src/domain.ts";
test("cancelled participation has its own category and cannot appear as upcoming", () => {
  assert.equal(mealInCategory(meal, "CANCELLED", "Upcoming"), false);
  assert.equal(mealInCategory(meal, "CANCELLED", "Cancelled"), true);
  assert.equal(mealInCategory(meal, "CONFIRMED", "Upcoming"), true);
  assert.equal(mealInCategory(meal, "PENDING", "Applications"), true);
  assert.equal(
    mealInCategory({ ...meal, owned: true }, "NONE", "Hosting"),
    true,
  );
  assert.equal(mealInCategory(meal, "PENDING", "Hosting"), false);
});

import { reservationNeedsUpdate } from "../src/domain.ts";
test("hosts can update a confirmed reservation when confirmed guest count changes", () => {
  assert.equal(reservationNeedsUpdate("CONFIRMED", 3, 4), true);
  assert.equal(reservationNeedsUpdate("CONFIRMED", 4, 3), true);
  assert.equal(reservationNeedsUpdate("CONFIRMED", 4, 4), false);
  assert.equal(reservationNeedsUpdate("PENDING", 0, 3), false);
});

test("cancelled meals reject payment before any seat is confirmed", () => {
  assert.throws(
    () =>
      settleSeatPayment(
        "APPROVED_PAYMENT_PENDING",
        "UNPAID",
        true,
        "CANCELLED",
      ),
    /cancelled/,
  );
});

import { alternativeReservationSlot } from "../src/domain.ts";
test("failed reservation alternatives respect restaurant hours and party size", () => {
  const lunch = { ...initialMeals[3], confirmed: 2 };
  assert.equal(alternativeReservationSlot(lunch), "13:00");
  assert.equal(
    alternativeReservationSlot({ ...lunch, time: "13:00" }),
    "12:00",
  );
  assert.equal(
    alternativeReservationSlot({ ...lunch, date: "2026-10-19" }),
    "",
  );
  assert.equal(alternativeReservationSlot({ ...meal, confirmed: 4 }), "19:30");
});

import { selectedDates, toggleDate } from "../src/domain.ts";
test("discovery dates toggle independently and combine with OR inside the filter intersection", () => {
  const dates = toggleDate(toggleDate("", "2026-10-23"), "2026-10-24");
  assert.deepEqual(selectedDates(dates), ["2026-10-23", "2026-10-24"]);
  assert.equal(toggleDate(dates, "2026-10-23"), "2026-10-24");
  const matches = eligibleMeals(initialMeals, { ...emptyFilters, date: dates });
  assert.ok(matches.some((m) => m.date === "2026-10-23"));
  assert.ok(matches.some((m) => m.date === "2026-10-24"));
  assert.deepEqual(eligibleMeals(initialMeals, { ...emptyFilters, date: "2026-11-30" }), []);
});

import { restaurantChoice, restaurantMapsUrl, validateRestaurant } from "../src/domain.ts";
test("map selection is required; manual restaurant records cannot be published", () => {
  const sample = restaurantChoice("The Little Table")!;
  const manual = { name: "Dockside Kitchen", address: "25 Test Road, London", area: "Canary Wharf", source: "manual" as const };
  assert.equal(validateRestaurant(sample), "");
  assert.equal(restaurantChoice("Unknown"), null);
  const draft = { restaurant: manual, venue: manual.name, date: "2026-10-23", time: "19:00", capacity: 4, min: 25, max: 35, cost: "offline", deposit: 0, booking: "external", externalConfirmed: true };
  assert.match(validateArrangement(draft, "costs"), /from the map/);
  assert.deepEqual(availableCreateSlots(manual.name, draft.date, 4), []);
  const url = new URL(restaurantMapsUrl(sample));
  assert.equal(url.origin, "https://www.google.com");
  assert.equal(url.searchParams.get("query"), `${sample.name}, ${sample.address}`);
});
