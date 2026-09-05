import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Ratchet: hardcoded Tailwind palette classes in src TSX files may only go down.
 * Plan 004 lowers BASELINE as each component moves onto --app-* tokens.
 * Same count as: grep -rhoE '<PALETTE_CLASS>' src --include=*.tsx | wc -l
 */
const BASELINE = 294;

const PALETTE_CLASS =
  /\b(?:bg|text|border|ring)-(?:white|black|slate|gray|zinc|neutral|blue|red|green|amber|orange|yellow|purple|indigo)(?:-[0-9]{2,3})?\b/g;

function listTsxFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...listTsxFiles(full));
    } else if (full.endsWith('.tsx')) {
      files.push(full);
    }
  }
  return files;
}

describe('hardcoded Tailwind palette classes in src/**/*.tsx', () => {
  it(`do not exceed the ratchet baseline (${BASELINE})`, () => {
    const count = listTsxFiles(path.resolve(process.cwd(), 'src')).reduce(
      (sum, file) => sum + (readFileSync(file, 'utf8').match(PALETTE_CLASS) ?? []).length,
      0,
    );
    expect(count, `palette-class count is ${count}`).toBeLessThanOrEqual(BASELINE);
  });
});
