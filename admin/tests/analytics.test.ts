import { dataChecks } from "../src/checks.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cleanEvents,
  londonDay,
  weekStart,
  attendance,
  ratio,
  summarize,
  cohorts,
  funnel,
  filterMeals,
  createFunnel,
  verifyAttendance,
} from "../src/analytics.ts";
import type { Dataset, Event, Meal } from "../src/analytics.ts";

const meal: Meal = {
  id: "m1",
  title: "Meal",
  startsAt: "2026-10-01T18:00:00Z",
  publishedAt: "2026-09-20T10:00:00Z",
  area: "Soho",
  language: "English",
  capacity: 4,
  minimum: 3,
  budget: 25,
  source: "user",
  hostId: "h",
  cancelled: false,
  peakConfirmed: 3,
};
const base: Dataset = {
  users: [
    { id: "u", joinedAt: "2026-09-01T10:00:00Z" },
    { id: "h", joinedAt: "2026-09-01T10:00:00Z" },
  ],
  meals: [meal],
  applications: [
    {
      id: "a",
      userId: "u",
      mealId: "m1",
      appliedAt: "2026-09-21T10:00:00Z",
      decidedAt: "2026-09-21T11:00:00Z",
      decision: "approved",
      confirmedAt: "2026-09-21T11:00:00Z",
    },
  ],
  attendance: [
    {
      userId: "u",
      mealId: "m1",
      host: "present",
      self: "present",
      updatedAt: "2026-10-02T10:00:00Z",
    },
  ],
  feedback: [],
  events: [],
};
const filters = {
  start: "2026-09-21",
  end: "2026-10-18",
  area: "all",
  source: "all",
  language: "all",
  size: "all",
  budget: "all",
  segment: "all",
};
test("zero denominator is unavailable, not zero percent", () => {
  assert.equal(ratio(0, 0), null);
  assert.equal(ratio(0, 2), 0);
});
test("London date boundaries respect British summer time and autumn transition", () => {
  assert.equal(londonDay("2026-10-24T23:30:00Z"), "2026-10-25");
  assert.equal(londonDay("2026-10-25T23:30:00Z"), "2026-10-25");
  assert.equal(weekStart("2026-10-18"), "2026-10-12");
});
test("attendance conflict, missing and explicit absence remain distinct", () => {
  assert.equal(attendance(undefined), "unknown");
  assert.equal(
    attendance({
      userId: "u",
      mealId: "m",
      host: "present",
      self: "absent",
      updatedAt: "",
    }),
    "conflict",
  );
  assert.equal(
    attendance({ userId: "u", mealId: "m", self: "absent", updatedAt: "" }),
    "absent",
  );
});
test("events deduplicate, exclude non-production/test/bot and join only explicit identities", () => {
  const event: Event = {
    id: "e1",
    name: "detail_view",
    occurredAt: "2026-10-01T10:00:00Z",
    receivedAt: "2026-10-01T10:01:00Z",
    anonymousId: "anon",
    sessionId: "s",
    environment: "production",
    appVersion: "1",
    schemaVersion: 1,
    mealId: "m1",
  };
  const events = cleanEvents(
    [
      event,
      event,
      { ...event, id: "e2", environment: "demo" },
      { ...event, id: "e3", isTest: true },
      { ...event, id: "e4", isBot: true },
      { ...event, id: "e5", isStaff: true },
    ],
    [{ anonymousId: "anon", sessionId: "s", userId: "u" }],
  );
  assert.equal(events.length, 1);
  assert.equal(events[0].userId, "u");
  assert.equal(
    cleanEvents(
      [{ ...event, sessionId: "different" }],
      [{ anonymousId: "anon", sessionId: "s", userId: "u" }],
    )[0].userId,
    undefined,
  );
});
test("late event availability uses received time, not just occurrence", () => {
  const e: Event = {
    id: "e",
    name: "detail_view",
    occurredAt: "2026-10-01T10:00:00Z",
    receivedAt: "2026-10-19T10:00:00Z",
    sessionId: "s",
    environment: "production",
    appVersion: "1",
    schemaVersion: 1,
  };
  assert.equal(cleanEvents([e], [], "2026-10-18T23:00:00Z").length, 0);
  assert.equal(cleanEvents([e], [], "2026-10-20T23:00:00Z").length, 1);
});
test("first application conversion waits for a complete 14-day observation", () => {
  const immature = {
    ...base,
    applications: [
      { ...base.applications[0], appliedAt: "2026-10-10T10:00:00Z" },
    ],
  };
  assert.equal(
    summarize(immature, filters, "2026-10-18T12:00:00Z").activation.denominator,
    0,
  );
  assert.equal(
    summarize(base, filters, "2026-10-18T12:00:00Z").activation.numerator,
    1,
  );
});
test("repeat cohorts exclude immature users and count same-meal duplicate attendance once", () => {
  const data = {
    ...base,
    attendance: [...base.attendance, ...base.attendance],
  };
  assert.equal(cohorts(data, filters, "2026-10-18T12:00:00Z")[0].mature, 0);
  const mature = cohorts(data, filters, "2026-11-05T12:00:00Z")[0];
  assert.equal(mature.mature, 1);
  assert.equal(mature.repeat, 0);
});
test("summary does not treat missing attendance as no-show or count attendance before snapshot", () => {
  assert.equal(
    summarize({ ...base, attendance: [] }, filters).attendance.unknown,
    2,
  );
  const future = {
    ...base,
    attendance: [{ ...base.attendance[0], updatedAt: "2026-10-19T10:00:00Z" }],
  };
  assert.equal(summarize(future, filters).attendance.present, 0);
});
test("filters propagate to meals and derived metrics; cancellations stay in formed denominator", () => {
  const data = {
    ...base,
    meals: [
      meal,
      { ...meal, id: "m2", area: "Camden", cancelled: true, peakConfirmed: 1 },
    ],
  };
  assert.equal(filterMeals(data, { ...filters, area: "Camden" }).length, 1);
  assert.equal(summarize(data, filters).formation.denominator, 2);
  assert.equal(
    summarize(data, { ...filters, area: "Camden" }).formation.numerator,
    0,
  );
});
test("funnel never approves an application from a different meal and duplicate events do not inflate users", () => {
  const ev: Event = {
    id: "e",
    name: "detail_view",
    occurredAt: "2026-09-21T09:00:00Z",
    receivedAt: "2026-09-21T09:00:00Z",
    sessionId: "s",
    userId: "u",
    environment: "production",
    appVersion: "1",
    schemaVersion: 1,
    mealId: "m1",
  };
  const data = {
    ...base,
    events: [ev, ev],
    applications: [{ ...base.applications[0], mealId: "other" }],
  };
  const f = funnel(data, filters);
  assert.equal(f.details, 1);
  assert.equal(f.applications, 0);
});
test("malformed events are quarantined and feedback is deduplicated by participation", () => {
  const e: Event = {
    id: "bad",
    name: "detail_view",
    occurredAt: "2026-10-01T10:00:00Z",
    receivedAt: "2026-10-01T10:00:00Z",
    sessionId: "",
    environment: "production",
    appVersion: "1",
    schemaVersion: 1,
  };
  assert.equal(cleanEvents([e]).length, 0);
  const r = {
    userId: "u",
    mealId: "m1",
    score: 5,
    again: true,
    issue: "none" as const,
    at: "2026-10-02T10:00:00Z",
  };
  assert.equal(
    summarize({ ...base, feedback: [r, r] }, filters).feedback.length,
    1,
  );
});
test("create funnel follows same attempt and user beyond selected entry dates", () => {
  const event: Event = {
    id: "start",
    name: "create_started",
    occurredAt: "2026-09-30T10:00:00Z",
    receivedAt: "2026-09-30T10:00:00Z",
    sessionId: "s",
    userId: "h",
    attemptId: "c",
    environment: "production",
    appVersion: "1",
    schemaVersion: 1,
    mealId: "m1",
  };
  const events = [
    event,
    {
      ...event,
      id: "arrange",
      name: "create_arranged",
      occurredAt: "2026-10-01T10:00:00Z",
      receivedAt: "2026-10-01T10:00:00Z",
    },
    {
      ...event,
      id: "publish",
      name: "meal_published",
      occurredAt: "2026-10-02T10:00:00Z",
      receivedAt: "2026-10-02T10:00:00Z",
    },
  ];
  assert.deepEqual(
    createFunnel({ ...base, events }, { ...filters, end: "2026-09-30" }),
    [1, 1, 1],
  );
  assert.deepEqual(
    createFunnel(
      {
        ...base,
        events: events.map((e) =>
          e.name === "meal_published" ? { ...e, userId: "other" } : e,
        ),
      },
      filters,
    ),
    [1, 1, 0],
  );
  assert.deepEqual(
    createFunnel(
      {
        ...base,
        events: events.map((e) =>
          e.name === "create_arranged" ? { ...e, userId: "other" } : e,
        ),
      },
      filters,
    ),
    [1, 0, 0],
  );
});
test("verified attendance retains evidence and recalculates, disallowing unconfirmed or cancelled participants", () => {
  const updated = verifyAttendance(
    { ...base, attendance: [] },
    "m1",
    "u",
    "present",
    "Checked with participant",
  );
  assert.equal(summarize(updated, filters).attendance.present, 1);
  assert.equal(base.attendance.length, 1);
  assert.throws(() =>
    verifyAttendance(base, "m1", "stranger", "present", "Checked"),
  );
  assert.throws(() =>
    verifyAttendance(
      { ...base, meals: [{ ...meal, cancelled: true }] },
      "m1",
      "u",
      "present",
      "Checked",
    ),
  );
  assert.throws(() => verifyAttendance(base, "m1", "u", "present", ""));
});

test("hand-calculated two-meal cohort reconciles outcomes, coverage and repeat participation", () => {
  const first = {
    ...meal,
    startsAt: "2026-09-01T18:00:00Z",
    publishedAt: "2026-08-18T10:00:00Z",
  };
  const second = {
    ...meal,
    id: "m2",
    startsAt: "2026-09-20T18:00:00Z",
    publishedAt: "2026-09-15T10:00:00Z",
  };
  const data: Dataset = {
    ...base,
    meals: [first, second],
    applications: [
      {
        ...base.applications[0],
        appliedAt: "2026-08-20T10:00:00Z",
        confirmedAt: "2026-08-21T10:00:00Z",
      },
      {
        ...base.applications[0],
        id: "a2",
        mealId: "m2",
        appliedAt: "2026-09-16T10:00:00Z",
        confirmedAt: "2026-09-17T10:00:00Z",
      },
    ],
    attendance: [
      {
        userId: "u",
        mealId: "m1",
        self: "present",
        updatedAt: "2026-09-02T10:00:00Z",
      },
      {
        userId: "h",
        mealId: "m1",
        self: "present",
        updatedAt: "2026-09-02T10:00:00Z",
      },
      {
        userId: "u",
        mealId: "m2",
        self: "present",
        updatedAt: "2026-09-21T10:00:00Z",
      },
    ],
  };
  const summary = summarize(data, { ...filters, start: "2026-08-01" });
  assert.deepEqual(summary.activation, { numerator: 1, denominator: 1 });
  assert.deepEqual(summary.retention, { numerator: 1, denominator: 2 });
  assert.deepEqual(summary.attendanceCoverage, {
    numerator: 3,
    denominator: 4,
  });
  assert.deepEqual(summary.attendance, {
    present: 3,
    absent: 0,
    unknown: 1,
    conflict: 0,
  });
  assert.equal(summary.attendedUsers, 2);
  assert.deepEqual(
    summary.weekly.map((w) => w.count),
    [2, 1],
  );
});

test("data checks follow current data, maturity and empty scope without claiming weekly agent advice", () => {
  assert.equal(
    dataChecks(summarize(base, filters), cohorts(base, filters)).at(-1)?.id,
    "observing",
  );
  const older = { ...filters, start: "2026-08-01" };
  assert.equal(
    dataChecks(
      summarize(base, older, "2026-11-18T12:00:00Z"),
      cohorts(base, older, "2026-11-18T12:00:00Z"),
    ).at(-1)?.id,
    "repeat",
  );
  const empty: Dataset = {
    users: [],
    meals: [],
    applications: [],
    attendance: [],
    feedback: [],
    events: [],
  };
  assert.deepEqual(dataChecks(summarize(empty, filters), []), [
    { id: "empty", numerator: 0, denominator: 0, target: "quality" },
  ]);
});

test("cohort drilldown members reconcile with every aggregate and preserve mature-only counts", () => {
  const rows = cohorts(base, filters, "2026-11-18T12:00:00Z");
  for (const row of rows) {
    assert.equal(row.members.length, row.total);
    assert.deepEqual(
      row.members.map((member) => member.userId),
      row.users,
    );
    assert.equal(
      row.members.filter((member) => member.mature).length,
      row.mature,
    );
    assert.equal(
      row.members.filter((member) => member.repeat).length,
      row.repeat,
    );
    assert.equal(
      row.members.filter((member) => member.opportunity).length,
      row.opportunity,
    );
  }
});

test("multi filters use OR within a dimension, AND across dimensions; language is membership", () => {
  const all = { ...base, meals: [meal, {...meal, id:"m2", area:"Camden", language:"中文 / English", budget:35, capacity:6}, {...meal,id:"m3",area:"Shoreditch",budget:50,capacity:2}] };
  assert.equal(filterMeals(all, {...filters, area:"Soho,Camden", size:"4,6"}).length,2);
  assert.equal(filterMeals(all, {...filters, language:"Chinese"}).length,1);
  assert.equal(filterMeals(all, {...filters, language:"English"}).length,3);
  assert.equal(filterMeals(all, {...filters, budget:"20-30,30-40"}).length,2);
  assert.equal(filterMeals(all, {...filters, area:"Camden", budget:"20-30"}).length,0);
});
test("budget bands form a complete non-overlapping partition", async () => {
  const {budgetBand} = await import("../src/analytics.ts");
  for (const [value, expected] of [[0,"0-20"],[20,"0-20"],[20.01,"20-30"],[30,"20-30"],[30.01,"30-40"],[40,"30-40"],[40.01,"40+"],[900,"40+"]] as const) assert.equal(budgetBand(value),expected);
  assert.equal(budgetBand(undefined),"unknown");
});
test("classified test users are excluded from facts, linked events and host meals; restoring regular restores history", () => {
  const ev: Event = {id:"e",name:"discovery_results",sessionId:"s",anonymousId:"anon",occurredAt:"2026-09-21T12:00:00Z",receivedAt:"2026-09-21T12:01:00Z",environment:"production",schemaVersion:1,appVersion:"1",resultCount:1};
  const classified: Dataset = {...base,users: base.users.map((u) => u.id === "u" ? {...u, accountType:"test"} : u),events:[ev],identityLinks:[{anonymousId:"anon",sessionId:"s",userId:"u"}]};
  assert.equal(summarize(classified,filters).attendance.present,0);
  assert.equal(funnel(classified,filters).applications,0);
  assert.equal(funnel(classified,filters).discovery,0);
  const host = {...base,users:base.users.map((u) => u.id === "h" ? {...u,accountType:"staff" as const} : u)};
  assert.equal(summarize(host,filters).formation.denominator,0);
  assert.equal(summarize(base,filters).attendance.present,1);
});
test("seat confirmation does not imply attendance and a not-ended meal has no report denominator", () => {
  const futureEnd = {...base,meals:[{...meal,endsAt:"2026-10-18T13:00:00Z"}]};
  assert.equal(funnel(futureEnd, filters).confirmed,1);
  assert.equal(summarize(futureEnd,filters).attendanceCoverage.denominator,0);
});

test("test members cannot make a host meal reach its minimum", () => {
  const duo = {...base, meals:[{...meal, capacity:2, minimum:2}], users:base.users.map((u) => u.id === "u" ? {...u,accountType:"test" as const} : u)};
  assert.equal(summarize(duo,filters).formation.numerator,0);
  assert.equal(summarize({...duo, users:base.users},filters).formation.numerator,1);
});
test("invalid discovery result counts are not silently added to the zero-result denominator", () => {
  const common: Event = {id:"valid",name:"discovery_results",sessionId:"s",userId:"u",occurredAt:"2026-09-21T12:00:00Z",receivedAt:"2026-09-21T12:01:00Z",environment:"production",schemaVersion:1,appVersion:"1",resultCount:0};
  const data = {...base,events:[common,{...common,id:"missing",resultCount:undefined},{...common,id:"negative",resultCount:-1}]};
  assert.deepEqual(summarize(data,filters).noResults,{numerator:1,denominator:1});
});
test("late seat confirmation cannot create eligible attendance", () => {
  const late = {...base,applications:base.applications.map((a) => ({...a,confirmedAt:"2026-10-02T12:00:00Z"}))};
  assert.equal(summarize(late,filters).attendance.present,0);
  assert.throws(() => verifyAttendance(late,"m1","u","present","Checked"));
});
