// Plan 005. Prints the per-component update counts of a profile dump. Extra arguments are
// component ids: `+Id` must have a count >= 1, `Id` must have a count of 0. Exits 1 otherwise.
// Usage: node scripts/perf-counts.mjs docs/planning/perf/<scenario>-<tag>.json [+Id ...] [Id ...]
import { readFileSync } from 'node:fs';

const [file, ...ids] = process.argv.slice(2);
if (!file) {
  console.error('usage: node scripts/perf-counts.mjs <dump.json> [+Id ...] [Id ...]');
  process.exit(2);
}
const counts = JSON.parse(readFileSync(file, 'utf8')).updateCounts ?? {};
console.log(JSON.stringify(counts));
const mustBePositive = ids.filter((id) => id.startsWith('+')).map((id) => id.slice(1));
const mustBeZero = ids.filter((id) => !id.startsWith('+'));
const missing = mustBePositive.filter((id) => (counts[id] ?? 0) === 0);
const nonZero = mustBeZero.filter((id) => (counts[id] ?? 0) > 0);
if (missing.length > 0) {
  console.log(`expected >= 1 but got 0: ${missing.join(', ')}`);
}
if (nonZero.length > 0) {
  console.log(`expected 0 but got more: ${nonZero.join(', ')}`);
}
process.exit(missing.length + nonZero.length > 0 ? 1 : 0);
