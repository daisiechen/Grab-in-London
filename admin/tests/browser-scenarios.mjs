// The same scenarios run against Playwright Page or the in-app browser adapter.
// No dependency on a particular browser profile, network service or test framework.
import { readFile } from "node:fs/promises";
const visible = async (locator) => {
  await locator.waitFor({ state: "visible" });
  return locator.isVisible();
};
const ensure = (value, message) => {
  if (!value) throw new Error(message);
};
const nav = (page, name) =>
  page
    .getByRole("navigation", { name: "主导航", exact: true })
    .getByRole("link", { name, exact: true });
const close = async (page) => {
  await page
    .getByRole("button", { name: "关闭详情", exact: true })
    .press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  ensure(
    (await page.getByRole("dialog").count()) === 0,
    "Dialog must close with Escape",
  );
};
export const scenarios = [
  {
    name: "filters: outside click, Escape, route change and removable active choices",
    run: async (page) => {
      await page.goto("/#overview");
      const more = page.locator(".advanced-filter > summary");
      await more.click();
      ensure(
        (await page.locator(".advanced-filter").getAttribute("open")) !== null,
        "Filters open",
      );
      await page.getByLabel("交流语言", { exact: true }).click();
      await page.getByRole("checkbox", { name: "English", exact: true }).check();
      ensure(
        (await page.locator(".advanced-filter").getAttribute("open")) !== null,
        "Choosing inside keeps filters open",
      );
      await page
        .getByRole("heading", { name: "产品概览.", exact: true })
        .click();
      ensure(
        (await page.locator(".advanced-filter").getAttribute("open")) === null,
        "Outside click closes filters",
      );
      ensure(
        await visible(
          page.getByRole("button", { name: "移除筛选: 交流语言", exact: true }),
        ),
        "Hidden choice remains visible as a chip",
      );
      await more.click();
      await more.press("Escape");
      ensure(
        await more.evaluate((el) => el === document.activeElement),
        "Escape restores trigger focus",
      );
      await more.click();
      await nav(page, "用户旅程").click();
      ensure(
        (await page.locator(".advanced-filter").getAttribute("open")) === null,
        "Route change closes filters",
      );
      await page
        .getByRole("button", { name: "移除筛选: 交流语言", exact: true })
        .click();
      ensure(
        (await page
          .getByRole("button", { name: "移除筛选: 交流语言", exact: true })
          .count()) === 0,
        "Choice removable without reopening popup",
      );
    },
  },
  {
    name: "overview: checks use current maturity and have inspectable evidence",
    run: async (page) => {
      await page.goto("/#overview");
      ensure(
        await visible(
          page.getByRole("heading", { name: "重复参与仍在观察", exact: true }),
        ),
        "28-day cohort is observing",
      );
      const metric = page.getByRole("button", { name: /首次申请后 14 天内出席率/ });
      await metric.click();
      await close(page);
      ensure(
        await metric.evaluate((el) => el === document.activeElement),
        "Metric focus restored",
      );
      await page.getByRole("button", { name: "90天", exact: true }).click();
      ensure(
        await visible(
          page.getByRole("heading", {
            name: "已有完整 30 天的再赴约结果",
            exact: true,
          }),
        ),
        "90-day scope uses mature results",
      );
      ensure(
        !(await page.locator("main").innerText()).includes(
          "近 28 天首次赴约队列尚未成熟",
        ),
        "No stale fixed weekly advice",
      );
      await page.screenshot({
        path: "qa/survey-2026-10-20/06-after-overview.png",
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "查看关联记录", exact: true })
        .click();
      ensure(
        (await page
          .getByLabel("出席记录筛选（仅下方列表）", { exact: true })
          .evaluate((el) => el.value)) === "unresolved",
        "Evidence action selects unresolved records",
      );
    },
  },
  {
    name: "journey: localized filters/search survive; nested records have a back path",
    run: async (page) => {
      await page.goto("/#journey");
      await page.getByLabel("区域", { exact: true }).click();
      await page.getByRole("checkbox", { name: "Camden", exact: true }).check();
      await page.getByLabel("搜索记录", { exact: true }).fill("A-");
      await page
        .getByRole("button", { name: "切换为英文", exact: true })
        .click();
      ensure(
        (await page
          .getByLabel("Area", { exact: true })
          .getAttribute("aria-label")) === "Area",
        "Labels localize",
      );
      ensure(
        (await page
          .getByLabel("Search records", { exact: true })
          .evaluate((el) => el.value)) === "A-",
        "Search retained across locale",
      );
      await page
        .getByRole("button", { name: "Switch to Chinese", exact: true })
        .click();
      await page.locator("tbody .text-button").first().click();
      ensure(await visible(page.getByRole("dialog")), "User detail opens");
      await page
        .getByRole("dialog")
        .locator(".evidence-list .text-button")
        .first()
        .click();
      ensure(
        await page
          .getByRole("dialog")
          .innerText()
          .then((text) => text.includes("参与与出席证据")),
        "Related meal opens",
      );
      await page
        .getByRole("button", { name: "返回上一条详情", exact: true })
        .click();
      ensure(
        await page
          .getByRole("dialog")
          .innerText()
          .then((text) => text.includes("相关饭局")),
        "Returns to same user",
      );
      await close(page);
      await page.screenshot({
        path: "qa/survey-2026-10-20/07a-after-join.png",
        fullPage: true,
      });
      await page.getByRole("button", { name: "发起饭局", exact: true }).click();
      ensure(
        await visible(
          page.getByRole("heading", { name: "创建卡点", exact: true }),
        ),
        "Create journey works",
      );
      await page
        .getByRole("button", { name: "查看相关事件 →", exact: true })
        .click();
      ensure(
        await visible(page.getByRole("dialog")),
        "Creation error trace opens",
      );
      await close(page);
      await page.screenshot({
        path: "qa/survey-2026-10-20/07-after-journey.png",
        fullPage: true,
      });
    },
  },
  {
    name: "supply: explicit date ordering, pagination, no-results and restoration",
    run: async (page) => {
      await page.goto("/#supply");
      await page.getByRole("button", { name: /^Camden/ }).click();
      ensure(
        (await page.locator("tbody tr").count()) === 6,
        "First page has six records",
      );
      const newest = await page.locator("tbody tr").first().innerText();
      await page.getByRole("button", { name: "下一页", exact: true }).click();
      ensure(
        (await page.locator("tbody tr").count()) === 1,
        "Second page has one record",
      );
      await page.getByRole("button", { name: /最新在前/ }).click();
      ensure(
        (await page.locator("tbody tr").count()) === 6,
        "Sort resets pagination",
      );
      ensure(
        (await page.locator("tbody tr").first().innerText()) !== newest,
        "Sort changes actual date order",
      );
      await page
        .getByRole("button", { name: /^查看 M-/ })
        .first()
        .click();
      ensure(
        (await page.getByRole("dialog").innerText()).includes("业务时间线"),
        "Meal trace opens",
      );
      await close(page);
      await page.getByLabel("搜索记录", { exact: true }).fill("not-a-record");
      ensure(
        await visible(page.getByText("没有符合条件的数据", { exact: true })),
        "Search empty state",
      );
      await page.getByRole("button", { name: "清除搜索", exact: true }).click();
      ensure(
        (await page.locator("tbody tr").count()) === 6,
        "Clear restores first page",
      );
      await page.getByRole("button", { name: /^未知/ }).click();
      ensure(
        (await page
          .getByLabel("出席记录筛选（仅下方列表）", { exact: true })
          .evaluate((el) => el.value)) === "unknown",
        "Attendance tiles filter only the record list",
      );
      await page
        .getByRole("button", { name: /^查看 M-/ })
        .first()
        .click();
      ensure(
        (await page.getByRole("dialog").innerText()).includes("未知"),
        "Filtered meal contains missing evidence",
      );
      await close(page);
      await page
        .getByLabel("出席记录筛选（仅下方列表）", { exact: true })
        .selectOption("all");
      await page.screenshot({
        path: "qa/survey-2026-10-20/08-after-supply.png",
        fullPage: true,
      });
    },
  },
  {
    name: "retention: whole-cohort drilldown and distinct feedback labels",
    run: async (page) => {
      await page.goto("/#retention");
      ensure(
        await visible(
          page.getByText("当前队列还没有完整的 30 天观察窗口", { exact: true }),
        ),
        "Immature warning",
      );
      await page
        .getByRole("button", { name: "查看 90 天", exact: true })
        .click();
      ensure(
        await visible(page.locator(".cohort-cell.mature").first()),
        "Mature cohorts present",
      );
      ensure(
        await visible(page.getByRole("button", { name: /^饭局评分覆盖率/ })),
        "Feedback coverage has precise label",
      );
      ensure(
        await visible(page.getByRole("button", { name: /^问卷：愿意再参加比例/ })),
        "Return intent has distinct label",
      );
      await page.locator(".cohort-table tbody .text-button").first().click();
      ensure(
        await page
          .getByRole("dialog")
          .innerText()
          .then((text) => text.includes("该组全部用户")),
        "Date opens entire cohort, not arbitrary first user",
      );
      ensure(
        (await page.getByRole("dialog").locator("tbody tr").count()) === 6,
        "Cohort has a user table",
      );
      await page
        .getByRole("dialog")
        .getByRole("button", { name: /^查看 U-/ })
        .first()
        .click();
      await page
        .getByRole("button", { name: "返回上一条详情", exact: true })
        .click();
      ensure(
        (await page.getByRole("dialog").innerText()).includes("队列"),
        "Back restores cohort",
      );
      await page.screenshot({
        path: "qa/survey-2026-10-20/09a-after-cohort-detail.png",
        fullPage: false,
      });
      await close(page);
      await page.screenshot({
        path: "qa/survey-2026-10-20/09-after-retention.png",
        fullPage: true,
      });
    },
  },
  {
    name: "quality: no normal test switches; dictionary and quarantined evidence",
    run: async (page) => {
      await page.goto("/#quality");
      ensure(
        (await page.getByLabel("数据场景", { exact: true }).count()) === 0,
        "Review controls hidden in ordinary product",
      );
      ensure(
        await visible(
          page.getByRole("heading", { name: "数据来源", exact: true }),
        ),
        "Source status remains visible",
      );
      await page
        .getByRole("button", { name: "查看异常事件 →", exact: true })
        .click();
      ensure(
        (await page.getByRole("dialog").innerText()).includes("BAD-1"),
        "Malformed event trace",
      );
      await close(page);
      await page.getByLabel("搜索指标", { exact: true }).fill("30");
      ensure(
        (await page.locator(".dictionary-list>button").count()) === 1,
        "Dictionary filters",
      );
      await page.locator(".dictionary-list>button").click();
      ensure(
        (await page.getByRole("dialog").innerText()).includes("计算方式"),
        "Definition complete",
      );
      await close(page);
      await page
        .getByRole("button", { name: "清除指标搜索", exact: true })
        .click();
      await page.screenshot({
        path: "qa/survey-2026-10-20/10-after-quality.png",
        fullPage: true,
      });
    },
  },
  {
    name: "review-only empty and failure states recover without stale charts",
    run: async (page) => {
      await page.goto("/?review=1#quality");
      await page.getByLabel("数据场景", { exact: true }).selectOption("empty");
      await nav(page, "产品概览").click();
      ensure(
        await visible(page.getByText("没有符合条件的数据", { exact: true })),
        "Empty chart",
      );
      ensure(
        await visible(
          page.getByRole("heading", { name: "当前范围暂无数据", exact: true }),
        ),
        "No fabricated data check",
      );
      await nav(page, "数据与定义").click();
      await page.getByLabel("数据场景", { exact: true }).selectOption("error");
      ensure(await visible(page.getByRole("alert")), "Failure state");
      ensure(
        (await page.locator(".metric-card").count()) === 0,
        "Stale charts hidden",
      );
      await page.getByRole("button", { name: "重试加载", exact: true }).click();
      ensure(
        await visible(
          page.getByRole("heading", {
            name: "数据来源与统计口径",
            exact: true,
          }),
        ),
        "Retry restores sample",
      );
    },
  },
  {
    name: "attendance: read-only source evidence and no routine verification operation",
    run: async (page) => {
      await page.goto("/#supply");
      await page.getByLabel("搜索记录", { exact: true }).fill("M-038");
      await page.getByRole("button", { name: "查看 M-038", exact: true }).click();
      ensure((await page.getByRole("dialog").innerText()).includes("本人报告优先"), "Priority is explained");
      ensure(await page.getByRole("button", {name:"核实出席",exact:true}).count() === 0, "No routine manual verification");
      ensure(await page.locator(".evidence-list>div").count() > 0, "Evidence rows retained");
      await close(page);
    },
  },
  {
    name: "date drafts validate; aggregate export includes all ratios and cohort denominators",
    run: async (page) => {
      await page.goto("/#overview");
      await page.getByLabel("开始日期", { exact: true }).fill("2026-10-18");
      await page.getByLabel("结束日期", { exact: true }).fill("2026-10-01");
      await page.getByRole("button", { name: "应用", exact: true }).click();
      ensure(
        (await page.getByRole("alert").innerText()).includes(
          "开始日期不得晚于结束日期",
        ),
        "Invalid date range rejected",
      );
      await page.getByRole("button", { name: "重置", exact: true }).click();
      const downloading = page.waitForEvent("download");
      await page.getByRole("button", { name: "导出指标", exact: true }).click();
      const path = await (await downloading).path();
      const csv = await readFile(path, "utf8");
      ensure(
        csv.includes("cohort_week") &&
          csv.includes("zeroResults") &&
          csv.includes("feedbackCoverage") && csv.includes("surveyUnansweredAgain") && csv.includes("surveyScope") && csv.includes("surveyWillingToReturn"),
        "Export covers drivers and cohorts, not just three metrics",
      );
      ensure(
        csv.includes("Fictional demo data") && !/U-\d{3}/.test(csv),
        "Aggregate export clearly fictional and no raw users",
      );
    },
  },
  {
    name: "compact viewport: named icon navigation, filters and localized state",
    run: async (page) => {
      await page.setViewportSize({ width: 864, height: 609 });
      await page.goto("/#overview");
      ensure(
        await visible(nav(page, "用户旅程")),
        "Icon navigation has accessible names",
      );
      await nav(page, "饭局与供需").click();
      await page.setViewportSize({ width: 390, height: 844 });
      await page
        .getByRole("navigation", { name: "移动端导航", exact: true })
        .getByRole("link", { name: "数据与定义", exact: true })
        .click();
      const more = page.locator(".advanced-filter > summary");
      await more.click();
      ensure(
        await page.locator(".advanced-filter > div").evaluate((el) => {
          const rect = el.getBoundingClientRect();
          return rect.left >= 0 && rect.right <= innerWidth;
        }),
        "Narrow filter popup stays within viewport",
      );
      await more.press("Escape");
      await page
        .getByRole("button", { name: "切换为英文", exact: true })
        .click();
      ensure(
        await visible(
          page.getByRole("heading", {
            name: "Data & definitions.",
            exact: true,
          }),
        ),
        "Mobile locale switches",
      );
      ensure(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        "No document horizontal overflow",
      );
      await page.screenshot({
        path: "qa/survey-2026-10-20/11-after-mobile.png",
        fullPage: true,
      });
      await page.setViewportSize({ width: 864, height: 609 });
    },
  },
];
