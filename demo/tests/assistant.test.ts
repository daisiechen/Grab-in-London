import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assistantReply,
  blankPreferences,
  parseMealRequest,
  helperExpired,
  HELPER_IDLE_MS,
  helperClock,
  helperDockPosition,
} from "../src/assistant.ts";
import { initialMeals, emptyFilters } from "../src/domain.ts";

const context = () => ({
  meals: initialMeals,
  filters: { ...emptyFilters },
  query: {},
  preferences: { ...blankPreferences },
  today: "2026-10-18",
});

test("helper expires on the 30-minute idle boundary, not while active", () => {
  assert.equal(helperExpired(null, 10_000_000), false);
  assert.equal(helperExpired(1_000, 1_000 + HELPER_IDLE_MS - 1), false);
  assert.equal(helperExpired(1_000, 1_000 + HELPER_IDLE_MS), true);
  assert.equal(
    helperExpired(1_000 + HELPER_IDLE_MS - 100, 1_000 + HELPER_IDLE_MS),
    false,
  );
});
test("helper timestamps use London time across daylight-saving seasons", () => {
  assert.equal(helperClock(Date.parse("2026-10-18T08:27:00Z")), "09:27");
  assert.equal(helperClock(Date.parse("2026-11-18T08:27:00Z")), "08:27");
});
test("dock placement clamps vertical ratios and keeps a 44px edge target", () => {
  assert.deepEqual(
    helperDockPosition({ side: "left", fraction: -1 }, 393, 224, 752, false),
    { x: 14, y: 224 },
  );
  assert.deepEqual(
    helperDockPosition({ side: "right", fraction: 2 }, 393, 224, 752, false),
    { x: 315, y: 678 },
  );
  assert.equal(
    helperDockPosition({ side: "right", fraction: 0.5 }, 427, 224, 852, true).x,
    383,
  );
  assert.equal(
    helperDockPosition({ side: "left", fraction: 0.5 }, 427, 224, 852, true).x,
    -20,
  );
  assert.equal(
    helperDockPosition({ side: "left", fraction: 1 }, 393, 224, 200, false).y,
    224,
  );
});

test("understands date, area, capacity and strict budget in English and Chinese", () => {
  assert.deepEqual(
    parseMealRequest("Friday evening in Soho, table for 4, £35", "2026-10-18"),
    {
      area: "Soho",
      budget: "35",
      size: "4",
      time: "dinner",
      date: "2026-10-23",
    },
  );
  const result = assistantReply(
    "周五晚上 Soho，预算35，四人，轻松一点",
    context(),
  );
  assert.deepEqual(
    result.meals?.map((m) => m.id),
    ["supper"],
  );
  assert.equal(result.query?.mood, "Easy conversation");
});
test("follow-up preserves prior constraints; explicit relaxation persists", () => {
  const c = context();
  c.preferences.area = "Soho";
  const first = assistantReply("Find meals under £30", c);
  const relaxed = assistantReply("any area", { ...c, query: first.query! });
  assert.equal(relaxed.query?.budget, "30");
  assert.equal(relaxed.query?.area, "");
  const next = assistantReply("compare meals", { ...c, query: relaxed.query! });
  assert.equal(next.query?.area, "");
  assert.ok(next.meals?.some((m) => m.id === "ramen"));
});
test("no match is honest and does not substitute expensive meals", () => {
  const reply = assistantReply("Find meals £10 in Soho", context());
  assert.equal(reply.meals?.length, 0);
  assert.match(reply.text, /No available tables/);
  assert.equal(reply.query?.budget, "10");
});
test("full, cancelled, past and owned meals cannot appear as joinable recommendations", () => {
  const base = initialMeals[0];
  const reply = assistantReply("find meals", {
    ...context(),
    meals: [
      { ...base, confirmed: base.capacity },
      { ...base, booking: "CANCELLED" },
      { ...base, date: "2026-10-17" },
      { ...base, owned: true },
    ],
  });
  assert.deepEqual(reply.meals, []);
});
test("active discovery filters are honored and can be relaxed in conversation", () => {
  const c = {
    ...context(),
    filters: { ...emptyFilters, area: "Soho", size: "4" },
  };
  const first = assistantReply("find meals", c);
  assert.ok(first.meals?.every((m) => m.area === "Soho" && m.capacity === 4));
  const clear = assistantReply("clear search", { ...c, query: first.query! });
  assert.ok(clear.meals!.length > first.meals!.length);
});
test("remember proposes changes without mutating preferences; dates are not remembered", () => {
  const c = context();
  const reply = assistantReply("Remember Soho, budget £35, Friday", c);
  assert.equal(c.preferences.area, "");
  assert.equal(reply.preferences?.area, "Soho");
  assert.equal(reply.preferences?.budget, "35");
  assert.ok(!("date" in reply.preferences!));
});
test("application needs an explicit meal and makes no claim about the user's background", () => {
  assert.equal(
    assistantReply("draft an application", {
      ...context(),
      current: { ...initialMeals[0], owned: true },
    }).draft,
    undefined,
  );
  assert.equal(
    assistantReply("draft an application", context()).draft,
    undefined,
  );
  const reply = assistantReply("draft an application", {
    ...context(),
    current: initialMeals[0],
  });
  assert.equal(reply.draft?.mealId, "supper");
  assert.equal(reply.draft?.kind, "application");
  assert.doesNotMatch(reply.draft!.text, /new to London|designer|researcher/);
});
test("coordination uses public meal facts only and is a draft", () => {
  const reply = assistantReply("draft a group message", {
    ...context(),
    current: initialMeals[0],
  });
  assert.equal(reply.draft?.kind, "message");
  assert.match(reply.draft!.text, /The Little Table/);
  assert.match(reply.text, /haven’t read/);
});
test("creation preserves the request without publishing or inventing stock", () => {
  const reply = assistantReply(
    "Create a dinner Friday for 4 in Soho",
    context(),
  );
  assert.equal(reply.draft?.kind, "create");
  assert.equal(reply.query?.date, "2026-10-23");
  assert.match(reply.text, /available time/);
});
test("financial, publishing and sending requests retain human confirmation", () => {
  for (const request of [
    "Publish now",
    "send it",
    "Pay now",
    "直接发送",
    "付款",
  ]) {
    const reply = assistantReply(request, context());
    assert.equal(reply.draft, undefined);
    assert.match(reply.text, /yourself/);
  }
});
test("cost explanation distinguishes payment, approval and booking", () => {
  const reply = assistantReply("explain costs", {
    ...context(),
    current: { ...initialMeals[0], booking: "FAILED" as const },
  });
  assert.match(reply.text, /£10/);
  assert.match(reply.text, /failed/);
  assert.match(reply.text, /not the restaurant/);
  assert.match(
    assistantReply("costs", { ...context(), current: initialMeals[1] }).text,
    /no payment is due/,
  );
});
test("unknown requests get a useful scope explanation", () => {
  const reply = assistantReply(
    "What do you think of my personality?",
    context(),
  );
  assert.equal(reply.meals, undefined);
  assert.equal(reply.preferences, undefined);
  assert.match(reply.text, /find or compare meals/);
});
test("dietary, cuisine and language requests are constraints, never guarantees", () => {
  const vegetarian = assistantReply("Find vegetarian meals", context());
  assert.ok(vegetarian.meals!.length > 0);
  assert.ok(
    vegetarian.meals!.every((m) => m.dietary?.includes("Vegetarian options")),
  );
  assert.deepEqual(assistantReply("Find vegan meals", context()).meals, []);
  assert.deepEqual(assistantReply("Find Sichuan meals", context()).meals, []);
  assert.deepEqual(assistantReply("Find Mandarin meals", context()).meals, []);
  assert.deepEqual(
    assistantReply("Find ramen meals", context()).meals?.map((m) => m.id),
    ["ramen"],
  );
});
test("unsupported areas and invalid dates ask for correction", () => {
  assert.equal(
    assistantReply("Find meals in Camden", context()).meals,
    undefined,
  );
  assert.match(
    assistantReply("Find meals 2026-02-30", context()).text,
    /isn’t valid/,
  );
});
