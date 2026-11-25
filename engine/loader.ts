import * as fs from 'fs';
import * as path from 'path';
import type { Step } from './context';

export interface Scenario {
  name: string;
  tags?: string[];
  steps: Step[];
  file: string;
}

const DIR = path.resolve(__dirname, '..', 'testdata');

export function loadScenarios(): Scenario[] {
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).sort();
  return files.map((f) => {
    const data = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
    if (!Array.isArray(data.steps)) throw new Error(`${f}: missing 'steps' array`);
    return { name: data.name ?? path.basename(f, '.json'), tags: data.tags ?? [], steps: data.steps, file: f };
  });
}
