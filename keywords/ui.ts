import type { KeywordFn } from './index';

export const ui: Record<string, KeywordFn> = {
  open: async (ctx, s) => { await ctx.page.goto(s.url ?? '/'); },
  click: async (ctx, s) => { await ctx.locator(s.target).click(); },
  fill: async (ctx, s) => { await ctx.locator(s.target).fill(String(s.value)); },
  select: async (ctx, s) => { await ctx.locator(s.target).selectOption(String(s.value)); },
  press: async (ctx, s) => { await ctx.locator(s.target).press(s.key); },
  store: async (ctx, s) => {
    ctx.vars[s.as] = ((await ctx.locator(s.target).first().innerText()) ?? '').trim();
  },
};
