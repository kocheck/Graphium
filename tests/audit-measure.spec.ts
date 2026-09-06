import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { test } from '@playwright/test';

import { gotoSurface } from './helpers/surfaces';

// Plan 006a Step 1. Dumps computed styles and resolved --app-* tokens per surface and theme.
// AUDIT_OUT names the committed dump. Without it (verify:web), write under test-results/
// so plan 000's no-test.skip guard still holds (shots.spec.ts uses the same pattern).
const out = process.env.AUDIT_OUT ?? 'test-results/ui-redesign-audit.json';

const SURFACES = [
  'home',
  'editor',
  'editor-mobile',
  'confirm-dialog',
  'world',
  'world-dialog',
  'design-system',
] as const;
const THEMES = ['light', 'dark'] as const;
const SELECTORS = [
  'body',
  'h1',
  'button',
  'input',
  '.toolbar',
  '.btn-tool',
  '[role="dialog"]',
  '[data-testid="editor-view"]',
  '[data-testid="session-console-panel"]',
  '[data-testid="playground-readout"]',
] as const;
const PROPS = [
  'fontFamily',
  'fontSize',
  'fontWeight',
  'lineHeight',
  'padding',
  'borderRadius',
  'borderWidth',
  'boxShadow',
  'backgroundColor',
  'color',
] as const;

interface SelectorSample {
  selector: string;
  found: boolean;
  styles: Record<string, string>;
}

interface SurfaceSample {
  surface: string;
  theme: string;
  tokens: Record<string, string>;
  selectors: SelectorSample[];
}

const tokenNames = Array.from(
  new Set(readFileSync('src/styles/theme.css', 'utf8').match(/--app-[a-z0-9-]+/g) ?? []),
).sort();

test('audit: measure every surface in both themes', async ({ page }) => {
  test.setTimeout(180_000);
  const samples: SurfaceSample[] = [];
  for (const surface of SURFACES) {
    for (const theme of THEMES) {
      const target = await gotoSurface(page, surface, theme);
      const sample = await target.evaluate(
        ({ names, selectors, props }) => {
          const root = getComputedStyle(document.documentElement);
          const tokens: Record<string, string> = {};
          for (const name of names) tokens[name] = root.getPropertyValue(name).trim();
          const results = selectors.map((selector) => {
            const el = document.querySelector(selector);
            const styles: Record<string, string> = {};
            if (el) {
              const cs = getComputedStyle(el);
              for (const prop of props)
                styles[prop] = cs[prop as keyof CSSStyleDeclaration] as string;
            }
            return { selector, found: el !== null, styles };
          });
          return { tokens, selectors: results };
        },
        { names: tokenNames, selectors: [...SELECTORS], props: [...PROPS] },
      );
      samples.push({ surface, theme, ...sample });
    }
  }
  mkdirSync(path.dirname(out as string), { recursive: true });
  writeFileSync(
    out as string,
    JSON.stringify({ generatedAt: new Date().toISOString(), samples }, null, 2),
  );
});
