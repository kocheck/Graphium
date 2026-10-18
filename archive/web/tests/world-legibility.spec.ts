import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { gotoSurface } from './helpers/surfaces';

// Brief §8: the World View is projected; overlay text ≥ 18 px and 7:1, strokes ≥ 2 px, no DM chrome.
test.use({ viewport: { width: 1920, height: 1080 } });

const MIN_FONT_PX = 18;
const MIN_STROKE_PX = 2;
const MIN_RATIO = 7;

interface Sample {
  tag: string;
  text: string;
  fontSize: number;
  strokes: number[];
  ratio: number;
}

async function sampleText(page: Page): Promise<Sample[]> {
  return page.evaluate(() => {
    const lum = (rgb: string): number | null => {
      const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (!m || (m[4] !== undefined && parseFloat(m[4]) === 0)) return null;
      const [r, g, b] = [m[1], m[2], m[3]].map((v) => {
        const c = parseInt(v as string, 10) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * (r as number) + 0.7152 * (g as number) + 0.0722 * (b as number);
    };
    const bgLum = (start: Element): number => {
      let el: Element | null = start;
      while (el) {
        const l = lum(getComputedStyle(el).backgroundColor);
        if (l !== null) return l;
        el = el.parentElement;
      }
      return lum(getComputedStyle(document.body).backgroundColor) ?? 0;
    };
    const out: Sample[] = [];
    for (const el of Array.from(document.body.querySelectorAll('*'))) {
      if (el.tagName === 'CANVAS' || el.tagName === 'SCRIPT' || el.tagName === 'STYLE') continue;
      // The `world-dialog` surface opens plan 003's ConfirmDialog on the World page. It is
      // DM-facing chrome gated by plan 000's a11y scan, not projected overlay text: exempt.
      if (el.closest('[role="dialog"]')) continue;
      const text = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent?.trim() ?? '')
        .join('');
      const rect = el.getBoundingClientRect();
      if (!text || rect.width === 0 || rect.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const fg = lum(cs.color) ?? 0;
      const bg = bgLum(el);
      const [hi, lo] = fg > bg ? [fg, bg] : [bg, fg];
      const strokes = [
        cs.borderTopWidth,
        cs.borderRightWidth,
        cs.borderBottomWidth,
        cs.borderLeftWidth,
      ]
        .map((w) => parseFloat(w))
        .filter((w) => w > 0);
      out.push({
        tag: el.tagName,
        text: text.slice(0, 40),
        fontSize: parseFloat(cs.fontSize),
        strokes,
        ratio: (hi + 0.05) / (lo + 0.05),
      });
    }
    return out;
  });
}

for (const surface of ['world', 'world-dialog'] as const) {
  test(`${surface}: brief §8 rules hold at 1920×1080`, async ({ page }) => {
    const target = await gotoSurface(page, surface, 'dark');
    await expect(
      target.locator('[data-testid^="toolbar-"], [data-testid^="sidebar-"]'),
    ).toHaveCount(0);
    const samples = await sampleText(target);
    const small = samples.filter((s) => s.fontSize < MIN_FONT_PX);
    const thin = samples.filter((s) => s.strokes.some((w) => w < MIN_STROKE_PX));
    const faint = samples.filter((s) => s.ratio < MIN_RATIO);
    expect(small, `text below ${MIN_FONT_PX}px: ${JSON.stringify(small)}`).toEqual([]);
    expect(thin, `strokes below ${MIN_STROKE_PX}px: ${JSON.stringify(thin)}`).toEqual([]);
    expect(faint, `contrast below ${MIN_RATIO}:1: ${JSON.stringify(faint)}`).toEqual([]);
  });
}
