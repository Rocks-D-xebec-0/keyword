import { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

export type Step = { keyword: string; [arg: string]: any };

const LOCATOR_DIR = path.resolve(__dirname, '..', 'locators');

function loadLocators(): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const f of fs.readdirSync(LOCATOR_DIR).filter((f) => f.endsWith('.json'))) {
    out[path.basename(f, '.json')] = JSON.parse(fs.readFileSync(path.join(LOCATOR_DIR, f), 'utf8'));
  }
  return out;
}

export class Context {
  vars: Record<string, string> = {};
  private locators = loadLocators();
  constructor(public page: Page) {}

  /** Replace ${var} using stored variables. Unknown vars throw. */
  interpolate<T>(value: T): T {
    if (typeof value === 'string') {
      return value.replace(/\$\{(\w+)\}/g, (_, name) => {
        if (!(name in this.vars)) throw new Error(`Variable '\${${name}}' is not defined. Known: ${Object.keys(this.vars).join(', ') || '(none)'}`);
        return this.vars[name];
      }) as unknown as T;
    }
    return value;
  }

  /** Resolve 'page.name' via locators/*.json; anything else is treated as a raw selector. */
  selector(target: string) {
    const m = /^(\w+)\.(\w+)$/.exec(target);
    if (m && this.locators[m[1]]) {
      const sel = this.locators[m[1]][m[2]];
      if (!sel) throw new Error(`Locator '${target}' not found. Available in ${m[1]}: ${Object.keys(this.locators[m[1]]).join(', ')}`);
      return sel;
    }
    return target;
  }

  locator(target: string) {
    return this.page.locator(this.selector(target));
  }
}
