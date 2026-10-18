import { test, expect } from "@playwright/test";

test("overview, metric definition, keyboard dismissal and real-data boundary", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByText("交互演示 · 全部记录为虚构示例，尚未连接真实业务服务。"),
  ).toBeVisible();
  const metric = page.getByRole("button", { name: /14 天首次赴约率/ });
  await metric.click();
  await expect(page.getByRole("dialog")).toContainText("计算方式");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(metric).toBeFocused();
  await page.screenshot({ path: "qa/overview.zh-CN.png", fullPage: true });
  expect(errors).toEqual([]);
});

test("application friction, meal/user drill-down, search and preserved locale filters", async ({
  page,
}) => {
  await page.goto("/#journey");
  await page.getByLabel("区域", { exact: true }).selectOption("Camden");
  await page.getByLabel("搜索记录").fill("A-");
  await page.getByRole("button", { name: "切换为英文" }).click();
  await expect(page.getByLabel("Area", { exact: true })).toHaveValue("Camden");
  await expect(
    page.getByRole("heading", { name: "Application progression" }),
  ).toBeVisible();
  const record = page.locator("tbody .text-button").first();
  await record.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close details" }).click();
  await page.getByRole("button", { name: "Host a meal", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Creation friction" }),
  ).toBeVisible();
  await page.screenshot({ path: "qa/journey.en.png", fullPage: true });
});

test("supply gaps filter records, inspect attendance evidence and paginate", async ({
  page,
}) => {
  await page.goto("/#supply");
  await page.getByRole("button", { name: /^Camden/ }).click();
  await expect(page.getByLabel("区域", { exact: true })).toHaveValue("Camden");
  await expect(page.locator("tbody tr")).toHaveCount(6);
  await page.getByRole("button", { name: "下一页" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page
    .getByRole("button", { name: /^查看 M-/ })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toContainText("参与与出席证据");
  await page.keyboard.press("Escape");
  await page.getByLabel("搜索记录").fill("not-a-record");
  await expect(page.getByText("没有符合条件的数据")).toBeVisible();
  await page.getByRole("button", { name: "清除搜索" }).click();
  await expect(page.locator("tbody tr")).not.toHaveCount(0);
});

test("mature and immature repeat cohorts stay separate; date validation and CSV export", async ({
  page,
}) => {
  await page.goto("/#retention");
  await expect(
    page.getByText("当前队列还没有完整的 30 天观察窗口"),
  ).toBeVisible();
  await page.getByRole("button", { name: "查看 90 天", exact: true }).click();
  await expect(page.locator(".cohort-cell.mature").first()).toBeVisible();
  await page.getByLabel("开始日期").fill("2026-10-18");
  await page.getByLabel("结束日期").fill("2026-10-01");
  await page.getByRole("button", { name: "应用", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "开始日期不得晚于结束日期",
  );
  await page.getByRole("button", { name: "重置", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出指标" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe(
    "fancy-demo-insights.csv",
  );
  await page.getByRole("button", { name: "查看 90 天", exact: true }).click();
  await page.screenshot({ path: "qa/retention.zh-CN.png", fullPage: true });
});

test("quality dictionary, quarantined event, empty and failed state recovery", async ({
  page,
}) => {
  await page.goto("/#quality");
  await page.getByRole("button", { name: "查看异常事件" }).click();
  await expect(page.getByRole("dialog")).toContainText("BAD-1");
  await page.keyboard.press("Escape");
  await page.getByLabel("搜索指标").fill("30");
  await expect(page.locator(".dictionary-list>button")).toHaveCount(1);
  await page.getByRole("button", { name: "清除指标搜索" }).click();
  await page.getByLabel("数据场景").selectOption("empty");
  await page.getByRole("link", { name: "产品概览", exact: true }).click();
  await expect(page.getByText("没有符合条件的数据")).toBeVisible();
  await page.getByRole("link", { name: "数据与定义", exact: true }).click();
  await page.getByLabel("数据场景").selectOption("error");
  await expect(page.getByRole("alert")).toContainText("演示加载失败状态");
  await page.getByRole("button", { name: "重试加载" }).click();
  await expect(
    page.getByRole("heading", { name: "清楚知道每个数字从哪里来。" }),
  ).toBeVisible();
});

test("narrow viewport retains navigation, native selectors, locale and no document overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "移动端导航" })
    .getByRole("link", { name: "饭局与供需" })
    .click();
  await page.getByLabel("区域", { exact: true }).selectOption("Soho");
  await page.getByRole("button", { name: "切换为英文" }).click();
  await expect(page.getByLabel("Area", { exact: true })).toHaveValue("Soho");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "qa/supply.mobile.en.png", fullPage: true });
});

test("sample attendance verification requires a basis and updates only local evidence", async ({
  page,
}) => {
  await page.goto("/#supply");
  await page.getByLabel("搜索记录").fill("M-038");
  await page.getByRole("button", { name: "查看 M-038", exact: true }).click();
  const missingRow = page
    .locator(".evidence-list>div")
    .filter({ has: page.getByText("未知", { exact: true }) })
    .filter({
      has: page.getByRole("button", { name: "核实示例", exact: true }),
    })
    .first();
  await missingRow
    .getByRole("button", { name: "核实示例", exact: true })
    .click();
  await page.getByRole("button", { name: "保存示例核实", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("请填写核实依据");
  await page.getByLabel("核实依据（必填）").fill("演示：与参与者核对出席");
  await page.getByRole("button", { name: "保存示例核实", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("已核实（模拟）");
  await expect(page.getByRole("status")).toContainText("相关指标已重算");
  await page.screenshot({
    path: "qa/attendance-evidence.zh-CN.png",
    fullPage: true,
  });
  await page.reload();
  await page.getByLabel("搜索记录").fill("M-038");
  await page.getByRole("button", { name: "查看 M-038", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toContainText("已核实（模拟）");
});
