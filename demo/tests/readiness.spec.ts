import { test, expect, type Page } from "@playwright/test";
async function choose(page: Page, name: string) {
  await page.locator("label.choice-chip").filter({ has: page.getByRole("radio", { name, exact: true }) }).click();
}
async function signIn(page: Page, review = true) {
  await page.goto(review ? "/?review=1" : "/");
  await page.getByRole("button", { name: "Skip intro", exact: true }).click();
  await page.getByRole("button", { name: "Find your people", exact: true }).click();
  await choose(page, "Log in");
  await page.getByRole("button", { name: "Continue with Google", exact: true }).click();
  await page.getByRole("button", { name: "Continue as Alex", exact: true }).click();
  await expect(page.getByRole("button", { name: "Create meal", exact: true })).toBeVisible();
}
async function createMeal(page: Page) {
  await page.getByRole("button", { name: "Create meal", exact: true }).click();
  await page.getByRole("group", { name: "Minimum people, including you", exact: true }).locator("label.choice-chip").filter({ hasText: "2 people" }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Give your meal a name", { exact: true }).fill("A friendly local supper");
  await page.getByLabel("What should people expect?", { exact: true }).fill("An easy dinner with new neighbours and friendly conversation.");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("checkbox", { name: /I have a reservation/ }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("checkbox", { name: /I’ve checked the arrangements/ }).check();
  await page.getByRole("button", { name: "Publish meal", exact: true }).click();
  await page.getByRole("button", { name: "Manage applications", exact: true }).click();
}
test("attendance opens independent meal experience; contact records remain separate", async ({ page }) => {
  await signIn(page);
  await page.getByRole("button", { name: "Meals", exact: true }).click();
  await expect(page.getByRole("heading", { name: "A good meal is waiting.", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Past", exact: true }).click();
  await page.getByRole("button", { name: "Leave feedback", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save meal experience", exact: true })).toHaveCount(0);
  await choose(page, "I attended");
  await expect(page.getByRole("radio", { name: "Yes", exact: true })).toHaveCount(0);
  await expect(page.locator(".body-pad > .state-illustration")).toHaveCount(0);
  await page.getByRole("button", { name: "About attendance", exact: true }).focus();
  await expect(page.getByRole("tooltip")).toContainText("Your report takes priority");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await choose(page, "4");
  await page.getByRole("button", { name: "Save meal experience", exact: true }).click();
  await expect(page.getByText("Your private meal experience is saved.", { exact: true })).toBeVisible();
  await page.screenshot({ path: "qa/comments-2026-10-20/meal-experience.png" });
  await page.getByLabel("A public reference · optional", { exact: false }).fill("Maya made everyone feel welcome.");
  await page.getByRole("checkbox", { name: /I’d like to share a table again/ }).check();
  await page.getByRole("button", { name: "Save feedback", exact: true }).click();
  await page.getByRole("button", { name: /Preview mutual connection/ }).click();
  await page.getByRole("button", { name: "Say hello to Maya", exact: true }).click();
  await page.getByRole("textbox", { name: "Message", exact: true }).fill("It was lovely meeting you.");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await page.getByRole("button", { name: "Withdraw connection", exact: true }).click();
  await page.getByRole("button", { name: "Withdraw connection", exact: true }).last().click();
  await expect(page.getByRole("textbox", { name: "Message", exact: true })).toHaveCount(0);
  await expect(page.getByText("It was lovely meeting you.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await choose(page, "Emma");
  await expect(page.getByLabel("A public reference · optional", { exact: false })).toHaveValue("");
  await expect(page.getByRole("radio", { name: "4", exact: true })).toBeChecked();
  await choose(page, "I didn’t attend");
  await expect(page.getByRole("button", { name: "Save feedback", exact: true })).toHaveCount(0);
});
test("approval locks arrangements; cancellation preserves group; dissolution is independent", async ({ page }) => {
  await signIn(page); await createMeal(page);
  await expect(page.getByRole("button", { name: "Edit arrangements", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: /^Approve/ }).click();
  await expect(page.getByRole("button", { name: "Edit arrangements", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Cancel this meal", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Your group chat stays open");
  await page.getByRole("button", { name: "Cancel meal for everyone", exact: true }).click();
  await page.getByRole("button", { name: "Open meal group", exact: true }).click();
  await page.getByRole("textbox", { name: "Message", exact: true }).fill("We can still arrange another meal.");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await page.getByRole("button", { name: "Open group settings", exact: true }).click();
  await page.getByRole("button", { name: "Dissolve group", exact: true }).click();
  await page.getByRole("button", { name: "Dissolve group", exact: true }).last().click();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Message", exact: true })).toHaveCount(0);
  await expect(page.getByText("We can still arrange another meal.", { exact: true })).toBeVisible();
});
test("deadline cancels an insufficient meal without cancelling its group", async ({ page }) => {
  await signIn(page); await createMeal(page);
  await page.getByRole("button", { name: "Advance to application deadline", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Approve/ })).toBeDisabled();
  await expect(page.getByText(/This meal is cancelled\. Please cancel/)).toBeVisible();
  await page.getByRole("button", { name: "Open meal group", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Message", exact: true })).toBeVisible();
});
test("ended meals keep chatting; leaving group keeps old messages read-only", async ({ page }) => {
  await signIn(page, false);
  await page.getByRole("button", { name: "Meals", exact: true }).click();
  await page.getByRole("button", { name: "Past", exact: true }).click();
  await page.getByRole("button", { name: "Open supper club group", exact: true }).click();
  await page.getByRole("textbox", { name: "Message", exact: true }).fill("Thanks for a lovely evening.");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await page.getByRole("button", { name: "Open group settings", exact: true }).click();
  await page.getByRole("button", { name: "Leave group", exact: true }).click();
  await page.getByRole("button", { name: "Leave group", exact: true }).last().click();
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Message", exact: true })).toHaveCount(0);
  await expect(page.getByText("Thanks for a lovely evening.", { exact: true })).toBeVisible();
});

test("mobile form preserves range/deadline validation and host report cannot override self", async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await signIn(page);
  await page.getByRole("button", { name: "Create meal", exact: true }).click();
  await page.getByLabel("Deadline time", { exact: false }).fill("18:45");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("at least 30 minutes");
  await page.getByLabel("Deadline time", { exact: false }).fill("18:00");
  await page.screenshot({ path: "qa/comments-2026-10-20/create-range.png" });
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await page.getByRole("button", { name: "Meals", exact: true }).click();
  await page.getByRole("button", { name: "Past", exact: true }).click();
  await page.getByRole("button", { name: "Leave feedback", exact: true }).click();
  await page.getByRole("button", { name: "Preview host attendance report", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save meal experience", exact: true })).toBeVisible();
  await choose(page, "I didn’t attend");
  await expect(page.getByRole("button", { name: "Save meal experience", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Advance to reporting deadline", exact: true }).click();
  await expect(page.getByRole("radio", { name: "I attended", exact: true })).toHaveCount(0);
});
