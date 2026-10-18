#!/usr/bin/env bash
# Pre-flight for plan executors (plans/CONVENTIONS.md §3).
# Usage: bash scripts/preflight.sh NNN     e.g. bash scripts/preflight.sh 001
# Exits 0 only when every check passes; prints one "preflight:" line per failure.
set -u
NNN="${1:-}"
if [ -z "$NNN" ]; then
  echo "usage: bash scripts/preflight.sh NNN"
  exit 2
fi
fail=0
say() { echo "preflight: $*"; }

# 1. The plan file (plans/NNN-*.md; 006a/006b share plans/006-*.md).
PLAN_FILE=$(ls plans/"${NNN}"-*.md 2>/dev/null | head -1)
if [ -z "$PLAN_FILE" ]; then
  BASE="${NNN%%[a-z]*}"
  PLAN_FILE=$(ls plans/"${BASE}"-*.md 2>/dev/null | head -1)
fi
if [ -z "$PLAN_FILE" ]; then
  say "no plan file plans/${NNN}-*.md"
  exit 1
fi

# 2. Every plan in this plan's "Depends on" column of plans/README.md is DONE.
ROW=$(grep -E "^\| *${NNN} *\|" plans/README.md | head -1)
if [ -z "$ROW" ]; then
  say "no row for ${NNN} in plans/README.md"
  fail=1
fi
DEPS=$(echo "$ROW" | awk -F'|' '{print $7}' | tr -d '*' | tr ',' ' ')
for dep in $DEPS; do
  [ "$dep" = "—" ] && continue
  STATUS=$(grep -E "^\| *${dep} *\|" plans/README.md | head -1 | awk -F'|' '{print $(NF-1)}' | sed 's/^ *//;s/ *$//')
  case "$STATUS" in
    DONE*) ;;
    *) say "plan ${dep} is '${STATUS:-missing}', not DONE"; fail=1 ;;
  esac
done

# 3. Every path in the plan's **Requires** line exists.
REQ_LINE=$(grep -m1 -E '\*\*Requires\*\*' "$PLAN_FILE" || true)
for p in $(echo "$REQ_LINE" | grep -oE '`[^`]+`' | tr -d '`'); do
  [ -e "$p" ] || { say "required artefact missing: $p"; fail=1; }
done

# 4. Tooling.
[ -x node_modules/.bin/playwright ] || { say "node_modules/.bin/playwright missing: run npm install"; fail=1; }
BROWSERS="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}"
if ! ls -d "$BROWSERS"/chromium* >/dev/null 2>&1; then
  say "Playwright Chromium missing under ${BROWSERS}: run npx playwright install chromium"
  fail=1
fi
NODE_MAJOR=$(node -v | sed 's/^v//' | cut -d. -f1)
[ "${NODE_MAJOR:-0}" -ge 20 ] || { say "node 20+ required, found $(node -v)"; fail=1; }

# 5. Branch.
BRANCH=$(git branch --show-current)
case "$BRANCH" in
  plan/${NNN}-*) ;;
  *) say "on branch '${BRANCH}', expected plan/${NNN}-<slug>"; fail=1 ;;
esac

[ "$fail" -eq 0 ] || exit 1
say "OK: plan ${NNN} (${PLAN_FILE}) on ${BRANCH}"
exit 0
