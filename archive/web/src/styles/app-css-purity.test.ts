import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const APP_CSS_PATH = path.resolve(process.cwd(), 'src/styles/app.css');

/** Colours written as literals instead of `--app-*` tokens (see theme.css header). */
const LITERAL_COLOUR = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|\b(?:white|black)\b/g;

describe('src/styles/app.css', () => {
  it('contains no literal colours; every colour comes from a --app-* token', () => {
    const css = readFileSync(APP_CSS_PATH, 'utf8');
    expect(css.match(LITERAL_COLOUR) ?? []).toEqual([]);
  });
});
