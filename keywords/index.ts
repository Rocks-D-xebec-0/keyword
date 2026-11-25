import { Context, Step } from '../engine/context';
import { ui } from './ui';
import { assertions } from './assertions';
import { saucedemo } from './saucedemo';

export type KeywordFn = (ctx: Context, step: Step) => Promise<void>;

export const registry: Record<string, KeywordFn> = {
  ...ui,
  ...assertions,
  ...saucedemo,
};
