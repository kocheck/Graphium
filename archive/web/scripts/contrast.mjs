#!/usr/bin/env node
// scripts/contrast.mjs — WCAG 2.1 contrast for --app-* token pairs (plan 006a Step 2b).
// Usage: node scripts/contrast.mjs [--direction a|b|c] [--write]
//   --direction  also apply src/styles/directions.css blocks for that direction
//   --write      regenerate the table in docs/features/wcag-audit.md between the markers
// Exit 1 when any pair without a "deferred" key is below its "min" ratio or cannot be resolved.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const THEME = 'src/styles/theme.css';
const DIRECTIONS = 'src/styles/directions.css';
const PAIRS = 'scripts/contrast-pairs.json';
const AUDIT = 'docs/features/wcag-audit.md';
const RADIX = 'node_modules/@radix-ui/colors';
const START = '<!-- contrast:start -->';
const END = '<!-- contrast:end -->';

const args = process.argv.slice(2);
const dirIdx = args.indexOf('--direction');
const direction = dirIdx === -1 ? null : args[dirIdx + 1];
const write = args.includes('--write');

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** Top-level `selector { body }` blocks; every @-rule (imports, media, supports) is skipped. */
function blocks(css) {
  const out = [];
  let i = 0;
  for (;;) {
    const open = css.indexOf('{', i);
    if (open === -1) return out;
    const selector = css.slice(i, open).trim().split(';').pop().trim();
    let depth = 1;
    let j = open + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth += 1;
      if (css[j] === '}') depth -= 1;
      j += 1;
    }
    if (!selector.startsWith('@')) out.push({ selector, body: css.slice(open + 1, j - 1) });
    i = j;
  }
}

function apply(body, maps) {
  for (const m of body.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    for (const map of maps) map[m[1]] = m[2].trim();
  }
}

const isDark = (selector) => /dark/.test(selector);
const mentionsDirection = (selector) => /data-direction/.test(selector);
const hasDirection = (selector, d) => new RegExp(`data-direction=['"]${d}['"]`).test(selector);

function loadRadix(css, light, dark) {
  for (const m of css.matchAll(/@import\s+'@radix-ui\/colors\/([a-z-]+)\.css';/g)) {
    const file = path.join(RADIX, `${m[1]}.css`);
    const maps = m[1].includes('-dark') ? [dark] : [light, dark];
    for (const b of blocks(stripComments(readFileSync(file, 'utf8')))) apply(b.body, maps);
  }
}

function loadTheme(css, light, dark, keep) {
  loadRadix(css, light, dark);
  for (const b of blocks(css)) {
    if (!keep(b.selector)) continue;
    apply(b.body, isDark(b.selector) ? [dark] : [light, dark]);
  }
}

const light = {};
const dark = {};
loadTheme(stripComments(readFileSync(THEME, 'utf8')), light, dark, (s) => !mentionsDirection(s));
if (direction) {
  if (!existsSync(DIRECTIONS)) {
    console.error(`--direction ${direction} given but ${DIRECTIONS} does not exist`);
    process.exit(1);
  }
  const css = stripComments(readFileSync(DIRECTIONS, 'utf8'));
  loadTheme(css, light, dark, (s) => !mentionsDirection(s) || hasDirection(s, direction));
}

function resolve(value, map, depth = 0) {
  if (value === undefined || depth > 25) return null;
  const v = value.trim();
  const ref = v.match(/^var\(--([a-z0-9-]+)\)$/i);
  if (ref) return resolve(map[ref[1]], map, depth + 1);
  if (v === 'white') return '#ffffff';
  if (v === 'black') return '#000000';
  return /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null;
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(fg, bg) {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

const pairs = JSON.parse(readFileSync(PAIRS, 'utf8'));
const lines = [
  `| Theme | Foreground | Background | fg | bg | Ratio | Min | Result |`,
  `| ----- | ---------- | ---------- | -- | -- | ----- | --- | ------ |`,
];
let failed = false;
for (const theme of ['light', 'dark']) {
  const map = theme === 'light' ? light : dark;
  for (const pair of pairs) {
    const fg = resolve(pair.fg.startsWith('app-') ? `var(--${pair.fg})` : pair.fg, map);
    const bg = resolve(`var(--${pair.bg})`, map);
    let result;
    let r = null;
    if (fg === null || bg === null) {
      result = pair.deferred ? `DEFER (${pair.deferred}, unresolved)` : 'FAIL (unresolved)';
      if (!pair.deferred) failed = true;
    } else {
      r = ratio(fg, bg);
      if (r >= pair.min) result = 'PASS';
      else if (pair.deferred) result = `DEFER (${pair.deferred})`;
      else {
        result = 'FAIL';
        failed = true;
      }
    }
    const shown = r === null ? 'n/a' : `${r.toFixed(2)}:1`;
    lines.push(
      `| ${theme} | \`${pair.fg}\` | \`${pair.bg}\` | ${fg ?? '?'} | ${bg ?? '?'} | ${shown} | ${pair.min}:1 | ${result} |`,
    );
  }
}
for (const theme of ['light', 'dark']) {
  const bg = resolve('var(--app-bg-surface)', theme === 'light' ? light : dark);
  if (bg)
    lines.push(
      `| ${theme} | luminance | \`app-bg-surface\` | ${bg} |  | ${(luminance(bg) * 100).toFixed(1)}% | ≤12% dark | brief §9 row 1 |`,
    );
}
const table = lines.join('\n');
console.log(`Contrast (${direction ? `direction ${direction}` : 'base theme'})\n${table}`);

if (write && !direction) {
  const doc = readFileSync(AUDIT, 'utf8');
  const a = doc.indexOf(START);
  const b = doc.indexOf(END);
  if (a === -1 || b === -1 || b < a) {
    console.error(`${AUDIT} must contain ${START} before ${END}`);
    process.exit(1);
  }
  const generated = `${START}\n\nGenerated by \`npm run contrast -- --write\`; do not edit by hand.\n\n${table}\n\n`;
  writeFileSync(AUDIT, doc.slice(0, a) + generated + doc.slice(b));
}
process.exit(failed ? 1 : 0);
