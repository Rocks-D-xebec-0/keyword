import { expect } from '@playwright/test';
import type { KeywordFn } from './index';

export const assertions: Record<string, KeywordFn> = {
  assertVisible: async (ctx, s) => { await expect(ctx.locator(s.target)).toBeVisible(); },
  assertNotVisible: async (ctx, s) => { await expect(ctx.locator(s.target)).toBeHidden(); },
  assertText: async (ctx, s) => {
    const l = ctx.locator(s.target).first();
    if (s.exact) await expect(l).toHaveText(String(s.value));
    else await expect(l).toContainText(String(s.value));
  },
  assertUrl: async (ctx, s) => { await expect(ctx.page).toHaveURL(new RegExp(String(s.value))); },
  assertCount: async (ctx, s) => { await expect(ctx.locator(s.target)).toHaveCount(Number(s.value)); },
};
