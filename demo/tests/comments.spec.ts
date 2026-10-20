import { test, expect, type Page } from "@playwright/test";
async function login(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Skip intro", exact: true }).click();
  await page.getByRole("button", { name: "Find your people", exact: true }).click();
  await page.locator("label.choice-chip").filter({ has: page.getByRole("radio", { name: "Log in", exact: true }) }).click();
  await page.getByRole("button", { name: "Continue with Google", exact: true }).click();
  await page.getByRole("button", { name: "Continue as Alex", exact: true }).click();
}
async function pick(page: Page, role: "radio" | "checkbox", name: string) {
  await page.locator("label.choice-chip").filter({ has: page.getByRole(role, { name, exact: true }) }).click();
}
test("calendar multi-select applies or discards as one pending filter", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "Filter by date", exact: true }).click();
  await expect.poll(() => page.getByTestId("bottom-sheet").evaluate((el) => Math.abs(new DOMMatrixReadOnly(getComputedStyle(el).transform).m42))).toBeLessThan(0.5);
  for (const date of ["Friday, 23 October 2026", "Saturday, 24 October 2026"]) {
    await page.locator("label.calendar-day").filter({ has: page.getByRole("checkbox", { name: date, exact: true }) }).click();
    await expect(page.getByRole("checkbox", { name: date, exact: true })).toBeChecked();
  }
  await expect(page.getByRole("checkbox", { checked: true })).toHaveCount(2);
  await page.getByRole("button", { name: "Apply date", exact: true }).click();
  await expect(page.getByRole("button", { name: "Filter by date", exact: true })).toContainText("2 dates");
  await page.getByRole("button", { name: "Filter by date", exact: true }).click();
  await page.locator("label.calendar-day").filter({ has: page.getByRole("checkbox", { name: "Friday, 23 October 2026", exact: true }) }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Filter by date", exact: true })).toContainText("2 dates");
});
test("inbox tabs, filled icon, avatar profile and member-only group actions", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "Inbox", exact: true }).click();
  await expect(page.locator('.bottom-nav [aria-current="page"] [data-filled="true"]')).toHaveCount(1);
  await page.getByRole("tab", { name: /Applications/ }).click();
  await expect(page.getByText("No pending applications.", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: /Chats/ }).click();
  await page.locator(".inbox-row").first().click();
  await expect(page.getByRole("button", { name: "Leave group", exact: true })).toHaveCount(0);
  await page.locator(".chat-message button.avatar").first().click();
  await expect(page.getByRole("heading", { name: "Maya", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Go back", exact: true }).first().click();
  await page.getByRole("button", { name: "Open group settings", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Group members/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Leave group", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Dissolve group", exact: true })).toHaveCount(0);
  await page.screenshot({ path: "qa/comments-2026-10-20/group-settings.png" });
});
test("profile options persist; settings survey works without meal attendance", async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await login(page);
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await pick(page, "radio", "Studying in London");
  await page.getByLabel("Conversation language", { exact: true }).selectOption("French");
  await pick(page, "checkbox", "Books");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await expect(page.getByRole("radio", { name: "Studying in London", exact: true })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Books", exact: true })).toBeChecked();
  await expect(page.getByLabel("Conversation language", { exact: true })).toHaveValue("French");
  await page.getByRole("button", { name: "Go back", exact: true }).first().click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Product survey", exact: true }).click();
  await page.getByRole("button", { name: "Save survey", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Answer a question or choose a factor before saving.");
  await pick(page, "checkbox", "Company");
  await page.getByRole("button", { name: "Save survey", exact: true }).click();
  await expect(page.getByText("Your product survey is saved.", { exact: true })).toBeVisible();
  await expect(page.getByRole("radio", { name: "No", exact: true })).not.toBeChecked();
  await page.getByRole("button", { name: "About the product survey", exact: true }).click();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await pick(page, "radio", "No");
  await page.getByRole("button", { name: "Save survey", exact: true }).click();
  await page.getByRole("button", { name: "Go back", exact: true }).first().click();
  await page.getByRole("button", { name: "Product survey", exact: true }).click();
  await expect(page.getByRole("radio", { name: "No", exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Clear answer", exact: true }).click();
  await expect(page.getByRole("radio", { name: "No", exact: true })).not.toBeChecked();
  await page.screenshot({ path: "qa/comments-2026-10-20/product-survey.png" });
});
