import { expect, test, type Page } from "@playwright/test";

async function browse(page: Page, review = false, tickingClock = false) {
  if (tickingClock)
    await page.clock.install({ time: new Date("2026-10-18T12:00:00Z") });
  else await page.clock.setFixedTime(new Date("2026-10-18T12:00:00Z"));
  await page.goto(review ? "/?review=1" : "/");
  await page.getByRole("button", { name: "Skip intro", exact: true }).click();
  await page
    .getByRole("button", { name: "Explore tables first", exact: true })
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
async function settleKeyboard(page: Page, visible: boolean) {
  await expect
    .poll(async () =>
      page.getByTestId("keyboard-dock").evaluate((element, shown) => {
        const offset = new DOMMatrixReadOnly(
          getComputedStyle(element).transform,
        ).m42;
        const height = Number.parseFloat((element as HTMLElement).style.height);
        return Math.abs(offset - (shown ? 0 : height)) < 0.5;
      }, visible),
    )
    .toBe(true);
}
async function settleHelper(page: Page) {
  await expect
    .poll(async () =>
      page
        .getByTestId("bottom-sheet")
        .evaluate((element) =>
          Math.abs(
            new DOMMatrixReadOnly(getComputedStyle(element).transform).m42,
          ),
        ),
    )
    .toBeLessThan(0.5);
}
async function settleSprite(page: Page) {
  await expect
    .poll(async () =>
      page.locator(".helper-launcher").evaluate((element) => {
        const style = getComputedStyle(element);
        const target = (element as HTMLElement).style;
        return (
          Math.abs(
            Number.parseFloat(style.left) - Number.parseFloat(target.left),
          ) +
          Math.abs(Number.parseFloat(style.top) - Number.parseFloat(target.top))
        );
      }),
    )
    .toBeLessThan(0.5);
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

test("helper searches, refines, preserves state, opens a meal and can be tucked away", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await browse(page);
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const launcher = document
          .querySelector(".helper-launcher")!
          .getBoundingClientRect();
        const header = document
          .querySelector(".discover-header")!
          .getBoundingClientRect();
        const navigation = document
          .querySelector(".bottom-nav")!
          .getBoundingClientRect();
        return (
          launcher.top >= header.bottom && launcher.bottom < navigation.top
        );
      }),
    )
    .toBe(true);
  await page.screenshot({ path: "qa/map-helper-update/launcher.png" });
  await page
    .getByRole("button", { name: "Tuck Fancy to edge", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Show Fancy helper", exact: true })
    .click();
  await ask(page, "Friday in Soho, table for 4, £35");
  await expect(page.locator(".helper-meal-card")).toHaveCount(1);
  await expect(page.locator(".helper-meal-card")).toContainText(
    "An easy Friday supper",
  );
  await settleKeyboard(page, false);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await page.screenshot({ path: "qa/map-helper-update/search-iphone.png" });
  await ask(page, "£10");
  await expect(page.getByRole("log")).toContainText(
    "No available tables match",
  );
  await ask(page, "£35");
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Open Fancy helper", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "What sounds good?", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".helper-turn")).toHaveCount(0);
  await page.getByRole("button", { name: /Continue conversation/ }).click();
  await expect(page.locator(".helper-turn")).toHaveCount(3);
  await page.locator(".helper-meal-card").last().click();
  await expect(
    page.getByRole("heading", { name: "An easy Friday supper", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("preferences require confirmation, can be corrected, and are removed with chat context", async ({
  page,
}) => {
  await browse(page);
  await page
    .getByRole("button", { name: "Open Fancy helper", exact: true })
    .click();
  await ask(page, "Remember Soho, budget £35, table for 4");
  await page
    .getByRole("button", { name: "My preferences", exact: true })
    .click();
  await expect(page.locator(".helper-saved")).toHaveText(
    "No saved preferences yet.",
  );
  await page
    .getByRole("button", { name: "Back to assistant home", exact: true })
    .click();
  await page.getByRole("button", { name: /Continue conversation/ }).click();
  await page
    .getByRole("button", { name: "Confirm and remember", exact: true })
    .click();
  await page
    .getByRole("button", { name: "My preferences", exact: true })
    .click();
  await expect(page.locator(".helper-saved")).toContainText("Soho");
  await page
    .getByRole("textbox", { name: "Replace preferences" })
    .fill("Fitzrovia, budget £30");
  await page
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  await expect(page.locator(".helper-saved")).toHaveText(
    "Fitzrovia · up to £30",
  );
  await settleKeyboard(page, false);
  await page.screenshot({ path: "qa/map-helper-update/preferences.png" });
  await page
    .getByRole("button", { name: "Delete preferences", exact: true })
    .click();
  await expect(page.locator(".helper-saved")).toHaveText(
    "No saved preferences yet.",
  );
  await page
    .getByRole("button", { name: "Back to assistant home", exact: true })
    .click();
  await expect(page.locator(".helper-turn")).toHaveCount(0);
});

test("application and creation drafts return to existing editors without submitting", async ({
  page,
}) => {
  await browse(page);
  await login(page);
  await page.getByRole("button", { name: "Discover", exact: true }).click();
  await page
    .getByRole("button", { name: "Open An easy Friday supper", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open Fancy helper", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Draft an application", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Edit application", exact: true })
    .click();
  await expect(page.locator("textarea")).toHaveValue(
    /I’d love to join your meal/,
  );
  await expect(
    page.getByText("Application pending", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await page
    .getByRole("button", { name: "Open Fancy helper", exact: true })
    .click();
  await ask(page, "Create a meal Friday for 4 in Soho");
  await page
    .getByRole("button", { name: "Review in Create meal", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A place at your table.", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Your meal is live", { exact: true }),
  ).toHaveCount(0);
});

test("an unconfirmed guest cannot use a message draft to enter group chat", async ({
  page,
}) => {
  await browse(page);
  await login(page);
  await page.getByRole("button", { name: "Discover", exact: true }).click();
  await page
    .getByRole("button", { name: "Open An easy Friday supper", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open Fancy helper", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Draft a group message", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Review in meal chat", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText(
    "Only confirmed participants can send to the meal group.",
  );
  await expect(
    page.getByRole("textbox", { name: "Message", exact: true }),
  ).toHaveCount(0);
});

test("keyboard and compact panel stay in phone bounds on iPhone and Pixel", async ({
  page,
}) => {
  await browse(page);
  for (const device of ["iPhone", "Pixel 10"] as const) {
    if (device === "Pixel 10") {
      await page.getByTestId("device-picker").click();
      await page.getByTestId("device-option-pixel-10").click();
    }
    await page
      .getByRole("button", { name: "Open Fancy helper", exact: true })
      .click();

    await page
      .getByRole("textbox", { name: "Ask about a meal or make a plan" })
      .fill("Find meals");
    await expect(page.getByTestId("keyboard-dock")).toHaveAttribute(
      "data-visible",
      "true",
    );
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const sheet = document
            .querySelector(".bottom-sheet")!
            .getBoundingClientRect();
          const screen = document
            .querySelector('[data-testid="device-screen"]')!
            .getBoundingClientRect();
          const input = document
            .querySelector(".helper-input-row")!
            .getBoundingClientRect();
          const keyboard = document
            .querySelector('[data-testid="keyboard-dock"]')!
            .getBoundingClientRect();
          return sheet.top >= screen.top && input.bottom <= keyboard.top + 1;
        }),
      )
      .toBe(true);
    await settleKeyboard(page, true);
    await page.screenshot({
      path: `qa/map-helper-update/keyboard-${device === "iPhone" ? "iphone" : "pixel"}.png`,
    });
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("keyboard-dock")).toHaveAttribute(
      "data-visible",
      "false",
    );
  }
});

test("confirmed guests can review a message draft without sending it", async ({
  page,
}) => {
  await browse(page, true);
  await login(page);
  await page.getByRole("button", { name: "Discover", exact: true }).click();
  await page.getByRole("button", { name: "List view", exact: true }).click();
  await page
    .getByRole("button", { name: "Open Ramen & new faces", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Apply to join", exact: true })
    .click();
  await page.getByRole("button", { name: "Send request", exact: true }).click();
  await page
    .getByRole("button", { name: "Preview host approval", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open Fancy helper", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Draft a group message", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Review in meal chat", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Message", exact: true }),
  ).toHaveValue(/Shall we meet at Noodle House/);
  await expect(page.locator(".chat-message.own")).toHaveCount(0);
  await page.screenshot({ path: "qa/map-helper-update/message-draft.png" });
});

test("speech permission denial preserves typed input and offers recovery", async ({
  page,
}) => {
  await page.addInitScript(() => {
    class DeniedSpeech {
      onerror: ((e: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        setTimeout(() => {
          this.onerror?.({ error: "not-allowed" });
          this.onend?.();
        }, 50);
      }
      abort() {}
    }
    Object.defineProperty(window, "SpeechRecognition", { value: DeniedSpeech });
  });
  await browse(page);
  await page
    .getByRole("button", { name: "Open Fancy helper", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Ask about a meal or make a plan" })
    .fill("Soho");
  await page
    .getByRole("button", { name: "Use voice input", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start voice input", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Microphone access wasn’t granted",
  );
  await expect(
    page.getByRole("textbox", { name: "Ask about a meal or make a plan" }),
  ).toHaveValue("Soho");
  await expect(
    page.getByRole("button", { name: "Send to Fancy", exact: true }),
  ).toBeEnabled();
});

test("unsupported speech gracefully falls back to text", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "SpeechRecognition", { value: undefined });
    Object.defineProperty(window, "webkitSpeechRecognition", {
      value: undefined,
    });
  });
  await browse(page);
  await page
    .getByRole("button", { name: "Open Fancy helper", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Use voice input", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Voice input isn’t available",
  );
  await expect(
    page.getByRole("textbox", { name: "Ask about a meal or make a plan" }),
  ).toBeEnabled();
});

test("speech requires disclosure, creates an editable transcript, and never auto-sends", async ({
  page,
}) => {
  await page.addInitScript(() => {
    class TestSpeech {
      onresult: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        setTimeout(() => {
          this.onresult?.({
            results: [[{ transcript: "Find Friday meals in Soho" }]],
          });
          this.onend?.();
        }, 50);
      }
      abort() {}
    }
    Object.defineProperty(window, "SpeechRecognition", { value: TestSpeech });
  });
  await browse(page);
  await page
    .getByRole("button", { name: "Open Fancy helper", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Use voice input", exact: true })
    .click();
  await expect(
    page.getByText("Your browser may send audio", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".helper-turn")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Start voice input", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Ask about a meal or make a plan" }),
  ).toHaveValue("Find Friday meals in Soho");
  await expect(page.locator(".helper-turn")).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Ask about a meal or make a plan" })
    .fill("Friday in Soho £35");
  await page
    .getByRole("button", { name: "Send to Fancy", exact: true })
    .click();
  await expect(page.locator(".helper-turn")).toHaveCount(1);
});

test("sprite drags without opening, snaps to either edge and peeks out when tucked", async ({
  page,
}) => {
  await browse(page);
  const sprite = page.getByRole("button", {
    name: "Open Fancy helper",
    exact: true,
  });
  const screen = (await page.getByTestId("device-screen").boundingBox())!;
  let box = (await sprite.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(screen.x + 40, box.y + 120, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator(".helper-launcher")).toHaveAttribute(
    "data-side",
    "left",
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect
    .poll(async () => (await sprite.boundingBox())!.x)
    .toBeLessThan(screen.x + screen.width / 4);
  await page
    .getByRole("button", { name: "Tuck Fancy to edge", exact: true })
    .click();
  await expect(page.locator(".helper-launcher")).toHaveClass(/is-tucked/);
  await settleSprite(page);
  await page.screenshot({ path: "qa/map-helper-update/edge-left.png" });
  const tucked = page.getByRole("button", {
    name: "Show Fancy helper",
    exact: true,
  });
  box = (await tucked.boundingBox())!;
  await page.mouse.move(screen.x + 20, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(screen.x + screen.width - 24, box.y + 70, {
    steps: 12,
  });
  await page.mouse.up();
  await expect(page.locator(".helper-launcher")).toHaveAttribute(
    "data-side",
    "right",
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".helper-launcher")).toHaveClass(/is-tucked/);
  await expect
    .poll(async () => (await tucked.boundingBox())!.x)
    .toBeGreaterThan(screen.x + screen.width / 2);
  await settleSprite(page);
  await page.screenshot({ path: "qa/map-helper-update/edge-right.png" });
  await tucked.click();
  await expect(
    page.getByRole("heading", { name: "What sounds good?", exact: true }),
  ).toBeVisible();
});

test("home, preferences and conversation have distinct return and reset behavior", async ({
  page,
}) => {
  await browse(page);
  await page
    .getByRole("button", { name: "Open Fancy helper", exact: true })
    .click();
  await ask(page, "Remember Soho, budget £35");
  await page
    .getByRole("button", { name: "Confirm and remember", exact: true })
    .click();
  await expect(page.locator(".helper-turn-time time")).toHaveText("13:00");
  await page
    .getByRole("button", { name: "My preferences", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "New conversation", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Open Fancy helper", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "What sounds good?", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "What I remember", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /Continue conversation/ }).click();
  await expect(page.locator(".helper-turn")).toHaveCount(1);
  await page
    .getByRole("button", { name: "New conversation", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Saved preferences are kept",
  );
  await page
    .getByRole("button", { name: "My preferences", exact: true })
    .click();
  await expect(page.locator(".helper-saved")).toHaveText("Soho · up to £35");
  await page
    .getByRole("button", { name: "Back to assistant home", exact: true })
    .click();
  await ask(page, "Find meals £10");
  await expect(page.locator(".helper-meal-card")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Open Fancy helper", exact: true })
    .click();
  await settleHelper(page);
  await page.screenshot({ path: "qa/map-helper-update/home-resume.png" });
  await ask(page, "Find meals");
  await expect(page.locator(".helper-turn")).toHaveCount(1);
  await expect(page.locator(".helper-meal-card")).toHaveCount(2);
  await expect(page.getByRole('button', {name: 'Use larger view', exact: true})).toHaveCount(0);
  await expect(page.getByRole('button', {name: 'Close Fancy helper', exact: true})).toHaveCount(0);
  await expect(page.locator('.helper-tools').getByRole('button', {name: 'My preferences', exact: true})).toBeVisible();
});

test("idle expiry resets context, retains approved preferences and unsent text, and typing renews activity", async ({
  page,
}) => {
  await browse(page, false, true);
  await page
    .getByRole("button", { name: "Open Fancy helper", exact: true })
    .click();
  await ask(page, "Remember Soho, budget £35");
  await page
    .getByRole("button", { name: "Confirm and remember", exact: true })
    .click();
  await ask(page, "Find meals £10");
  await page.clock.fastForward("29:00");
  await expect(page.locator(".helper-turn")).toHaveCount(2);
  await page
    .getByRole("textbox", { name: "Ask about a meal or make a plan" })
    .fill("Find meals");
  await page.clock.fastForward("29:00");
  await expect(page.locator(".helper-turn")).toHaveCount(2);
  await page.clock.fastForward("01:01");
  await expect(
    page.getByRole("heading", { name: "What sounds good?", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "30 minutes without activity",
  );
  await expect(
    page.getByRole("textbox", { name: "Ask about a meal or make a plan" }),
  ).toHaveValue("Find meals");
  await page
    .getByRole("button", { name: "Send to Fancy", exact: true })
    .click();
  await expect(page.locator(".helper-turn")).toHaveCount(1);
  await expect(page.locator(".helper-meal-card")).toHaveCount(2);
  await settleKeyboard(page, false);
  await settleHelper(page);
  await page.screenshot({ path: "qa/map-helper-update/timestamps.png" });
});

test("reopening checks expiry even when a background timer has not run", async ({
  page,
}) => {
  await browse(page);
  await page
    .getByRole("button", { name: "Open Fancy helper", exact: true })
    .click();
  await ask(page, "Remember Soho, budget £35");
  await page
    .getByRole("button", { name: "Confirm and remember", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // Only Date changes: the timer has not elapsed. Reopening must recheck it.
  await page.clock.setFixedTime(new Date("2026-10-18T12:31:00Z"));
  await page
    .getByRole("button", { name: "Open Fancy helper", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "30 minutes without activity",
  );
  await expect(
    page.getByRole("button", { name: /Continue conversation/ }),
  ).toHaveCount(0);
  await settleHelper(page);
  await page.screenshot({ path: "qa/map-helper-update/expired.png" });
  await page
    .getByRole("button", { name: "My preferences", exact: true })
    .click();
  await expect(page.locator(".helper-saved")).toHaveText("Soho · up to £35");
  await page
    .getByRole("button", { name: "Back to assistant home", exact: true })
    .click();
  await ask(page, "Find meals £10");
  await page
    .getByRole("button", { name: "Assistant home", exact: true })
    .click();
  await page.clock.setFixedTime(new Date("2026-10-18T13:02:00Z"));
  await page.getByRole("button", { name: /Continue conversation/ }).click();
  await expect(page.getByRole("status")).toContainText(
    "30 minutes without activity",
  );
  await expect(
    page.getByRole("button", { name: /Continue conversation/ }),
  ).toHaveCount(0);
});
