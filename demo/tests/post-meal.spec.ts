import {test} from "@playwright/test";
import {postMealScenario} from "./post-meal-scenario.mjs";
test("attendance, private meal experience, host reporting and cross-meal state", async ({page}) => {
  await postMealScenario(page);
});
