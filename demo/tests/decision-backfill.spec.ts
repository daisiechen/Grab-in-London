import { test, expect, type Page } from "@playwright/test";
async function login(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Skip intro", exact: true }).click();
  await page.getByRole("button", { name: "Find your people", exact: true }).click();
  await page.locator("label.choice-chip").filter({ has: page.getByRole("radio", { name: "Log in", exact: true }) }).click();
  await page.getByRole("button", { name: "Continue with Google", exact: true }).click();
  await page.getByRole("button", { name: "Continue as Alex", exact: true }).click();
}
test("profile permits 1000-character introduction and keeps it after reopening", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  const bio = page.getByRole("textbox", { name: "About you", exact: true });
  await expect(bio).toHaveAttribute("maxlength", "1000");
  await bio.fill("x".repeat(19));
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("20–1,000");
  await bio.fill("x".repeat(1000));
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "About you", exact: true })).toHaveValue("x".repeat(1000));
});
test("host declarations start unknown and publish only explicitly selected values", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "Create meal", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("radio", { name: "Not provided", exact: true })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Vegetarian options", exact: true })).not.toBeChecked();
  await page.getByRole("textbox", { name: "Give your meal a name", exact: true }).fill("A declared Japanese dinner");
  await page.getByRole("textbox", { name: "What should people expect?", exact: true }).fill("A friendly dinner with easy conversation and new friends.");
  await page.locator("label.choice-chip").filter({ has: page.getByRole("radio", { name: "Japanese", exact: true }) }).click();
  await page.locator("label.choice-chip").filter({ has: page.getByRole("checkbox", { name: "Vegetarian options", exact: true }) }).click();
  await expect(page.getByText(/Host-reported · not an allergy guarantee/)).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.locator("label.create-consent input").check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByText(/Cuisine: Japanese/)).toContainText("Vegetarian options");
  await page.locator("label.create-consent input").check();
  await page.getByRole("button", { name: "Publish meal", exact: true }).click();
  await expect(page.getByText(/Cuisine: Japanese/)).toContainText("Host-reported");
  await expect(page.locator(".toast")).toHaveCount(0);
  await page.getByText(/Cuisine: Japanese/).scrollIntoViewIfNeeded();
  await page.screenshot({ path: "demo/qa/decision-backfill-2026-10-22/host-declarations.png" });
});
