import type { KeywordFn } from './index';
import { ui } from './ui';
import { assertions } from './assertions';

const USERS: Record<string, string> = { standard_user: 'secret_sauce', locked_out_user: 'secret_sauce' };

export const saucedemo: Record<string, KeywordFn> = {
  login: async (ctx, s) => {
    const user = s.user ?? 'standard_user';
    const pass = s.password ?? USERS[user] ?? 'secret_sauce';
    await ui.open(ctx, { keyword: 'open', url: '/' });
    await ui.fill(ctx, { keyword: 'fill', target: 'login.username', value: user });
    await ui.fill(ctx, { keyword: 'fill', target: 'login.password', value: pass });
    await ui.click(ctx, { keyword: 'click', target: 'login.loginButton' });
  },
  addToCart: async (ctx, s) => {
    await ui.click(ctx, { keyword: 'click', target: `inventory.${s.item ?? 'addBackpack'}` });
  },
  openCart: async (ctx) => {
    await ui.click(ctx, { keyword: 'click', target: 'inventory.cartLink' });
    await assertions.assertUrl(ctx, { keyword: 'assertUrl', value: 'cart.html' });
  },
  checkout: async (ctx, s) => {
    await ui.click(ctx, { keyword: 'click', target: 'cart.checkoutButton' });
    await ui.fill(ctx, { keyword: 'fill', target: 'checkout.firstName', value: s.firstName ?? 'Test' });
    await ui.fill(ctx, { keyword: 'fill', target: 'checkout.lastName', value: s.lastName ?? 'User' });
    await ui.fill(ctx, { keyword: 'fill', target: 'checkout.postalCode', value: s.postalCode ?? '12345' });
    await ui.click(ctx, { keyword: 'click', target: 'checkout.continueButton' });
    await ui.click(ctx, { keyword: 'click', target: 'checkout.finishButton' });
  },
  logout: async (ctx) => {
    await ui.click(ctx, { keyword: 'click', target: 'inventory.menuButton' });
    await ui.click(ctx, { keyword: 'click', target: 'inventory.logoutLink' });
  },
};
