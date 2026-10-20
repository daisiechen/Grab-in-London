import { test } from "node:test";
import assert from "node:assert/strict";
import { relativeMealDay } from "../src/experience.ts";
import {
  act,
  pilotSeed,
  groupAccess,
  confirmedIds,
  projectAnalytics,
  readableMessages,
} from "../../shared/pilot.ts";
import { londonVenues } from "../../shared/venues.ts";
const command = (
  s: ReturnType<typeof pilotSeed>,
  actor: string,
  c: Record<string, unknown>,
  at = s.now,
) => act(s, actor, { ...c, key: String(s.version) }, at, s.version);
test("relative meal labels follow calendar days across the London autumn clock change", () => {
  assert.equal(
    relativeMealDay("2026-10-25T19:00:00Z", "2026-10-24T23:30:00Z"),
    "Today",
  );
  assert.equal(
    relativeMealDay("2026-10-26T19:00:00Z", "2026-10-24T23:30:00Z"),
    "Tomorrow",
  );
  assert.equal(
    relativeMealDay("2026-10-28T19:00:00Z", "2026-10-24T23:30:00Z"),
    "In 3 days",
  );
});
test("publish accepts all host-selected ranges and rejects inverted, fractional and unverified restaurant entries", () => {
  const venue = londonVenues[1];
  for (let capacity = 2; capacity <= 6; capacity++)
    for (let minimum = 2; minimum <= capacity; minimum++) {
      const s = pilotSeed();
      const next = command(s, "alex", {
        type: "publish",
        meal: {
          ...s.meals[0],
          venueId: venue.id,
          venue: venue.name,
          address: venue.address,
          area: venue.area,
          mapUrl: venue.mapUrl,
          minimum,
          capacity,
        },
      });
      assert.equal(next.meals.at(-1)!.minimum, minimum);
    }
  for (const changes of [
    { minimum: 5, capacity: 4 },
    { minimum: 2.5 },
    { venue: "A fictional restaurant" },
    { venueId: "unknown" },
  ]) {
    const s = pilotSeed();
    assert.throws(() =>
      command(s, "alex", {
        type: "publish",
        meal: { ...s.meals[0], ...changes },
      }),
    );
  }
});
test("meal end keeps group writable; leaving only ends chat access and preserves historical participation", () => {
  let s = pilotSeed();
  const past = s.meals.find((m) => m.id === "past")!;
  const participant = s.applications.find(
    (a) => a.mealId === "past" && a.confirmedAt,
  )!;
  const id = participant.userId;
  assert.equal(groupAccess(s, "past", id), "write");
  s = command(s, id, {
    type: "send",
    mealId: "past",
    text: "Lovely meeting everyone.",
  });
  const before = confirmedIds(s, "past");
  const analytics = projectAnalytics(s).applications;
  s = command(s, id, { type: "leave-group", mealId: "past" });
  assert.equal(groupAccess(s, "past", id), "read");
  assert.deepEqual(confirmedIds(s, "past"), before);
  assert.deepEqual(projectAnalytics(s).applications, analytics);
  assert.throws(() =>
    command(s, id, {
      type: "send",
      mealId: "past",
      text: "No longer a member",
    }),
  );
  assert.ok(
    readableMessages(s, "past", id).some(
      (m) => m.text === "Lovely meeting everyone.",
    ),
  );
  assert.throws(() =>
    command(s, id, { type: "dissolve-group", mealId: "past" }),
  );
  s = command(s, past.hostId, { type: "dissolve-group", mealId: "past" });
  assert.equal(groupAccess(s, "past", past.hostId), "read");
  assert.deepEqual(confirmedIds(s, "past"), before);
  assert.equal(
    JSON.stringify(projectAnalytics(s)).includes("groupClosedAt"),
    false,
  );
  assert.equal(
    JSON.stringify(projectAnalytics(s)).includes("chatLeftAt"),
    false,
  );
});
test("analytics normalizes missing legacy minimum but preserves recorded thresholds", () => {
  const s = pilotSeed();
  delete (s.meals[0] as Partial<(typeof s.meals)[0]>).minimum;
  assert.equal(projectAnalytics(s).meals[0].minimum, 3);
  s.meals[0].minimum = 2;
  assert.equal(projectAnalytics(s).meals[0].minimum, 2);
});
