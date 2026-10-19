const assert = (ok, message) => { if (!ok) throw new Error(message); };
export const measurementScenarios = [
  {
    name: "measurement: clean navigation, multi-choice language/size and complete budget ranges",
    run: async (page) => {
      await page.goto("/#overview");
      assert(await page.locator(".workspace,.avatar,.sample-label,.demo-banner").count() === 0, "No empty workspace, fake avatars or demo banner");
      assert(await page.locator(".nav-heading").count() === 0, "No decorative navigation heading");
      assert(await page.locator(".sidebar").evaluate((el) => { const logo = el.querySelector(".wordmark").getBoundingClientRect(); const nav = el.querySelector("nav").getBoundingClientRect(); return !logo.width || nav.top - logo.bottom >= 30; }), "Logo and navigation have distinct spacing");
      assert(!(await page.locator(".breadcrumb").innerText()).includes("产品洞察"), "No nonexistent breadcrumb level");
      await page.locator(".advanced-filter > summary").click();
      await page.getByLabel("交流语言", {exact:true}).click();
      await page.getByRole("checkbox",{name:"English",exact:true}).check();
      await page.getByRole("checkbox",{name:"中文",exact:true}).check();
      assert(await page.getByRole("checkbox",{name:"English",exact:true}).evaluate((e)=>e.checked), "English stays selected");
      await page.getByLabel("人数",{exact:true}).click();
      await page.getByRole("checkbox",{name:"2 人",exact:true}).check();
      await page.getByRole("checkbox",{name:"4 人",exact:true}).check();
      await page.getByLabel("人均预算",{exact:true}).click();
      await page.getByRole("checkbox",{name:"£0–20",exact:true}).check();
      await page.getByRole("checkbox",{name:"> £40",exact:true}).check();
      assert(await page.getByRole("checkbox",{name:"预算未填写",exact:true}).count() === 1,"Unknown budget is an explicit bucket");
      await page.getByRole("heading",{name:"产品概览.",exact:true}).click();
      assert(await page.locator(".filter-chip").count() === 3,"Selected dimensions remain visible");
      await page.screenshot({path:"qa/measurement-2026-10-19/02-filters.png",fullPage:false});
      await page.reload();
      assert((await page.locator(".active-filters").innerText()).includes("2、4"),"Multi-choice URL survives reload");
    },
  },
  {
    name: "classification: test host excluded from metrics and restored without deleting records",
    run: async (page) => {
      await page.goto("/#overview");
      const before = await page.locator(".metric-card").first().innerText();
      await page.goto("/#quality");
      await page.getByLabel("分类用户编号",{exact:true}).fill("U-001");
      await page.getByLabel("账号分类",{exact:true}).selectOption("test");
      await page.getByRole("button",{name:"保存分类",exact:true}).click();
      assert(await page.getByRole("button",{name:"U-001 · 测试",exact:true}).isVisible(),"Excluded account inspectable");
      await page.screenshot({path:"qa/measurement-2026-10-19/03-classification.png",fullPage:true});
      // Route through navigation to preserve local state.
      await page.getByRole("navigation",{name:"主导航",exact:true}).getByRole("link",{name:"产品概览",exact:true}).click();
      assert(await page.locator(".metric-card").first().innerText() !== before,"Classification affects business results");
      await page.getByRole("navigation",{name:"主导航",exact:true}).getByRole("link",{name:"数据与定义",exact:true}).click();
      await page.getByLabel("账号分类",{exact:true}).selectOption("regular");
      await page.getByRole("button",{name:"保存分类",exact:true}).click();
      await page.getByRole("navigation",{name:"主导航",exact:true}).getByRole("link",{name:"产品概览",exact:true}).click();
      assert(await page.locator(".metric-card").first().innerText() === before,"Restoring regular recalculates original records");
    },
  },
  {
    name: "definitions: follow-up example, distinct seat state and reason rating slice",
    run: async (page) => {
      await page.goto("/#overview");
      await page.getByRole("button",{name:/首次申请后 14 天内出席率/}).click();
      assert((await page.getByRole("dialog").innerText()).includes("10月1日12点"),"Follow-up has a concrete time example");
      assert((await page.getByRole("dialog").innerText()).includes("申请成功是提交成功，不是获准"),"Submission and approval distinct");
      await page.getByRole("button",{name:"关闭详情",exact:true}).click();
      await page.goto("/#journey");
      assert((await page.locator("main").innerText()).includes("这些都不代表实际出席"),"Seat state is distinct from attendance");
      await page.goto("/#retention");
      await page.getByLabel("原因对应评分",{exact:true}).selectOption("2");
      assert(await page.getByRole("heading",{name:"体验原因（可多选）",exact:true}).isVisible(),"Rating reasons available");
      await page.screenshot({path:"qa/measurement-2026-10-19/04-feedback-reasons.png",fullPage:true});
    },
  },
];
