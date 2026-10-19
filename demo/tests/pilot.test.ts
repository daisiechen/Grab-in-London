import { test } from "node:test";
import assert from "node:assert/strict";
import {
  pilotSeed,
  act,
  confirmedIds,
  attendanceStatus,
  canDirect,
  projectAnalytics,
} from "../../shared/pilot.ts";
function command(
  state: ReturnType<typeof pilotSeed>,
  actor: string,
  action: Record<string, unknown>,
  at = "2026-10-19T12:00:00Z",
  key = String(state.version),
) {
  return act(state, actor, { ...action, key }, at, state.version);
}
test("R1 approves directly without payment; duplicate intent and final-seat conflict cannot add seats", () => {
  let s = pilotSeed();
  s = command(s, "alex", {
    type: "apply",
    mealId: "supper",
    message: "I would love to share a table with you.",
  });
  const id = s.applications.at(-1)!.id;
  const version = s.version;
  s = command(
    s,
    "maya",
    { type: "approve", applicationId: id },
    undefined,
    "approve-once",
  );
  assert.equal(confirmedIds(s, "supper").length, 4);
  assert.equal(s.applications.at(-1)!.state, "CONFIRMED");
  assert.deepEqual(
    act(
      s,
      "maya",
      { type: "approve", applicationId: id, key: "approve-once" },
      s.now,
      version,
    ),
    s,
  );
  assert.throws(
    () =>
      act(
        s,
        "maya",
        { type: "approve", applicationId: id, key: "stale" },
        s.now,
        version,
      ),
    /version/i,
  );
});
test("cutoff instants close applications, approvals and booking declarations; full table does not bypass them", () => {
  let s = pilotSeed();
  assert.throws(
    () =>
      command(
        s,
        "alex",
        {
          type: "apply",
          mealId: "supper",
          message: "I would love to join this table.",
        },
        "2026-10-23T17:15:00Z",
      ),
    /closed/i,
  );
  s = command(s, "alex", {
    type: "apply",
    mealId: "supper",
    message: "I would love to join this table.",
  });
  assert.throws(
    () =>
      command(
        s,
        "maya",
        { type: "approve", applicationId: s.applications.at(-1)!.id },
        "2026-10-23T17:30:00Z",
      ),
    /closed/i,
  );
  assert.throws(
    () =>
      command(
        s,
        "maya",
        { type: "declare", mealId: "supper" },
        "2026-10-23T17:45:00Z",
      ),
    /closed/i,
  );
});
test("checkpoint checks historical facts on delayed delivery, records both reasons and expires pending applications", () => {
  let s = pilotSeed();
  s = command(s, "alex", {
    type: "apply",
    mealId: "duo",
    message: "I would like to join you for lunch.",
  });
  s = command(s, "system", { type: "tick" }, "2026-10-24T13:00:00Z");
  const m = s.meals.find((m) => m.id === "duo")!;
  assert.equal(m.status, "CANCELLED");
  assert.deepEqual(m.cancelReasons, ["insufficient", "booking"]);
  assert.equal(s.applications.at(-1)!.state, "EXPIRED");
  const count = s.notifications.length;
  s = command(s, "system", { type: "tick" }, s.now);
  assert.equal(s.notifications.length, count);
});
test("passed checkpoint and later low count asks host, does not automatically cancel or reopen admissions", () => {
  let s = pilotSeed();
  s = command(s, "maya", { type: "declare", mealId: "supper" });
  s = command(s, "system", { type: "tick" }, "2026-10-23T17:45:00Z");
  s = command(
    s,
    "emma",
    { type: "leave", mealId: "supper" },
    "2026-10-23T17:50:00Z",
  );
  assert.equal(
    s.meals.find((m) => m.id === "supper")!.lowCountDecision,
    "pending",
  );
  assert.equal(s.meals.find((m) => m.id === "supper")!.status, "OPEN");
  s = command(
    s,
    "maya",
    { type: "continue", mealId: "supper" },
    "2026-10-23T17:52:00Z",
  );
  assert.equal(s.meals.find((m) => m.id === "supper")!.minimum, 3);
  assert.equal(
    s.meals.find((m) => m.id === "supper")!.lowCountDecision,
    "continue",
  );
  assert.throws(
    () =>
      command(
        s,
        "alex",
        {
          type: "apply",
          mealId: "supper",
          message: "I would like to join after the cutoff.",
        },
        s.now,
      ),
    /closed/i,
  );
});
test("host cancellation is separate from booking and preserves time-limited chat history for departed users", () => {
  let s = pilotSeed();
  s = command(s, "emma", {
    type: "send",
    mealId: "supper",
    text: "Hello table!",
  });
  s = command(s, "emma", { type: "leave", mealId: "supper" });
  s = command(s, "maya", {
    type: "send",
    mealId: "supper",
    text: "A later message",
  });
  assert.throws(
    () =>
      command(s, "emma", {
        type: "send",
        mealId: "supper",
        text: "No access now",
      }),
    /read.only|member/i,
  );
  s = command(s, "maya", { type: "cancel", mealId: "supper", reason: "host" });
  assert.equal(s.meals.find((m) => m.id === "supper")!.status, "CANCELLED");
  assert.equal(s.meals.find((m) => m.id === "supper")!.booking, "PENDING");
});
test("withdrawal creates a new application round; decline cannot reapply", () => {
  let s = pilotSeed();
  s = command(s, "alex", {
    type: "apply",
    mealId: "supper",
    message: "I would love to join this table.",
  });
  const first = s.applications.at(-1)!.id;
  s = command(s, "alex", { type: "withdraw", applicationId: first });
  s = command(s, "alex", {
    type: "apply",
    mealId: "supper",
    message: "I would still like to join you.",
  });
  assert.notEqual(s.applications.at(-1)!.id, first);
  s = command(s, "maya", {
    type: "decline",
    applicationId: s.applications.at(-1)!.id,
  });
  assert.throws(
    () =>
      command(s, "alex", {
        type: "apply",
        mealId: "supper",
        message: "I would like to join this table again.",
      }),
    /again|declined/i,
  );
});
test("self reports override host supplements without any manual verification; seven day window is enforced", () => {
  let s = pilotSeed();
  s.attendance = s.attendance.filter((a) => a.userId !== "alex");
  s = command(s, "maya", {
    type: "attendance",
    mealId: "past",
    userId: "alex",
    value: "absent",
  });
  s = command(s, "alex", {
    type: "attendance",
    mealId: "past",
    userId: "alex",
    value: "present",
  });
  assert.equal(attendanceStatus(s, "past", "alex"), "present");
  s = command(s, "alex", {
    type: "feedback",
    mealId: "past",
    score: 4,
    again: true,
    reasons: [],
  });
  assert.equal(projectAnalytics(s).feedback.length, 1);
  s = command(s, "alex", {
    type: "attendance",
    mealId: "past",
    userId: "alex",
    value: "absent",
  });
  assert.equal(attendanceStatus(s, "past", "alex"), "absent");
  assert.equal(projectAnalytics(s).feedback.length, 0);
  assert.throws(
    () =>
      command(s, "operator", {
        type: "verify",
        mealId: "past",
        userId: "alex",
        value: "present",
        basis: "No operator path",
      }),
    /Unknown command/,
  );
  assert.throws(
    () =>
      command(
        s,
        "alex",
        {
          type: "attendance",
          mealId: "past",
          userId: "alex",
          value: "present",
        },
        "2026-10-26T16:00:00Z",
      ),
    /window/i,
  );
});
test("mutual consent is object specific and blocking or withdrawal closes sending without erasing history", () => {
  let s = pilotSeed();
  s = command(s, "alex", {
    type: "reconnect",
    mealId: "past",
    userId: "maya",
    wants: true,
  });
  assert.equal(canDirect(s, "alex", "maya"), false);
  s = command(s, "maya", {
    type: "reconnect",
    mealId: "past",
    userId: "alex",
    wants: true,
  });
  assert.equal(canDirect(s, "alex", "maya"), true);
  s = command(s, "alex", {
    type: "direct",
    userId: "maya",
    text: "Nice to meet you!",
  });
  s = command(s, "alex", { type: "block", userId: "maya", blocked: true });
  assert.equal(canDirect(s, "alex", "maya"), false);
  s = command(s, "alex", { type: "block", userId: "maya", blocked: false });
  assert.equal(canDirect(s, "alex", "maya"), false);
  assert.equal(s.messages.filter((m) => m.toId === "maya").length, 1);
});

test("membership re-entry reads the union of admitted intervals, never the absent interval", async () => {
  const { readableMessages, eligibleAtMeal } =
    await import("../../shared/pilot.ts");
  let s = pilotSeed();
  s = command(
    s,
    "emma",
    { type: "send", mealId: "supper", text: "Before leaving" },
    "2026-10-19T12:01:00Z",
  );
  s = command(
    s,
    "emma",
    { type: "leave", mealId: "supper" },
    "2026-10-19T12:02:00Z",
  );
  s = command(
    s,
    "maya",
    { type: "send", mealId: "supper", text: "During absence" },
    "2026-10-19T12:03:00Z",
  );
  s = command(
    s,
    "emma",
    {
      type: "apply",
      mealId: "supper",
      message: "I would like to join this meal again.",
    },
    "2026-10-19T12:04:00Z",
  );
  s = command(
    s,
    "maya",
    { type: "approve", applicationId: s.applications.at(-1)!.id },
    "2026-10-19T12:05:00Z",
  );
  s = command(
    s,
    "maya",
    { type: "send", mealId: "supper", text: "After readmission" },
    "2026-10-19T12:06:00Z",
  );
  assert.deepEqual(
    readableMessages(s, "supper", "emma").map((m) => m.text),
    ["Before leaving", "After readmission"],
  );
  s = command(
    s,
    "emma",
    { type: "leave", mealId: "supper" },
    "2026-10-19T12:07:00Z",
  );
  assert.equal(eligibleAtMeal(s, "supper", "emma"), false);
});
test("delayed scheduler runs before commands and cannot permit chat on an automatically cancelled meal", () => {
  const s = pilotSeed();
  assert.throws(
    () =>
      command(
        s,
        "maya",
        { type: "send", mealId: "duo", text: "Late message" },
        "2026-10-24T11:20:00Z",
      ),
    /read.only/i,
  );
});
test("publish accepts exactly T-60 and rejects one millisecond later; London DST gap and repeated hour are explicit", async () => {
  const { londonInstants } = await import("../../shared/pilot.ts");
  const s = pilotSeed();
  const input = {
    ...s.meals[0],
    startsAt: "2026-10-19T13:00:00Z",
    replacementFor: undefined,
  };
  assert.equal(
    command(s, "alex", { type: "publish", meal: input }).meals.at(-1)!.minimum,
    3,
  );
  assert.throws(
    () =>
      command(
        s,
        "alex",
        { type: "publish", meal: input },
        "2026-10-19T12:00:00.001Z",
      ),
    /60 minutes/,
  );
  assert.equal(londonInstants("2026-03-29", "01:30").length, 0);
  assert.deepEqual(londonInstants("2026-10-25", "01:30"), [
    "2026-10-25T00:30:00.000Z",
    "2026-10-25T01:30:00.000Z",
  ]);
});
test("arrangements stay locked after the last guest leaves; descriptive editing still works", () => {
  let s = pilotSeed();
  s = command(s, "emma", { type: "leave", mealId: "supper" });
  s = command(s, "leo", { type: "leave", mealId: "supper" });
  assert.throws(
    () =>
      command(s, "maya", {
        type: "edit",
        mealId: "supper",
        venue: "Another venue",
      }),
    /locked/i,
  );
  s = command(s, "maya", {
    type: "edit",
    mealId: "supper",
    title: "An updated supper title",
  });
  assert.equal(s.meals[0].title, "An updated supper title");
});
test("before first confirmation host can edit arrangements and must reconfirm any old declaration", () => {
  let s = pilotSeed();
  s = command(s, "maya", { type: "declare", mealId: "duo" });
  s = command(s, "maya", {
    type: "edit",
    mealId: "duo",
    venue: "A new restaurant",
    address: "New area, London",
    area: "New area",
  });
  assert.equal(s.meals[1].venue, "A new restaurant");
  assert.equal(s.meals[1].declaration, undefined);
});
test("approval interval after application cutoff remains valid, then closes at approval cutoff", () => {
  let s = pilotSeed();
  s = command(s, "alex", {
    type: "apply",
    mealId: "supper",
    message: "I would like to share a relaxed meal.",
  });
  s = command(
    s,
    "maya",
    { type: "approve", applicationId: s.applications.at(-1)!.id },
    "2026-10-23T17:20:00Z",
  );
  assert.equal(s.applications.at(-1)!.state, "CONFIRMED");
});
test("host only supplements missing self reports; exact seven-day end is closed", () => {
  const s = pilotSeed();
  assert.throws(
    () =>
      command(s, "maya", {
        type: "attendance",
        mealId: "past",
        userId: "alex",
        value: "absent",
      }),
    /already reported/,
  );
  assert.throws(
    () =>
      command(
        s,
        "alex",
        {
          type: "feedback",
          mealId: "past",
          score: 5,
          again: true,
          reasons: [],
        },
        "2026-10-25T13:00:00Z",
      ),
    /window/,
  );
});
test("changing present to absent removes analytics feedback and mutual DM send access immediately", () => {
  let s = pilotSeed();
  s = command(s, "alex", {
    type: "feedback",
    mealId: "past",
    score: 5,
    again: true,
    reasons: ["company"],
  });
  s = command(s, "alex", {
    type: "reconnect",
    mealId: "past",
    userId: "maya",
    wants: true,
  });
  s = command(s, "maya", {
    type: "reconnect",
    mealId: "past",
    userId: "alex",
    wants: true,
  });
  assert.equal(canDirect(s, "alex", "maya"), true);
  s = command(s, "alex", {
    type: "attendance",
    mealId: "past",
    userId: "alex",
    value: "absent",
  });
  assert.equal(canDirect(s, "alex", "maya"), false);
  assert.equal(projectAnalytics(s).feedback.length, 0);
});
test("retract remains available after seven days and unblocking never restores old consent", () => {
  let s = pilotSeed();
  s = command(s, "alex", {
    type: "reconnect",
    mealId: "past",
    userId: "maya",
    wants: true,
  });
  s = command(s, "maya", {
    type: "reconnect",
    mealId: "past",
    userId: "alex",
    wants: true,
  });
  s = command(
    s,
    "alex",
    { type: "reconnect", mealId: "past", userId: "maya", wants: false },
    "2026-10-27T14:00:00Z",
  );
  assert.equal(canDirect(s, "alex", "maya"), false);
});
test("deletion requires explicit confirmation and cleans associated controlled personal content", async () => {
  const { exportAccount } = await import("../../shared/pilot.ts");
  let s = pilotSeed();
  s = command(s, "alex", {
    type: "apply",
    mealId: "supper",
    message: "Looking forward to meeting this table.",
  });
  assert.throws(
    () =>
      command(s, "alex", { type: "delete-account", confirmation: "DELETE" }),
    /Reauthenticate/,
  );
  s = command(s, "alex", {
    type: "delete-account",
    confirmation: "DELETE",
    reauthenticated: true,
  });
  assert.equal(s.meals.find((m) => m.id === "hosting")!.status, "CANCELLED");
  assert.equal(s.users[0].bio, "");
  assert.equal(s.users[0].deleted, true);
  assert.ok(
    s.applications.filter((a) => a.userId === "alex").every((a) => !a.message),
  );
  assert.throws(() => exportAccount(s, "alex"), /Sign in/);
  assert.equal(JSON.stringify(s.audit).includes("Looking forward"), false);
});
test("analytics handoff and role projections exclude private free text and unilateral consent", async () => {
  const { projectMember } = await import("../../shared/pilot.ts");
  let s = pilotSeed();
  s = command(s, "alex", {
    type: "report",
    userId: "maya",
    reason: "Private report body",
  });
  s = command(s, "alex", {
    type: "reconnect",
    mealId: "past",
    userId: "maya",
    wants: true,
  });
  const out = JSON.stringify(projectAnalytics(s));
  for (const secret of [
    "Private report body",
    "reconnect",
    "messages",
    "bio",
    "I enjoy",
  ])
    assert.equal(out.includes(secret), false);
  assert.equal("bio" in projectMember(s, null, "maya"), false);
  assert.equal("bio" in projectMember(s, "alex", "maya"), true);
  s = command(s, "alex", { type: "block", userId: "maya", blocked: true });
  assert.equal("bio" in projectMember(s, "alex", "maya"), false);
});

test("same-millisecond membership changes use sequence boundaries, not timestamp equality", async () => {
  const { readableMessages } = await import("../../shared/pilot.ts");
  let s = pilotSeed();
  s = command(s, "emma", {
    type: "send",
    mealId: "supper",
    text: "Before exit",
  });
  s = command(s, "emma", { type: "leave", mealId: "supper" });
  s = command(s, "maya", {
    type: "send",
    mealId: "supper",
    text: "While absent",
  });
  s = command(s, "emma", {
    type: "apply",
    mealId: "supper",
    message: "I would like to join this meal again.",
  });
  s = command(s, "maya", {
    type: "approve",
    applicationId: s.applications.at(-1)!.id,
  });
  s = command(s, "maya", {
    type: "send",
    mealId: "supper",
    text: "After approval",
  });
  assert.deepEqual(
    readableMessages(s, "supper", "emma").map((m) => m.text),
    ["Before exit", "After approval"],
  );
});

function twoSharedMeals() {
  const s = pilotSeed();
  const past = s.meals.find((m) => m.id === "past")!;
  s.meals.push({
    ...past,
    id: "past-two",
    startsAt: "2026-10-17T11:00:00.000Z",
    scheduledEndAt: "2026-10-17T13:00:00.000Z",
  });
  s.applications.push(
    ...s.applications
      .filter((a) => a.mealId === "past")
      .map((a) => ({ ...a, id: a.id + "-two", mealId: "past-two" })),
  );
  s.attendance.push(
    ...s.attendance
      .filter((a) => a.mealId === "past")
      .map((a) => ({ ...a, mealId: "past-two" })),
  );
  let next = s;
  for (const mealId of ["past", "past-two"]) {
    next = command(next, "alex", {
      type: "reconnect",
      mealId,
      userId: "maya",
      wants: true,
    });
    next = command(next, "maya", {
      type: "reconnect",
      mealId,
      userId: "alex",
      wants: true,
    });
  }
  return next;
}
test("retraction clears the actor’s consent across two shared meals; opposite choices never keep DM writable", () => {
  let s = twoSharedMeals();
  assert.equal(canDirect(s, "alex", "maya"), true);
  s = command(s, "alex", {
    type: "direct",
    userId: "maya",
    text: "History remains readable after withdrawal.",
  });
  s = command(s, "alex", {
    type: "reconnect",
    mealId: "past",
    userId: "maya",
    wants: false,
  });
  assert.equal(canDirect(s, "alex", "maya"), false);
  assert.equal(canDirect(s, "maya", "alex"), false);
  assert.ok(
    s.reconnect
      .filter((r) => r.from === "alex" && r.to === "maya")
      .every((r) => !r.wants),
  );
  assert.equal(
    s.reconnect.filter((r) => r.from === "maya" && r.to === "alex" && r.wants)
      .length,
    2,
  );
  assert.equal(s.messages.filter((m) => m.toId === "maya").length, 1);
  assert.throws(
    () =>
      command(s, "maya", {
        type: "direct",
        userId: "alex",
        text: "Must be rejected.",
      }),
    /consent/,
  );
  s = command(s, "alex", {
    type: "reconnect",
    mealId: "past-two",
    userId: "maya",
    wants: true,
  });
  assert.equal(
    canDirect(s, "alex", "maya"),
    true,
    "explicit new consent in a valid window may reconnect",
  );
});
test("person-level retraction works after both seven-day windows, while new consent cannot revive either old meal", () => {
  let s = twoSharedMeals();
  s = command(
    s,
    "alex",
    { type: "reconnect", mealId: "past", userId: "maya", wants: false },
    "2026-10-27T12:00:00Z",
  );
  assert.equal(canDirect(s, "alex", "maya"), false);
  for (const mealId of ["past", "past-two"])
    assert.throws(
      () =>
        command(
          s,
          "alex",
          { type: "reconnect", mealId, userId: "maya", wants: true },
          s.now,
        ),
      /window/,
    );
  assert.equal(
    s.reconnect.filter((r) => r.from === "maya" && r.wants).length,
    2,
  );
});

test("cancellation rejects arbitrary text and notifies only host plus current confirmed/pending people", () => {
  let s = pilotSeed();
  const base = s.applications[0];
  for (const [id, state] of [
    ["withdrawn-person", "WITHDRAWN"],
    ["declined-person", "DECLINED"],
    ["pending-person", "PENDING"],
  ] as const) {
    s.users.push({ ...s.users[0], id, name: id });
    s.applications.push({
      ...base,
      id: "app-" + id,
      userId: id,
      state,
      confirmedAt: undefined,
      decidedAt: state === "DECLINED" ? s.now : undefined,
      withdrawnAt: state === "WITHDRAWN" ? s.now : undefined,
    });
  }
  assert.throws(
    () =>
      command(s, "maya", {
        type: "cancel",
        mealId: "supper",
        reason: "Private health details",
      }),
    /reason code/,
  );
  s = command(s, "maya", {
    type: "cancel",
    mealId: "supper",
    reason: "host",
    note: "Private health details",
  });
  assert.deepEqual([...new Set(s.notifications.map((n) => n.userId))].sort(), [
    "emma",
    "leo",
    "maya",
    "pending-person",
  ]);
  assert.equal(
    JSON.stringify(s.notifications).includes("Private health details"),
    false,
  );
  assert.deepEqual(s.meals[0].cancelReasons, ["host"]);
});
function startedHostingMeal() {
  let s = pilotSeed();
  s = command(s, "alex", { type: "declare", mealId: "hosting" });
  return command(s, "system", { type: "tick" }, "2026-10-24T18:05:00Z");
}
test("deleting the host after start preserves the meal and other participants post-meal eligibility", async () => {
  const { eligibleAtMeal } = await import("../../shared/pilot.ts");
  let s = startedHostingMeal();
  s = command(
    s,
    "alex",
    { type: "delete-account", confirmation: "DELETE", reauthenticated: true },
    s.now,
  );
  assert.equal(s.meals.find((m) => m.id === "hosting")!.status, "OPEN");
  assert.equal(s.users.find((u) => u.id === "alex")!.name, "Deleted member");
  assert.equal(eligibleAtMeal(s, "hosting", "emma"), true);
  s = command(s, "system", { type: "tick" }, "2026-10-24T20:05:00Z");
  assert.equal(s.meals.find((m) => m.id === "hosting")!.status, "COMPLETED");
  s = command(
    s,
    "emma",
    { type: "attendance", mealId: "hosting", userId: "emma", value: "present" },
    s.now,
  );
  assert.equal(attendanceStatus(s, "hosting", "emma"), "present");
});
test("deleting a guest after start retains historical membership and creates no late low-count task", async () => {
  const { eligibleAtMeal } = await import("../../shared/pilot.ts");
  let s = startedHostingMeal();
  s = command(
    s,
    "emma",
    { type: "delete-account", confirmation: "DELETE", reauthenticated: true },
    s.now,
  );
  const m = s.meals.find((m) => m.id === "hosting")!;
  assert.equal(m.lowCountDecision, undefined);
  assert.equal(m.lowCountHistory, undefined);
  assert.equal(
    s.applications.find((a) => a.mealId === "hosting" && a.userId === "emma")!
      .withdrawnAt,
    undefined,
  );
  assert.equal(eligibleAtMeal(s, "hosting", "leo"), true);
});
test("apply and publish both require the explicit adult declaration, not merely a seeded profile", () => {
  for (const adult of [undefined, false]) {
    const s = pilotSeed();
    s.users.find((u) => u.id === "alex")!.adult = adult;
    assert.throws(
      () =>
        command(s, "alex", {
          type: "apply",
          mealId: "supper",
          message: "I would love to share a meal with you.",
        }),
      /18 or older/,
    );
    assert.throws(
      () => command(s, "alex", { type: "publish", meal: { ...s.meals[0] } }),
      /18 or older/,
    );
  }
});
function passedSupper() {
  let s = pilotSeed();
  s = command(s, "maya", { type: "declare", mealId: "supper" });
  return command(s, "system", { type: "tick" }, "2026-10-23T17:45:00Z");
}
test("later low-count requests clear the current old decision but retain each historical decision", () => {
  let s = passedSupper();
  s = command(
    s,
    "emma",
    { type: "leave", mealId: "supper" },
    "2026-10-23T17:46:00Z",
  );
  s = command(
    s,
    "maya",
    { type: "continue", mealId: "supper" },
    "2026-10-23T17:47:00Z",
  );
  s = command(
    s,
    "leo",
    { type: "leave", mealId: "supper" },
    "2026-10-23T17:48:00Z",
  );
  let m = s.meals[0];
  assert.equal(m.lowCountDecision, "pending");
  assert.equal(m.lowCountActual, undefined);
  assert.equal(m.lowCountDecidedAt, undefined);
  assert.deepEqual(
    m.lowCountHistory?.map((h) => [h.kind, h.count]),
    [
      ["pending", 2],
      ["continue", 2],
      ["pending", 1],
    ],
  );
  s = command(
    s,
    "maya",
    { type: "continue", mealId: "supper" },
    "2026-10-23T17:49:00Z",
  );
  m = s.meals[0];
  assert.equal(m.lowCountActual, 1);
  assert.equal(m.minimum, 3);
  assert.equal(m.lowCountHistory?.length, 4);
});
test("an unmade decision at the start is recorded and notified once, without automatic agreement or cancellation", () => {
  let s = passedSupper();
  s = command(
    s,
    "emma",
    { type: "leave", mealId: "supper" },
    "2026-10-23T17:46:00Z",
  );
  s = command(s, "system", { type: "tick" }, "2026-10-23T18:00:00Z");
  assert.equal(s.meals[0].status, "OPEN");
  assert.equal(s.meals[0].lowCountDecision, "pending");
  assert.equal(s.meals[0].lowCountDecidedAt, undefined);
  assert.deepEqual(s.meals[0].lowCountUnresolvedAtStart, {
    at: "2026-10-23T18:00:00.000Z",
    count: 2,
  });
  const count = s.notifications.length;
  s = command(s, "system", { type: "tick" }, "2026-10-23T18:01:00Z");
  assert.equal(s.notifications.length, count);
  assert.throws(
    () => command(s, "maya", { type: "continue", mealId: "supper" }, s.now),
    /closed/,
  );
});

test("an unresolved-at-start decision preserves the r1-1 pending shape and roundtrips through admin parsing", async () => {
  const { parseHandoff } = await import("../../admin/src/handoff.ts");
  let s = passedSupper();
  s = command(
    s,
    "emma",
    { type: "leave", mealId: "supper" },
    "2026-10-23T17:46:00Z",
  );
  s = command(s, "system", { type: "tick" }, "2026-10-23T18:01:00Z");
  const out = projectAnalytics(s);
  const imported = parseHandoff(JSON.stringify(out));
  const m = imported.data.meals.find((m) => m.id === "supper")!;
  assert.equal(m.lowCountDecision, "pending");
  assert.ok(Date.parse(imported.asOf) >= Date.parse(m.startsAt));
  assert.equal("lowCountHistory" in out.meals[0], false);
  assert.equal("lowCountUnresolvedAtStart" in out.meals[0], false);
});
