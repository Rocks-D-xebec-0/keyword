import { test } from '@playwright/test';
import { registry } from '../keywords';
import { Context, Step } from './context';

function describe(step: Step): string {
  const { keyword, ...args } = step;
  const parts = Object.entries(args).map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`);
  return parts.length ? `${keyword} (${parts.join(', ')})` : keyword;
}

export async function runSteps(ctx: Context, steps: Step[]) {
  for (const [i, raw] of steps.entries()) {
    const fn = registry[raw.keyword];
    if (!fn) {
      throw new Error(
        `Step ${i + 1}: unknown keyword '${raw.keyword}'. Available keywords: ${Object.keys(registry).sort().join(', ')}`,
      );
    }
    const step: Step = Object.fromEntries(
      Object.entries(raw).map(([k, v]) => [k, k === 'keyword' ? v : ctx.interpolate(v)]),
    ) as Step;
    await test.step(`${i + 1}. ${describe(step)}`, async () => {
      await fn(ctx, step);
    });
  }
}
