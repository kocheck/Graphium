/**
 * WCAG 2.1 AA audit (axe-core) on every surface in both themes: 14 scans.
 * Exclusions: `canvas` (Konva graphics) and `[aria-disabled="true"]` (intentional, see
 * docs/features/wcag-audit.md). Do not add exclusions here.
 */
import fs from 'node:fs';

import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';

import { SURFACES, THEMES, gotoSurface } from './helpers/surfaces';
import type { Surface } from './helpers/surfaces';

// Surfaces whose only remaining violations are `color-contrast`. Emptied by plan 006b Step 5.
const CONTRAST_DEFERRED: Surface[] = [];

test.describe('Accessibility audit (WCAG 2.1 AA)', () => {
  for (const surface of SURFACES) {
    for (const theme of THEMES) {
      test(`${surface} ${theme} has no WCAG AA violations`, async ({ page }) => {
        const target = await gotoSurface(page, surface, theme);
        await target.waitForTimeout(250);

        let builder = new AxeBuilder({ page: target })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .exclude('canvas')
          .exclude('[aria-disabled="true"]');
        if (CONTRAST_DEFERRED.includes(surface)) {
          builder = builder.disableRules(['color-contrast']);
        }
        const results = await builder.analyze();

        if (results.violations.length > 0) {
          fs.writeFileSync(
            `accessibility-violations-${surface}-${theme}.json`,
            JSON.stringify(results.violations, null, 2),
          );
        }
        expect(results.violations).toEqual([]);
      });
    }
  }
});
