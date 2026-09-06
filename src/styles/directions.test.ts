import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const css = readFileSync(path.resolve('src/styles/directions.css'), 'utf8');
const DIRECTIONS = ['a', 'b', 'c'] as const;
type Direction = (typeof DIRECTIONS)[number];

function block(direction: Direction): string {
  const match = css.match(new RegExp(`^\\[data-direction='${direction}'\\]\\s*\\{([^}]*)\\}`, 'm'));
  if (!match) throw new Error(`no [data-direction='${direction}'] block`);
  return match[1] as string;
}

function token(direction: Direction, name: string): string {
  const match = block(direction).match(new RegExp(`--app-${name}:\\s*([^;]+);`));
  if (!match) throw new Error(`--app-${name} missing in direction ${direction}`);
  return (match[1] as string).trim();
}

describe('directions.css (brief §10: distinct = accent differs AND depth or type differs)', () => {
  const pairs: Array<[Direction, Direction]> = [
    ['a', 'b'],
    ['a', 'c'],
    ['b', 'c'],
  ];
  it.each(pairs)('%s and %s are distinct', (x, y) => {
    expect(token(x, 'accent-solid')).not.toBe(token(y, 'accent-solid'));
    const depthOrTypeDiffers =
      token(x, 'elevation-active') !== token(y, 'elevation-active') ||
      token(x, 'font-family-readout') !== token(y, 'font-family-readout') ||
      token(x, 'font-family-title') !== token(y, 'font-family-title');
    expect(depthOrTypeDiffers).toBe(true);
  });
  it.each(DIRECTIONS)('%s keeps chrome on a grey scale (brief §9 row 4)', (d) => {
    const chrome = block(d).match(/--app-(bg|border)-[a-z-]+:\s*([^;]+);/g) ?? [];
    expect(chrome.length).toBeGreaterThan(0);
    for (const line of chrome) expect(line).toMatch(/var\(--(slate|sand)-\d+\)/);
  });
  it.each(DIRECTIONS)('%s readouts meet brief §9 row 2 size and weight', (d) => {
    expect(parseFloat(token(d, 'font-size-readout'))).toBeGreaterThanOrEqual(13);
    expect(parseInt(token(d, 'font-weight-readout'), 10)).toBeGreaterThanOrEqual(500);
  });
});
