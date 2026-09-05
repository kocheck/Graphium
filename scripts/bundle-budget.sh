#!/usr/bin/env bash
# Plan 005. Compares dist-web's main chunk and its total JS+CSS bytes with bundle-budget.json.
# Usage: bash scripts/bundle-budget.sh          # exit 1 when either number drifts more than 2 %
#        bash scripts/bundle-budget.sh --write  # rewrite bundle-budget.json from dist-web
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -d dist-web/assets ]; then
  echo "bundle-budget: dist-web/assets missing; run npm run build:web first" >&2
  exit 2
fi
MAIN_FILE=$(ls dist-web/assets/index-*.js | head -n 1)
MAIN=$(wc -c < "$MAIN_FILE" | tr -d ' ')
TOTAL=$(find dist-web \( -name '*.js' -o -name '*.css' \) -type f -print0 \
  | xargs -0 wc -c | awk '$2 != "total" { s += $1 } END { print s }')
echo "bundle-budget: main=$MAIN ($MAIN_FILE) total=$TOTAL"
if [ "${1:-}" = "--write" ]; then
  printf '{\n  "main": %s,\n  "total": %s\n}\n' "$MAIN" "$TOTAL" > bundle-budget.json
  echo "bundle-budget: wrote bundle-budget.json"
  exit 0
fi
node - "$MAIN" "$TOTAL" <<'EOF'
const fs = require('node:fs');
const budget = JSON.parse(fs.readFileSync('bundle-budget.json', 'utf8'));
const [main, total] = process.argv.slice(2).map(Number);
const tolerance = Number(process.env.BUNDLE_TOLERANCE ?? '2');
let failed = false;
for (const [name, actual, expected] of [['main', main, budget.main], ['total', total, budget.total]]) {
  const delta = ((actual - expected) / expected) * 100;
  const verdict = Math.abs(delta) > tolerance ? 'FAIL' : 'ok';
  if (verdict === 'FAIL') failed = true;
  console.log(`bundle-budget: ${name}: ${actual} bytes, budget ${expected}, delta ${delta.toFixed(2)}% (${verdict})`);
}
process.exit(failed ? 1 : 0);
EOF
