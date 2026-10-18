import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import config from '../../playwright.config';

const TESTS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// The single permitted skip: plan 005's opt-in profiling spec.
const ALLOWED_SKIP = "test.skip(!process.env.PERF, 'set PERF=1 to profile')";

function listSpecFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listSpecFiles(full));
    } else if (/\.(spec|test)\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe('playwright.config.ts guard', () => {
  it('Web-Chromium ignores only the three structural patterns', () => {
    const web = config.projects?.find((p) => p.name === 'Web-Chromium');
    expect(web).toBeDefined();
    const ignore = web?.testIgnore;
    expect(Array.isArray(ignore) ? ignore.length : -1).toBe(3);
  });

  it('no spec under tests/ is skipped or fixme', () => {
    const offenders: string[] = [];
    for (const file of listSpecFiles(TESTS_DIR)) {
      fs.readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, index) => {
          if (
            /\b(test|describe|testInfo)\.(skip|fixme)\(/.test(line) &&
            !line.includes(ALLOWED_SKIP)
          ) {
            offenders.push(`${path.relative(TESTS_DIR, file)}:${index + 1}`);
          }
        });
    }
    expect(offenders).toEqual([]);
  });
});
