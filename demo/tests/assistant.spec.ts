import { expect, test, type Page } from "@playwright/test";

async function browse(page: Page, review = false) {
  await page.clock.setFixedTime(new Date("2026-10-18T12:00:00Z"));
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
  await page.screenshot({ path: "qa/ai-helper/launcher.png" });
  await page
    .getByRole("button", { name: "Hide Fancy helper", exact: true })
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
  await page.screenshot({ path: "qa/ai-helper/search-iphone.png" });
  await ask(page, "£10");
  await expect(page.getByRole("log")).toContainText(
    "No available tables match",
  );
  await ask(page, "£35");
  await page
    .getByRole("button", { name: "Close Fancy helper", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open Fancy helper", exact: true })
    .click();
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
  await page.getByRole("button", { name: "Back to chat", exact: true }).click();
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
  await page.screenshot({ path: "qa/ai-helper/preferences.png" });
  await page
    .getByRole("button", { name: "Delete preferences", exact: true })
    .click();
  await expect(page.locator(".helper-saved")).toHaveText(
    "No saved preferences yet.",
  );
  await page.getByRole("button", { name: "Back to chat", exact: true }).click();
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

test("keyboard and expanded panel stay in phone bounds on iPhone and Pixel", async ({
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
    if (device === "iPhone")
      await page
        .getByRole("button", { name: "Expand assistant", exact: true })
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
      path: `qa/ai-helper/keyboard-${device === "iPhone" ? "iphone" : "pixel"}.png`,
    });
    await page
      .getByRole("button", { name: "Close Fancy helper", exact: true })
      .click();
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
  await page.screenshot({ path: "qa/ai-helper/message-draft.png" });
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
