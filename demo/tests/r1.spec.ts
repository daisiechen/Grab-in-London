import { test, expect, type Page } from "@playwright/test";
import { pilotSeed } from "../../shared/pilot";
// R1 acceptance is separate from the preserved future exploration tests.
test.setTimeout(45_000);
async function start(page: Page, review = true) {
  await page.clock.setFixedTime(new Date(pilotSeed().now));
  await page.goto(review ? "/?review=1" : "/");
  await page.getByRole("button", { name: "Skip intro", exact: true }).click();
  await page
    .getByRole("button", { name: "Explore tables first", exact: true })
    .click();
}
async function login(page: Page) {
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await page.getByRole("radio", { name: "Log in", exact: true }).check();
  await page
    .getByRole("button", { name: "Continue with Google", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Continue as Alex", exact: true })
    .click();
}
async function actor(page: Page, id: string) {
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("radio", { name: id, exact: true }).check();
}
async function past(page: Page) {
  await page.getByRole("button", { name: "Meals", exact: true }).click();
  await page.getByRole("button", { name: "Past", exact: true }).click();
  await page
    .getByRole("button", { name: "Open A Sunday table", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Your shared meal", exact: true })
    .click();
}
async function ask(page: Page, text: string) {
  await page
    .getByRole("textbox", { name: "Ask about a meal or make a plan" })
    .fill(text);
  await page
    .getByRole("button", { name: "Send to Fancy", exact: true })
    .click();
}

test("R1 restored date dropdown, non-contiguous choices and list-map view are observable", async ({
  page,
}) => {
  await start(page, false);
  await expect(page.locator('[data-scope="r1"]')).toHaveCount(1);
  await expect(
    page.getByText("R1 acceptance tools", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Filter by date", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveClass(/r1-filter-dropdown/);
  await page.getByRole("button", { name: "Fri 23 Oct", exact: true }).click();
  await page.getByRole("button", { name: "Sun 25 Oct", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Fri 23 Oct", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Sun 25 Oct", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Sat 24 Oct", exact: true }).click();
  await page.getByRole("button", { name: "Show tables", exact: true }).click();
  await page.getByRole("button", { name: "List view", exact: true }).click();
  await expect(page.locator(".r1-card-open")).toHaveCount(3);
  await page
    .getByRole("button", { name: "Filter by table size", exact: true })
    .click();
  await page.getByRole("radio", { name: "2 people", exact: true }).check();
  await page.getByRole("button", { name: "Show tables", exact: true }).click();
  await expect(page.locator(".r1-card-open")).toHaveCount(1);
  await page.getByRole("button", { name: "More filters", exact: true }).click();
  await page
    .getByRole("button", { name: "Clear selections", exact: true })
    .press("Enter");
  await page.getByRole("button", { name: "Show tables", exact: true }).click();
  await expect(page.locator(".r1-card-open")).toHaveCount(3);
  await page.getByRole("button", { name: "Map view", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Meals in central London" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Go back", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Soho: 2 meals", exact: true })
    .click();
  await page
    .getByRole("button", { name: /2 meals in this view View all/ })
    .click();
  await expect(page.locator(".r1-card-open")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Show all areas", exact: true })
    .click();
  await expect(page.locator(".r1-card-open")).toHaveCount(3);
  await page.getByRole("button", { name: "Map view", exact: true }).click();
  const map = page.getByRole("region", { name: "Meals in central London" });
  await map.getByRole("button", { name: "Zoom in", exact: true }).click();
  await map
    .getByRole("button", { name: "Search this area", exact: true })
    .click();
  await expect(map).toHaveAttribute("data-zoom", "1.3");
  await map
    .getByRole("button", { name: "Show central London", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Filter by date", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.screenshot({
    path: "qa/experience-restoration-2026-10-19/discovery.png",
  });
});
test("R1 pending Inbox cannot chat; host approval opens group without a payment step", async ({
  page,
}) => {
  await start(page);
  await login(page);
  await page.getByRole("button", { name: "Discover", exact: true }).click();
  await page
    .getByRole("button", { name: "Open An easy Friday supper", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Apply to join", exact: true })
    .click();
  await page
    .getByRole("textbox", {
      name: "Your introduction · 20–300 characters",
      exact: true,
    })
    .fill("I would like to meet new friends over a relaxed meal.");
  await page
    .getByRole("button", { name: "Send application", exact: true })
    .click();
  await page.getByRole("button", { name: "Inbox", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "View application", exact: true }),
  ).toBeVisible();
  await actor(page, "maya");
  await page.getByRole("button", { name: "Discover", exact: true }).click();
  await page
    .getByRole("button", { name: "Open An easy Friday supper", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Manage your table", exact: true })
    .click();
  await page.getByRole("button", { name: "Approve seat", exact: true }).click();
  await page
    .getByRole("button", { name: "Declare reservation for 4", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm declaration for 4", exact: true })
    .click();
  await actor(page, "alex");
  await page.getByRole("button", { name: "Inbox", exact: true }).click();
  await page
    .getByRole("button", {
      name: /An easy Friday supper.*Say hello/,
    })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Message your group", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("payment pending", { exact: true })).toHaveCount(
    0,
  );
  await page.screenshot({
    path: "qa/experience-restoration-2026-10-19/confirmed.png",
  });
});
test("R1 feedback has no defaults, optional multiple reasons and persists per meal/user", async ({
  page,
}) => {
  await start(page);
  await login(page);
  await past(page);
  await expect(
    page.getByRole("radio", { name: "5", exact: true }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("radio", { name: "yes", exact: true }),
  ).not.toBeChecked();
  await page
    .getByRole("button", { name: "Save private feedback", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Choose a rating");
  await page.getByRole("radio", { name: "2", exact: true }).check();
  await page.getByRole("radio", { name: "no", exact: true }).check();
  await page
    .getByRole("checkbox", { name: "Coordination", exact: true })
    .check();
  await page.getByRole("checkbox", { name: "Cost", exact: true }).check();
  await page
    .getByRole("button", { name: "Save private feedback", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Private feedback saved",
  );
  await actor(page, "maya");
  await past(page);
  await expect(
    page.getByRole("radio", { name: "2", exact: true }),
  ).not.toBeChecked();
  await actor(page, "alex");
  await past(page);
  await expect(
    page.getByRole("radio", { name: "2", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("radio", { name: "no", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "Cost", exact: true }),
  ).toBeChecked();
  await page.screenshot({
    path: "qa/experience-restoration-2026-10-19/feedback.png",
  });
});
test("R1 helper uses current public meal data and returns drafts without submitting", async ({
  page,
}) => {
  await start(page);
  await login(page);
  await page.getByRole("button", { name: "Discover", exact: true }).click();
  await page
    .getByRole("button", { name: "Open An easy Friday supper", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open Fancy helper", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Use voice input", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Draft an application", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Edit application", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", {
      name: "Your introduction · 20–300 characters",
      exact: true,
    }),
  ).toHaveValue(/I’d love to join/);
  await expect(
    page.getByRole("button", { name: "Send application", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await page
    .getByRole("button", { name: "Open Fancy helper", exact: true })
    .click();
  await ask(page, "Find meals in Soho for 4 under £35");
  await expect(page.locator(".helper-meal-card")).toContainText(
    "An easy Friday supper",
  );
  await page.keyboard.press("Escape");
  await actor(page, "maya");
  await page.getByRole("button", { name: "Discover", exact: true }).click();
  await page
    .getByRole("button", { name: "Open An easy Friday supper", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Manage your table", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Cancel entire meal", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel entire meal", exact: true })
    .click();
  await actor(page, "alex");
  await page.getByRole("button", { name: "Discover", exact: true }).click();
  await page
    .getByRole("button", { name: "Open Fancy helper", exact: true })
    .click();
  await ask(page, "Find meals in Soho for 4 under £35");
  await expect(page.locator(".helper-meal-card")).toHaveCount(0);
});
test("R1 provider failures keep original intent and move the error into the phone viewport", async ({
  page,
}) => {
  await start(page);
  await page
    .getByRole("button", { name: "Open An easy Friday supper", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Apply to join", exact: true })
    .click();
  await page.getByRole("radio", { name: "Log in", exact: true }).check();
  await page
    .getByRole("button", { name: "Continue with Apple", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Preview provider failure", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("alert")).toContainText("could not be completed");
  await expect
    .poll(async () => {
      const alert = await page.getByRole("alert").boundingBox(),
        screen = await page.getByTestId("device-screen").boundingBox();
      return (
        !!alert &&
        !!screen &&
        alert.y >= screen.y &&
        alert.y + alert.height <= screen.y + screen.height
      );
    })
    .toBe(true);
  await expect
    .poll(() => page.getByTestId("device-screen").evaluate((e) => e.scrollTop))
    .toBe(0);
  await expect(page.getByTestId("keyboard-dock")).toHaveAttribute(
    "data-visible",
    "false",
  );
  await page
    .getByRole("button", { name: "Continue with Facebook", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Continue as Alex", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Join An easy Friday supper",
      exact: true,
    }),
  ).toBeVisible();
});

test("restored create flow publishes a real restaurant and custom range, then returns to Hosting", async ({
  page,
}) => {
  await start(page);
  await login(page);
  await page.getByRole("button", { name: "Create meal", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Save draft & close", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Flat Iron Soho Soho · Steak", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "View on Google Maps", exact: true }),
  ).toHaveAttribute("href", /^https:\/\/maps.app.goo.gl\//);
  await page
    .getByRole("button", { name: "Use this restaurant", exact: true })
    .press("Enter");
  await page
    .getByRole("button", { name: "Continue", exact: true })
    .press("Enter");
  await page
    .getByRole("button", { name: "Choose meal date", exact: true })
    .click();
  await page.getByRole("button", { name: "Mon 26 Oct", exact: true }).click();
  await page.getByLabel("Minimum people", { exact: true }).selectOption("2");
  await page.getByLabel("Maximum people", { exact: true }).selectOption("5");
  await expect(
    page.locator('input[type="date"],input[type="time"]'),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Continue", exact: true })
    .press("Enter");
  await expect(
    page.getByRole("radio", { name: "English", exact: true }),
  ).toBeChecked();
  await page
    .getByRole("textbox", { name: "Meal title · 5–80 characters", exact: true })
    .fill("A relaxed Monday supper");
  await page
    .getByRole("textbox", { name: "A little note for your table", exact: true })
    .fill("Come along for a relaxed supper and a little conversation.");
  await page
    .getByRole("button", { name: "Continue", exact: true })
    .press("Enter");
  await page
    .getByRole("button", { name: "Publish meal", exact: true })
    .press("Enter");
  await expect(
    page.getByRole("heading", { name: "A relaxed Monday supper", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Hosting", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".r1-agenda-card").last()).toContainText(
    "2–5 people",
  );
  await page.getByRole("button", { name: "Create meal", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Choose your table.", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Use this restaurant", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Meals", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Discard this meal?");
  await page.getByRole("button", { name: "Discard meal", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your next good meal.", exact: true }),
  ).toBeVisible();
});
test("reports acknowledge receipt, blocking requires confirmation and profile settings are unique", async ({
  page,
}) => {
  await start(page);
  await login(page);
  await expect(
    page.getByRole("button", { name: "Settings", exact: true }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Export my data", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Discover", exact: true }).click();
  await page
    .getByRole("button", { name: "Open An easy Friday supper", exact: true })
    .click();
  await page.getByRole("button", { name: "View Maya", exact: true }).click();
  await page
    .getByRole("button", { name: "Report a concern", exact: true })
    .press("Enter");
  await page
    .getByRole("textbox", {
      name: "What happened? · 5–1000 characters",
      exact: true,
    })
    .fill("Test report receipt and acknowledgement.");
  await page
    .getByRole("button", { name: "Submit report", exact: true })
    .press("Enter");
  await expect(page.getByRole("status")).toContainText(
    "received and will be reviewed",
  );
  await page
    .getByRole("button", { name: "Block member", exact: true })
    .press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm block", exact: true }),
  ).toBeVisible();
});
test("past meal chat remains open and leaving chat preserves access to attendance", async ({
  page,
}) => {
  await start(page);
  await login(page);
  await page.getByRole("button", { name: "Inbox", exact: true }).click();
  await page.getByRole("button", { name: /A Sunday table.*Say hello/ }).click();
  await page
    .getByRole("textbox", { name: "Message your group", exact: true })
    .fill("Lovely meeting everyone yesterday.");
  await page
    .getByRole("button", { name: "Send message", exact: true })
    .press("Enter");
  await expect(
    page.getByText("Lovely meeting everyone yesterday.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Leave group", exact: true })
    .press("Enter");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Leave group", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Message your group", exact: true }),
  ).toHaveCount(0);
  await past(page);
  await expect(
    page.getByRole("button", { name: "I attended", exact: true }),
  ).toBeVisible();
});
test("restored profile saves optional background and full-name conversation languages", async ({
  page,
}) => {
  await start(page);
  await login(page);
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await page
    .getByRole("textbox", {
      name: "Work or what keeps you busy (optional)",
      exact: true,
    })
    .fill("Building useful products");
  await page
    .getByRole("textbox", { name: "School (optional)", exact: true })
    .fill("A London university");
  await page
    .getByRole("textbox", { name: "Originally from (optional)", exact: true })
    .fill("Bristol");
  await page.getByRole("checkbox", { name: "German", exact: true }).check();
  await page
    .getByRole("button", { name: "Save profile", exact: true })
    .press("Enter");
  await expect(
    page.getByText("Building useful products", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("English · German", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Bristol", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: "German", exact: true }),
  ).toBeChecked();
});
test("authentication preserves the detail return path and submitted applications leave no stale form in history", async ({
  page,
}) => {
  await start(page, false);
  await page
    .getByRole("button", { name: "Open An easy Friday supper", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Apply to join", exact: true })
    .click();
  await page.getByRole("radio", { name: "Log in", exact: true }).check();
  await page
    .getByRole("button", { name: "Continue with Google", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Continue as Alex", exact: true })
    .click();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "An easy Friday supper", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Apply to join", exact: true })
    .press("Enter");
  await page
    .getByRole("textbox", {
      name: "Your introduction · 20–300 characters",
      exact: true,
    })
    .fill("I would enjoy meeting new friends over supper.");
  await page
    .getByRole("button", { name: "Send application", exact: true })
    .press("Enter");
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Fancy a bite?", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Send application", exact: true }),
  ).toHaveCount(0);
});
