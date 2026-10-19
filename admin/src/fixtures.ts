import type { Dataset, Event, Meal } from "./analytics.ts";
import { DAY, SNAPSHOT, rosterAt } from "./analytics.ts";

// Deterministic synthetic fixtures. No records represent actual people or activity.
const iso = (ms: number) => new Date(ms).toISOString();
export const areas = ["Soho", "Camden", "Fitzrovia", "Shoreditch"];
export function createFixture(): Dataset {
  const start = +new Date("2026-08-17T18:00:00Z");
  const data: Dataset = {
    users: [],
    meals: [],
    applications: [],
    attendance: [],
    feedback: [],
    events: [],
    identityLinks: [],
  };
  for (let i = 0; i < 180; i++)
    data.users.push({
      id: `U-${String(i + 1).padStart(3, "0")}`,
      joinedAt: iso(start - (i < 75 ? 10 : -Math.floor((i - 75) / 2)) * DAY),
    });
  const add = (
    name: string,
    userId: string,
    time: number,
    meal?: Meal,
    extra: Partial<Event> = {},
  ) => {
    const event: Event = {
      id: `EV-${String(data.events.length + 1).padStart(4, "0")}`,
      name,
      userId,
      sessionId: `S-${userId}-${iso(time).slice(0, 10)}`,
      occurredAt: iso(time),
      receivedAt: iso(time + 40_000),
      environment: "production",
      appVersion: "pilot.1",
      schemaVersion: 1,
      ...(meal
        ? {
            mealId: meal.id,
            area: meal.area,
            language: meal.language,
            budget: meal.budget,
            size: meal.capacity,
            source: meal.source,
          }
        : {}),
      ...extra,
    };
    data.events.push(event);
    return event;
  };
  for (let i = 0; i < 64; i++) {
    const time = start + i * DAY,
      area = areas[i % 4];
    const meal: Meal = {
      id: `M-${String(i + 1).padStart(3, "0")}`,
      title: [
        "Friday supper",
        "A little ramen club",
        "Small plates & stories",
        "Sunday at the table",
      ][i % 4],
      startsAt: iso(time),
      publishedAt: iso(time - 5 * DAY),
      area,
      language: i % 11 === 0 ? "中文" : i % 5 === 0 ? "中文 / English" : "English",
      capacity: i % 13 === 0 ? 2 : 4 + (i % 3),
      minimum: i % 13 === 0 ? 2 : 3,
      budget: 20 + (i % 4) * 5,
      source: i % 4 === 0 ? "assisted" : "user",
      hostId: data.users[i % 12].id,
      cancelled: i % 11 === 0,
      ...(i%11===0 ? {cancelledAt:iso(time-(i%22===0?15*60_000:2*3_600_000))} : {}),
      // R1: failed 15-minute checkpoint, or a host cancellation before it.
      ...(i % 11 === 0
        ? { cancelReasons: i === 0 ? ["insufficient"] : i % 22 === 0 ? ["booking"] : ["host"] }
        : {}),
      peakConfirmed: 1,
    };
    data.meals.push(meal);
    const attempt = `C-${i}`;
    add("create_started", meal.hostId, time - 6 * DAY, meal, {
      attemptId: attempt,
    });
    add("create_arranged", meal.hostId, time - 6 * DAY + 60_000, meal, {
      attemptId: attempt,
    });
    add("meal_published", meal.hostId, time - 5 * DAY, meal, {
      attemptId: attempt,
    });
    if (i % 3 === 0)
      add("form_error", meal.hostId, time - 6 * DAY + 30_000, meal, {
        field: "schedule",
        attemptId: attempt,
      });
    const users = Array.from(
      { length: meal.capacity - 1 },
      (_, j) => data.users[((i * 3 + j) % 144) + 12],
    );
    for (const [j, user] of users.entries()) {
      const applied = time - (3 - j * 0.2) * DAY,
        accepted = (i + j) % 7 !== 0;
      const pending = i >= 59 && j === 0;
      const a = {
        id: `A-${i}-${j}`,
        userId: user.id,
        mealId: meal.id,
        appliedAt: iso(applied),
        ...(!pending
          ? {
              decidedAt: iso(
                applied + ((i % 4 === 1 ? 28 : 3) + j) * 3_600_000,
              ),
              decision: accepted
                ? ("approved" as const)
                : ("declined" as const),
            }
          : {}),
        ...(!pending && accepted
          ? {
              confirmedAt: iso(
                applied + ((i % 4 === 1 ? 29 : 4) + j) * 3_600_000,
              ),
            }
          : {}),
        // M-055 loses a guest after its passed checkpoint (D-08 example).
        ...(i % 9 === 0 && j === 1 ? { withdrawnAt: iso(i === 54 ? time - 10 * 60_000 : time - DAY) } : {}),
      };
      data.applications.push(a);
      add("discovery_results", user.id, applied - 120_000, meal, {
        resultCount: 4,
      });
      add("meal_impression", user.id, applied - 100_000, meal, {
        visibleRatio: 0.8,
        durationMs: 1500,
      });
      add("detail_view", user.id, applied - 80_000, meal);
      add("profile_view", user.id, applied - 60_000, meal);
      add("application_attempt", user.id, applied - 20_000, meal);
      add("application_succeeded", user.id, applied, meal);
      if (a.confirmedAt)
        add("chat_opened", user.id, +new Date(a.confirmedAt) + 60_000, meal);
      if (a.confirmedAt && !meal.cancelled && !a.withdrawnAt) {
        if ((i + j) % 8 !== 0) {
          const host =
            (i + j) % 10 === 0 ? ("absent" as const) : ("present" as const);
          data.attendance.push({
            userId: user.id,
            mealId: meal.id,
            host,
            ...((i + j) % 17 === 0
              ? {
                  self:
                    host === "present"
                      ? ("absent" as const)
                      : ("present" as const),
                }
              : {}),
            updatedAt: iso(time + 12 * 3_600_000),
          });
          if (host === "present" && (i + j) % 17 !== 0 && j % 3 !== 2)
            data.feedback.push({
              userId: user.id,
              mealId: meal.id,
              score: (i + j) % 9 === 0 ? 2 : 4 + (j % 2),
              again: (i + j) % 6 !== 0,
              issue: (i + j) % 9 === 0 ? "coordination" : "none",
              at: iso(time + 18 * 3_600_000),
            });
        }
      }
    }
    meal.cancelReason = meal.cancelReasons?.[0];
    if (i % 11 !== 0 || i % 22 === 0) {
      const at = iso(time - 15 * 60_000);
      meal.checkpoint = { at, passed: i % 11 !== 0, count: rosterAt(data, meal, at).size };
    }
    if (i === 54) meal.lowCountDecision = "continue";
    meal.peakConfirmed = Math.min(
      meal.capacity,
      1 +
        data.applications.filter((a) => a.mealId === meal.id && a.confirmedAt)
          .length,
    );
    if (!meal.cancelled && i % 9 !== 0)
      data.attendance.push({
        userId: meal.hostId,
        mealId: meal.id,
        self: "present",
        updatedAt: iso(time + 12 * 3_600_000),
      });
    // Browsers who do not apply; each discovery request retains its actual filter context.
    for (let j = 0; j < 6; j++) {
      const user = data.users[90 + ((i + j) % 80)],
        time2 = time - 2 * DAY + j * 60_000;
      add("discovery_results", user.id, time2, undefined, {
        area,
        language: meal.language,
        budget: meal.budget,
        size: meal.capacity,
        source: meal.source,
        resultCount: i % 4 === 1 && j < 4 ? 0 : j === 0 ? 0 : 3,
      });
      if (!(i % 4 === 1 && j < 4) && j > 0) {
        add("meal_impression", user.id, time2 + 15_000, meal, {
          visibleRatio: 0.6,
          durationMs: 1200,
        });
        if (j > 2) add("detail_view", user.id, time2 + 30_000, meal);
        if (j === 4) add("filter_applied", user.id, time2 + 35_000, meal);
        if (j === 5) add("map_opened", user.id, time2 + 35_000, meal);
      }
    }
    if (i % 4 === 1) {
      add(
        "create_started",
        data.users[100 + (i % 30)].id,
        time - 2 * DAY,
        meal,
        { attemptId: `abandon-${i}` },
      );
      add(
        "form_error",
        data.users[100 + (i % 30)].id,
        time - 2 * DAY + 40_000,
        meal,
        { attemptId: `abandon-${i}`, field: "schedule" },
      );
    }
  }
  // Raw quality fixtures: duplicates, non-live traffic, late arrival, missing schema field.
  const example = data.events.find((e) =>
    e.occurredAt.startsWith("2026-10-01"),
  )!;
  data.events.push(
    { ...example },
    { ...example, id: "TEST-1", isTest: true },
    { ...example, id: "DEMO-1", environment: "demo" },
    { ...example, id: "BOT-1", isBot: true },
    { ...example, id: "LATE-1", receivedAt: "2026-10-19T12:00:00Z" },
    { ...example, id: "BAD-1", sessionId: "" },
  );
  // R-16 samples: a two-area request, an unconstrained request and pre-login browsing.
  const wide = { ...example, name: "discovery_results", mealId: undefined, attemptId: undefined, resultCount: 2, budget: undefined, size: undefined, language: undefined };
  data.events.push(
    { ...wide, id: "WIDE-1", area: "Soho,Camden" },
    { ...wide, id: "WIDE-2", area: undefined },
    { ...wide, id: "ANON-1", userId: undefined, anonymousId: "anon-150", sessionId: "S-anon-150", area: "Soho" },
    { ...wide, id: "ANON-2", userId: undefined, anonymousId: "anon-150", sessionId: "S-anon-150-later", area: "Soho" },
  );
  data.identityLinks!.push({ anonymousId: "anon-150", sessionId: "S-anon-150", userId: "U-150" });
  data.events = data.events.filter((e) => e.occurredAt <= SNAPSHOT);
  for (const user of data.users) {
    const first = data.events
      .filter((e) => e.userId === user.id)
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))[0];
    if (first && first.occurredAt < user.joinedAt)
      user.joinedAt = iso(+new Date(first.occurredAt) - DAY);
  }
  return data;
}
export const fixture = createFixture();
