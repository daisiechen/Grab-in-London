import {readinessScenarios} from "./readiness-scenarios.mjs";
import {measurementScenarios} from "./measurement-scenarios.mjs";
import { test } from "@playwright/test";
import { scenarios } from "./browser-scenarios.mjs";
for (const scenario of [...scenarios, ...measurementScenarios, ...readinessScenarios]) {
  test(scenario.name, async ({ page }) => {
    await scenario.run(page);
  });
}
