import { test } from '@playwright/test';
import { loadScenarios } from '../engine/loader';
import { Context } from '../engine/context';
import { runSteps } from '../engine/runner';

// Optional filter: SCENARIO_TAG=smoke npx playwright test
const tag = process.env.SCENARIO_TAG;

for (const sc of loadScenarios()) {
  if (tag && !sc.tags?.includes(tag)) continue;
  const title = `${sc.name} ${(sc.tags ?? []).map((t) => '@' + t).join(' ')}`.trim();
  test(title, async ({ page }) => {
    await runSteps(new Context(page), sc.steps);
  });
}
